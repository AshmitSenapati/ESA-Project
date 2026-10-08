/**
 * SMARTBUS Reusable Telemetry & WebSocket Hook
 * Integrates SmartBusWebSocketService into React lifecycle.
 * Manages authoritative telemetry, events timeline, occupancy chart history,
 * strict prioritization of real ESP32 data over demo data, and automatic reconnects.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BusTelemetry,
  CommandFeedback,
  CommandType,
  DoorState,
  EventType,
  LogEvent,
  TelemetryCommandAckMessage,
  WsConnectionStatus,
} from "./types";
import { SmartBusWebSocketService, telemetrySocketService } from "./websocket-service";

let eventIdCounter = 1000;

export interface UseTelemetrySocketOptions {
  service?: SmartBusWebSocketService;
  initialCapacity?: number;
}

export function useTelemetrySocket(options: UseTelemetrySocketOptions = {}) {
  const service = options.service || telemetrySocketService;

  // Active simulation timer references to stop simulated sequences when real data arrives
  const simTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelActiveSimulations = useCallback(() => {
    for (const t of simTimersRef.current) {
      clearTimeout(t);
    }
    simTimersRef.current = [];
  }, []);

  const addSimTimer = useCallback((t: ReturnType<typeof setTimeout>) => {
    simTimersRef.current.push(t);
  }, []);

  // ── Core Telemetry State ───────────────────────────────────────────────────
  const [telemetry, setTelemetry] = useState<BusTelemetry>({
    deviceId: "smartbus-01",
    timestamp: Date.now(),
    passengerCount: 0,
    entryCount: 0,
    exitCount: 0,
    maxCapacity: options.initialCapacity || 40,
    doorState: "OPEN",
    servoAngle: 90,
    distanceCm: 100.0,
    obstacleThresholdCm: 5.0,
    ir1Active: false,
    ir2Active: false,
    buzzerActive: false,
    ledActive: false,
    esp32Connected: false,
    wsConnected: false,
    wsStatus: "CONNECTING",
    dataSource: "OFFLINE",
    lastHeartbeat: null,
    latencyMs: 12,
    isDemoMode: false,
    serverUrl: service.getUrl(),
  });

  // ── Historical Occupancy Ticks (AreaChart) ─────────────────────────────────
  const [occupancyHistory, setOccupancyHistory] = useState([
    { time: "00:00", passengers: 0, capacity: 40 },
  ]);

  // ── Event Log Stream ───────────────────────────────────────────────────────
  const [events, setEvents] = useState<LogEvent[]>([]);

  // ── Command Lifecycle Feedback (UI state) ──────────────────────────────────
  const [commandFeedback, setCommandFeedback] = useState<CommandFeedback | null>(null);

  // Add event helper (memoized)
  const addEvent = useCallback(
    (
      type: EventType,
      title: string,
      description: string,
      severity: LogEvent["severity"],
      metadata?: LogEvent["metadata"]
    ) => {
      const now = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const newEv: LogEvent = {
        id: `ev-${++eventIdCounter}`,
        type,
        title,
        description,
        timestamp: now,
        severity,
        metadata,
      };

      setEvents((prev) => [newEv, ...prev].slice(0, 50));
    },
    []
  );

  // ── Subscribe to WebSocket Service Events ──────────────────────────────────
  useEffect(() => {
    // 1. Connection status change listener
    const unsubConn = service.onConnectionChange((newStatus: WsConnectionStatus) => {
      setTelemetry((prev) => {
        const isWsConnected = newStatus === "CONNECTED";
        const nextSource = prev.isDemoMode
          ? "DEMO"
          : prev.esp32Connected && isWsConnected
          ? "LIVE"
          : "OFFLINE";

        return {
          ...prev,
          wsStatus: newStatus,
          wsConnected: isWsConnected,
          dataSource: nextSource,
          esp32Connected: isWsConnected ? prev.esp32Connected : false,
        };
      });

      if (newStatus === "CONNECTED") {
        addEvent(
          "SYSTEM_CONNECTED",
          "WebSocket Server Linked",
          `Live channel connected to ${service.getUrl()}`,
          "safe"
        );
      } else if (newStatus === "DISCONNECTED") {
        addEvent(
          "SYSTEM_DISCONNECTED",
          "WebSocket Disconnected",
          "Connection dropped. Auto-reconnecting in background...",
          "warning"
        );
      }
    });

    // 2. Latency measurement listener
    const unsubLatency = service.onLatency((lat) => {
      setTelemetry((prev) => ({ ...prev, latencyMs: lat }));
    });

    // 3. Authoritative status telemetry listener
    const unsubStatus = service.onStatus((data) => {
      const isDeviceOnline = Boolean(data.deviceOnline);

      // Real telemetry takes priority over demo data:
      // If hardware is online, halt any active simulated sequences immediately!
      if (isDeviceOnline) {
        cancelActiveSimulations();
      }

      setTelemetry((prev) => {
        // Compute passenger change to sync entry/exit counts if available
        let newEntries = prev.entryCount;
        let newExits = prev.exitCount;
        if (data.passengerCount !== undefined && data.passengerCount !== prev.passengerCount) {
          if (data.passengerCount > prev.passengerCount) {
            newEntries += data.passengerCount - prev.passengerCount;
          } else {
            newExits += prev.passengerCount - data.passengerCount;
          }
        }

        // Determine effective data source
        const effectiveIsDemo = isDeviceOnline ? false : prev.isDemoMode;
        const effectiveDataSource = isDeviceOnline
          ? "LIVE"
          : effectiveIsDemo
          ? "DEMO"
          : "OFFLINE";

        return {
          ...prev,
          deviceId: data.deviceId || prev.deviceId,
          timestamp: data.timestamp || Date.now(),
          passengerCount:
            data.passengerCount !== undefined ? data.passengerCount : prev.passengerCount,
          entryCount: newEntries,
          exitCount: newExits,
          doorState: (data.doorState as DoorState) || prev.doorState,
          servoAngle:
            typeof data.servoAngle === "number" ? data.servoAngle : prev.servoAngle,
          distanceCm:
            typeof data.distanceCm === "number" ? data.distanceCm : prev.distanceCm,
          ir1Active: typeof data.ir1 === "boolean" ? data.ir1 : prev.ir1Active,
          ir2Active: typeof data.ir2 === "boolean" ? data.ir2 : prev.ir2Active,
          buzzerActive:
            typeof data.buzzer === "boolean" ? data.buzzer : prev.buzzerActive,
          ledActive: typeof data.led === "boolean" ? data.led : prev.ledActive,
          esp32Connected: isDeviceOnline,
          isDemoMode: effectiveIsDemo,
          dataSource: effectiveDataSource,
          lastHeartbeat: new Date().toISOString(),
          lastTelemetryReceivedMs: isDeviceOnline ? Date.now() : prev.lastTelemetryReceivedMs,
        };
      });

      // Append point to occupancy history chart
      if (data.passengerCount !== undefined) {
        const timeStr = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });

        setOccupancyHistory((prev) => [
          ...prev.slice(prev.length > 15 ? 1 : 0),
          {
            time: timeStr,
            passengers: data.passengerCount,
            capacity: telemetry.maxCapacity,
          },
        ]);
      }
    });

    // 4. Safety & Transit Event listener
    const unsubEvent = service.onEvent((data) => {
      const evType = (data.event || data.type) as EventType;
      const isObstacle = evType?.includes("OBSTACLE");
      const isEntry = evType?.includes("ENTRY");
      const isExit = evType?.includes("EXIT");
      const isDisconnect = evType?.includes("DISCONNECTED");
      const isConnect = evType?.includes("CONNECTED");

      // Update hardware connectivity state if system link event
      if (isDisconnect) {
        setTelemetry((prev) => ({
          ...prev,
          esp32Connected: false,
          dataSource: prev.isDemoMode ? "DEMO" : "OFFLINE",
        }));
      } else if (isConnect) {
        setTelemetry((prev) => ({
          ...prev,
          esp32Connected: true,
          dataSource: "LIVE",
          isDemoMode: false,
        }));
      }

      // Add to timeline
      addEvent(
        evType,
        isObstacle
          ? "Obstacle Detected (<5cm)"
          : isEntry
          ? "Passenger Entry (+1)"
          : isExit
          ? "Passenger Exit (-1)"
          : data.message || "Hardware Telemetry Event",
        data.message || `Received ${evType} from ${data.deviceId}`,
        isObstacle
          ? "critical"
          : isDisconnect
          ? "warning"
          : isEntry || isExit || isConnect
          ? "safe"
          : "info",
        {
          distanceCm: data.distanceCm,
          passengerCount: data.passengerCount,
          doorState: data.doorState,
        }
      );
    });

    // 5. Command acknowledgement listener
    const unsubAck = service.onCommandAck((ack: TelemetryCommandAckMessage) => {
      const now = Date.now();
      if (ack.success) {
        setCommandFeedback({
          command: ack.command,
          state: "accepted",
          timestamp: now,
          message: ack.reason || `Command '${ack.command}' accepted by hardware`,
        });
        addEvent(
          "DOOR_OPEN",
          `Command Accepted: ${ack.command}`,
          ack.reason || `ESP32 confirmed execution of '${ack.command}'`,
          "safe"
        );
      } else {
        const isOffline = (ack.reason || "").toLowerCase().includes("offline");
        setCommandFeedback({
          command: ack.command,
          state: isOffline ? "device_offline" : "rejected",
          timestamp: now,
          message: ack.reason || `Command '${ack.command}' rejected`,
        });
        addEvent(
          "OBSTACLE_DETECTED",
          `Command Rejected: ${ack.command}`,
          ack.reason || `Interlock rejected '${ack.command}'`,
          "warning"
        );
      }
    });

    // 6. Connect automatically on mount
    service.connect();

    return () => {
      unsubConn();
      unsubLatency();
      unsubStatus();
      unsubEvent();
      unsubAck();
      cancelActiveSimulations();
    };
  }, [service, addEvent, cancelActiveSimulations, telemetry.maxCapacity]);

  // ── Downlink Command Dispatcher ────────────────────────────────────────────
  const sendCommand = useCallback(
    async (cmd: CommandType, value?: number) => {
      const now = Date.now();

      // If hardware is disconnected and NOT in demo mode, fail immediately
      if (!telemetry.esp32Connected && !telemetry.isDemoMode) {
        setCommandFeedback({
          command: cmd,
          state: "device_offline",
          timestamp: now,
          message: "Device offline: Controls disabled until ESP32 connects or Demo Mode enabled",
        });
        addEvent(
          "SYSTEM_DISCONNECTED",
          `Command Blocked: ${cmd}`,
          "Device offline: commands disabled",
          "warning"
        );
        return false;
      }

      // Handle pure demo mode simulation if ESP32 is offline
      if (telemetry.isDemoMode && !telemetry.esp32Connected) {
        setCommandFeedback({
          command: cmd,
          state: "sent",
          timestamp: now,
          message: `Command sent: ${cmd} (Demo Mode)...`,
        });

        // Simulate turnaround and safety check in Demo Mode
        setTimeout(() => {
          if (cmd === "CLOSE_DOOR" && telemetry.distanceCm < telemetry.obstacleThresholdCm) {
            setCommandFeedback({
              command: cmd,
              state: "rejected",
              timestamp: Date.now(),
              message: `Command rejected: Obstacle detected in doorway (${telemetry.distanceCm.toFixed(1)} cm < ${telemetry.obstacleThresholdCm} cm)`,
            });
            addEvent(
              "OBSTACLE_DETECTED",
              "Command Rejected: CLOSE_DOOR",
              `Cannot close door: Doorway obstructed (< ${telemetry.obstacleThresholdCm} cm)`,
              "warning"
            );
          } else {
            setCommandFeedback({
              command: cmd,
              state: "accepted",
              timestamp: Date.now(),
              message: `Command accepted: ${cmd} (Demo Mode)`,
            });

            if (cmd === "OPEN_DOOR") {
              setTelemetry((prev) => ({ ...prev, doorState: "OPEN", servoAngle: 90 }));
              addEvent("DOOR_OPENED", "Door Commanded Open", "Simulated 90° aperture achieved", "info");
            } else if (cmd === "CLOSE_DOOR") {
              setTelemetry((prev) => ({ ...prev, doorState: "CLOSED", servoAngle: 0 }));
              addEvent("DOOR_CLOSED", "Door Commanded Closed", "Simulated 0° latch achieved", "info");
            } else if (cmd === "RESET_PASSENGER_COUNT" || cmd === "RESET_COUNT") {
              setTelemetry((prev) => ({ ...prev, passengerCount: 0 }));
              addEvent("PASSENGER_ENTRY", "Passenger Count Zeroed", "Counter reset to 0", "info");
            } else if (cmd === "SET_SAFETY_THRESHOLD" && typeof value === "number") {
              setTelemetry((prev) => ({ ...prev, obstacleThresholdCm: value }));
              addEvent("DOOR_OPEN", "Safety Threshold Configured", `Threshold set to ${value.toFixed(1)} cm`, "info");
            } else if (cmd === "TEST_BUZZER") {
              setTelemetry((prev) => ({ ...prev, buzzerActive: true }));
              setTimeout(() => setTelemetry((prev) => ({ ...prev, buzzerActive: false })), 300);
            } else if (cmd === "TEST_LED") {
              setTelemetry((prev) => ({ ...prev, ledActive: true }));
              setTimeout(() => setTelemetry((prev) => ({ ...prev, ledActive: false })), 600);
            }
          }
        }, 300);
        return true;
      }

      // Live ESP32 Dispatch
      setCommandFeedback({
        command: cmd,
        state: "sent",
        timestamp: now,
        message: `Command sent: ${cmd}...`,
      });

      const ok = await service.sendCommand(cmd, value, "dashboard");
      if (ok) {
        addEvent(
          "DOOR_OPEN",
          `Command Sent: ${cmd}`,
          `Downlink command '${cmd}' delivered to server relay`,
          "info"
        );
      } else {
        setCommandFeedback({
          command: cmd,
          state: "rejected",
          timestamp: Date.now(),
          message: `Failed to transmit '${cmd}' to server`,
        });
        addEvent(
          "SYSTEM_DISCONNECTED",
          `Command Failed: ${cmd}`,
          `Could not transmit '${cmd}' to server`,
          "warning"
        );
      }
      return ok;
    },
    [
      service,
      addEvent,
      telemetry.esp32Connected,
      telemetry.isDemoMode,
      telemetry.distanceCm,
      telemetry.obstacleThresholdCm,
    ]
  );

  // ── Demo & Simulation Actions ─────────────────────────────────────────────

  // Toggle Demo Mode explicitly
  const toggleDemoMode = useCallback(() => {
    setTelemetry((prev) => {
      const nextMode = !prev.isDemoMode;
      // If turning demo mode off and ESP32 is not connected, source is OFFLINE
      const nextSource = nextMode
        ? "DEMO"
        : prev.esp32Connected
        ? "LIVE"
        : "OFFLINE";

      addEvent(
        nextMode ? "SYSTEM_CONNECTED" : "SYSTEM_DISCONNECTED",
        nextMode ? "Switched to Demo Simulation Mode" : "Exited Demo Mode",
        nextMode
          ? "Synthetic in-memory test bench active (visual demo only)"
          : prev.esp32Connected
          ? "Streaming live ESP32 hardware values"
          : "Hardware offline. Waiting for ESP32 connection...",
        nextMode ? "info" : prev.esp32Connected ? "safe" : "warning"
      );

      return {
        ...prev,
        isDemoMode: nextMode,
        dataSource: nextSource,
      };
    });
  }, [addEvent]);

  // Simulate Obstacle Hazard (< 5 cm)
  const simulateObstacle = useCallback(() => {
    cancelActiveSimulations();
    const obstacleDist = +(1.8 + Math.random() * 2.2).toFixed(1);

    // Step 1: Detect obstacle
    setTelemetry((prev) => ({
      ...prev,
      distanceCm: obstacleDist,
      doorState: "BLOCKED",
      servoAngle: 15,
      buzzerActive: true,
      ledActive: true,
      dataSource: prev.esp32Connected ? "LIVE" : "DEMO",
    }));

    addEvent(
      "OBSTACLE_DETECTED",
      "Obstacle Collision Warning",
      `Obstacle detected at ${obstacleDist} cm (< ${telemetry.obstacleThresholdCm} cm threshold) • Door closing halted`,
      "critical",
      { distanceCm: obstacleDist }
    );

    // Step 2: Safety Reopening sequence after 1.2s
    const t1 = setTimeout(() => {
      setTelemetry((prev) => ({
        ...prev,
        doorState: "REOPENING",
        servoAngle: 75,
      }));

      addEvent(
        "DOOR_REOPENED",
        "Safety Interlock Reopen Triggered",
        "Door reversing to open position to prevent passenger pinch injury",
        "warning"
      );

      // Step 3: Clearance after 1.5s
      const t2 = setTimeout(() => {
        setTelemetry((prev) => ({
          ...prev,
          distanceCm: +(16 + Math.random() * 15).toFixed(1),
          doorState: "OPEN",
          servoAngle: 90,
          buzzerActive: false,
          ledActive: false,
        }));
      }, 1500);
      addSimTimer(t2);
    }, 1200);
    addSimTimer(t1);
  }, [addEvent, addSimTimer, cancelActiveSimulations, telemetry.obstacleThresholdCm]);

  // Simulate Passenger Entry (IR1 → IR2)
  const simulateEntry = useCallback(() => {
    cancelActiveSimulations();

    // Stage 1: Trip IR1 (outside)
    setTelemetry((prev) => ({
      ...prev,
      ir1Active: true,
      dataSource: prev.esp32Connected ? "LIVE" : "DEMO",
    }));

    const t1 = setTimeout(() => {
      // Stage 2: Trip IR2 (inside) and clear IR1
      setTelemetry((prev) => {
        const newPax = prev.passengerCount + 1;
        const newEntry = prev.entryCount + 1;

        addEvent(
          "PASSENGER_ENTRY",
          "Passenger Entry Recorded (+1)",
          `Sequential breakbeam sequence IR1 → IR2 confirmed • Total onboard: ${newPax}`,
          "safe",
          { passengerCount: newPax }
        );

        const nowTime = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });

        setOccupancyHistory((h) => [
          ...h.slice(h.length > 15 ? 1 : 0),
          { time: nowTime, passengers: newPax, capacity: prev.maxCapacity },
        ]);

        return {
          ...prev,
          ir1Active: false,
          ir2Active: true,
          passengerCount: newPax,
          entryCount: newEntry,
        };
      });

      // Stage 3: Clear IR2
      const t2 = setTimeout(() => {
        setTelemetry((prev) => ({ ...prev, ir2Active: false }));
      }, 600);
      addSimTimer(t2);
    }, 450);
    addSimTimer(t1);
  }, [addEvent, addSimTimer, cancelActiveSimulations]);

  // Simulate Passenger Exit (IR2 → IR1)
  const simulateExit = useCallback(() => {
    cancelActiveSimulations();

    // Stage 1: Trip IR2 (inside)
    setTelemetry((prev) => ({
      ...prev,
      ir2Active: true,
      dataSource: prev.esp32Connected ? "LIVE" : "DEMO",
    }));

    const t1 = setTimeout(() => {
      // Stage 2: Trip IR1 (outside) and clear IR2
      setTelemetry((prev) => {
        const newPax = Math.max(0, prev.passengerCount - 1);
        const newExit = prev.exitCount + 1;

        addEvent(
          "PASSENGER_EXIT",
          "Passenger Exit Recorded (-1)",
          `Sequential breakbeam sequence IR2 → IR1 confirmed • Total onboard: ${newPax}`,
          "safe",
          { passengerCount: newPax }
        );

        const nowTime = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });

        setOccupancyHistory((h) => [
          ...h.slice(h.length > 15 ? 1 : 0),
          { time: nowTime, passengers: newPax, capacity: prev.maxCapacity },
        ]);

        return {
          ...prev,
          ir2Active: false,
          ir1Active: true,
          passengerCount: newPax,
          exitCount: newExit,
        };
      });

      // Stage 3: Clear IR1
      const t2 = setTimeout(() => {
        setTelemetry((prev) => ({ ...prev, ir1Active: false }));
      }, 600);
      addSimTimer(t2);
    }, 450);
    addSimTimer(t1);
  }, [addEvent, addSimTimer, cancelActiveSimulations]);

  // Toggle Door (Open / Close) with command fallback
  const toggleDoor = useCallback(() => {
    if (telemetry.esp32Connected) {
      // If hardware is linked, dispatch real hardware command!
      const nextCmd: CommandType = telemetry.doorState === "OPEN" ? "CLOSE_DOOR" : "OPEN_DOOR";
      sendCommand(nextCmd);
    } else {
      // Simulated toggle
      if (telemetry.doorState === "OPEN") {
        setTelemetry((prev) => ({
          ...prev,
          doorState: "CLOSING",
          servoAngle: 45,
        }));
        addEvent("DOOR_CLOSE", "Door Closing Transit", "SG90 moving to 0°", "info");

        const t = setTimeout(() => {
          setTelemetry((prev) => ({
            ...prev,
            doorState: "CLOSED",
            servoAngle: 0,
          }));
        }, 800);
        addSimTimer(t);
      } else {
        setTelemetry((prev) => ({
          ...prev,
          doorState: "OPEN",
          servoAngle: 90,
        }));
        addEvent("DOOR_OPEN", "Door Commanded Open", "SG90 moving to 90°", "info");
      }
    }
  }, [telemetry.esp32Connected, telemetry.doorState, sendCommand, addEvent, addSimTimer]);

  // Reset Pax Count with command fallback
  const resetCount = useCallback(() => {
    sendCommand("RESET_PASSENGER_COUNT");
  }, [sendCommand]);

  // Threshold update with command downlink
  const updateThreshold = useCallback((threshold: number) => {
    sendCommand("SET_SAFETY_THRESHOLD", threshold);
  }, [sendCommand]);

  // Buzzer diagnostic test pulse
  const testBuzzer = useCallback(() => {
    sendCommand("TEST_BUZZER");
  }, [sendCommand]);

  // LED diagnostic test pulse
  const testLed = useCallback(() => {
    sendCommand("TEST_LED");
  }, [sendCommand]);

  // Capacity update
  const updateCapacity = useCallback((capacity: number) => {
    setTelemetry((prev) => ({ ...prev, maxCapacity: capacity }));
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Reconnect WebSocket manually
  const reconnectWs = useCallback(() => {
    service.reconnect();
  }, [service]);

  return {
    telemetry,
    setTelemetry,
    events,
    addEvent,
    clearEvents,
    occupancyHistory,
    setOccupancyHistory,
    commandFeedback,
    setCommandFeedback,
    sendCommand,
    testBuzzer,
    testLed,
    toggleDemoMode,
    simulateObstacle,
    simulateEntry,
    simulateExit,
    toggleDoor,
    resetCount,
    updateThreshold,
    updateCapacity,
    reconnectWs,
  };
}

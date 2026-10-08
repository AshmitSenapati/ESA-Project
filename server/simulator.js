import { WebSocket } from "ws";

const WS_URL = process.env.SERVER_WS_URL || "ws://localhost:8080/ws/device";
const DEVICE_ID = process.env.DEVICE_ID || "smartbus-01";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS) || 2500;

console.log("=================================================");
console.log("  SMARTBUS Hardware Simulator (ESP32 Emulation)  ");
console.log("  Connecting to:", WS_URL);
console.log("=================================================");

let ws = null;
let state = {
  type: "status",
  timestamp: Date.now(),
  deviceId: DEVICE_ID,
  passengerCount: 8,
  doorState: "OPEN",
  distanceCm: 85.0,
  ir1: false,
  ir2: false,
  servoAngle: 90,
  buzzer: false,
  led: false,
};

let cycleCount = 0;
let simTimer = null;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log(`[SIMULATOR] Connected to server as DEVICE (${DEVICE_ID})`);
    
    // Explicit identify handshake
    ws.send(JSON.stringify({
      type: "identify",
      role: "DEVICE",
      deviceId: DEVICE_ID,
    }));

    // Send initial baseline status
    sendStatus();

    // Start simulation loop
    startSimulationLoop();
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log(`[SIMULATOR] Received message from server:`, msg);

      if (msg.type === "command") {
        handleCommand(msg.command);
      }
    } catch (err) {
      console.error("[SIMULATOR] Error parsing server message:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("[SIMULATOR] Disconnected from server. Reconnecting in 3s...");
    stopSimulationLoop();
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error("[SIMULATOR] WebSocket error:", err.message);
  });
}

function sendStatus() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    state.timestamp = Date.now();
    ws.send(JSON.stringify(state));
    console.log(`[TX:STATUS] Passengers: ${state.passengerCount} | Door: ${state.doorState} | Dist: ${state.distanceCm}cm`);
  }
}

function sendEvent(eventType, message, extra = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const ev = {
      type: "event",
      timestamp: Date.now(),
      deviceId: DEVICE_ID,
      eventType,
      event: eventType,
      message,
      doorState: state.doorState,
      passengerCount: state.passengerCount,
      distanceCm: state.distanceCm,
      buzzer: state.buzzer,
      led: state.led,
      ...extra,
    };
    ws.send(JSON.stringify(ev));
    console.log(`[TX:EVENT] >>> ${eventType} <<< ${message}`);
  }
}

function handleCommand(cmd) {
  console.log(`[SIMULATOR] Executing hardware command: ${cmd}`);
  switch (cmd) {
    case "OPEN_DOOR":
      state.doorState = "OPEN";
      state.servoAngle = 90;
      state.buzzer = false;
      state.led = false;
      sendEvent("DOOR_OPENED", "Bus door opened by dashboard command");
      sendStatus();
      break;

    case "CLOSE_DOOR":
      state.doorState = "CLOSED";
      state.servoAngle = 0;
      state.buzzer = false;
      state.led = false;
      sendEvent("DOOR_CLOSED", "Bus door closed by dashboard command");
      sendStatus();
      break;

    case "RESET_COUNT":
      state.passengerCount = 0;
      sendEvent("SYSTEM_CONNECTED", "Passenger counter reset to 0 by operator");
      sendStatus();
      break;

    default:
      console.warn(`[SIMULATOR] Unknown command received: ${cmd}`);
  }
}

function startSimulationLoop() {
  if (simTimer) clearInterval(simTimer);

  simTimer = setInterval(() => {
    cycleCount++;

    // Scenario 1: Passenger boards (every ~10s)
    if (cycleCount % 4 === 1) {
      state.ir1 = true;
      setTimeout(() => {
        state.ir1 = false;
        state.ir2 = true;
        state.passengerCount += 1;
        setTimeout(() => {
          state.ir2 = false;
          sendEvent(
            "PASSENGER_ENTRY",
            `Passenger boarded (count: ${state.passengerCount})`
          );
          sendStatus();
        }, 300);
      }, 300);
      return;
    }

    // Scenario 2: Passenger disembarks (every ~15s)
    if (cycleCount % 6 === 3 && state.passengerCount > 0) {
      state.ir2 = true;
      setTimeout(() => {
        state.ir2 = false;
        state.ir1 = true;
        state.passengerCount = Math.max(0, state.passengerCount - 1);
        setTimeout(() => {
          state.ir1 = false;
          sendEvent(
            "PASSENGER_EXIT",
            `Passenger alighted (count: ${state.passengerCount})`
          );
          sendStatus();
        }, 300);
      }, 300);
      return;
    }

    // Scenario 3: Safety Obstacle Detection cycle (every ~25s)
    if (cycleCount % 10 === 7) {
      console.log("[SIMULATOR] Simulating door closing with obstacle violation...");
      state.doorState = "CLOSING";
      state.servoAngle = 35;
      sendStatus();

      setTimeout(() => {
        // Obstacle detected! Distance drops to 3.2 cm (< 5 cm threshold)
        state.distanceCm = 3.2;
        state.doorState = "REOPENING";
        state.servoAngle = 90;
        state.buzzer = true;
        state.led = true;

        sendEvent(
          "OBSTACLE_DETECTED",
          "Obstacle detected at 3.2 cm while closing! Reopening door.",
          { distanceCm: 3.2, doorState: "REOPENING", buzzer: true, led: true }
        );
        sendStatus();

        setTimeout(() => {
          // Obstacle clears
          state.distanceCm = 65.0;
          state.doorState = "OPEN";
          state.buzzer = false;
          state.led = false;
          sendEvent("DOOR_REOPENED", "Door fully reopened; doorway clear.");
          sendStatus();
        }, 2000);
      }, 1000);
      return;
    }

    // Baseline jitter
    state.distanceCm = Number((60 + Math.random() * 25).toFixed(1));
    sendStatus();
  }, INTERVAL_MS);
}

function stopSimulationLoop() {
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
}

// Clean shutdown
process.on("SIGINT", () => {
  console.log("\n[SIMULATOR] Shutting down simulator...");
  stopSimulationLoop();
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

connect();

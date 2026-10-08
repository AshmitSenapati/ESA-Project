/**
 * SMARTBUS Reusable WebSocket Client Service
 * Connects browser dashboards to the Node.js WebSocket backend (ws://localhost:8080/ws/dashboard).
 * Provides automatic reconnect with backoff, connection state notifications,
 * latency measurement, and downlink command dispatching.
 */

import {
  CommandType,
  TelemetryCommandAckMessage,
  TelemetryCommandMessage,
  TelemetryEventMessage,
  TelemetryStatusMessage,
  WsConnectionStatus,
} from "./types";

export type StatusListener = (
  data: TelemetryStatusMessage & { deviceOnline?: boolean; lastSeen?: string | null }
) => void;
export type EventListener = (data: TelemetryEventMessage) => void;
export type CommandListener = (data: TelemetryCommandMessage) => void;
export type CommandAckListener = (data: TelemetryCommandAckMessage) => void;
export type ConnectionListener = (status: WsConnectionStatus) => void;
export type LatencyListener = (latencyMs: number) => void;

export class SmartBusWebSocketService {
  private url: string;
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = "DISCONNECTED";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pingStartTime = 0;
  private reconnectAttempts = 0;
  private isExplicitlyClosed = false;

  // Listeners
  private statusListeners = new Set<StatusListener>();
  private eventListeners = new Set<EventListener>();
  private commandListeners = new Set<CommandListener>();
  private commandAckListeners = new Set<CommandAckListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private latencyListeners = new Set<LatencyListener>();

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else if (typeof window !== "undefined") {
      this.url =
        process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws/dashboard";
    } else {
      this.url = "ws://localhost:8080/ws/dashboard";
    }
  }

  public getUrl(): string {
    return this.url;
  }

  public setUrl(newUrl: string): void {
    if (this.url === newUrl) return;
    this.url = newUrl;
    if (this.status !== "DISCONNECTED") {
      this.reconnect();
    }
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  /** Subscribe to base status updates */
  public onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  /** Subscribe to safety & passenger transit events */
  public onEvent(cb: EventListener): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  /** Subscribe to downlink command echoes */
  public onCommand(cb: CommandListener): () => void {
    this.commandListeners.add(cb);
    return () => this.commandListeners.delete(cb);
  }

  /** Subscribe to downlink command acknowledgements (accepted / rejected / offline) */
  public onCommandAck(cb: CommandAckListener): () => void {
    this.commandAckListeners.add(cb);
    return () => this.commandAckListeners.delete(cb);
  }

  /** Subscribe to connection lifecycle updates (CONNECTING, CONNECTED, DISCONNECTED) */
  public onConnectionChange(cb: ConnectionListener): () => void {
    this.connectionListeners.add(cb);
    cb(this.status);
    return () => this.connectionListeners.delete(cb);
  }

  /** Subscribe to latency measurements (ms) */
  public onLatency(cb: LatencyListener): () => void {
    this.latencyListeners.add(cb);
    return () => this.latencyListeners.delete(cb);
  }

  private setConnectionStatus(newStatus: WsConnectionStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    for (const listener of this.connectionListeners) {
      try {
        listener(newStatus);
      } catch (err) {
        console.error("[WS-SERVICE] Error in connection listener:", err);
      }
    }
  }

  /** Initialize or trigger connection */
  public connect(): void {
    if (typeof window === "undefined") return; // SSR safe
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.clearTimers();
    this.setConnectionStatus("CONNECTING");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionStatus("CONNECTED");
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.handleClose();
      };

      this.ws.onerror = (err) => {
        console.warn("[WS-SERVICE] Socket error occurred:", err);
        // onclose will trigger next and schedule reconnect
      };
    } catch (err) {
      console.error("[WS-SERVICE] Connection creation exception:", err);
      this.handleClose();
    }
  }

  /** Parse and dispatch incoming server payloads */
  private handleMessage(rawData: unknown): void {
    if (typeof rawData !== "string") return;

    try {
      const parsed = JSON.parse(rawData);
      if (!parsed || typeof parsed !== "object") return;

      // Heartbeat Pong
      if (parsed.type === "pong") {
        if (this.pingStartTime > 0) {
          const latency = Math.max(1, Math.round(performance.now() - this.pingStartTime));
          for (const cb of this.latencyListeners) cb(latency);
          this.pingStartTime = 0;
        }
        return;
      }

      // Base status telemetry
      if (parsed.type === "status") {
        for (const cb of this.statusListeners) {
          try {
            cb(parsed);
          } catch (err) {
            console.error("[WS-SERVICE] Error in status listener:", err);
          }
        }
        return;
      }

      // Event message
      if (parsed.type === "event") {
        for (const cb of this.eventListeners) {
          try {
            cb(parsed);
          } catch (err) {
            console.error("[WS-SERVICE] Error in event listener:", err);
          }
        }
        return;
      }

      // Command message
      if (parsed.type === "command") {
        for (const cb of this.commandListeners) {
          try {
            cb(parsed);
          } catch (err) {
            console.error("[WS-SERVICE] Error in command listener:", err);
          }
        }
        return;
      }

      // Command Acknowledgement message
      if (parsed.type === "command_ack") {
        for (const cb of this.commandAckListeners) {
          try {
            cb(parsed);
          } catch (err) {
            console.error("[WS-SERVICE] Error in commandAck listener:", err);
          }
        }
        return;
      }
    } catch {
      // Ignore non-json or malformed frames without crashing
    }
  }

  private handleClose(): void {
    this.ws = null;
    this.stopHeartbeat();
    this.setConnectionStatus("DISCONNECTED");

    if (!this.isExplicitlyClosed) {
      this.scheduleReconnect();
    }
  }

  /** Reconnect with exponential backoff */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;
    // 1s, 2s, 4s, capped at 5s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /** Periodic heartbeat for link liveness & latency */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingStartTime = performance.now();
        try {
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch {}
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
  }

  /** Force immediate reconnection */
  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  /** Clean disconnection */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.setConnectionStatus("DISCONNECTED");
  }

  /** Dispatch command downlink to hardware through the server */
  public async sendCommand(
    command: CommandType,
    value?: number,
    issuer = "dashboard"
  ): Promise<boolean> {
    const payload: TelemetryCommandMessage = {
      type: "command",
      timestamp: Date.now(),
      command,
      ...(value !== undefined ? { value } : {}),
      issuer,
    };

    // 1. Try sending directly over WebSocket if OPEN
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return true;
      } catch (err) {
        console.warn("[WS-SERVICE] Failed to send command over WS:", err);
      }
    }

    // 2. HTTP Fallback to POST /api/command if WS is buffering/disconnected
    try {
      const httpUrl = this.url
        .replace("ws://", "http://")
        .replace("wss://", "https://")
        .replace(/\/ws\/dashboard|\/ws\/device|\/ws/g, "");

      const res = await fetch(`${httpUrl}/api/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, value, issuer }),
      });
      return res.ok;
    } catch (err) {
      console.error("[WS-SERVICE] Failed to dispatch command via HTTP fallback:", err);
      return false;
    }
  }
}

// Global shared service instance
export const telemetrySocketService = new SmartBusWebSocketService();

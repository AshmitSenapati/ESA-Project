/**
 * SMARTBUS Telemetry Protocol Type Definitions
 * Authoritative shared schema for ESP32, Node.js server, and Next.js dashboard.
 * @see docs/TELEMETRY_PROTOCOL.md
 */

// ── Supported Door States ────────────────────────────────────────────────────
export type DoorState =
  | "OPEN"
  | "CLOSED"
  | "CLOSING"
  | "REOPENING"
  | "BLOCKED";

// ── Supported Event Types ────────────────────────────────────────────────────
export type EventType =
  | "PASSENGER_ENTRY"
  | "PASSENGER_EXIT"
  | "OBSTACLE_DETECTED"
  | "DOOR_OPENED"
  | "DOOR_CLOSED"
  | "DOOR_REOPENED"
  | "SYSTEM_CONNECTED"
  | "SYSTEM_DISCONNECTED"
  // Backward-compatible aliases
  | "DOOR_OPEN"
  | "DOOR_CLOSE";

// ── Downlink Command Types ───────────────────────────────────────────────────
export type CommandType =
  | "OPEN_DOOR"
  | "CLOSE_DOOR"
  | "RESET_PASSENGER_COUNT"
  | "SET_SAFETY_THRESHOLD"
  | "TEST_BUZZER"
  | "TEST_LED"
  | "RESET_COUNT";

// ── Base State Message Schema (type: "status") ───────────────────────────────
export interface TelemetryStatusMessage {
  type: "status";
  timestamp: number;
  deviceId: string;
  passengerCount: number;
  doorState: DoorState;
  distanceCm: number;
  ir1: boolean;
  ir2: boolean;
  servoAngle: number;
  buzzer: boolean;
  led: boolean;
}

// ── Event Message Schema (type: "event") ─────────────────────────────────────
export interface TelemetryEventMessage {
  type: "event";
  timestamp: number;
  deviceId: string;
  event: EventType;
  message: string;
  distanceCm?: number;
  passengerCount?: number;
  doorState?: DoorState;
}

// ── Downlink Command Message Schema (type: "command") ────────────────────────
export interface TelemetryCommandMessage {
  type: "command";
  timestamp?: number;
  command: CommandType;
  value?: number;
  issuer?: string;
}

// ── Command Acknowledgement Schema (type: "command_ack") ──────────────────────
export interface TelemetryCommandAckMessage {
  type: "command_ack";
  timestamp?: number;
  command: string;
  success: boolean;
  reason?: string;
}

// ── Command Lifecycle Feedback (UI state) ────────────────────────────────────
export type CommandLifecycleState =
  | "idle"
  | "sending"
  | "sent"
  | "accepted"
  | "rejected"
  | "device_offline";

export interface CommandFeedback {
  command: string;
  state: CommandLifecycleState;
  timestamp: number;
  message: string;
}

// ── Discriminated Union for All Telemetry Messages ───────────────────────────
export type TelemetryMessage =
  | TelemetryStatusMessage
  | TelemetryEventMessage
  | TelemetryCommandMessage
  | TelemetryCommandAckMessage;

// ── WebSocket Connection Lifecycle States ─────────────────────────────────────
export type WsConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED";

// ── Dashboard Data Source Modes ───────────────────────────────────────────────
export type DataSource = "LIVE" | "DEMO" | "OFFLINE";

// ── Dashboard Extended Runtime Telemetry State ───────────────────────────────
export interface BusTelemetry {
  deviceId: string;
  timestamp: number;
  passengerCount: number;
  entryCount: number;
  exitCount: number;
  maxCapacity: number;
  doorState: DoorState;
  servoAngle: number; // 0 to 90 degrees
  distanceCm: number;
  obstacleThresholdCm: number;
  ir1Active: boolean; // Entry sensor
  ir2Active: boolean; // Exit sensor
  buzzerActive: boolean;
  ledActive: boolean;
  esp32Connected: boolean;
  wsConnected: boolean;
  wsStatus: WsConnectionStatus; // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'
  dataSource: DataSource; // 'LIVE' | 'DEMO' | 'OFFLINE'
  lastHeartbeat: string | null;
  latencyMs: number;
  isDemoMode: boolean; // Flag to clearly distinguish simulated demo data from real ESP32 telemetry
  serverUrl?: string;
  lastTelemetryReceivedMs?: number; // Epoch timestamp (ms) when real telemetry was last ingested
}

// ── Dashboard Component Records & Views ──────────────────────────────────────
export interface LogEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  timestamp: string;
  severity: "safe" | "warning" | "critical" | "info";
  metadata?: {
    distanceCm?: number;
    passengerCount?: number;
    doorState?: DoorState;
  };
}

export type HardwareStatus = "ONLINE" | "OFFLINE" | "WARNING";

export interface HardwareItem {
  id: string;
  name: string;
  role: string;
  pin: string;
  status: HardwareStatus;
  statusNote: string;
  voltage: string;
  readout: string;
}

export interface TransitLogEntry {
  id: string;
  time: string;
  event: string;
  direction: "Inbound (+1)" | "Outbound (-1)" | "Reversal" | "Door Transit";
  passengerCount: number;
  isSimulated: boolean;
}

export interface SafetyIncident {
  id: string;
  timestamp: string;
  eventType: string;
  title: string;
  distanceCm: number;
  thresholdCm: number;
  doorState: DoorState;
  servoAngle: number;
  buzzerActive: boolean;
  ledActive: boolean;
  actionTaken: string;
  severity: "CRITICAL" | "WARNING" | "RESOLVED";
  status: "ACTIVE" | "RESOLVED";
  isSimulated: boolean;
}

export type NavigationTab =
  | "live-monitor"
  | "passenger-analytics"
  | "safety-events"
  | "hardware"
  | "hardware-test"
  | "system-architecture"
  | "settings";

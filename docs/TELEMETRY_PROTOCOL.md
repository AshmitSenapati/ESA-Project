# SMARTBUS Unified Telemetry Protocol Specification
**Version:** 1.0.0  
**Status:** Authoritative  
**Target Architecture:** ESP32 Firmware ↔ Node.js Ingestion Server ↔ Next.js Operations Dashboard  

---

## 1. Overview & Architectural Principles

The SMARTBUS system relies on a single authoritative telemetry protocol across all three system tiers:
1. **Edge Tier (ESP32)**: Collects sensor readings, executes the local door safety interlock, formats newline-delimited JSON payloads, and communicates via USB Serial (115200 baud).
2. **Relay & Ingestion Tier (Node.js)**: Reads newline-delimited JSON from USB Serial (`serialport`), validates incoming payloads, manages command downlinks, and broadcasts real-time streams over WebSockets (`ws://localhost:8080/ws/dashboard`).
3. **Control Tier (Next.js Dashboard)**: Subscribes to the WebSocket stream, renders live digital twin animations, computes transit analytics, and issues operator commands.

```
┌─────────────────────────────────┐
│     Next.js / React Client      │
│  (Authoritative TypeScript)     │
└───────────────▲─────────────────┘
                │
          WebSocket (ws)
          /ws/dashboard
                │
┌───────────────▼─────────────────┐
│      Node.js Server (:8080)     │
│   USB Serial Bridge & Relay     │
└───────────────▲─────────────────┘
                │
          USB Serial (115200)
       Newline-delimited JSON
          (COMx / /dev/tty*)
                │
┌───────────────▼─────────────────┐
│      ESP32 Microcontroller      │
│   (Authoritative C++ Struct)    │
└─────────────────────────────────┘
```

---

## 2. Base State Message (`type: "status"`)

The base state message is transmitted periodically by the ESP32 (every 200 ms) and broadcast by the Node.js server to all connected dashboard WebSocket clients.

### 2.1 JSON Schema
```json
{
  "type": "status",
  "timestamp": 0,
  "deviceId": "smartbus-01",
  "passengerCount": 0,
  "doorState": "OPEN",
  "distanceCm": 100,
  "ir1": false,
  "ir2": false,
  "servoAngle": 90,
  "buzzer": false,
  "led": false
}
```

### 2.2 Field Definitions & Constraints

| Field | Type | Description | Allowed Range / Constraints |
|---|---|---|---|
| `type` | `string` | Message discriminator | Strictly `"status"` |
| `timestamp` | `number` | Time of telemetry capture | Milliseconds (ESP32 `millis()` or UNIX timestamp) |
| `deviceId` | `string` | Unique hardware identifier | e.g. `"smartbus-01"` |
| `passengerCount` | `number` (integer) | Current net passengers onboard | Non-negative integer ($\ge 0$) |
| `doorState` | `string` | Current physical state of doorway | `"OPEN"` \| `"CLOSED"` \| `"CLOSING"` \| `"REOPENING"` \| `"BLOCKED"` |
| `distanceCm` | `number` (float) | Current HC-SR04 sonar distance | Millimeters to centimeters ($0.0 - 999.0\text{ cm}$) |
| `ir1` | `boolean` | State of IR Sensor 1 (Exterior) | `true` = beam broken; `false` = beam clear |
| `ir2` | `boolean` | State of IR Sensor 2 (Interior) | `true` = beam broken; `false` = beam clear |
| `servoAngle` | `number` (integer) | Current SG90 servo PWM angle | Integer between $0^\circ$ and $180^\circ$ (typically $0^\circ - 90^\circ$) |
| `buzzer` | `boolean` | Active state of Piezo Buzzer (GPIO 23) | `true` = sounding alarm; `false` = silent |
| `led` | `boolean` | Active state of Red Safety LED (GPIO 2) | `true` = flashing alarm; `false` = off |

---

## 3. Supported Door States

The door state machine governs transit clearance and passenger safety. All tiers must recognize and respect these 5 states:

| State | Servo Angle | Description |
|---|---|---|
| `OPEN` | $90^\circ$ | Door leaves fully retracted. Entry/exit permitted. Clear passage. |
| `CLOSED` | $0^\circ$ | Door leaves secured at center sill. Mechanism locked. |
| `CLOSING` | Sweeping $90^\circ \to 0^\circ$ | Door moving toward closed position. Ultrasonic obstacle barrier armed. |
| `REOPENING` | $15^\circ \to 90^\circ$ | Emergency safety reversal underway after obstacle encounter. |
| `BLOCKED` | Fixed $15^\circ$ (Clearance) | Safety interlock active. Closing halted due to object $< 5.0\text{ cm}$. Buzzer & Red LED active. |

---

## 4. Supported Event Messages (`type: "event"`)

Discrete occurrences (sensor trips, safety interlocks, network changes) are emitted as immediate event messages.

### 4.1 JSON Schema
```json
{
  "type": "event",
  "timestamp": 1728412800000,
  "deviceId": "smartbus-01",
  "event": "OBSTACLE_DETECTED",
  "message": "Obstacle detected at 3.4 cm (< 5.0 cm threshold)",
  "distanceCm": 3.4,
  "passengerCount": 24,
  "doorState": "REOPENING"
}
```

### 4.2 Supported Event Types

| Event Identifier | Severity | Trigger Condition |
|---|---|---|
| `PASSENGER_ENTRY` | `safe` | Sequential breakbeam order: $\text{IR1} \to \text{IR2}$ completed. Passenger count increments $+1$. |
| `PASSENGER_EXIT` | `safe` | Sequential breakbeam order: $\text{IR2} \to \text{IR1}$ completed. Passenger count decrements $-1$. |
| `OBSTACLE_DETECTED` | `critical` | HC-SR04 measures distance $< 5.0\text{ cm}$ while door is closing or open. |
| `DOOR_OPENED` | `info` | Door actuator reaches full $90^\circ$ aperture. |
| `DOOR_CLOSED` | `info` | Door actuator reaches $0^\circ$ locked position. |
| `DOOR_REOPENED` | `warning` | Automatic safety reversal completes to clear obstacle. |
| `SYSTEM_CONNECTED` | `safe` | Hardware established connection to server/network. |
| `SYSTEM_DISCONNECTED` | `critical` | Network or heartbeat loss detected ($> 10\text{ s}$ silence). |

---

## 5. Downlink Command Messages (`type: "command"`)

Dispatched from the dashboard to command the edge controller via Node.js relay.

### 5.1 JSON Schemas

**Standard Command:**
```json
{
  "type": "command",
  "command": "OPEN_DOOR"
}
```

**Threshold Configuration Command:**
```json
{
  "type": "command",
  "command": "SET_SAFETY_THRESHOLD",
  "value": 5.0
}
```

### 5.2 Supported Command Actions

| Command | Arguments | Action on ESP32 | Safety Rule |
|---|---|---|---|
| `OPEN_DOOR` | None | Rotate SG90 servo to $90^\circ$, set state to `OPEN`, emit `DOOR_OPENED`. | Always permitted. |
| `CLOSE_DOOR` | None | If obstacle clear ($\ge \text{threshold}$), rotate servo to $0^\circ$, set state to `CLOSED`, emit `DOOR_CLOSED`. | **SAFETY INTERLOCK**: If obstacle $< \text{threshold}$, command is **REJECTED** immediately. Ultrasonic sampling continues during sweep. |
| `RESET_PASSENGER_COUNT` | None | Reset onboard passenger counter to $0$. Emit `PASSENGER_ENTRY` reset event. *(Alias `RESET_COUNT` also supported).* | Permitted at any time. |
| `SET_SAFETY_THRESHOLD` | `value` ($2.0 - 50.0\text{ cm}$) | Update runtime collision threshold variable on ESP32. | Range-checked ($2 - 50\text{ cm}$). Default: $5.0\text{ cm}$. |
| `TEST_BUZZER` | None | Trigger a 300 ms non-blocking acoustic test chirp on GPIO 23. | Diagnostic only; does not override active collision alarms. |
| `TEST_LED` | None | Trigger a 600 ms non-blocking visual test strobe on GPIO 2. | Diagnostic only; does not override active collision alarms. |

---

## 6. Command Acknowledgements (`type: "command_ack"`)

To provide deterministic two-way confirmation, the ESP32 (or Node.js server if edge device is offline) transmits an explicit acknowledgement back to all dashboard instances upon processing a command.

### 6.1 JSON Schema
```json
{
  "type": "command_ack",
  "command": "OPEN_DOOR",
  "success": true,
  "reason": "Door aperture opened"
}
```

**Rejection Example (Obstacle Detected):**
```json
{
  "type": "command_ack",
  "command": "CLOSE_DOOR",
  "success": false,
  "reason": "Obstacle detected in doorway (< 5.0 cm)"
}
```

**Rejection Example (Device Offline):**
```json
{
  "type": "command_ack",
  "command": "OPEN_DOOR",
  "success": false,
  "reason": "Device offline"
}
```

### 6.2 Command Lifecycle States in UI
1. **Command Sent**: Dashboard dispatched payload over WebSocket to Node.js server.
2. **Command Accepted**: Hardware (ESP32) validated and executed command (`success: true`).
3. **Command Rejected**: Interlock rejected command (`success: false`, e.g. obstacle detected).
4. **Device Offline**: Server or frontend reports device disconnected; controls disabled.

---

## 7. TypeScript Reference Definitions

Shared interface definitions implemented in `frontend/lib/types.ts`:

```typescript
export type DoorState = "OPEN" | "CLOSED" | "CLOSING" | "REOPENING" | "BLOCKED";

export type EventType =
  | "PASSENGER_ENTRY"
  | "PASSENGER_EXIT"
  | "OBSTACLE_DETECTED"
  | "DOOR_OPENED"
  | "DOOR_CLOSED"
  | "DOOR_REOPENED"
  | "SYSTEM_CONNECTED"
  | "SYSTEM_DISCONNECTED"
  | "DOOR_OPEN"
  | "DOOR_CLOSE";

export type CommandType =
  | "OPEN_DOOR"
  | "CLOSE_DOOR"
  | "RESET_PASSENGER_COUNT"
  | "SET_SAFETY_THRESHOLD"
  | "TEST_BUZZER"
  | "TEST_LED"
  | "RESET_COUNT";

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

export interface TelemetryCommandMessage {
  type: "command";
  timestamp?: number;
  command: CommandType;
  value?: number;
  issuer?: string;
}

export interface TelemetryCommandAckMessage {
  type: "command_ack";
  command: string;
  success: boolean;
  reason?: string;
}

export type TelemetryMessage =
  | TelemetryStatusMessage
  | TelemetryEventMessage
  | TelemetryCommandMessage
  | TelemetryCommandAckMessage;
```

---

## 8. C++ Reference Structures (ESP32 Firmware)

Implemented in `esp32/smartbus_esp32.ino`:

```cpp
/**
 * @brief Authoritative status telemetry payload
 */
struct TelemetryStatus {
  const char* type = "status";
  unsigned long timestamp;       // millis()
  const char* deviceId = "smartbus-01";
  int passengerCount;            // >= 0
  const char* doorState;         // "OPEN", "CLOSED", "CLOSING", "REOPENING", "BLOCKED"
  float distanceCm;              // Ultrasonic sonar distance
  bool ir1;                      // IR1 state
  bool ir2;                      // IR2 state
  int servoAngle;                // 0 to 90 degrees
  bool buzzer;                   // Piezo active state
  bool led;                      // Red LED active state
};

/**
 * @brief Authoritative discrete event payload
 */
struct TelemetryEvent {
  const char* type = "event";
  unsigned long timestamp;       // millis()
  const char* deviceId = "smartbus-01";
  const char* event;             // PASSENGER_ENTRY, OBSTACLE_DETECTED, etc.
  const char* message;           // Human-readable diagnostic
  float distanceCm;              // Optional distance snapshot
  int passengerCount;            // Optional passenger count snapshot
};

/**
 * @brief Downlink command acknowledgement payload
 */
struct TelemetryCommandAck {
  const char* type = "command_ack";
  const char* command;           // "OPEN_DOOR", "CLOSE_DOOR", etc.
  bool success;                  // true if accepted/executed, false if rejected
  const char* reason;            // Failure or diagnostic explanation
};
```

---

## 9. Node.js Ingestion & Validation Rules

To protect against malformed or corrupted packets, the Node.js server (`server/server.js`) enforces strict non-crashing validation:

1. **Payload Structure Validation**: Rejects non-object payloads or null values with `HTTP 400 Bad Request`.
2. **Door State Whitelist**: Rejects any state string outside of `["OPEN", "CLOSED", "CLOSING", "REOPENING", "BLOCKED"]`.
3. **Range Validation**:
   - `passengerCount`: Must be integer $\ge 0$.
   - `distanceCm`: Must be a finite number.
   - `servoAngle`: Must be a number between $0$ and $180$.
   - `ir1`, `ir2`, `buzzer`, `led`: Must be booleans.
4. **Heartbeat & Fail-Safe Handling**:
   - Heartbeat timer resets on valid `POST /api/telemetry`.
   - After 10 seconds of silence, device is marked `deviceOnline: false` and broadcast to dashboards.
   - All handlers are wrapped in `try / catch` to ensure malformed JSON or unhandled exceptions never terminate the Node.js process.

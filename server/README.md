# SMARTBUS Ingestion & Telemetry Backend

High-performance, fault-tolerant Node.js + Express + `serialport` + `ws` telemetry backend for the SMARTBUS IoT system.

---

## 1. System Architecture

The server bridges physical USB Serial communication from the ESP32 to browser dashboards over WebSockets:

```
┌─────────────────────────────────┐
│     ESP32 Hardware Client       │
│  (USB Serial @ 115200 Baud)     │
└────────────────┬────────────────┘
                 │ USB Cable (COM3 / COM4 / COM5)
                 ▼
┌─────────────────────────────────┐
│     SMARTBUS Node.js Server     │
│   • USB SerialPort bridge       │
│   • In-memory state store       │
│   • Schema & range validator    │
│   • Safe non-crashing parser    │
│   • Command downlink dispatcher │
└────────────────┬────────────────┘
                 │ ws://localhost:8080/ws/dashboard
                 ▼
┌─────────────────────────────────┐
│    Next.js Browser Dashboards   │
│           [DASHBOARD]           │
└─────────────────────────────────┘
```

### Communication Flow:
- **Uplink**: ESP32 emits newline-delimited JSON status telemetry (500 ms) and immediate event frames over USB Serial $\to$ Node.js parses lines $\to$ broadcasts to all dashboard WebSockets.
- **Downlink**: Browser sends commands over WebSocket $\to$ Node.js validates command $\to$ writes newline-delimited JSON over USB Serial $\to$ ESP32 executes command $\to$ returns `command_ack` $\to$ Node.js relays ack to dashboards.

---

## 2. Server Endpoints

### HTTP REST Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health status, server uptime, serial connection state, and client counts |
| `GET` | `/api/status` | Authoritative in-memory telemetry snapshot and device connection state |
| `POST` | `/api/telemetry` | Validated HTTP telemetry ingest fallback |
| `POST` | `/api/event` | Validated HTTP safety and passenger transit events |
| `POST` | `/api/command` | Command dispatch from operator dashboard (`OPEN_DOOR`, `CLOSE_DOOR`, etc.) |
| `GET` | `/api/command` | FIFO polling queue for downlink commands (HTTP fallback) |

### WebSocket Endpoints
| URL | Role | Usage |
|---|---|---|
| `ws://<host>:8080/ws/dashboard` | `DASHBOARD` | Browser UI real-time push subscription |
| `ws://<host>:8080/ws/device` | `DEVICE` | WebSocket device channel (backward compatibility & test mocks) |

---

## 3. Environment Variables

Create `server/.env` based on `server/.env.example`:

| Variable | Default | Description |
|---|---|---|
| `SERIAL_PORT` | `COM5` (or null) | Target COM port on Windows (e.g. `COM3`, `COM4`, `COM5`) or `/dev/tty*` on Unix |
| `BAUD_RATE` | `115200` | Serial transmission baud rate (default: 115200) |
| `PORT` | `8080` | Server listening port |
| `HOST` | `0.0.0.0` | Server host binding |
| `DEVICE_TIMEOUT_MS` | `10000` | Inactivity window before marking device offline |
| `SERIAL_RECONNECT_INTERVAL_MS` | `3000` | Auto-reconnect retry interval when serial port drops |

---

## 4. Startup Instructions

### Install Dependencies
```bash
cd server
npm install
```

### Configure Environment
```bash
copy .env.example .env
```
Edit `server/.env` with your active COM port (check Windows Device Manager $\to$ Ports COM & LPT).

### Start Production Server
```bash
npm start
```

### Start Development Server (Auto-reload on file changes)
```bash
npm run dev
```

### Run Automated Backend Tests
Runs the 56-assertion test suite verifying health, status, validation, serial ingestion resilience, command routing, safety interlocks, and disconnect handling:
```bash
npm test
```

---

## 5. Server Event Logs

The server emits standardized, readable console logs:

- `[SMARTBUS] Server running on http://localhost:8080` — Server initialized.
- `[SMARTBUS] Serial port: COM5` — Configured COM port.
- `[SMARTBUS] Baud rate: 115200` — Configured baud rate.
- `[SMARTBUS] ESP32 serial connection established` — Serial connection active.
- `[SMARTBUS] ESP32 serial connection unavailable: COM5` — Logged when COM port is unavailable; retries in background.
- `[TELEMETRY] Passenger count: 24` — Valid status update received.
- `[EVENT] OBSTACLE_DETECTED` — Ultrasonic collision interlock alert.
- `[DEVICE] ESP32 disconnected` — ESP32 disconnected, notifying all dashboards.
- `[COMMAND] Dispatched command 'OPEN_DOOR' from DASHBOARD to ESP32` — Downlink command forwarded over serial.
- `[COMMAND_ACK] OPEN_DOOR: ACCEPTED` — Confirmation from ESP32 returned and broadcast.

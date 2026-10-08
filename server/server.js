import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { SerialPort, ReadlineParser } from "serialport";

// ── Environment Configuration & .env File Loader ─────────────────────────────
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (key && process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  }
} catch {
  // Ignore env read errors gracefully
}

// ── Configuration Constants ───────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const DEVICE_TIMEOUT_MS = Number(process.env.DEVICE_TIMEOUT_MS) || 10_000;
const SERIAL_PORT = process.env.SERIAL_PORT || null;
const BAUD_RATE = Number(process.env.BAUD_RATE) || 115200;
const SERIAL_RECONNECT_INTERVAL_MS = Number(process.env.SERIAL_RECONNECT_INTERVAL_MS) || 3000;

// ── Express & HTTP Setup ─────────────────────────────────────────────────────
const app = express();
app.use(cors());

// Safely parse JSON HTTP bodies; never crash on malformed payloads
app.use(express.json());
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    console.warn("[HTTP] Rejected malformed JSON HTTP body");
    return res.status(400).json({ ok: false, error: "Malformed JSON payload" });
  }
  next(err);
});

const server = http.createServer(app);

// ── WebSocket Server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

// ── Protocol Constants ───────────────────────────────────────────────────────
const CLIENT_TYPES = {
  DEVICE: "DEVICE",
  DASHBOARD: "DASHBOARD",
};

const ALLOWED_DOOR_STATES = new Set([
  "OPEN",
  "CLOSED",
  "CLOSING",
  "REOPENING",
  "BLOCKED",
]);

const ALLOWED_EVENT_TYPES = new Set([
  "PASSENGER_ENTRY",
  "PASSENGER_EXIT",
  "OBSTACLE_DETECTED",
  "DOOR_OPENED",
  "DOOR_CLOSED",
  "DOOR_REOPENED",
  "SYSTEM_CONNECTED",
  "SYSTEM_DISCONNECTED",
  // Backward-compatible aliases
  "DOOR_OPEN",
  "DOOR_CLOSE",
]);

const ALLOWED_COMMANDS = new Set([
  "OPEN_DOOR",
  "CLOSE_DOOR",
  "RESET_PASSENGER_COUNT",
  "SET_SAFETY_THRESHOLD",
  "TEST_BUZZER",
  "TEST_LED",
  "RESET_COUNT",
]);

// ── Authoritative State Store (In-Memory Only, No Fake Telemetry) ─────────────
let latest = {
  type: "status",
  timestamp: Date.now(),
  deviceId: "smartbus-01",
  passengerCount: 0,
  doorState: "OPEN",
  distanceCm: 100.0,
  ir1: false,
  ir2: false,
  servoAngle: 90,
  buzzer: false,
  led: false,
  deviceOnline: false,
  lastSeen: null,
};

/** Downlink FIFO command queue for offline / polling devices */
let pendingCommands = [];

/** Active client sets */
const deviceClients = new Set();
const dashboardClients = new Set();

/** Heartbeat timeout for devices */
let deviceInactivityTimer = null;

// ── USB Serial Bridge State ──────────────────────────────────────────────────
let serialPortInstance = null;
let serialParserInstance = null;
let isSerialPortOpen = false;
let isSerialConnected = false;
let serialReconnectTimer = null;

function isDeviceOnline() {
  return isSerialConnected || deviceClients.size > 0;
}

function resetDeviceInactivityTimer() {
  if (deviceInactivityTimer) {
    clearTimeout(deviceInactivityTimer);
  }
  deviceInactivityTimer = setTimeout(() => {
    // If no telemetry received within the timeout window, mark device offline
    if (latest.deviceOnline) {
      latest.deviceOnline = false;
      isSerialConnected = false;
      console.log("[DEVICE] ESP32 disconnected (inactivity timeout)");
      broadcastToDashboards({
        type: "status",
        ...latest,
        deviceOnline: false,
      });
    }
  }, DEVICE_TIMEOUT_MS);
}

// ── Safe WebSocket Transmission Helper ───────────────────────────────────────
function safeSend(socket, payload) {
  try {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(typeof payload === "string" ? payload : JSON.stringify(payload));
      return true;
    }
  } catch (err) {
    console.error("[WS] Transmission error:", err.message);
  }
  return false;
}

// ── Broadcast Helpers ─────────────────────────────────────────────────────────
function broadcastToDashboards(payload) {
  const message = typeof payload === "string" ? payload : JSON.stringify(payload);
  for (const client of dashboardClients) {
    if (client.readyState === WebSocket.OPEN) {
      safeSend(client, message);
    }
  }
}

function broadcastToDevices(payload) {
  const message = typeof payload === "string" ? payload : JSON.stringify(payload);
  for (const client of deviceClients) {
    if (client.readyState === WebSocket.OPEN) {
      safeSend(client, message);
    }
  }
}

// ── Validators (docs/TELEMETRY_PROTOCOL.md) ──────────────────────────────────
function validateTelemetryStatus(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Payload must be a JSON object"] };
  }

  if (data.doorState !== undefined && !ALLOWED_DOOR_STATES.has(data.doorState)) {
    errors.push(
      `Invalid doorState: '${data.doorState}'. Allowed: ${[...ALLOWED_DOOR_STATES].join(", ")}`
    );
  }

  if (data.passengerCount !== undefined) {
    if (
      typeof data.passengerCount !== "number" ||
      !Number.isInteger(data.passengerCount) ||
      data.passengerCount < 0
    ) {
      errors.push("passengerCount must be a non-negative integer");
    }
  }

  if (data.distanceCm !== undefined) {
    if (typeof data.distanceCm !== "number" || !Number.isFinite(data.distanceCm)) {
      errors.push("distanceCm must be a finite number");
    }
  }

  if (data.servoAngle !== undefined) {
    if (
      typeof data.servoAngle !== "number" ||
      data.servoAngle < 0 ||
      data.servoAngle > 180
    ) {
      errors.push("servoAngle must be a number between 0 and 180");
    }
  }

  for (const boolField of ["ir1", "ir2", "buzzer", "led"]) {
    if (data[boolField] !== undefined && typeof data[boolField] !== "boolean") {
      errors.push(`${boolField} must be a boolean`);
    }
  }

  if (data.deviceId !== undefined && typeof data.deviceId !== "string") {
    errors.push("deviceId must be a string");
  }

  return { valid: errors.length === 0, errors };
}

function validateTelemetryEvent(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Event payload must be a JSON object"] };
  }

  const evType = data.eventType || data.event;
  if (!evType || typeof evType !== "string") {
    errors.push("Missing required field 'eventType' or 'event' (string)");
  } else if (!ALLOWED_EVENT_TYPES.has(evType)) {
    errors.push(
      `Invalid event type: '${evType}'. Allowed: ${[...ALLOWED_EVENT_TYPES].join(", ")}`
    );
  }

  return { valid: errors.length === 0, errors, eventType: evType };
}

function validateCommand(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Command payload must be a JSON object"] };
  }

  if (!data.command || typeof data.command !== "string") {
    errors.push("Missing required field 'command' (string)");
  } else if (!ALLOWED_COMMANDS.has(data.command)) {
    errors.push(
      `Unknown command: '${data.command}'. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}`
    );
  }

  if (data.command === "SET_SAFETY_THRESHOLD") {
    if (
      data.value === undefined ||
      typeof data.value !== "number" ||
      !Number.isFinite(data.value) ||
      data.value < 1.0 ||
      data.value > 100.0
    ) {
      errors.push(
        "SET_SAFETY_THRESHOLD requires a numeric 'value' between 1.0 and 100.0 cm"
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateCommandAck(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Command ack payload must be a JSON object"] };
  }

  if (!data.command || typeof data.command !== "string") {
    errors.push("Missing required field 'command' (string)");
  }

  if (typeof data.success !== "boolean") {
    errors.push("Missing or invalid required field 'success' (boolean)");
  }

  return { valid: errors.length === 0, errors };
}

// ── State Update Logic ───────────────────────────────────────────────────────
function applyStatusTelemetry(data, source = "WS") {
  const deviceId = data.deviceId || latest.deviceId;
  const now = Date.now();
  const lastSeenIso = new Date().toISOString();

  const wasOffline = !latest.deviceOnline;

  Object.assign(latest, data, {
    type: "status",
    deviceId,
    timestamp: data.timestamp || now,
    deviceOnline: true,
    lastSeen: lastSeenIso,
  });

  if (source === "SERIAL") {
    isSerialConnected = true;
  }

  resetDeviceInactivityTimer();

  // Log authoritative message
  console.log(`[TELEMETRY] Passenger count: ${latest.passengerCount}`);

  // Broadcast connection event if transitioned from offline
  if (wasOffline && source === "SERIAL") {
    broadcastToDashboards({
      type: "event",
      timestamp: now,
      deviceId,
      eventType: "SYSTEM_CONNECTED",
      event: "SYSTEM_CONNECTED",
      message: `ESP32 telemetry linked via USB Serial (${SERIAL_PORT || "COM"} @ ${BAUD_RATE} baud)`,
    });
  }

  // Push to all connected dashboards
  broadcastToDashboards(latest);
}

function applyEventTelemetry(data, source = "WS") {
  const evType = data.eventType || data.event;
  const deviceId = data.deviceId || latest.deviceId;
  const now = Date.now();

  if (source === "SERIAL") {
    isSerialConnected = true;
    latest.deviceOnline = true;
    latest.lastSeen = new Date().toISOString();
  }

  const eventPayload = {
    type: "event",
    timestamp: data.timestamp || now,
    deviceId,
    eventType: evType,
    event: evType,
    message: data.message || `Hardware event: ${evType}`,
    distanceCm: data.distanceCm ?? latest.distanceCm,
    passengerCount: data.passengerCount ?? latest.passengerCount,
    doorState: data.doorState ?? latest.doorState,
    buzzer: data.buzzer ?? latest.buzzer,
    led: data.led ?? latest.led,
  };

  resetDeviceInactivityTimer();

  // Log authoritative message
  console.log(`[EVENT] ${evType}`);

  // Push to all connected dashboards immediately
  broadcastToDashboards(eventPayload);

  return eventPayload;
}

// ── Downlink Command Dispatch to Device (USB Serial / WebSocket) ─────────────
function sendCommandToDevice(cmdPayload) {
  let dispatched = false;

  // 1. Dispatch over USB Serial if port is open
  if ((isSerialPortOpen || isSerialConnected) && serialPortInstance && serialPortInstance.isOpen) {
    try {
      const line = JSON.stringify(cmdPayload) + "\n";
      serialPortInstance.write(line, "utf8", (err) => {
        if (err) {
          console.error(`[SERIAL] Failed to write command to ${SERIAL_PORT}:`, err.message);
        }
      });
      dispatched = true;
    } catch (err) {
      console.error("[SERIAL] Exception dispatching command:", err.message);
    }
  }

  // 2. Dispatch to connected WebSocket device clients (fallback / tests)
  if (deviceClients.size > 0) {
    broadcastToDevices(cmdPayload);
    dispatched = true;
  }

  return dispatched;
}

// ── USB Serial Bridge Implementation ─────────────────────────────────────────
function handleIncomingSerialLine(rawLine) {
  const trimmed = (rawLine || "").toString().trim();
  if (!trimmed) return;

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // If it's a diagnostic or startup message, log it cleanly without crashing
    if (trimmed.startsWith("[") || trimmed.includes("SMARTBUS")) {
      console.log(`[ESP32:LOG] ${trimmed}`);
    } else {
      console.warn("[SERIAL] Non-JSON or malformed line ignored:", trimmed);
    }
    return;
  }

  if (!parsed || typeof parsed !== "object") return;

  // 1. Safety / Transit Event
  if (parsed.type === "event" || parsed.eventType !== undefined || parsed.event !== undefined) {
    const validation = validateTelemetryEvent(parsed);
    if (!validation.valid) {
      console.warn(`[VALIDATION] Rejected invalid serial event: ${validation.errors.join("; ")}`);
      return;
    }
    applyEventTelemetry(parsed, "SERIAL");
    return;
  }

  // 2. Status Telemetry
  if (parsed.type === "status" || parsed.passengerCount !== undefined) {
    const validation = validateTelemetryStatus(parsed);
    if (!validation.valid) {
      console.warn(`[VALIDATION] Rejected invalid serial telemetry: ${validation.errors.join("; ")}`);
      return;
    }
    applyStatusTelemetry(parsed, "SERIAL");
    return;
  }

  // 3. Command Acknowledgement
  if (parsed.type === "command_ack") {
    const validation = validateCommandAck(parsed);
    if (!validation.valid) {
      console.warn(`[VALIDATION] Rejected invalid serial command_ack: ${validation.errors.join("; ")}`);
      return;
    }
    const ackPayload = {
      type: "command_ack",
      timestamp: parsed.timestamp || Date.now(),
      command: parsed.command,
      success: parsed.success,
      reason: parsed.reason,
    };
    console.log(
      `[COMMAND_ACK] ${ackPayload.command}: ${ackPayload.success ? "ACCEPTED" : "REJECTED"}${ackPayload.reason ? ` (${ackPayload.reason})` : ""}`
    );
    broadcastToDashboards(ackPayload);
    return;
  }

  console.warn(`[SERIAL] Unknown message type ignored: '${parsed.type}'`);
}

function handleSerialDisconnect() {
  if (isSerialConnected) {
    isSerialConnected = false;
    latest.deviceOnline = false;
    console.log("[DEVICE] ESP32 disconnected");

    broadcastToDashboards({
      type: "status",
      ...latest,
      deviceOnline: false,
    });

    broadcastToDashboards({
      type: "event",
      timestamp: Date.now(),
      deviceId: latest.deviceId,
      eventType: "SYSTEM_DISCONNECTED",
      event: "SYSTEM_DISCONNECTED",
      message: `ESP32 hardware disconnected from USB Serial (${SERIAL_PORT})`,
    });
  }
}

function scheduleSerialReconnect() {
  if (serialReconnectTimer || !SERIAL_PORT) return;
  serialReconnectTimer = setTimeout(() => {
    serialReconnectTimer = null;
    connectSerial();
  }, SERIAL_RECONNECT_INTERVAL_MS);
}

function connectSerial() {
  if (serialReconnectTimer) {
    clearTimeout(serialReconnectTimer);
    serialReconnectTimer = null;
  }

  if (!SERIAL_PORT) return;

  if (serialPortInstance && serialPortInstance.isOpen) {
    return;
  }

  try {
    serialPortInstance = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: false,
    });

    serialParserInstance = serialPortInstance.pipe(new ReadlineParser({ delimiter: "\n" }));

    serialPortInstance.open((err) => {
      if (err) {
        console.log(`[SMARTBUS] ESP32 serial connection unavailable: ${SERIAL_PORT}`);
        handleSerialDisconnect();
        scheduleSerialReconnect();
        return;
      }

      isSerialPortOpen = true;
      console.log(`[SMARTBUS] ESP32 serial connection established`);
    });

    serialParserInstance.on("data", (line) => {
      handleIncomingSerialLine(line);
    });

    serialPortInstance.on("close", () => {
      console.log(`[SMARTBUS] ESP32 serial connection closed: ${SERIAL_PORT}`);
      handleSerialDisconnect();
      scheduleSerialReconnect();
    });

    serialPortInstance.on("error", (err) => {
      console.warn(`[SMARTBUS] Serial error on ${SERIAL_PORT}:`, err.message);
    });
  } catch (err) {
    console.log(`[SMARTBUS] ESP32 serial connection unavailable: ${SERIAL_PORT}`);
    handleSerialDisconnect();
    scheduleSerialReconnect();
  }
}

function initSerialBridge() {
  if (!SERIAL_PORT) {
    return;
  }
  connectSerial();
}

// ── REST Endpoints ───────────────────────────────────────────────────────────

/** Health endpoint reporting server health, uptime, serial state, and client counts */
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: Date.now(),
    deviceOnline: latest.deviceOnline,
    deviceId: latest.deviceId,
    serial: {
      configuredPort: SERIAL_PORT,
      baudRate: BAUD_RATE,
      connected: isSerialConnected,
    },
    clients: {
      devices: deviceClients.size,
      dashboards: dashboardClients.size,
      total: wss.clients.size,
    },
  });
});

/** Status endpoint returning the latest authoritative snapshot */
app.get("/api/status", (_req, res) => {
  res.json({
    ...latest,
    serialConnected: isSerialConnected,
    clients: {
      devices: deviceClients.size,
      dashboards: dashboardClients.size,
    },
  });
});

/** Telemetry ingest over HTTP (fallback / REST interface) */
app.post("/api/telemetry", (req, res) => {
  try {
    const validation = validateTelemetryStatus(req.body);
    if (!validation.valid) {
      console.warn(`[VALIDATION] Rejected invalid HTTP telemetry: ${validation.errors.join("; ")}`);
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validation.errors,
      });
    }

    applyStatusTelemetry(req.body, "HTTP");
    res.json({ ok: true });
  } catch (err) {
    console.error("[HTTP] /api/telemetry exception:", err.message);
    res.status(500).json({ ok: false, error: "Internal processing error" });
  }
});

/** Safety & transit event ingest over HTTP */
app.post("/api/event", (req, res) => {
  try {
    const validation = validateTelemetryEvent(req.body);
    if (!validation.valid) {
      console.warn(`[VALIDATION] Rejected invalid HTTP event: ${validation.errors.join("; ")}`);
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validation.errors,
      });
    }

    const payload = applyEventTelemetry(req.body, "HTTP");
    res.json({ ok: true, event: payload.eventType });
  } catch (err) {
    console.error("[HTTP] /api/event exception:", err.message);
    res.status(500).json({ ok: false, error: "Internal processing error" });
  }
});

/** Dashboard command dispatch */
app.post("/api/command", (req, res) => {
  try {
    const validation = validateCommand(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validation.errors,
      });
    }

    const { command, value, issuer = "dashboard" } = req.body;
    const connected = isDeviceOnline();

    if (!connected) {
      console.log(`[COMMAND] Rejected command '${command}' from HTTP ${issuer}: Device offline`);
      const offlineAck = {
        type: "command_ack",
        timestamp: Date.now(),
        command,
        success: false,
        reason: "Device offline",
      };
      broadcastToDashboards(offlineAck);
      return res.status(503).json({
        ok: false,
        error: "Device offline",
        command_ack: offlineAck,
      });
    }

    const cmdPayload = {
      type: "command",
      timestamp: Date.now(),
      command,
      ...(value !== undefined ? { value } : {}),
      issuer,
    };

    console.log(`[COMMAND] Dispatched command '${command}' from HTTP ${issuer}`);
    sendCommandToDevice(cmdPayload);
    broadcastToDashboards(cmdPayload);

    res.json({ ok: true, command });
  } catch (err) {
    console.error("[HTTP] /api/command exception:", err.message);
    res.status(500).json({ ok: false, error: "Internal processing error" });
  }
});

/** Device command acknowledgement ingest over HTTP */
app.post("/api/command-ack", (req, res) => {
  try {
    const validation = validateCommandAck(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        details: validation.errors,
      });
    }

    const ackPayload = {
      type: "command_ack",
      timestamp: req.body.timestamp || Date.now(),
      command: req.body.command,
      success: req.body.success,
      reason: req.body.reason,
    };

    console.log(
      `[COMMAND_ACK] ${ackPayload.command}: ${ackPayload.success ? "ACCEPTED" : "REJECTED"}${ackPayload.reason ? ` (${ackPayload.reason})` : ""}`
    );

    broadcastToDashboards(ackPayload);
    res.json({ ok: true });
  } catch (err) {
    console.error("[HTTP] /api/command-ack exception:", err.message);
    res.status(500).json({ ok: false, error: "Internal processing error" });
  }
});

/** ESP32 HTTP command polling */
app.get("/api/command", (_req, res) => {
  const cmd = pendingCommands.shift() ?? null;
  res.json({ command: cmd ? cmd.command : null });
});

// ── WebSocket Architecture: DEVICE vs DASHBOARD ──────────────────────────────
wss.on("connection", (socket, req) => {
  let clientRole = CLIENT_TYPES.DASHBOARD; // Default to DASHBOARD

  try {
    const hostHeader = req.headers.host || `localhost:${PORT}`;
    const parsedUrl = new URL(req.url, `http://${hostHeader}`);
    const pathname = parsedUrl.pathname.toLowerCase();
    const roleQuery = (
      parsedUrl.searchParams.get("role") ||
      parsedUrl.searchParams.get("type") ||
      parsedUrl.searchParams.get("client") ||
      req.headers["x-client-type"] ||
      ""
    ).toLowerCase();

    if (pathname.includes("/device") || roleQuery === "device" || roleQuery === "esp32") {
      clientRole = CLIENT_TYPES.DEVICE;
    } else {
      clientRole = CLIENT_TYPES.DASHBOARD;
    }
  } catch (err) {
    console.warn("[WS] Error parsing connection URL, defaulting to DASHBOARD:", err.message);
  }

  function registerDevice() {
    clientRole = CLIENT_TYPES.DEVICE;
    deviceClients.add(socket);
    dashboardClients.delete(socket);

    latest.deviceOnline = true;
    latest.lastSeen = new Date().toISOString();
    resetDeviceInactivityTimer();

    console.log("[DEVICE] ESP32 connected");

    // Flush any pending commands immediately to this connected device
    while (pendingCommands.length > 0) {
      const pending = pendingCommands.shift();
      safeSend(socket, pending);
    }

    // Inform all dashboards that device is now ONLINE
    broadcastToDashboards({
      type: "status",
      ...latest,
      deviceOnline: true,
    });
  }

  function registerDashboard() {
    clientRole = CLIENT_TYPES.DASHBOARD;
    dashboardClients.add(socket);
    deviceClients.delete(socket);

    console.log(`[DASHBOARD] Dashboard connected (active: ${dashboardClients.size})`);

    // Send immediate snapshot upon dashboard connection
    safeSend(socket, {
      type: "status",
      ...latest,
      deviceOnline: isDeviceOnline() || latest.deviceOnline,
    });
  }

  if (clientRole === CLIENT_TYPES.DEVICE) {
    registerDevice();
  } else {
    registerDashboard();
  }

  // Handle incoming messages safely (Never crash on malformed payloads)
  socket.on("message", (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      console.warn(`[WS] Malformed JSON received from ${clientRole}`);
      safeSend(socket, {
        type: "error",
        error: "Malformed JSON payload",
      });
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      safeSend(socket, {
        type: "error",
        error: "Message must be a JSON object",
      });
      return;
    }

    // Handshake / role identification
    if (parsed.type === "identify") {
      const declaredRole = (parsed.role || "").toUpperCase();
      if (declaredRole === CLIENT_TYPES.DEVICE) {
        registerDevice();
      } else if (declaredRole === CLIENT_TYPES.DASHBOARD) {
        registerDashboard();
      }
      return;
    }

    // Ping / Pong heartbeat
    if (parsed.type === "ping") {
      safeSend(socket, { type: "pong", timestamp: Date.now() });
      return;
    }

    // 1. Safety / Transit Event
    if (parsed.type === "event" || parsed.eventType !== undefined || parsed.event !== undefined) {
      const validation = validateTelemetryEvent(parsed);
      if (!validation.valid) {
        console.warn(`[VALIDATION] Rejected invalid event from ${clientRole}: ${validation.errors.join("; ")}`);
        safeSend(socket, {
          type: "error",
          error: "Validation failed",
          details: validation.errors,
        });
        return;
      }

      applyEventTelemetry(parsed, `WS:${clientRole}`);
      return;
    }

    // 2. Status Telemetry
    if (parsed.type === "status" || (clientRole === CLIENT_TYPES.DEVICE && parsed.passengerCount !== undefined)) {
      const validation = validateTelemetryStatus(parsed);
      if (!validation.valid) {
        console.warn(`[VALIDATION] Rejected invalid telemetry from ${clientRole}: ${validation.errors.join("; ")}`);
        safeSend(socket, {
          type: "error",
          error: "Validation failed",
          details: validation.errors,
        });
        return;
      }

      applyStatusTelemetry(parsed, `WS:${clientRole}`);
      return;
    }

    // 3. Command Message
    if (parsed.type === "command") {
      const validation = validateCommand(parsed);
      if (!validation.valid) {
        console.warn(`[VALIDATION] Rejected invalid command from ${clientRole}: ${validation.errors.join("; ")}`);
        safeSend(socket, {
          type: "command_ack",
          command: parsed.command || "UNKNOWN",
          success: false,
          reason: `Validation failed: ${validation.errors.join("; ")}`,
        });
        return;
      }

      const connected = isDeviceOnline();
      if (!connected) {
        console.log(`[COMMAND] Rejected command '${parsed.command}' from ${clientRole}: Device offline`);
        safeSend(socket, {
          type: "command_ack",
          timestamp: Date.now(),
          command: parsed.command,
          success: false,
          reason: "Device offline",
        });
        return;
      }

      const cmdPayload = {
        type: "command",
        timestamp: Date.now(),
        command: parsed.command,
        ...(parsed.value !== undefined ? { value: parsed.value } : {}),
        issuer: parsed.issuer || clientRole.toLowerCase(),
      };

      console.log(`[COMMAND] Dispatched command '${parsed.command}' from ${clientRole} to ESP32`);
      sendCommandToDevice(cmdPayload);
      broadcastToDashboards(cmdPayload);
      return;
    }

    // 4. Command Acknowledgement (Device -> Dashboards)
    if (parsed.type === "command_ack") {
      const validation = validateCommandAck(parsed);
      if (!validation.valid) {
        console.warn(`[VALIDATION] Rejected invalid command_ack from ${clientRole}: ${validation.errors.join("; ")}`);
        return;
      }

      const ackPayload = {
        type: "command_ack",
        timestamp: parsed.timestamp || Date.now(),
        command: parsed.command,
        success: parsed.success,
        reason: parsed.reason,
      };

      console.log(
        `[COMMAND_ACK] ${ackPayload.command}: ${ackPayload.success ? "ACCEPTED" : "REJECTED"}${ackPayload.reason ? ` (${ackPayload.reason})` : ""}`
      );

      broadcastToDashboards(ackPayload);
      return;
    }

    // Unknown message type
    safeSend(socket, {
      type: "error",
      error: `Unknown message type: '${parsed.type}'`,
    });
  });

  // Handle Disconnections
  function handleDisconnect() {
    if (deviceClients.has(socket)) {
      deviceClients.delete(socket);
      console.log("[DEVICE] ESP32 disconnected");

      if (!isDeviceOnline()) {
        latest.deviceOnline = false;
        broadcastToDashboards({
          type: "status",
          ...latest,
          deviceOnline: false,
        });
        broadcastToDashboards({
          type: "event",
          timestamp: Date.now(),
          deviceId: latest.deviceId,
          eventType: "SYSTEM_DISCONNECTED",
          event: "SYSTEM_DISCONNECTED",
          message: "ESP32 disconnected",
        });
      }
    }

    if (dashboardClients.has(socket)) {
      dashboardClients.delete(socket);
      console.log(`[DASHBOARD] Dashboard disconnected (active: ${dashboardClients.size})`);
    }
  }

  socket.on("close", handleDisconnect);
  socket.on("error", (err) => {
    console.warn(`[WS] Socket error (${clientRole}):`, err.message);
    handleDisconnect();
  });
});

// ── Global Error Traps (Server Must Never Crash) ─────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[CRITICAL] Uncaught exception trapped:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[CRITICAL] Unhandled promise rejection trapped:", reason);
});

// ── Server Start ─────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  const serverUrl = `http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`;
  console.log(`[SMARTBUS] Server running on ${serverUrl}`);
  console.log(`[SMARTBUS] Serial port: ${SERIAL_PORT || "None configured (set SERIAL_PORT env)"}`);
  console.log(`[SMARTBUS] Baud rate: ${BAUD_RATE}`);
  console.log(`  Protocol: Telemetry Protocol v1.0.0 (docs/TELEMETRY_PROTOCOL.md)`);
  console.log(`  Clients Supported:`);
  console.log(`    DEVICE    → USB Serial @ ${BAUD_RATE} baud & ws://localhost:${PORT}/ws/device`);
  console.log(`    DASHBOARD → ws://localhost:${PORT}/ws/dashboard (Browser UI)`);
  console.log(`  REST Routes:`);
  console.log(`    GET  /api/health      (Server health & active client counts)`);
  console.log(`    GET  /api/status      (Current status snapshot)`);
  console.log(`    POST /api/telemetry   (Validated ESP32 telemetry ingest)`);
  console.log(`    POST /api/event       (Validated safety events)`);
  console.log(`    POST /api/command     (Downlink command dispatch)`);
  console.log(`    GET  /api/command     (FIFO command polling)`);

  initSerialBridge();
});

export {
  app,
  server,
  latest,
  isDeviceOnline,
  handleIncomingSerialLine,
  validateTelemetryStatus,
  validateTelemetryEvent,
  validateCommand,
  validateCommandAck,
};

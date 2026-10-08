import http from "http";
import { WebSocket } from "ws";

// Set a dedicated port for testing to avoid conflicts
const TEST_PORT = 8089;
process.env.PORT = String(TEST_PORT);
process.env.DEVICE_TIMEOUT_MS = "5000";

console.log("=== Starting SMARTBUS Node.js Backend Test Suite ===");

const { server, latest, validateCommand, validateCommandAck, handleIncomingSerialLine } = await import("./server.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port: TEST_PORT,
      path,
      method,
      headers: {
        ...headers,
      },
    };

    if (body !== null) {
      if (typeof body === "object") {
        body = JSON.stringify(body);
        opts.headers["Content-Type"] = "application/json";
      }
      opts.headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode, data, json, headers: res.headers });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    throw new Error(`Test assertion failed: ${testName}`);
  }
}

async function runTests() {
  try {
    // Wait for server listening
    await sleep(300);

    // ─────────────────────────────────────────────────────────
    console.log("\n[1] Testing GET /api/health");
    const health = await httpRequest("GET", "/api/health");
    assert(health.status === 200, "HTTP 200 returned from /api/health");
    assert(health.json && health.json.status === "healthy", "Status is healthy");
    assert(health.json.deviceOnline === false, "Device initially offline");
    assert(typeof health.json.uptime === "number", "Uptime reported");
    assert(health.json.clients.devices === 0, "Initial device count is 0");
    assert(health.json.clients.dashboards === 0, "Initial dashboard count is 0");

    // ─────────────────────────────────────────────────────────
    console.log("\n[2] Testing GET /api/status");
    const status = await httpRequest("GET", "/api/status");
    assert(status.status === 200, "HTTP 200 returned from /api/status");
    assert(status.json && status.json.type === "status", "Type is status");
    assert(status.json.deviceId === "smartbus-01", "Default deviceId is smartbus-01");
    assert(status.json.doorState === "OPEN", "Initial door state matches");

    // ─────────────────────────────────────────────────────────
    console.log("\n[3] Testing HTTP Malformed JSON & Validation Failure Handling");
    const badJson = await httpRequest(
      "POST",
      "/api/telemetry",
      "{ this is not valid json",
      { "Content-Type": "application/json" }
    );
    assert(badJson.status === 400, "Malformed HTTP JSON rejected with 400");
    assert(badJson.json && badJson.json.ok === false, "Response specifies ok: false");

    const invalidState = await httpRequest("POST", "/api/telemetry", {
      doorState: "EXPLODED",
      passengerCount: -5,
    });
    assert(invalidState.status === 400, "Invalid doorState and negative passengerCount rejected with 400");
    assert(invalidState.json.error === "Validation failed", "Validation failure message returned");

    // ─────────────────────────────────────────────────────────
    console.log("\n[4] Testing Dashboard WebSocket Connection");
    let dashReceivedInitSnapshot = false;
    let dashReceivedDeviceOnline = false;
    let dashReceivedTelemetry = false;
    let dashReceivedEvent = false;
    let dashReceivedOffline = false;
    const dashAcksReceived = [];

    const dashWs = new WebSocket(`ws://localhost:${TEST_PORT}/ws/dashboard`);

    dashWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "status") {
          if (!dashReceivedInitSnapshot) {
            dashReceivedInitSnapshot = true;
          }
          if (msg.deviceOnline === true) {
            dashReceivedDeviceOnline = true;
          }
          if (msg.passengerCount === 24) {
            dashReceivedTelemetry = true;
          }
          if (dashReceivedDeviceOnline && msg.deviceOnline === false) {
            dashReceivedOffline = true;
          }
        }
        if (msg.type === "event" && msg.eventType === "OBSTACLE_DETECTED") {
          dashReceivedEvent = true;
        }
        if (msg.type === "command_ack") {
          dashAcksReceived.push(msg);
        }
      } catch (err) {
        console.error("Dashboard WS parse error:", err);
      }
    });

    await new Promise((resolve) => dashWs.on("open", resolve));
    await sleep(200);

    assert(dashReceivedInitSnapshot, "Dashboard received immediate status snapshot on connect");

    // Verify health endpoint updated dashboard client count
    const healthAfterDash = await httpRequest("GET", "/api/health");
    assert(healthAfterDash.json.clients.dashboards === 1, "Health reflects 1 dashboard connected");

    // ─────────────────────────────────────────────────────────
    console.log("\n[5] Testing Device (ESP32) WebSocket Connection");
    const deviceWs = new WebSocket(`ws://localhost:${TEST_PORT}/ws/device`);
    let deviceErrorReceived = false;
    const deviceCommandsReceived = [];

    deviceWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "error") {
          deviceErrorReceived = true;
        }
        if (msg.type === "command") {
          deviceCommandsReceived.push(msg);
        }
      } catch {}
    });

    await new Promise((resolve) => deviceWs.on("open", resolve));
    await sleep(200);

    assert(dashReceivedDeviceOnline, "Dashboard notified that device is ONLINE upon connection");

    const healthAfterDevice = await httpRequest("GET", "/api/health");
    assert(healthAfterDevice.json.deviceOnline === true, "Health reports deviceOnline = true");
    assert(healthAfterDevice.json.clients.devices === 1, "Health reflects 1 device connected");

    // ─────────────────────────────────────────────────────────
    console.log("\n[6] Testing Telemetry Transmission & Broadcast");
    deviceWs.send(
      JSON.stringify({
        type: "status",
        passengerCount: 24,
        doorState: "CLOSED",
        distanceCm: 110.5,
        ir1: false,
        ir2: false,
        servoAngle: 0,
        buzzer: false,
        led: false,
      })
    );

    await sleep(300);
    assert(dashReceivedTelemetry, "Dashboard received updated passenger count (24) from ESP32");

    const statusAfterTelemetry = await httpRequest("GET", "/api/status");
    assert(statusAfterTelemetry.json.passengerCount === 24, "State in memory updated to 24 passengers");
    assert(statusAfterTelemetry.json.doorState === "CLOSED", "Door state in memory updated to CLOSED");

    // ─────────────────────────────────────────────────────────
    console.log("\n[7] Testing Event Ingest & Instant Broadcast");
    deviceWs.send(
      JSON.stringify({
        type: "event",
        eventType: "OBSTACLE_DETECTED",
        distanceCm: 3.4,
        doorState: "REOPENING",
        buzzer: true,
        led: true,
        message: "Obstacle detected at 3.4 cm while closing!",
      })
    );

    await sleep(300);
    assert(dashReceivedEvent, "Dashboard received OBSTACLE_DETECTED event immediately");

    // ─────────────────────────────────────────────────────────
    console.log("\n[8] Testing Malformed JSON & Invalid Payload on Device WebSocket");
    deviceWs.send("{{{ Not Valid JSON");
    await sleep(200);
    assert(deviceErrorReceived, "Device received error message for malformed JSON, server did not crash");

    // ─────────────────────────────────────────────────────────
    console.log("\n[9] Testing Command Validators");
    assert(validateCommand({ command: "OPEN_DOOR" }).valid, "validateCommand: OPEN_DOOR valid");
    assert(validateCommand({ command: "CLOSE_DOOR" }).valid, "validateCommand: CLOSE_DOOR valid");
    assert(validateCommand({ command: "RESET_PASSENGER_COUNT" }).valid, "validateCommand: RESET_PASSENGER_COUNT valid");
    assert(validateCommand({ command: "TEST_BUZZER" }).valid, "validateCommand: TEST_BUZZER valid");
    assert(validateCommand({ command: "TEST_LED" }).valid, "validateCommand: TEST_LED valid");
    assert(validateCommand({ command: "SET_SAFETY_THRESHOLD", value: 5.0 }).valid, "validateCommand: SET_SAFETY_THRESHOLD with value 5.0 valid");
    assert(!validateCommand({ command: "SET_SAFETY_THRESHOLD" }).valid, "validateCommand: SET_SAFETY_THRESHOLD without value rejected");
    assert(!validateCommand({ command: "SET_SAFETY_THRESHOLD", value: -2 }).valid, "validateCommand: SET_SAFETY_THRESHOLD with negative value rejected");
    assert(!validateCommand({ command: "BLOW_UP_BUS" }).valid, "validateCommand: unknown command rejected");
    assert(validateCommandAck({ command: "OPEN_DOOR", success: true }).valid, "validateCommandAck: valid ack recognized");
    assert(!validateCommandAck({ command: "OPEN_DOOR" }).valid, "validateCommandAck: missing success rejected");

    // ─────────────────────────────────────────────────────────
    console.log("\n[10] Testing Two-Way Command Dispatch & Device Acknowledgement");
    // Dashboard sends command to open door
    dashWs.send(JSON.stringify({ type: "command", command: "OPEN_DOOR" }));
    await sleep(200);

    const receivedCmd = deviceCommandsReceived.find((c) => c.command === "OPEN_DOOR");
    assert(receivedCmd !== undefined, "Device WebSocket received OPEN_DOOR command from dashboard");

    // Device transmits command_ack back
    deviceWs.send(
      JSON.stringify({
        type: "command_ack",
        command: "OPEN_DOOR",
        success: true,
        reason: "Door aperture opened to 90°",
      })
    );
    await sleep(200);

    const receivedAck = dashAcksReceived.find((a) => a.command === "OPEN_DOOR" && a.success === true);
    assert(receivedAck !== undefined, "Dashboard WebSocket received command_ack for OPEN_DOOR (success: true)");

    // ─────────────────────────────────────────────────────────
    console.log("\n[11] Testing Safety Command Rejection (Interlock Active)");
    // Dashboard sends CLOSE_DOOR command
    dashWs.send(JSON.stringify({ type: "command", command: "CLOSE_DOOR" }));
    await sleep(200);

    const closeCmd = deviceCommandsReceived.find((c) => c.command === "CLOSE_DOOR");
    assert(closeCmd !== undefined, "Device WebSocket received CLOSE_DOOR command");

    // Device simulates obstacle collision interlock rejection
    deviceWs.send(
      JSON.stringify({
        type: "command_ack",
        command: "CLOSE_DOOR",
        success: false,
        reason: "Obstacle detected in doorway (< 5.0 cm)",
      })
    );
    await sleep(200);

    const rejectAck = dashAcksReceived.find((a) => a.command === "CLOSE_DOOR" && a.success === false);
    assert(rejectAck !== undefined, "Dashboard WebSocket received rejected command_ack for CLOSE_DOOR");
    assert(rejectAck.reason.includes("Obstacle"), "Rejection reason specifies obstacle detected");

    // ─────────────────────────────────────────────────────────
    console.log("\n[12] Testing Parameterized Command Dispatch (SET_SAFETY_THRESHOLD)");
    dashWs.send(
      JSON.stringify({
        type: "command",
        command: "SET_SAFETY_THRESHOLD",
        value: 7.5,
      })
    );
    await sleep(200);

    const threshCmd = deviceCommandsReceived.find((c) => c.command === "SET_SAFETY_THRESHOLD");
    assert(threshCmd !== undefined && threshCmd.value === 7.5, "Device received SET_SAFETY_THRESHOLD with value 7.5");

    // ─────────────────────────────────────────────────────────
    console.log("\n[13] Testing Device Disconnection Handling");
    deviceWs.close();
    await sleep(300);

    assert(dashReceivedOffline, "Dashboard notified that device is OFFLINE when ESP32 disconnects");

    const healthAfterDisconnect = await httpRequest("GET", "/api/health");
    assert(healthAfterDisconnect.json.deviceOnline === false, "Health reports deviceOnline = false");
    assert(healthAfterDisconnect.json.clients.devices === 0, "Device count back to 0");

    // ─────────────────────────────────────────────────────────
    console.log("\n[14] Testing Command Rejection When Device Offline");
    dashWs.send(JSON.stringify({ type: "command", command: "OPEN_DOOR" }));
    await sleep(200);

    const offlineWsAck = dashAcksReceived.find(
      (a) => a.command === "OPEN_DOOR" && a.success === false && a.reason === "Device offline"
    );
    assert(offlineWsAck !== undefined, "Dashboard received 'Device offline' rejection ack over WebSocket");

    const httpOfflineCmd = await httpRequest("POST", "/api/command", { command: "OPEN_DOOR" });
    assert(httpOfflineCmd.status === 503, "HTTP POST /api/command returns 503 when device offline");
    assert(httpOfflineCmd.json.error === "Device offline", "HTTP response confirms Device offline");

    // ─────────────────────────────────────────────────────────
    console.log("\n[15] Testing Dashboard Disconnection");
    dashWs.close();
    await sleep(200);

    const healthFinal = await httpRequest("GET", "/api/health");
    assert(healthFinal.json.clients.dashboards === 0, "Dashboard count back to 0 after disconnect");

    // ─────────────────────────────────────────────────────────
    console.log("\n[16] Testing USB Serial Ingestion & Line Parser Resilience");
    // Connect a fresh dashboard WS client to observe serial broadcasts
    const dashWs2 = new WebSocket(`ws://localhost:${TEST_PORT}/ws/dashboard`);
    const serialBroadcasts = [];
    dashWs2.on("message", (raw) => {
      try {
        serialBroadcasts.push(JSON.parse(raw.toString()));
      } catch {}
    });
    await sleep(200);

    // 16.1 Valid newline-delimited serial status telemetry
    handleIncomingSerialLine(
      JSON.stringify({
        type: "status",
        deviceId: "smartbus-01",
        passengerCount: 31,
        doorState: "OPEN",
        distanceCm: 18.2,
        ir1: false,
        ir2: true,
        servoAngle: 90,
        buzzer: false,
        led: false,
      }) + "\n"
    );
    await sleep(100);

    assert(latest.passengerCount === 31, "Serial status updated passenger count to 31 in memory");
    assert(latest.doorState === "OPEN", "Serial status updated doorState to OPEN in memory");
    assert(latest.distanceCm === 18.2, "Serial status updated distanceCm to 18.2 in memory");
    assert(latest.deviceOnline === true, "Serial telemetry marked deviceOnline = true");
    const lastBroadcast = serialBroadcasts[serialBroadcasts.length - 1];
    assert(lastBroadcast && lastBroadcast.passengerCount === 31, "Dashboard WS received serial status broadcast");

    // 16.2 Valid serial event
    handleIncomingSerialLine(
      JSON.stringify({
        type: "event",
        eventType: "OBSTACLE_DETECTED",
        message: "Obstacle detected at 3.2 cm",
        distanceCm: 3.2,
        passengerCount: 31,
        doorState: "BLOCKED",
      }) + "\n"
    );
    await sleep(100);
    const eventBroadcast = serialBroadcasts.find((b) => b.type === "event" && b.eventType === "OBSTACLE_DETECTED");
    assert(eventBroadcast !== undefined, "Dashboard WS received serial OBSTACLE_DETECTED event");

    // 16.3 Corrupted / malformed serial data resilience (must never crash)
    let crashed = false;
    try {
      handleIncomingSerialLine("corrupted garbage !#$#%#^{not json\n");
      handleIncomingSerialLine("[SMARTBUS ESP32 Embedded Safety Controller v2.0]\n");
      handleIncomingSerialLine("");
      handleIncomingSerialLine(null);
    } catch {
      crashed = true;
    }
    assert(!crashed, "Server gracefully handled corrupted / boot banner serial lines without crashing");

    // 16.4 Malformed telemetry values rejected
    handleIncomingSerialLine(JSON.stringify({ type: "status", passengerCount: -5 }) + "\n");
    assert(latest.passengerCount === 31, "Invalid negative passenger count over serial rejected by validator");

    dashWs2.close();
    await sleep(100);

    // ─────────────────────────────────────────────────────────
    console.log(`\n=================================================`);
    console.log(` All ${passedTests}/${totalTests} tests passed successfully!`);
    console.log(`=================================================\n`);

    server.close(() => {
      process.exit(0);
    });
  } catch (err) {
    console.error("\n❌ Test Suite Failed:", err);
    server.close(() => {
      process.exit(1);
    });
  }
}

runTests();

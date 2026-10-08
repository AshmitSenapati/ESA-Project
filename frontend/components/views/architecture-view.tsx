"use client";

import { useState } from "react";
import {
  Network,
  Cpu,
  Server,
  Monitor,
  Radio,
  Wifi,
  Cable,
  ArrowDown,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Tv,
  Eye,
  Sliders,
  Volume2,
  Lightbulb,
  Layers,
  Code2,
  CheckCircle2,
  Sparkles,
  Zap,
  Activity,
  FileJson,
  RotateCcw,
} from "lucide-react";
import { cn } from "../../lib/utils";

export function ArchitectureView() {
  const [activeSubsystem, setActiveSubsystem] = useState<number>(0);

  const subsystems = [
    {
      id: "obstacle-detection",
      title: "1. Obstacle Detection",
      subtitle: "HC-SR04 Ultrasonic Sonar & 5 cm Threshold",
      icon: Activity,
      color: "text-danger border-danger/40 bg-danger/10",
      description:
        "The doorway portal is actively monitored by an HC-SR04 ultrasonic distance sensor mounted centrally on the door header. It emits 40 kHz acoustic ultrasonic bursts and measures echo travel time to calculate distance with millimeter precision.",
      details: [
        "Pulse Trigger: ESP32 sends a 10 µs HIGH trigger pulse on GPIO 5.",
        "Echo Measurement: ESP32 measures HIGH pulse width on GPIO 18.",
        "Formula: Distance (cm) = (Echo Time in µs × 0.0343) / 2.",
        "Configured Threshold: 5.0 cm — any obstacle below this limit triggers the safety interlock.",
        "Electrical Safety: 1kΩ + 2kΩ voltage divider shifts 5V ECHO output to 3.3V to protect ESP32 input.",
      ],
      codeSnippet: `// Distance measurement routine
digitalWrite(TRIG_PIN, LOW);
delayMicroseconds(2);
digitalWrite(TRIG_PIN, HIGH);
delayMicroseconds(10);
digitalWrite(TRIG_PIN, LOW);

long duration = pulseIn(ECHO_PIN, HIGH, 30000);
float distanceCm = (duration > 0) ? (duration * 0.0343 / 2.0) : 999.0;
bool obstacleActive = (distanceCm < SAFETY_THRESHOLD_CM); // 5.0 cm`,
    },
    {
      id: "passenger-counting",
      title: "2. Passenger Counting",
      subtitle: "Dual Sequential IR Breakbeams (IR1 ↔ IR2)",
      icon: Eye,
      color: "text-entry-blue border-entry-blue/40 bg-entry-blue/10",
      description:
        "Directional passenger movement is resolved using two sequential active-LOW infrared breakbeam sensors mounted across the entrance threshold. Direction is determined by the temporal sequence of beam breaks.",
      details: [
        "Boarding (Entry): IR1 breaks first, then IR2 breaks → Passenger count increments by +1.",
        "Alighting (Exit): IR2 breaks first, then IR1 breaks → Passenger count decrements by -1.",
        "Finite State Machine (FSM): Sequence timer timeout (1.5s) discards partial or aborted passages.",
        "Zero Ghost Counts: Sequential state validation eliminates double counting when doors swing.",
        "Pins: IR1 on GPIO 27 (Exterior Gate) and IR2 on GPIO 26 (Interior Gate).",
      ],
      codeSnippet: `// Sequential state machine
if (ir1State == LOW && seqState == IDLE) {
  seqState = ENTRY_STARTED;
  seqTimer = millis();
} else if (ir2State == LOW && seqState == ENTRY_STARTED) {
  passengerCount++;
  seqState = IDLE;
  sendEvent("PASSENGER_ENTRY", "Boarding +1");
}`,
    },
    {
      id: "door-safety-response",
      title: "3. Door Safety Response",
      subtitle: "SG90 Reversal Interlock, Piezo Alarm & Strobe",
      icon: ShieldAlert,
      color: "text-amber-400 border-amber-400/40 bg-amber-400/10",
      description:
        "When an obstacle is detected below 5.0 cm while the door is closing, the system immediately cancels the closing transit, executes an emergency reopen sequence, and engages dual audible and visual alerts.",
      details: [
        "Mechanical Response: SG90 servo motor halts closing and reverses to 15° (REOPENING aperture).",
        "Audible Alarm: Active piezo buzzer on GPIO 23 activates with a 2.4 kHz alert tone.",
        "Visual Hazard Beacon: High-intensity red LED on GPIO 2 strobes with 220Ω series current limiter.",
        "Downlink Ingestion: Immediate safety event transmitted to Node.js backend without polling delays.",
        "Operator Interlock: Manual close commands are locked out until obstacle clearance is confirmed.",
      ],
      codeSnippet: `// Emergency safety interlock
if (doorState == CLOSING && distanceCm < 5.0) {
  doorState = BLOCKED;
  doorServo.write(15); // Reopen to clearance angle
  digitalWrite(BUZZER_PIN, HIGH);
  digitalWrite(LED_PIN, HIGH);
  sendEvent("OBSTACLE_DETECTED", "Collision hazard < 5cm");
}`,
    },
    {
      id: "local-lcd-monitoring",
      title: "4. Local LCD Monitoring",
      subtitle: "16×2 Character LCD via PCF8574 I2C Backpack",
      icon: Tv,
      color: "text-safe border-safe/40 bg-safe/10",
      description:
        "An onboard 16×2 character LCD screen provides bus drivers with real-time passenger loads and door safety readouts right in the driver cabin, functioning completely independently of network status.",
      details: [
        "I2C Hardware Bus: Connected via ESP32 default I2C pins (SDA: GPIO 21, SCL: GPIO 22).",
        "Backpack Address: 0x27 using standard PCF8574 I2C expander (configurable in config.h).",
        "Line 1 Readout: Concise passenger tally (e.g. 'PASSENGERS: 24  ') or hazard banner '!!! OBSTACLE !!!'.",
        "Line 2 Readout: Synchronized door state (e.g. 'DOOR: OPEN      ', 'DOOR: CLOSE     ', or 'REOPENING...    ').",
        "Offline Resilience: Differential line caching eliminates screen flicker and runs 100% independent of Wi-Fi.",
      ],
      codeSnippet: `// 16x2 LCD differential refresh
if (obstacleActive) {
  lcdPrintRow(0, "!!! OBSTACLE !!!");
  lcdPrintRow(1, "REOPENING...    ");
} else {
  lcdPrintRow(0, "PASSENGERS: " + String(passengerCount));
  lcdPrintRow(1, "DOOR: " + String(doorState));
}`,
    },
    {
      id: "usb-serial-telemetry",
      title: "5. USB Serial Bridge",
      subtitle: "ESP32 USB Serial Bridge & Command Downlink (115200 Baud)",
      icon: Cable,
      color: "text-primary-light border-primary/40 bg-primary/10",
      description:
        "The ESP32 communicates with the Node.js backend over a direct USB-A to USB-C cable at 115200 baud. It streams newline-delimited JSON status packets upwards and reads command lines downwards with non-blocking serial buffers.",
      details: [
        "Direct USB Link: Physical USB cable interface (e.g. COM3 / COM4 / COM5 on Windows).",
        "High-Speed Baud: 115200 baud, 8 data bits, no parity, 1 stop bit (8N1).",
        "Uplink Telemetry: Newline-delimited JSON status string transmitted every 500 ms.",
        "Uplink Events: Immediate newline-delimited JSON event strings for obstacles and boarding.",
        "Downlink Commands: Non-blocking Serial buffer reads command strings (OPEN_DOOR, CLOSE_DOOR, etc.).",
        "Zero Cloud Dependency: Operates 100% locally with zero Wi-Fi, router, or internet requirement.",
      ],
      codeSnippet: `// USB Serial newline-delimited JSON output
StaticJsonDocument<256> doc;
doc["type"]           = "status";
doc["passengerCount"] = passengerCount;
doc["doorState"]      = currentDoorState;
doc["distanceCm"]     = currentDistanceCm;
doc["servoAngle"]     = servoAngle;
doc["buzzer"]         = buzzerActive;
doc["led"]            = ledActive;

serializeJson(doc, Serial);
Serial.print('\\n');`,
    },
    {
      id: "web-dashboard",
      title: "6. Web Dashboard",
      subtitle: "Next.js / React / WebSocket Operations Console",
      icon: Monitor,
      color: "text-exit-violet border-exit-violet/40 bg-exit-violet/10",
      description:
        "The control room interface is built with Next.js 14, React 18, TypeScript, Tailwind CSS, and Recharts. It connects to the Node.js backend via WebSockets to deliver a sub-50 ms live digital twin.",
      details: [
        "Real-Time WebSocket: Subscribes to ws://localhost:8080 with automatic 3-second reconnection.",
        "Digital Twin Doorway: Animated SVG and CSS visualization showing bi-parting leaves and ultrasonic beam.",
        "Occupancy Trend: Recharts AreaChart graphing live passenger loads with capacity threshold markers.",
        "Command Dispatcher: Sends POST /api/command triggers (OPEN_DOOR, CLOSE_DOOR, RESET_COUNT).",
        "Full Responsiveness: Optimized for high-resolution desktop control consoles and tablet browsers.",
      ],
      codeSnippet: `// WebSocket client connection in Next.js
const ws = new WebSocket("ws://localhost:8080");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "status") {
    setTelemetry((prev) => ({ ...prev, ...data }));
  }
};`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary-light" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary-light font-bold">
              SYSTEM ARCHITECTURE SPECIFICATION
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
            End-to-End System Architecture
          </h2>
          <p className="text-xs text-muted">
            Complete hardware, network, backend &amp; frontend engineering topology for SMARTBUS fleet operations
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary-light font-semibold shadow-sm">
            ARCHITECTURE v2.4 IoT
          </span>
        </div>
      </div>

      {/* ── THE VISUAL ARCHITECTURE TOPOLOGY ─────────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-safe animate-ping" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
              PHYSICAL TO CLOUD MULTI-TIER TOPOLOGY
            </h3>
          </div>
          <span className="font-mono text-[10px] text-muted">
            Animated bidirectional data pipelines
          </span>
        </div>

        {/* The Multi-Tier Architecture Diagram */}
        <div className="relative max-w-2xl mx-auto flex flex-col items-center py-2">
          {/* ── TIER 1: SMARTBUS DASHBOARD (TOP) ────────────────────────── */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border-2 border-primary/50 bg-base-950/95 p-4 shadow-glow-blue flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/50 bg-primary/15 text-primary-light">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <div className="font-mono text-xs font-extrabold text-slate-100">
                  SMARTBUS DASHBOARD
                </div>
                <div className="text-[11px] text-primary-light font-mono">
                  Next.js 14 / React 18 / TypeScript (:3000)
                </div>
              </div>
            </div>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary-light">
              OPERATIONS ROOM
            </span>
          </div>

          {/* Animated Trunk Line 1: Dashboard <-> Server (WebSocket) */}
          <div className="relative my-2 h-14 flex flex-col items-center justify-center">
            <div className="h-full w-0.5 border-l-2 border-dashed border-primary" style={{ animation: "flow-line 1.2s linear infinite" }} />
            <div className="absolute rounded-full border border-primary/50 bg-base-950 px-2.5 py-0.5 font-mono text-[9px] font-bold text-primary-light shadow-md flex items-center gap-1.5">
              <Zap className="h-2.5 w-2.5 text-primary" />
              <span>WebSocket (ws://localhost:8080)</span>
            </div>
          </div>

          {/* ── TIER 2: NODE.JS SERVER (MIDDLE) ─────────────────────────── */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border-2 border-safe/50 bg-base-950/95 p-4 shadow-glow-safe flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-safe/50 bg-safe/15 text-safe">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <div className="font-mono text-xs font-extrabold text-slate-100">
                  NODE.JS INGESTION SERVER
                </div>
                <div className="text-[11px] text-safe font-mono">
                  Express API + ws WebSocket Engine (:8080)
                </div>
              </div>
            </div>
            <span className="rounded-full border border-safe/40 bg-safe/10 px-2 py-0.5 font-mono text-[9px] font-bold text-safe">
              BROADCAST RELAY
            </span>
          </div>

          {/* Animated Trunk Line 2: Server <-> ESP32 (USB Serial) */}
          <div className="relative my-2 h-14 flex flex-col items-center justify-center">
            <div className="h-full w-0.5 border-l-2 border-dashed border-safe" style={{ animation: "flow-line 1.2s linear infinite" }} />
            <div className="absolute rounded-full border border-safe/50 bg-base-950 px-2.5 py-0.5 font-mono text-[9px] font-bold text-safe shadow-md flex items-center gap-1.5">
              <Cable className="h-2.5 w-2.5 text-safe" />
              <span>USB Serial @ 115200 baud (Newline-delimited JSON)</span>
            </div>
          </div>

          {/* ── TIER 3: ESP32 MCU (BOTTOM CORE) ──────────────────────────── */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border-2 border-primary-light/60 bg-base-950/95 p-4 shadow-panel flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-light/50 bg-primary/20 text-primary-light">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <div className="font-mono text-xs font-extrabold text-slate-100">
                  ESP32 MICROCONTROLLER
                </div>
                <div className="text-[11px] text-slate-300 font-mono">
                  Sensors + Local Safety Interlock + USB Serial
                </div>
              </div>
            </div>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary-light">
              EDGE NODE
            </span>
          </div>

          {/* Animated Fan-out Traces to Peripherals */}
          <div className="relative w-full max-w-lg my-2 h-12 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 400 48" fill="none">
              <line x1="200" y1="0" x2="200" y2="48" stroke="#2d9cff" strokeWidth="2" strokeDasharray="4 3" style={{ animation: "flow-line 1s linear infinite" }} />
              <line x1="200" y1="20" x2="70" y2="20" stroke="#2d9cff" strokeWidth="2" strokeDasharray="4 3" style={{ animation: "flow-line 1s linear infinite" }} />
              <line x1="200" y1="20" x2="330" y2="20" stroke="#2d9cff" strokeWidth="2" strokeDasharray="4 3" style={{ animation: "flow-line 1s linear infinite" }} />
              <line x1="70" y1="20" x2="70" y2="48" stroke="#2d9cff" strokeWidth="2" strokeDasharray="4 3" style={{ animation: "flow-line 1s linear infinite" }} />
              <line x1="330" y1="20" x2="330" y2="48" stroke="#2d9cff" strokeWidth="2" strokeDasharray="4 3" style={{ animation: "flow-line 1s linear infinite" }} />
            </svg>
          </div>

          {/* ── TIER 4: HARDWARE PERIPHERALS ROW ─────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-lg mb-4">
            {/* Peripheral 1: HC-SR04 */}
            <div className="rounded-xl border border-border/80 bg-base-950 p-2.5 text-center flex flex-col items-center">
              <Activity className="h-4 w-4 text-primary-light mb-1" />
              <div className="font-mono text-xs font-bold text-slate-100">HC-SR04</div>
              <div className="font-mono text-[9px] text-muted">Ultrasonic Sonar</div>
            </div>

            {/* Peripheral 2: 2x IR Sensors */}
            <div className="rounded-xl border border-border/80 bg-base-950 p-2.5 text-center flex flex-col items-center">
              <Eye className="h-4 w-4 text-entry-blue mb-1" />
              <div className="font-mono text-xs font-bold text-slate-100">IR × 2</div>
              <div className="font-mono text-[9px] text-muted">Sequential Breakbeams</div>
            </div>

            {/* Peripheral 3: SG90 Servo */}
            <div className="rounded-xl border border-border/80 bg-base-950 p-2.5 text-center flex flex-col items-center">
              <Sliders className="h-4 w-4 text-amber-400 mb-1" />
              <div className="font-mono text-xs font-bold text-slate-100">SG90 Door</div>
              <div className="font-mono text-[9px] text-muted">PWM Servo Linkage</div>
            </div>
          </div>

          {/* Downward connection to Local Output Bundle */}
          <div className="h-6 w-0.5 border-l-2 border-dashed border-primary" style={{ animation: "flow-line 1s linear infinite" }} />

          {/* ── TIER 5: LOCAL OUTPUT ALARMS & LCD DISPLAY ────────────────── */}
          <div className="w-full max-w-lg rounded-xl border border-safe/40 bg-base-950/90 p-3 flex items-center justify-around font-mono text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-danger" />
              <span>Piezo Buzzer</span>
            </div>
            <span className="text-muted">•</span>
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-danger" />
              <span>Red LED</span>
            </div>
            <span className="text-muted">•</span>
            <div className="flex items-center gap-1.5">
              <Tv className="h-3.5 w-3.5 text-safe" />
              <span>16×2 LCD</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── DATA FLOW PIPELINE VISUALIZATION ──────────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="border-b border-border/70 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary-light" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
              DATA FLOW PIPELINE (SENSOR → UI TELEMETRY SEQUENCE)
            </h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Step-by-step chronological signal propagation across the physical-to-cloud boundary
          </p>
        </div>

        {/* The 6-Step Pipeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            {
              step: "STEP 01",
              title: "Sensor Trigger",
              sub: "Physical Hardware",
              desc: "HC-SR04 sonar pulse or IR1/IR2 breakbeam edge transition occurs at bus doorway.",
              time: "< 5 ms",
              color: "border-primary/40 text-primary-light",
            },
            {
              step: "STEP 02",
              title: "ESP32 Processing",
              sub: "Edge Logic",
              desc: "GPIO interrupt captures pin state; safety interlock verifies 5cm threshold.",
              time: "< 10 ms",
              color: "border-primary/40 text-primary-light",
            },
            {
              step: "STEP 03",
              title: "Telemetry JSON",
              sub: "Wi-Fi Serialization",
              desc: "ArduinoJson packages passenger count, distance & door state into POST payload.",
              time: "~ 15 ms",
              color: "border-safe/40 text-safe",
            },
            {
              step: "STEP 04",
              title: "WebSocket Relay",
              sub: "Node.js Server",
              desc: "Express server updates internal cache and broadcasts JSON over WebSocket on :8080.",
              time: "< 25 ms",
              color: "border-safe/40 text-safe",
            },
            {
              step: "STEP 05",
              title: "Dashboard State",
              sub: "React Client",
              desc: "Next.js WebSocket handler receives packet and triggers reactive state update.",
              time: "< 35 ms",
              color: "border-entry-blue/40 text-entry-blue",
            },
            {
              step: "STEP 06",
              title: "UI Render",
              sub: "60 FPS Visual Twin",
              desc: "Doorway SVG animates, AreaChart appends sample, and metrics reflect latest count.",
              time: "< 50 ms Total",
              color: "border-exit-violet/40 text-exit-violet",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-xl border bg-base-950/80 p-3.5 flex flex-col justify-between transition hover:bg-base-950",
                item.color
              )}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted mb-1">
                  <span>{item.step}</span>
                  <span className="font-bold">{item.time}</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-100">
                  {item.title}
                </div>
                <div className="text-[10px] font-mono opacity-80 mb-2">
                  {item.sub}
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-snug">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6 CORE SUBSYSTEM TECHNICAL BREAKDOWNS ─────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="border-b border-border/70 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary-light" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
              THE 6 SUBSYSTEMS // DETAILED ENGINEERING BREAKDOWN
            </h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Select any subsystem to inspect hardware timing, electrical interfacing and firmware source logic
          </p>
        </div>

        {/* Subsystem Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {subsystems.map((sub, index) => {
            const Icon = sub.icon;
            const isSelected = activeSubsystem === index;

            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubsystem(index)}
                className={cn(
                  "rounded-xl border p-2.5 text-left transition flex flex-col justify-between",
                  isSelected
                    ? "border-primary bg-primary/20 shadow-glow-blue"
                    : "border-border/70 bg-base-950/70 hover:border-slate-600 hover:bg-base-950"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={cn("h-4 w-4", isSelected ? "text-primary-light" : "text-muted")} />
                  <span className="font-mono text-[9px] text-muted">0{index + 1}</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-100 truncate">
                  {sub.title.split(". ")[1]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Subsystem Detail Display */}
        {(() => {
          const active = subsystems[activeSubsystem];
          const Icon = active.icon;

          return (
            <div className="rounded-xl border border-border/80 bg-base-950/90 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", active.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100">
                      {active.title}
                    </h4>
                    <span className="font-mono text-xs text-muted">
                      {active.subtitle}
                    </span>
                  </div>
                </div>

                <span className="font-mono text-[10px] text-primary-light border border-primary/30 bg-primary/10 px-2.5 py-1 rounded-lg">
                  Authoritative Subsystem Specification
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {active.description}
              </p>

              {/* Technical Specifications Bullets */}
              <div className="space-y-1.5 font-mono text-xs text-slate-300">
                <span className="text-[10px] uppercase text-muted tracking-wider block mb-1">
                  Architectural Implementation Guidelines:
                </span>
                {active.details.map((detail, dIdx) => (
                  <div key={dIdx} className="flex items-start gap-2">
                    <span className="text-primary-light mt-0.5">•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              {/* Firmware Code Routine */}
              <div className="pt-2">
                <div className="flex items-center justify-between font-mono text-[10px] text-muted mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Code2 className="h-3.5 w-3.5 text-primary-light" />
                    Embedded C++ Routine (ESP32 Firmware)
                  </span>
                  <span>Non-Blocking State Loop</span>
                </div>
                <pre className="rounded-xl border border-border/60 bg-base-900 p-3.5 font-mono text-[11px] text-primary-light/90 overflow-x-auto">
                  {active.codeSnippet}
                </pre>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Cpu,
  Activity,
  Eye,
  Sliders,
  Volume2,
  Lightbulb,
  Tv,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Radio,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Info,
  ShieldAlert,
  ShieldCheck,
  Code2,
  Wrench,
} from "lucide-react";
import { BusTelemetry, HardwareStatus } from "../../lib/types";
import { cn } from "../../lib/utils";

interface HardwareViewProps {
  telemetry: BusTelemetry;
  onSimulateObstacle?: () => void;
  onSimulateEntry?: () => void;
  onSimulateExit?: () => void;
  onNavigateToTestBench?: () => void;
}

type ComponentId =
  | "esp32"
  | "hcsr04"
  | "ir1"
  | "ir2"
  | "sg90"
  | "buzzer"
  | "led"
  | "lcd";

interface ComponentDetail {
  id: ComponentId;
  name: string;
  purpose: string;
  pin: string;
  voltage: string;
  wiring: string;
  getStatus: (t: BusTelemetry) => HardwareStatus;
  getCurrentState: (t: BusTelemetry) => string;
  getTelemetryMetrics: (t: BusTelemetry) => Array<{ label: string; value: string }>;
  icon: typeof Cpu;
}

const COMPONENTS: Record<ComponentId, ComponentDetail> = {
  esp32: {
    id: "esp32",
    name: "ESP32 Dev Board",
    purpose: "Master Edge Microcontroller Node & Wi-Fi Gateway",
    pin: "Xtensa Dual-Core 240MHz",
    voltage: "3.3V System Logic (5V Micro-USB VBUS)",
    wiring: "Authoritative IoT controller running smartbus_esp32.ino",
    getStatus: (t) => (t.esp32Connected ? "ONLINE" : "OFFLINE"),
    getCurrentState: (t) => (t.esp32Connected ? "Wi-Fi Telemetry Streaming" : "Disconnected / Standby"),
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.esp32Connected ? "ONLINE" : "OFFLINE" },
      { label: "Core Architecture", value: "32-bit Xtensa LX6 @ 240MHz" },
      { label: "Transport Protocol", value: "HTTP POST/GET + WebSocket (:8080)" },
      { label: "Internal Logic", value: "3.3V Active-LOW / Active-HIGH" },
    ],
    icon: Cpu,
  },
  hcsr04: {
    id: "hcsr04",
    name: "HC-SR04 Ultrasonic Sensor",
    purpose: "Obstacle detection at doorway",
    pin: "TRIG: GPIO 5 | ECHO: GPIO 18",
    voltage: "5V VCC / 3.3V Echo via Voltage Divider",
    wiring: "1kΩ + 2kΩ resistor voltage divider required on ECHO pin to protect ESP32 3.3V input",
    getStatus: (t) => {
      if (!t.esp32Connected) return "OFFLINE";
      return t.distanceCm < t.obstacleThresholdCm ? "WARNING" : "ONLINE";
    },
    getCurrentState: (t) =>
      t.distanceCm < t.obstacleThresholdCm
        ? "OBSTACLE DETECTED (COLLISION RISK)"
        : "PASSAGEWAY CLEAR",
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.distanceCm < t.obstacleThresholdCm ? "WARNING (OBSTACLE)" : "ONLINE" },
      { label: "Distance", value: t.distanceCm >= 900 ? "Out of Range" : `${t.distanceCm.toFixed(1)} cm` },
      { label: "Safety threshold", value: `${t.obstacleThresholdCm.toFixed(1)} cm` },
      { label: "Pinch Protection", value: t.distanceCm < t.obstacleThresholdCm ? "HALT CLOSING & REOPEN" : "ARMED" },
    ],
    icon: Activity,
  },
  ir1: {
    id: "ir1",
    name: "IR SENSOR 1",
    purpose: "Passenger direction detection (Exterior Entry Sensor)",
    pin: "GPIO 27 (Digital Input)",
    voltage: "3.3V Logic (Active-LOW)",
    wiring: "Positioned on the exterior side of the doorway threshold. Breaks first on entry.",
    getStatus: (t) => {
      if (!t.esp32Connected) return "OFFLINE";
      return t.ir1Active ? "WARNING" : "ONLINE";
    },
    getCurrentState: (t) => (t.ir1Active ? "BEAM BROKEN (PASSENGER PRESENT)" : "CLEAR"),
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.esp32Connected ? "ONLINE" : "OFFLINE" },
      { label: "Current state", value: t.ir1Active ? "TRIGGERED (BEAM BROKEN)" : "CLEAR" },
      { label: "Sequence Role", value: "IR1 → IR2 = Entry (+1)" },
      { label: "Logic Level", value: t.ir1Active ? "LOW (0V / Detected)" : "HIGH (3.3V / Clear)" },
    ],
    icon: Eye,
  },
  ir2: {
    id: "ir2",
    name: "IR SENSOR 2",
    purpose: "Passenger direction detection (Interior Exit Sensor)",
    pin: "GPIO 26 (Digital Input)",
    voltage: "3.3V Logic (Active-LOW)",
    wiring: "Positioned on the interior cabin side of the doorway threshold. Breaks first on exit.",
    getStatus: (t) => {
      if (!t.esp32Connected) return "OFFLINE";
      return t.ir2Active ? "WARNING" : "ONLINE";
    },
    getCurrentState: (t) => (t.ir2Active ? "BEAM BROKEN (PASSENGER PRESENT)" : "CLEAR"),
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.esp32Connected ? "ONLINE" : "OFFLINE" },
      { label: "Current state", value: t.ir2Active ? "TRIGGERED (BEAM BROKEN)" : "CLEAR" },
      { label: "Sequence Role", value: "IR2 → IR1 = Exit (−1)" },
      { label: "Logic Level", value: t.ir2Active ? "LOW (0V / Detected)" : "HIGH (3.3V / Clear)" },
    ],
    icon: Eye,
  },
  sg90: {
    id: "sg90",
    name: "SG90 SERVO",
    purpose: "Door actuator (Bi-parting mechanical linkage)",
    pin: "GPIO 19 (PWM Signal)",
    voltage: "5V VCC Power Rail / 3.3V PWM Control",
    wiring: "Must be powered from dedicated 5V rail (not ESP32 3.3V regulator) to prevent current brownouts",
    getStatus: (t) => {
      if (!t.esp32Connected) return "OFFLINE";
      return t.doorState === "BLOCKED" ? "WARNING" : "ONLINE";
    },
    getCurrentState: (t) => t.doorState,
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.esp32Connected ? "ONLINE" : "OFFLINE" },
      { label: "Current state", value: t.doorState },
      { label: "Servo Angle", value: `${t.servoAngle}° PWM` },
      { label: "Aperture Mode", value: t.servoAngle === 90 ? "FULL APERTURE (OPEN)" : t.servoAngle === 0 ? "LATCHED (CLOSED)" : "SAFETY REOPEN (15°)" },
    ],
    icon: Sliders,
  },
  buzzer: {
    id: "buzzer",
    name: "BUZZER",
    purpose: "Piezo audible warning alarm for doorway hazards",
    pin: "GPIO 23 (Digital Output)",
    voltage: "3.3V Active-HIGH",
    wiring: "Active 5V/3.3V piezo buzzer sounds immediately upon obstacle distance < 5.0 cm",
    getStatus: (t) => {
      if (!t.esp32Connected) return "OFFLINE";
      return t.buzzerActive ? "WARNING" : "ONLINE";
    },
    getCurrentState: (t) => (t.buzzerActive ? "ACTIVE (2.4 kHz ALERT TONE)" : "SILENT (ARMED)"),
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.esp32Connected ? "ONLINE" : "OFFLINE" },
      { label: "Current state", value: t.buzzerActive ? "ACTIVE (SOUNDING)" : "SILENT (ARMED)" },
      { label: "Trigger Rule", value: "Distance < 5.0 cm during door transit" },
      { label: "Acoustic Frequency", value: "2.4 kHz Piezo Resonance" },
    ],
    icon: Volume2,
  },
  led: {
    id: "led",
    name: "RED LED",
    purpose: "Visual hazard strobe for passenger pinch protection",
    pin: "GPIO 2 (Digital Output)",
    voltage: "3.3V Active-HIGH via 220Ω Resistor",
    wiring: "High-intensity 5mm Red LED connected with 220Ω current-limiting resistor to GND",
    getStatus: (t) => {
      if (!t.esp32Connected) return "OFFLINE";
      return t.ledActive ? "WARNING" : "ONLINE";
    },
    getCurrentState: (t) => (t.ledActive ? "FLASHING (ALARM ACTIVE)" : "OFF (STANDBY)"),
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.esp32Connected ? "ONLINE" : "OFFLINE" },
      { label: "Current state", value: t.ledActive ? "FLASHING (EMERGENCY)" : "OFF (NOMINAL)" },
      { label: "Current Limiting", value: "220Ω Series Resistor (12mA safe)" },
      { label: "Beacon Mode", value: t.ledActive ? "Strobe Synchronized with Buzzer" : "Dark" },
    ],
    icon: Lightbulb,
  },
  lcd: {
    id: "lcd",
    name: "16×2 LCD with I2C Backpack",
    purpose: "Physical passenger count & door safety display inside cabin",
    pin: "SDA: GPIO 21 | SCL: GPIO 22",
    voltage: "5V VCC / 3.3V I2C Bus (PCF8574)",
    wiring: "I2C backpack address 0x27 connected to default ESP32 hardware I2C pins",
    getStatus: (t) => (t.esp32Connected ? "ONLINE" : "OFFLINE"),
    getCurrentState: (t) =>
      t.esp32Connected
        ? t.distanceCm < t.obstacleThresholdCm
          ? "Row 0: !!! OBSTACLE !!! | Row 1: REOPENING..."
          : `Row 0: PASSENGERS: ${t.passengerCount} | Row 1: DOOR: ${t.doorState}`
        : "OFFLINE",
    getTelemetryMetrics: (t) => [
      { label: "Status", value: t.esp32Connected ? "ONLINE" : "OFFLINE" },
      {
        label: "Current state",
        value:
          t.distanceCm < t.obstacleThresholdCm
            ? "!!! OBSTACLE !!! / REOPENING..."
            : `PASSENGERS: ${t.passengerCount} | DOOR: ${t.doorState}`,
      },
      { label: "I2C Slave Address", value: "0x27 (Configurable in config.h)" },
      { label: "Bus Speed", value: "100 kHz Standard I2C Clock" },
    ],
    icon: Tv,
  },
};

export function HardwareView({
  telemetry,
  onSimulateObstacle,
  onSimulateEntry,
  onSimulateExit,
  onNavigateToTestBench,
}: HardwareViewProps) {
  const [selectedId, setSelectedId] = useState<ComponentId>("esp32");

  const selectedComponent = COMPONENTS[selectedId];
  const selectedStatus = selectedComponent.getStatus(telemetry);
  const SelectedIcon = selectedComponent.icon;

  const isHardwareLive = !telemetry.isDemoMode && telemetry.esp32Connected;

  return (
    <div className="space-y-5">
      {/* ── HEADER & DATA PROVENANCE BANNER ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary-light" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary-light font-bold">
              ELECTRICAL SCHEMATIC &amp; BUS TOPOLOGY
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
            Hardware Architecture &amp; System Interconnect
          </h2>
          <p className="text-xs text-muted">
            Interactive component wiring diagram with animated signal traces, GPIO mappings &amp; live telemetry
          </p>
        </div>

        {/* Clear Data Provenance Badge & Optional Verification Bench Link */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onNavigateToTestBench && (
            <button
              onClick={onNavigateToTestBench}
              className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 px-3 py-2 font-mono text-xs text-primary-light transition shadow-sm font-semibold"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Diagnostic Bench →</span>
            </button>
          )}

          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-xs transition-all shadow-sm",
              isHardwareLive
                ? "border-safe/50 bg-safe/10 text-safe shadow-glow-safe"
                : "border-amber-500/50 bg-amber-500/10 text-amber-300"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isHardwareLive ? "bg-safe animate-ping" : "bg-amber-400 animate-pulse"
              )}
            />
            <span className="font-bold">
              {isHardwareLive ? "LIVE HARDWARE DATA" : "DEMO DATA (SIMULATED)"}
            </span>
            <span className="text-[10px] opacity-75 hidden sm:inline">
              {isHardwareLive ? "(ESP32 LINKED)" : "(IN-MEMORY TEST BENCH)"}
            </span>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE CONNECTION DIAGRAM & DETAIL INSPECTOR ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        {/* LEFT: VISUAL CONNECTION DIAGRAM */}
        <div className="relative rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-light animate-ping" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                TOPOLOGY DIAGRAM // CLICK COMPONENT TO INSPECT
              </h3>
            </div>
            <span className="text-[10px] font-mono text-muted">
              Animated traces denote active data/signal paths
            </span>
          </div>

          {/* Diagram Container */}
          <div className="relative my-2 py-4 flex flex-col items-center justify-center min-h-[520px]">
            {/* SVG Background Animated Connection Traces */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="traceGradInput" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2d9cff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#5de5a0" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="traceGradOutput" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5de5a0" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#55b8ff" stopOpacity="0.8" />
                </linearGradient>
                <marker
                  id="arrowhead-down"
                  markerWidth="8"
                  markerHeight="6"
                  refX="4"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#2d9cff" />
                </marker>
                <marker
                  id="arrowhead-right"
                  markerWidth="8"
                  markerHeight="6"
                  refX="4"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#2d9cff" />
                </marker>
                <marker
                  id="arrowhead-left"
                  markerWidth="8"
                  markerHeight="6"
                  refX="4"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#2d9cff" />
                </marker>
              </defs>

              {/* 1. HC-SR04 -> ESP32 (Vertical line downwards) */}
              <line
                x1="50%"
                y1="18%"
                x2="50%"
                y2="38%"
                stroke="#2d9cff"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                style={{ animation: "flow-line 1.2s linear infinite" }}
                markerEnd="url(#arrowhead-down)"
              />

              {/* 2. IR1 -> ESP32 (Horizontal line to the right) */}
              <line
                x1="22%"
                y1="45%"
                x2="40%"
                y2="45%"
                stroke="#5cbcff"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                style={{ animation: "flow-line 1.2s linear infinite" }}
                markerEnd="url(#arrowhead-right)"
              />

              {/* 3. IR2 -> ESP32 (Horizontal line to the left) */}
              <line
                x1="78%"
                y1="45%"
                x2="60%"
                y2="45%"
                stroke="#9b8dff"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                style={{ animation: "flow-reverse 1.2s linear infinite" }}
                markerEnd="url(#arrowhead-left)"
              />

              {/* 4. ESP32 -> SG90 (Split branch downwards left) */}
              <path
                d="M 48% 52% L 48% 60% L 22% 60% L 22% 68%"
                fill="none"
                stroke="#2d9cff"
                strokeWidth="2"
                strokeDasharray="6 4"
                style={{ animation: "flow-line 1.4s linear infinite" }}
                markerEnd="url(#arrowhead-down)"
              />

              {/* 5. ESP32 -> BUZZER (Direct branch downwards center) */}
              <line
                x1="50%"
                y1="52%"
                x2="50%"
                y2="68%"
                stroke="#ff6875"
                strokeWidth="2"
                strokeDasharray="6 4"
                style={{ animation: "flow-line 1.4s linear infinite" }}
                markerEnd="url(#arrowhead-down)"
              />

              {/* 6. ESP32 -> RED LED (Split branch downwards right) */}
              <path
                d="M 52% 52% L 52% 60% L 78% 60% L 78% 68%"
                fill="none"
                stroke="#ff6875"
                strokeWidth="2"
                strokeDasharray="6 4"
                style={{ animation: "flow-line 1.4s linear infinite" }}
                markerEnd="url(#arrowhead-down)"
              />

              {/* 7. Center bus -> 16x2 LCD (Downwards to bottom) */}
              <line
                x1="50%"
                y1="76%"
                x2="50%"
                y2="86%"
                stroke="#5de5a0"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                style={{ animation: "flow-line 1.2s linear infinite" }}
                markerEnd="url(#arrowhead-down)"
              />
            </svg>

            {/* ── ROW 1: HC-SR04 (TOP CENTER) ── */}
            <div className="z-10 flex justify-center mb-12">
              <ComponentNodeCard
                comp={COMPONENTS.hcsr04}
                telemetry={telemetry}
                selected={selectedId === "hcsr04"}
                onClick={() => setSelectedId("hcsr04")}
              />
            </div>

            {/* ── ROW 2: IR1 (LEFT) ─── ESP32 (CENTER) ─── IR2 (RIGHT) ── */}
            <div className="z-10 w-full flex items-center justify-between px-2 sm:px-6 mb-14">
              <ComponentNodeCard
                comp={COMPONENTS.ir1}
                telemetry={telemetry}
                selected={selectedId === "ir1"}
                onClick={() => setSelectedId("ir1")}
              />

              <ComponentNodeCard
                comp={COMPONENTS.esp32}
                telemetry={telemetry}
                selected={selectedId === "esp32"}
                onClick={() => setSelectedId("esp32")}
                highlight
              />

              <ComponentNodeCard
                comp={COMPONENTS.ir2}
                telemetry={telemetry}
                selected={selectedId === "ir2"}
                onClick={() => setSelectedId("ir2")}
              />
            </div>

            {/* ── ROW 3: SG90 (LEFT) ─── BUZZER (CENTER) ─── RED LED (RIGHT) ── */}
            <div className="z-10 w-full flex items-center justify-between px-2 sm:px-6 mb-12">
              <ComponentNodeCard
                comp={COMPONENTS.sg90}
                telemetry={telemetry}
                selected={selectedId === "sg90"}
                onClick={() => setSelectedId("sg90")}
              />

              <ComponentNodeCard
                comp={COMPONENTS.buzzer}
                telemetry={telemetry}
                selected={selectedId === "buzzer"}
                onClick={() => setSelectedId("buzzer")}
              />

              <ComponentNodeCard
                comp={COMPONENTS.led}
                telemetry={telemetry}
                selected={selectedId === "led"}
                onClick={() => setSelectedId("led")}
              />
            </div>

            {/* ── ROW 4: 16×2 LCD (BOTTOM CENTER) ── */}
            <div className="z-10 flex justify-center">
              <ComponentNodeCard
                comp={COMPONENTS.lcd}
                telemetry={telemetry}
                selected={selectedId === "lcd"}
                onClick={() => setSelectedId("lcd")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-3 text-[10px] font-mono text-muted">
            <span>Direction: HC-SR04 &amp; IR1/IR2 → Inputs → ESP32 → Outputs → SG90/Buzzer/LED/LCD</span>
            <span className="text-safe">8 Modules Mapped</span>
          </div>
        </div>

        {/* RIGHT: INTERACTIVE COMPONENT DETAILS INSPECTOR */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel flex flex-col justify-between">
          <div>
            {/* Inspector Header */}
            <div className="flex items-start justify-between border-b border-border/70 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 transition",
                    selectedStatus === "WARNING"
                      ? "border-amber-400/50 bg-amber-400/20 text-amber-300 shadow-[0_0_15px_rgba(255,197,92,0.3)] animate-pulse"
                      : selectedStatus === "ONLINE"
                      ? "border-primary/50 bg-primary/20 text-primary-light shadow-glow-blue"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  )}
                >
                  <SelectedIcon className="h-5 w-5" />
                </div>

                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted">
                    COMPONENT INSPECTOR
                  </div>
                  <h3 className="text-base font-bold text-slate-100">
                    {selectedComponent.name}
                  </h3>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={cn(
                  "rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase border",
                  selectedStatus === "ONLINE"
                    ? "border-safe/40 bg-safe/10 text-safe"
                    : selectedStatus === "WARNING"
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300 animate-pulse"
                    : "border-slate-700 bg-slate-800 text-slate-400"
                )}
              >
                {selectedStatus}
              </div>
            </div>

            {/* Purpose & State Summary */}
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="rounded-xl border border-border/80 bg-base-950/80 p-3">
                <span className="text-[10px] text-muted uppercase block">Purpose</span>
                <span className="text-slate-200 font-semibold mt-0.5 block font-sans">
                  {selectedComponent.purpose}
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-base-950/80 p-3">
                <span className="text-[10px] text-muted uppercase block">Current Telemetry / State</span>
                <span className={cn(
                  "font-bold text-sm mt-0.5 block",
                  selectedStatus === "WARNING" ? "text-amber-400" : "text-slate-100"
                )}>
                  {selectedComponent.getCurrentState(telemetry)}
                </span>
              </div>
            </div>

            {/* Granular Metric Grid */}
            <div className="mt-4">
              <div className="text-[10px] font-mono text-muted uppercase mb-2">
                Real-Time Telemetry Attributes
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                {selectedComponent.getTelemetryMetrics(telemetry).map((metric, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-base-950/60 p-2.5 flex flex-col justify-between"
                  >
                    <span className="text-[10px] text-muted truncate">{metric.label}</span>
                    <span className="font-bold text-slate-200 mt-1 truncate">
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Electrical & Wiring Specs */}
            <div className="mt-4 space-y-2 font-mono text-xs border-t border-border/60 pt-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">ESP32 Pin:</span>
                <span className="text-primary-light font-bold">{selectedComponent.pin}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">Voltage Rating:</span>
                <span className="text-slate-300 font-semibold">{selectedComponent.voltage}</span>
              </div>
              <div className="text-[11px] text-muted font-sans mt-2 leading-relaxed bg-base-950/50 p-2.5 rounded-lg border border-border/50">
                <span className="font-mono text-slate-300 font-semibold block text-[10px] mb-1">
                  WIRING / INTEGRATION NOTE:
                </span>
                {selectedComponent.wiring}
              </div>
            </div>
          </div>

          {/* Quick Simulation Trigger if applicable */}
          <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted">
              {telemetry.isDemoMode ? "Simulated Test Signal" : "Active Hardware Signal"}
            </span>

            {selectedId === "hcsr04" && onSimulateObstacle && (
              <button
                onClick={onSimulateObstacle}
                className="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1 text-danger hover:bg-danger/20 transition font-bold"
              >
                <Zap className="h-3 w-3" />
                Simulate Obstacle (&lt;5cm)
              </button>
            )}

            {selectedId === "ir1" && onSimulateEntry && (
              <button
                onClick={onSimulateEntry}
                className="flex items-center gap-1.5 rounded-lg border border-entry-blue/40 bg-entry-blue/10 px-2.5 py-1 text-entry-blue hover:bg-entry-blue/20 transition font-bold"
              >
                <Zap className="h-3 w-3" />
                Simulate Entry
              </button>
            )}

            {selectedId === "ir2" && onSimulateExit && (
              <button
                onClick={onSimulateExit}
                className="flex items-center gap-1.5 rounded-lg border border-exit-violet/40 bg-exit-violet/10 px-2.5 py-1 text-exit-violet hover:bg-exit-violet/20 transition font-bold"
              >
                <Zap className="h-3 w-3" />
                Simulate Exit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3.3V LOGIC SAFETY NOTICE ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-mono text-xs sm:text-sm font-bold text-amber-300">
              ELECTRICAL LEVEL SHIFTER &amp; MOTOR POWER RULE (ESP32 3.3V PROTECTION)
            </h4>
            <p className="mt-1 text-xs text-amber-200/90 leading-relaxed">
              The ESP32 microcontroller operates strictly with <strong>3.3V maximum logic inputs</strong>.
              The HC-SR04 ultrasonic echo pin outputs a <strong>5V square wave</strong> that can damage the GPIO if connected directly.
              Always insert a voltage divider (1kΩ series + 2kΩ to GND) between HC-SR04 ECHO and GPIO 18.
              Additionally, power the SG90 servo motor from an external 5V rail rather than the ESP32 onboard 3.3V regulator to eliminate motor inductive spikes and reset loops.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable Interactive Component Node Card ─────────────────────────────────

function ComponentNodeCard({
  comp,
  telemetry,
  selected,
  onClick,
  highlight = false,
}: {
  comp: ComponentDetail;
  telemetry: BusTelemetry;
  selected: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  const status = comp.getStatus(telemetry);
  const Icon = comp.icon;
  const stateText = comp.getCurrentState(telemetry);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border p-2.5 sm:p-3 transition-all duration-200 text-left flex flex-col justify-between w-32 sm:w-44 backdrop-blur-md cursor-pointer",
        selected
          ? "border-primary bg-primary/20 shadow-glow-blue scale-105 z-20"
          : highlight
          ? "border-primary/50 bg-base-950/90 hover:border-primary shadow-brand"
          : "border-border/80 bg-base-950/80 hover:border-slate-500 hover:bg-base-900/90"
      )}
    >
      {/* Top: Icon + Status Pill */}
      <div className="flex items-center justify-between w-full gap-1">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border transition",
            selected
              ? "border-primary bg-primary/30 text-primary-light"
              : "border-border bg-base-900 text-slate-300 group-hover:text-primary-light"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>

        <span
          className={cn(
            "rounded-full px-1.5 py-0.2 font-mono text-[8px] font-bold uppercase border",
            status === "ONLINE"
              ? "border-safe/40 bg-safe/10 text-safe"
              : status === "WARNING"
              ? "border-amber-400/40 bg-amber-400/10 text-amber-300 animate-pulse"
              : "border-slate-700 bg-slate-800 text-slate-400"
          )}
        >
          {status}
        </span>
      </div>

      {/* Title & Pin */}
      <div className="mt-2 min-w-0 w-full">
        <div className="font-mono text-xs font-bold text-slate-100 truncate group-hover:text-primary-light transition">
          {comp.name}
        </div>
        <div className="font-mono text-[9px] text-primary-light truncate mt-0.5">
          {comp.pin}
        </div>
      </div>

      {/* Bottom State Preview */}
      <div className="mt-2 border-t border-border/50 pt-1.5 font-mono text-[9px] text-muted truncate w-full">
        {stateText}
      </div>
    </button>
  );
}

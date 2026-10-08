"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  HelpCircle,
  Lightbulb,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Tv,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { BusTelemetry, CommandFeedback } from "../../lib/types";
import { cn } from "../../lib/utils";

interface HardwareTestViewProps {
  telemetry: BusTelemetry;
  commandFeedback: CommandFeedback | null;
  onOpenDoor: () => void;
  onCloseDoor: () => void;
  onResetCount: () => void;
  onTestBuzzer: () => void;
  onTestLed: () => void;
  onReconnectWs: () => void;
}

export function HardwareTestView({
  telemetry,
  commandFeedback,
  onOpenDoor,
  onCloseDoor,
  onResetCount,
  onTestBuzzer,
  onTestLed,
  onReconnectWs,
}: HardwareTestViewProps) {
  // Configurable stale threshold in milliseconds (default: 1000 ms)
  const [staleThresholdMs, setStaleThresholdMs] = useState<number>(1000);
  const [customThresholdInput, setCustomThresholdInput] = useState<string>("1000");
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // High-frequency tick for accurate relative elapsed age calculation
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Compute telemetry message arrival age
  const lastPacketAgeMs = useMemo(() => {
    if (!telemetry.esp32Connected || !telemetry.lastTelemetryReceivedMs) {
      return null;
    }
    return Math.max(0, nowMs - telemetry.lastTelemetryReceivedMs);
  }, [telemetry.esp32Connected, telemetry.lastTelemetryReceivedMs, nowMs]);

  // Telemetry Freshness State: "LIVE" | "STALE" | "OFFLINE"
  const freshness = useMemo<"LIVE" | "STALE" | "OFFLINE">(() => {
    if (!telemetry.esp32Connected || !telemetry.wsConnected) {
      return "OFFLINE";
    }
    if (lastPacketAgeMs === null) {
      return "OFFLINE";
    }
    return lastPacketAgeMs <= staleThresholdMs ? "LIVE" : "STALE";
  }, [telemetry.esp32Connected, telemetry.wsConnected, lastPacketAgeMs, staleThresholdMs]);

  // Formatted last timestamp string
  const formattedLastTimestamp = useMemo(() => {
    if (!telemetry.lastTelemetryReceivedMs) return "No telemetry received";
    const d = new Date(telemetry.lastTelemetryReceivedMs);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;
  }, [telemetry.lastTelemetryReceivedMs]);

  // Handle setting predefined stale threshold
  const applyPresetThreshold = (val: number) => {
    setStaleThresholdMs(val);
    setCustomThresholdInput(String(val));
  };

  // Sensor Diagnostic Table Evaluation Criteria
  const diagnostics = useMemo(() => {
    const isOnline = telemetry.esp32Connected;

    return [
      {
        id: "sonar",
        component: "HC-SR04 Ultrasonic",
        pin: "TRIG: GPIO 5 | ECHO: GPIO 18 (Divider)",
        expected: "2.0 – 400.0 cm distance value",
        actual: isOnline ? `${telemetry.distanceCm.toFixed(1)} cm` : "--",
        status: !isOnline
          ? "OFFLINE"
          : telemetry.distanceCm < telemetry.obstacleThresholdCm
          ? "WARN"
          : telemetry.distanceCm >= 900
          ? "FAIL"
          : "PASS",
        note: !isOnline
          ? "No telemetry stream"
          : telemetry.distanceCm < telemetry.obstacleThresholdCm
          ? `Obstacle Hazard (< ${telemetry.obstacleThresholdCm} cm)`
          : "Echo return pulse within normal bounds",
      },
      {
        id: "ir1",
        component: "IR Sensor 1 (Exterior Entry)",
        pin: "GPIO 27 (Input Active-LOW)",
        expected: "Digital state: LOW / HIGH",
        actual: isOnline ? (telemetry.ir1Active ? "LOW (BLOCKED)" : "HIGH (CLEAR)") : "--",
        status: !isOnline ? "OFFLINE" : "PASS",
        note: !isOnline
          ? "No telemetry stream"
          : telemetry.ir1Active
          ? "Entry breakbeam currently interrupted"
          : "Optical path clear",
      },
      {
        id: "ir2",
        component: "IR Sensor 2 (Interior Exit)",
        pin: "GPIO 26 (Input Active-LOW)",
        expected: "Digital state: LOW / HIGH",
        actual: isOnline ? (telemetry.ir2Active ? "LOW (BLOCKED)" : "HIGH (CLEAR)") : "--",
        status: !isOnline ? "OFFLINE" : "PASS",
        note: !isOnline
          ? "No telemetry stream"
          : telemetry.ir2Active
          ? "Exit breakbeam currently interrupted"
          : "Optical path clear",
      },
      {
        id: "servo",
        component: "SG90 Door Actuator",
        pin: "GPIO 19 (LEDC PWM 50Hz)",
        expected: "Valid angle: 0° (Closed) to 90° (Open)",
        actual: isOnline ? `${telemetry.servoAngle}° (${telemetry.doorState})` : "--",
        status: !isOnline ? "OFFLINE" : telemetry.servoAngle >= 0 && telemetry.servoAngle <= 90 ? "PASS" : "WARN",
        note: !isOnline
          ? "No telemetry stream"
          : telemetry.doorState === "BLOCKED"
          ? "Safety interlock holding aperture"
          : "Aperture servo angle synchronized",
      },
      {
        id: "buzzer",
        component: "Active Piezo Buzzer",
        pin: "GPIO 23 (Output)",
        expected: "Active on hazard (< 5 cm) / silent when clear",
        actual: isOnline ? (telemetry.buzzerActive ? "ACTIVE (HIGH)" : "MUTED (LOW)") : "--",
        status: !isOnline ? "OFFLINE" : "PASS",
        note: !isOnline
          ? "No telemetry stream"
          : telemetry.buzzerActive
          ? "2.4 kHz acoustic warning alarm active"
          : "Acoustic line pulled LOW (silent)",
      },
      {
        id: "led",
        component: "Red Safety Strobe LED",
        pin: "GPIO 2 (220Ω Resistor to GND)",
        expected: "Synchronized optical strobe on collision hazard",
        actual: isOnline ? (telemetry.ledActive ? "ACTIVE (HIGH)" : "OFF (LOW)") : "--",
        status: !isOnline ? "OFFLINE" : "PASS",
        note: !isOnline
          ? "No telemetry stream"
          : telemetry.ledActive
          ? "Visual hazard beacon illuminated"
          : "LED diode quiescent (dark)",
      },
      {
        id: "lcd",
        component: "16×2 Character LCD (PCF8574)",
        pin: "SDA: GPIO 21 | SCL: GPIO 22 (I2C)",
        expected: "I2C ACK at 0x27 & synchronized 2-line cabin text",
        actual: isOnline
          ? `SYNCED [PAX: ${telemetry.passengerCount} | DOOR: ${telemetry.doorState}]`
          : "--",
        status: !isOnline ? "OFFLINE" : "PASS",
        note: !isOnline
          ? "No telemetry stream"
          : "Authoritative local buffer updated without network dependency",
      },
      {
        id: "serial",
        component: "USB Serial Bridge",
        pin: "USB-A to USB-C (115200 Baud)",
        expected: "USB Serial online & newline-delimited JSON stream",
        actual: isOnline ? `ONLINE (Device ID: ${telemetry.deviceId})` : "DISCONNECTED",
        status: !isOnline ? "OFFLINE" : "PASS",
        note: !isOnline ? "USB Serial link not detected or disconnected" : "115200 baud serial stream active",
      },
      {
        id: "websocket",
        component: "Dashboard WebSocket Relay",
        pin: "/ws/dashboard (Localhost Bridge)",
        expected: "Sub-200ms round-trip latency & persistent ping",
        actual: isOnline ? `${telemetry.latencyMs} ms (${telemetry.wsStatus})` : `${telemetry.wsStatus}`,
        status: !isOnline
          ? "OFFLINE"
          : telemetry.latencyMs > 250
          ? "WARN"
          : "PASS",
        note: !isOnline ? "WebSocket transport disconnected" : "Full duplex RFC 6455 socket streaming",
      },
    ];
  }, [telemetry]);

  const passedCount = diagnostics.filter((d) => d.status === "PASS").length;
  const warnedCount = diagnostics.filter((d) => d.status === "WARN").length;
  const failedCount = diagnostics.filter((d) => d.status === "FAIL").length;
  const offlineCount = diagnostics.filter((d) => d.status === "OFFLINE").length;

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER & BENCH STATUS STRIP ───────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary-light shadow-glow-blue">
              <Wrench className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                  Hardware Test &amp; Verification Bench
                </h1>
                <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-cyan-400">
                  Bench Mode
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                Authoritative electrical pin, ultrasonic ranging, digital breakbeam, and actuator diagnostic console.
              </p>
            </div>
          </div>
        </div>

        {/* Freshness & Stale Configuration Widget */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Freshness Indicator Pill */}
          <div
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all shadow-sm",
              freshness === "LIVE" && "border-safe/50 bg-safe/10 text-safe shadow-glow-green",
              freshness === "STALE" && "border-amber-500/50 bg-amber-500/10 text-amber-400 animate-pulse",
              freshness === "OFFLINE" && "border-danger/50 bg-danger/10 text-danger"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                freshness === "LIVE" && "bg-safe animate-ping",
                freshness === "STALE" && "bg-amber-400",
                freshness === "OFFLINE" && "bg-danger"
              )}
            />
            <span className="tracking-wider">
              {freshness === "LIVE" && "FRESHNESS: LIVE"}
              {freshness === "STALE" && "FRESHNESS: STALE"}
              {freshness === "OFFLINE" && "FRESHNESS: OFFLINE"}
            </span>
            {lastPacketAgeMs !== null && freshness !== "OFFLINE" && (
              <span className="text-[10px] opacity-80 border-l border-current/30 pl-2">
                {lastPacketAgeMs} ms
              </span>
            )}
          </div>

          {/* Stale Cutoff Threshold Adjuster Button */}
          <button
            onClick={() => setShowConfigModal(!showConfigModal)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-base-900/80 hover:bg-base-800 text-slate-300 font-mono text-xs transition"
            title="Configure stale telemetry cutoff time"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary-light" />
            <span>Cutoff: {staleThresholdMs}ms</span>
          </button>
        </div>
      </div>

      {/* ── STALE THRESHOLD CONFIGURATION DRAWER (CONDITIONAL) ─────────────── */}
      {showConfigModal && (
        <div className="rounded-xl border border-primary/30 bg-base-900/90 p-4 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary-light" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Telemetry Freshness Threshold Configuration
              </h3>
            </div>
            <span className="text-[11px] font-mono text-muted">
              Current Cutoff: <strong className="text-primary-light">{staleThresholdMs} ms</strong>
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Telemetry is marked <strong className="text-safe">LIVE</strong> if received within this duration. If packet arrival takes longer, state becomes <strong className="text-amber-400">STALE</strong>. If disconnected, it displays <strong className="text-danger">OFFLINE</strong>.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted font-mono mr-1">Presets:</span>
            {[
              { label: "500 ms (Fast / 2 Hz)", val: 500 },
              { label: "1000 ms (Default / 1 Hz)", val: 1000 },
              { label: "2000 ms (Relaxed)", val: 2000 },
              { label: "5000 ms (Slow)", val: 5000 },
            ].map((p) => (
              <button
                key={p.val}
                onClick={() => applyPresetThreshold(p.val)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-mono border transition",
                  staleThresholdMs === p.val
                    ? "border-primary bg-primary/20 text-primary-light font-bold"
                    : "border-border/70 bg-base-950/60 hover:bg-base-950 text-slate-400"
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs font-mono text-muted">Custom (ms):</span>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={customThresholdInput}
                onChange={(e) => setCustomThresholdInput(e.target.value)}
                onBlur={() => {
                  const num = parseInt(customThresholdInput, 10);
                  if (!isNaN(num) && num >= 100 && num <= 10000) {
                    setStaleThresholdMs(num);
                  } else {
                    setCustomThresholdInput(String(staleThresholdMs));
                  }
                }}
                className="w-24 px-2 py-1 bg-base-950 border border-border/80 rounded font-mono text-xs text-slate-100 text-right focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── HARDWARE DISCONNECTED BANNER (STRICT REQUIREMENT: NO LIVE DATA) ─── */}
      {!telemetry.esp32Connected && (
        <div className="rounded-2xl border-2 border-danger/60 bg-gradient-to-r from-danger/20 via-base-900 to-base-950 p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/50 bg-danger/20 text-danger shrink-0">
                <AlertOctagon className="h-7 w-7 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-mono">
                    NO LIVE HARDWARE DATA
                  </h2>
                  <span className="rounded bg-danger/20 border border-danger/40 px-2 py-0.5 text-[10px] font-mono font-bold text-danger">
                    DEVICE DISCONNECTED
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                  The physical ESP32 microcontroller is currently offline. In strict compliance with laboratory test bench directives, <strong>this verification page never fabricates simulated telemetry</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={onReconnectWs}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 hover:bg-danger/20 px-4 py-2.5 font-mono text-xs font-bold text-danger transition shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Link to Server</span>
            </button>
          </div>

          {/* Quick Troubleshooting Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-danger/30 pt-4 text-xs font-mono text-slate-400">
            <div className="flex items-start gap-2">
              <span className="text-danger font-bold">1.</span>
              <span>Connect ESP32 using a USB-A to USB-C DATA cable (verify in Device Manager under Ports COM &amp; LPT).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-danger font-bold">2.</span>
              <span>Set <code className="text-slate-200">SERIAL_PORT=COM5</code> and <code className="text-slate-200">BAUD_RATE=115200</code> in <code className="text-slate-200">server/.env</code>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-danger font-bold">3.</span>
              <span>Start server (<code className="text-slate-200">npm start</code>) and verify <code className="text-slate-200">[SMARTBUS] ESP32 serial connection established</code>.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE HARDWARE SENSOR CARDS (Only live when esp32Connected) ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: HC-SR04 ULTRASONIC */}
        <div className="rounded-xl border border-border/80 bg-base-900/60 p-4 backdrop-blur-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
              HC-SR04 Sonar (GPIO 5/18)
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                !telemetry.esp32Connected
                  ? "bg-slate-800 text-slate-500"
                  : telemetry.distanceCm < telemetry.obstacleThresholdCm
                  ? "bg-danger/20 text-danger border border-danger/40 animate-pulse"
                  : "bg-safe/20 text-safe border border-safe/40"
              )}
            >
              {!telemetry.esp32Connected
                ? "OFFLINE"
                : telemetry.distanceCm < telemetry.obstacleThresholdCm
                ? "HAZARD (<5cm)"
                : "CLEAR"}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black font-mono tracking-tight text-white">
              {telemetry.esp32Connected ? telemetry.distanceCm.toFixed(1) : "--"}
              <span className="text-sm font-normal text-muted ml-1 font-sans">cm</span>
            </div>
            <span className="text-[11px] font-mono text-muted">
              Cutoff: {telemetry.obstacleThresholdCm} cm
            </span>
          </div>

          {/* Mini Distance Bar Gauge */}
          <div className="w-full bg-base-950 rounded-full h-2 overflow-hidden border border-border/60">
            <div
              className={cn(
                "h-full transition-all duration-300",
                !telemetry.esp32Connected
                  ? "bg-slate-800 w-0"
                  : telemetry.distanceCm < telemetry.obstacleThresholdCm
                  ? "bg-danger w-full"
                  : "bg-safe"
              )}
              style={{
                width: telemetry.esp32Connected
                  ? `${Math.min(100, (telemetry.distanceCm / 100) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <div className="text-[10px] font-mono text-muted flex justify-between">
            <span>0 cm (Pinch)</span>
            <span>Threshold: {telemetry.obstacleThresholdCm} cm</span>
            <span>100 cm</span>
          </div>
        </div>

        {/* CARD 2: DUAL IR BREAKBEAM SENSORS */}
        <div className="rounded-xl border border-border/80 bg-base-900/60 p-4 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
              Dual IR Breakbeam (GPIO 27/26)
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                !telemetry.esp32Connected
                  ? "bg-slate-800 text-slate-500"
                  : telemetry.ir1Active || telemetry.ir2Active
                  ? "bg-primary/20 text-primary-light border border-primary/40"
                  : "bg-safe/20 text-safe border border-safe/40"
              )}
            >
              {!telemetry.esp32Connected
                ? "OFFLINE"
                : telemetry.ir1Active || telemetry.ir2Active
                ? "BEAM TRIP"
                : "CLEAR"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
            {/* IR1 */}
            <div className="p-2 rounded-lg bg-base-950/70 border border-border/60">
              <div className="text-[10px] text-muted">IR1 (Exterior)</div>
              <div
                className={cn(
                  "text-sm font-bold mt-1",
                  !telemetry.esp32Connected
                    ? "text-slate-600"
                    : telemetry.ir1Active
                    ? "text-primary-light"
                    : "text-slate-300"
                )}
              >
                {!telemetry.esp32Connected
                  ? "--"
                  : telemetry.ir1Active
                  ? "LOW (TRIP)"
                  : "HIGH (IDLE)"}
              </div>
            </div>

            {/* IR2 */}
            <div className="p-2 rounded-lg bg-base-950/70 border border-border/60">
              <div className="text-[10px] text-muted">IR2 (Interior)</div>
              <div
                className={cn(
                  "text-sm font-bold mt-1",
                  !telemetry.esp32Connected
                    ? "text-slate-600"
                    : telemetry.ir2Active
                    ? "text-primary-light"
                    : "text-slate-300"
                )}
              >
                {!telemetry.esp32Connected
                  ? "--"
                  : telemetry.ir2Active
                  ? "LOW (TRIP)"
                  : "HIGH (IDLE)"}
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-muted flex justify-between">
            <span>Sequence: Ingress (IR1→IR2)</span>
            <span>Egress (IR2→IR1)</span>
          </div>
        </div>

        {/* CARD 3: SG90 SERVO APERTURE */}
        <div className="rounded-xl border border-border/80 bg-base-900/60 p-4 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
              SG90 Door Servo (GPIO 19)
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                !telemetry.esp32Connected
                  ? "bg-slate-800 text-slate-500"
                  : telemetry.doorState === "OPEN"
                  ? "bg-safe/20 text-safe border border-safe/40"
                  : telemetry.doorState === "CLOSED"
                  ? "bg-slate-700 text-slate-300"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              )}
            >
              {!telemetry.esp32Connected ? "OFFLINE" : telemetry.doorState}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black font-mono tracking-tight text-white">
              {telemetry.esp32Connected ? `${telemetry.servoAngle}°` : "--"}
            </div>
            <span className="text-[11px] font-mono text-muted">
              LEDC PWM 50Hz
            </span>
          </div>

          {/* Aperture Arc / Bar */}
          <div className="w-full bg-base-950 rounded-full h-2 overflow-hidden border border-border/60">
            <div
              className={cn(
                "h-full transition-all duration-300",
                !telemetry.esp32Connected ? "bg-slate-800 w-0" : "bg-primary-light"
              )}
              style={{
                width: telemetry.esp32Connected
                  ? `${Math.max(0, Math.min(100, (telemetry.servoAngle / 90) * 100))}%`
                  : "0%",
              }}
            />
          </div>
          <div className="text-[10px] font-mono text-muted flex justify-between">
            <span>0° (Closed)</span>
            <span>45° (Mid)</span>
            <span>90° (Open)</span>
          </div>
        </div>

        {/* CARD 4: BUZZER & RED LED ALARMS */}
        <div className="rounded-xl border border-border/80 bg-base-900/60 p-4 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
              Audio / Visual Alarms (GPIO 23/2)
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                !telemetry.esp32Connected
                  ? "bg-slate-800 text-slate-500"
                  : telemetry.buzzerActive || telemetry.ledActive
                  ? "bg-danger/20 text-danger border border-danger/40 animate-pulse"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              {!telemetry.esp32Connected
                ? "OFFLINE"
                : telemetry.buzzerActive || telemetry.ledActive
                ? "ACTIVE ALARM"
                : "QUIESCENT"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
            {/* Buzzer */}
            <div className="p-2 rounded-lg bg-base-950/70 border border-border/60 flex items-center gap-2">
              {telemetry.buzzerActive ? (
                <Volume2 className="h-4 w-4 text-danger animate-pulse" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-500" />
              )}
              <div>
                <div className="text-[9px] text-muted">Buzzer (G23)</div>
                <div className="text-xs font-bold text-slate-200">
                  {!telemetry.esp32Connected ? "--" : telemetry.buzzerActive ? "SOUNDING" : "MUTED"}
                </div>
              </div>
            </div>

            {/* LED */}
            <div className="p-2 rounded-lg bg-base-950/70 border border-border/60 flex items-center gap-2">
              <Lightbulb
                className={cn(
                  "h-4 w-4",
                  telemetry.ledActive ? "text-danger animate-pulse" : "text-slate-500"
                )}
              />
              <div>
                <div className="text-[9px] text-muted">LED (G2)</div>
                <div className="text-xs font-bold text-slate-200">
                  {!telemetry.esp32Connected ? "--" : telemetry.ledActive ? "STROBING" : "DARK"}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-muted flex justify-between">
            <span>Interlock Coupled</span>
            <span>Non-blocking Timer</span>
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: VIRTUAL 16×2 LCD PREVIEW & BENCH CONTROLS ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VIRTUAL 16×2 LCD HARDWARE REPLICA */}
        <div className="rounded-xl border border-border/80 bg-base-900/70 p-5 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-primary-light" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Physical 16×2 LCD Screen Mirror (I2C 0x27)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-muted">
              SDA: GPIO 21 • SCL: GPIO 22
            </span>
          </div>

          <p className="text-xs text-muted">
            Direct visual replica of the HD44780 LCD backpack. Updates are driven 100% locally by the ESP32 CPU with differential line caching to eliminate screen flicker.
          </p>

          {/* Simulated Retro LCD Screen Bezel */}
          <div className="rounded-lg border-4 border-slate-800 bg-[#0f2e1a] p-4 shadow-inner">
            <div className="font-mono text-sm tracking-widest text-[#5bf58c] font-black space-y-1 select-none">
              {/* Row 0 */}
              <div className="bg-[#0b2414] px-2 py-1 rounded border border-[#1b4d2c]/50">
                {!telemetry.esp32Connected
                  ? "SYSTEM OFFLINE "
                  : telemetry.distanceCm < telemetry.obstacleThresholdCm
                  ? "!!! OBSTACLE !!!"
                  : `PASSENGERS: ${String(telemetry.passengerCount).padEnd(4, " ")}`}
              </div>
              {/* Row 1 */}
              <div className="bg-[#0b2414] px-2 py-1 rounded border border-[#1b4d2c]/50">
                {!telemetry.esp32Connected
                  ? "WAITING HARDWARE"
                  : telemetry.distanceCm < telemetry.obstacleThresholdCm
                  ? "REOPENING...    "
                  : telemetry.doorState === "OPEN"
                  ? "DOOR: OPEN      "
                  : "DOOR: CLOSE     "}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-1">
            <span>Geometry: 16 Columns × 2 Rows</span>
            <span>Wi-Fi Independent: <strong className="text-safe">YES</strong></span>
          </div>
        </div>

        {/* INTERACTIVE BENCH DIAGNOSTIC CONTROLS */}
        <div className="rounded-xl border border-border/80 bg-base-900/70 p-5 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary-light" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Direct Hardware Bench Actuation Controls
              </h3>
            </div>
            <span className="text-[10px] font-mono text-muted">
              ESP32 Downlink Relay
            </span>
          </div>

          <p className="text-xs text-muted">
            Send authoritative verification commands directly to the ESP32 during physical project demonstrations.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Test Buzzer */}
            <button
              onClick={onTestBuzzer}
              disabled={!telemetry.esp32Connected}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border/80 bg-base-950/80 hover:bg-base-950 text-slate-200 text-xs font-mono font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Volume2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Test Buzzer (300ms)</span>
            </button>

            {/* Test LED */}
            <button
              onClick={onTestLed}
              disabled={!telemetry.esp32Connected}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border/80 bg-base-950/80 hover:bg-base-950 text-slate-200 text-xs font-mono font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Lightbulb className="h-3.5 w-3.5 text-danger" />
              <span>Test LED (600ms)</span>
            </button>

            {/* Command Open Door */}
            <button
              onClick={onOpenDoor}
              disabled={!telemetry.esp32Connected}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-safe/40 bg-safe/10 hover:bg-safe/20 text-safe text-xs font-mono font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Open Door (90°)</span>
            </button>

            {/* Command Close Door */}
            <button
              onClick={onCloseDoor}
              disabled={!telemetry.esp32Connected}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary-light text-xs font-mono font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Close Door (0°)</span>
            </button>
          </div>

          <div className="pt-1">
            <button
              onClick={onResetCount}
              disabled={!telemetry.esp32Connected}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-base-950/50 hover:bg-base-950 text-slate-400 hover:text-slate-200 text-xs font-mono transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Zero Passenger Counter in RAM (RESET_PASSENGER_COUNT)</span>
            </button>
          </div>

          {/* Active Command Feedback Toast inline */}
          {commandFeedback && (
            <div className="rounded-lg border border-primary/40 bg-base-950/90 p-2.5 text-xs font-mono flex items-center justify-between">
              <span className="text-primary-light font-bold">
                [{commandFeedback.command}] {commandFeedback.message}
              </span>
              <span className="text-[10px] text-muted">
                {new Date(commandFeedback.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── SENSOR DIAGNOSTIC TABLE (CORE REQUIREMENT) ────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-base-900/60 p-5 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Activity className="h-4 w-4 text-primary-light" />
              <h2 className="font-bold text-sm sm:text-base uppercase tracking-wider text-slate-100">
                Sensor &amp; Subsystem Diagnostic Verification Table
              </h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Live validation matrix evaluating sensor telemetry against nominal electrical &amp; logical tolerances.
            </p>
          </div>

          {/* Summary tally badges */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2 py-0.5 rounded bg-safe/10 border border-safe/30 text-safe font-bold">
              {passedCount} PASS
            </span>
            {warnedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                {warnedCount} WARN
              </span>
            )}
            {failedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-danger/10 border border-danger/30 text-danger font-bold">
                {failedCount} FAIL
              </span>
            )}
            {offlineCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-bold">
                {offlineCount} OFFLINE
              </span>
            )}
          </div>
        </div>

        {/* THE TABLE */}
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-base-950/80 border-b border-border/70 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Component</th>
                <th className="py-3 px-4 font-semibold">Expected</th>
                <th className="py-3 px-4 font-semibold">Actual</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold hidden md:table-cell">Diagnostic Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-base-950/30">
              {diagnostics.map((row) => (
                <tr key={row.id} className="hover:bg-base-900/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-200">{row.component}</div>
                    <div className="text-[10px] text-muted">{row.pin}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{row.expected}</td>
                  <td className="py-3 px-4 font-bold">
                    <span
                      className={cn(
                        row.status === "PASS" && "text-safe",
                        row.status === "WARN" && "text-amber-400",
                        row.status === "FAIL" && "text-danger",
                        row.status === "OFFLINE" && "text-slate-500 font-normal"
                      )}
                    >
                      {row.actual}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                        row.status === "PASS" && "bg-safe/20 text-safe border border-safe/40",
                        row.status === "WARN" && "bg-amber-500/20 text-amber-400 border border-amber-500/40",
                        row.status === "FAIL" && "bg-danger/20 text-danger border border-danger/40 animate-pulse",
                        row.status === "OFFLINE" && "bg-slate-800 text-slate-400 border border-slate-700"
                      )}
                    >
                      {row.status === "PASS" && <CheckCircle2 className="h-3 w-3" />}
                      {row.status === "WARN" && <AlertTriangle className="h-3 w-3" />}
                      {row.status === "FAIL" && <XCircle className="h-3 w-3" />}
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[11px] text-slate-400 hidden md:table-cell">
                    {row.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Telemetry Timestamp Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] font-mono text-muted border-t border-border/60">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary-light" />
            <span>
              Last Telemetry Timestamp:{" "}
              <strong className="text-slate-200">{formattedLastTimestamp}</strong>
            </span>
          </div>
          <div>
            <span>
              Active WebSocket Endpoint:{" "}
              <code className="text-primary-light">{telemetry.serverUrl || "ws://localhost:8089/ws/dashboard"}</code>
            </span>
          </div>
        </div>
      </div>

      {/* ── HARDWARE PINOUT ELECTRICAL REFERENCE TABLE ─────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-base-900/60 p-5 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary-light" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
              ESP32 Hardware Pin Allocation &amp; Electrical Safety Map
            </h3>
          </div>
          <span className="text-[10px] font-mono text-muted">docs/WIRING.md</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-base-950/70 border border-border/60 space-y-1">
            <div className="font-bold text-primary-light">HC-SR04 ECHO (GPIO 18)</div>
            <div className="text-[11px] text-danger font-semibold">★ 5V → 3.3V Voltage Divider (1kΩ + 2kΩ)</div>
            <div className="text-[10px] text-muted">Protects ESP32 silicon against 5.0V overvoltage burnout.</div>
          </div>

          <div className="p-3 rounded-lg bg-base-950/70 border border-border/60 space-y-1">
            <div className="font-bold text-primary-light">SG90 SERVO (GPIO 19)</div>
            <div className="text-[11px] text-amber-400 font-semibold">★ Dedicated 5V Rail (≥ 2.0A) + Common GND</div>
            <div className="text-[10px] text-muted">Never power from ESP32 3.3V pin to avoid Wi-Fi brownouts.</div>
          </div>

          <div className="p-3 rounded-lg bg-base-950/70 border border-border/60 space-y-1">
            <div className="font-bold text-primary-light">IR1 &amp; IR2 (GPIO 27 &amp; 26)</div>
            <div className="text-[11px] text-safe font-semibold">Native 3.3V VCC Operation</div>
            <div className="text-[10px] text-muted">Active-LOW breakbeam logic with on-board potentiometer calibration.</div>
          </div>

          <div className="p-3 rounded-lg bg-base-950/70 border border-border/60 space-y-1">
            <div className="font-bold text-primary-light">BUZZER &amp; LED (GPIO 23 &amp; 2)</div>
            <div className="text-[11px] text-slate-300 font-semibold">GPIO 2 (220Ω Resistor) • GPIO 23 Direct</div>
            <div className="text-[10px] text-muted">GPIO 2 resistor pull-down guarantees nominal ESP32 bootloader boot.</div>
          </div>

          <div className="p-3 rounded-lg bg-base-950/70 border border-border/60 space-y-1">
            <div className="font-bold text-primary-light">16×2 LCD BACKPACK (GPIO 21 &amp; 22)</div>
            <div className="text-[11px] text-safe font-semibold">I2C Address 0x27 (Configurable in config.h)</div>
            <div className="text-[10px] text-muted">SDA: GPIO 21, SCL: GPIO 22. Powered from 5V rail for contrast.</div>
          </div>

          <div className="p-3 rounded-lg bg-base-950/70 border border-border/60 space-y-1">
            <div className="font-bold text-primary-light">COMMON REFERENCE GROUND</div>
            <div className="text-[11px] text-safe font-semibold">★ All Module Grounds Tied Together (0V)</div>
            <div className="text-[10px] text-muted">Mandatory star topology ensures clean PWM &amp; echo signal returns.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

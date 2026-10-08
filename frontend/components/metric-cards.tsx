"use client";

import {
  Users,
  DoorOpen,
  DoorClosed,
  Activity,
  Cpu,
  Wifi,
  Radio,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "../lib/utils";
import { BusTelemetry, DoorState } from "../lib/types";

interface MetricCardsProps {
  telemetry: BusTelemetry;
  onCommandOpen: () => void;
  onCommandClose: () => void;
  onCommandReset: () => void;
}

export function MetricCards({
  telemetry,
  onCommandOpen,
  onCommandClose,
  onCommandReset,
}: MetricCardsProps) {
  const {
    passengerCount,
    entryCount,
    exitCount,
    maxCapacity,
    doorState,
    servoAngle,
    distanceCm,
    obstacleThresholdCm,
    esp32Connected,
    wsConnected,
    ir1Active,
    ir2Active,
    latencyMs,
  } = telemetry;

  const occupancyRatio = Math.min(100, Math.round((passengerCount / maxCapacity) * 100));
  const controlsEnabled = esp32Connected || telemetry.isDemoMode;

  // Door status styling & badge
  const doorStyles: Record<
    DoorState,
    {
      bg: string;
      border: string;
      text: string;
      glow: string;
      icon: typeof DoorOpen;
      desc: string;
    }
  > = {
    OPEN: {
      bg: "bg-safe/10",
      border: "border-safe/30",
      text: "text-safe",
      glow: "shadow-[0_0_20px_rgba(93,229,160,0.15)]",
      icon: DoorOpen,
      desc: `Servo aperture: ${servoAngle}° (Clear passage)`,
    },
    CLOSED: {
      bg: "bg-slate-800/50",
      border: "border-slate-700/60",
      text: "text-slate-300",
      glow: "shadow-none",
      icon: DoorClosed,
      desc: `Servo secured: ${servoAngle}° (Door latched)`,
    },
    CLOSING: {
      bg: "bg-watch/10",
      border: "border-watch/40",
      text: "text-watch",
      glow: "shadow-[0_0_20px_rgba(255,197,92,0.15)]",
      icon: DoorClosed,
      desc: `Transit active: ${servoAngle}° (Sensors armed)`,
    },
    REOPENING: {
      bg: "bg-primary/10",
      border: "border-primary/40",
      text: "text-primary-light",
      glow: "shadow-[0_0_20px_rgba(45,156,255,0.2)]",
      icon: DoorOpen,
      desc: `Safety release: ${servoAngle}° (Reversing)`,
    },
    BLOCKED: {
      bg: "bg-danger/15",
      border: "border-danger/50",
      text: "text-danger animate-pulse",
      glow: "shadow-[0_0_25px_rgba(255,104,117,0.3)]",
      icon: AlertTriangle,
      desc: `Obstacle < 5 cm: ${servoAngle}° (Safety Stop)`,
    },
  };

  const currentDoorStyle = doorStyles[doorState];
  const DoorIcon = currentDoorStyle.icon;

  // Obstacle distance styling
  const isCriticalObstacle = distanceCm < obstacleThresholdCm;
  const isCautionObstacle = distanceCm >= obstacleThresholdCm && distanceCm < 15;
  const clampedDistance = Math.min(50, Math.max(0, distanceCm));
  const distanceBarPercent = Math.min(100, Math.round((clampedDistance / 50) * 100));
  const thresholdBarPercent = Math.round((obstacleThresholdCm / 50) * 100); // 10% on 50cm scale

  // Sensor health status count
  const sensorsOk = !isCriticalObstacle;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
      {/* ── CARD 1: CURRENT PASSENGERS ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/70 to-base-950 p-5 shadow-panel backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
              METRIC 01 // PASSENGERS
            </div>
            <h3 className="text-xs font-semibold text-slate-300 mt-0.5">
              CURRENT PASSENGERS
            </h3>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary-light">
            <Users className="h-4 w-4" />
          </div>
        </div>

        {/* Large Number Readout */}
        <div className="mt-3.5 flex items-baseline gap-2">
          <span className="font-mono text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-50">
            {passengerCount}
          </span>
          <span className="font-mono text-xs text-muted">
            / {maxCapacity} MAX
          </span>
        </div>

        {/* Capacity Bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted">
            <span>Capacity Occupancy</span>
            <span
              className={cn(
                "font-semibold",
                occupancyRatio > 85 ? "text-danger" : "text-slate-300"
              )}
            >
              {occupancyRatio}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-950">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                occupancyRatio > 85
                  ? "bg-danger"
                  : occupancyRatio > 60
                  ? "bg-amber-400"
                  : "bg-primary"
              )}
              style={{ width: `${occupancyRatio}%` }}
            />
          </div>
        </div>

        {/* Entry / Exit Stats */}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-entry-blue/10 text-entry-blue">
              <ArrowDownToLine className="h-3 w-3" />
            </span>
            <span className="text-slate-400 text-[11px]">Entry:</span>
            <span className="font-bold text-entry-blue">+{entryCount}</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-exit-violet/10 text-exit-violet">
              <ArrowUpFromLine className="h-3 w-3" />
            </span>
            <span className="text-slate-400 text-[11px]">Exit:</span>
            <span className="font-bold text-exit-violet">-{exitCount}</span>
          </div>

          <button
            onClick={onCommandReset}
            disabled={!controlsEnabled}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded border transition",
              controlsEnabled
                ? "border-border/80 text-muted hover:border-slate-500 hover:text-slate-200"
                : "border-border/40 text-slate-600 cursor-not-allowed"
            )}
            title={controlsEnabled ? "Reset passenger count" : "Device offline — controls disabled"}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── CARD 2: DOOR STATUS ───────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-base-900/95 via-base-900/70 to-base-950 p-5 shadow-panel backdrop-blur-md transition-all",
          currentDoorStyle.border,
          currentDoorStyle.glow
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
              METRIC 02 // ACTUATOR
            </div>
            <h3 className="text-xs font-semibold text-slate-300 mt-0.5">
              DOOR STATUS
            </h3>
          </div>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              currentDoorStyle.border,
              currentDoorStyle.bg,
              currentDoorStyle.text
            )}
          >
            <DoorIcon className="h-4 w-4" />
          </div>
        </div>

        {/* Large State Readout */}
        <div className="mt-3.5 flex items-center gap-3">
          <span
            className={cn(
              "font-mono text-3xl lg:text-4xl font-extrabold tracking-tight",
              currentDoorStyle.text
            )}
          >
            {doorState}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
              currentDoorStyle.bg,
              currentDoorStyle.text,
              "border",
              currentDoorStyle.border
            )}
          >
            SG90: {servoAngle}°
          </span>
        </div>

        <p className="mt-2 text-[11px] text-muted font-mono">
          {doorState === "BLOCKED" ? (
            <span className="text-danger font-semibold">
              Obstacle &lt; 5 cm: Door Reopening Active
            </span>
          ) : (
            currentDoorStyle.desc
          )}
        </p>

        {/* Door Quick Action Controls */}
        <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
          <button
            onClick={onCommandOpen}
            disabled={!controlsEnabled || doorState === "OPEN"}
            title={controlsEnabled ? "Open entrance door" : "Device offline — controls disabled"}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium border transition",
              !controlsEnabled
                ? "border-border/30 bg-base-950 text-slate-600 opacity-60 cursor-not-allowed"
                : doorState === "OPEN"
                ? "border-safe/40 bg-safe/10 text-safe opacity-80 cursor-default"
                : "border-border hover:border-safe/40 hover:bg-safe/10 text-slate-300 hover:text-safe"
            )}
          >
            <DoorOpen className="h-3.5 w-3.5" />
            Open (90°)
          </button>

          <button
            onClick={onCommandClose}
            disabled={!controlsEnabled || doorState === "CLOSED" || doorState === "BLOCKED"}
            title={
              !controlsEnabled
                ? "Device offline — controls disabled"
                : doorState === "BLOCKED"
                ? "Doorway blocked by obstacle"
                : "Close entrance door"
            }
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium border transition",
              !controlsEnabled
                ? "border-border/30 bg-base-950 text-slate-600 opacity-60 cursor-not-allowed"
                : doorState === "CLOSED"
                ? "border-slate-600 bg-slate-800/40 text-slate-300 opacity-80 cursor-default"
                : "border-border hover:border-amber-400/40 hover:bg-amber-400/10 text-slate-300 hover:text-amber-400"
            )}
          >
            <DoorClosed className="h-3.5 w-3.5" />
            Close (0°)
          </button>
        </div>
      </div>

      {/* ── CARD 3: OBSTACLE DISTANCE ─────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-base-900/95 via-base-900/70 to-base-950 p-5 shadow-panel backdrop-blur-md transition-all",
          isCriticalObstacle
            ? "border-danger/60 shadow-[0_0_25px_rgba(255,104,117,0.25)]"
            : isCautionObstacle
            ? "border-amber-500/40"
            : "border-border/90"
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
              METRIC 03 // HC-SR04
            </div>
            <h3 className="text-xs font-semibold text-slate-300 mt-0.5">
              OBSTACLE DISTANCE
            </h3>
          </div>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              isCriticalObstacle
                ? "border-danger/40 bg-danger/20 text-danger animate-pulse"
                : isCautionObstacle
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-safe/30 bg-safe/10 text-safe"
            )}
          >
            <Activity className="h-4 w-4" />
          </div>
        </div>

        {/* Distance Readout */}
        <div className="mt-3.5 flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-4xl lg:text-5xl font-extrabold tracking-tight",
              isCriticalObstacle
                ? "text-danger"
                : isCautionObstacle
                ? "text-amber-400"
                : "text-slate-50"
            )}
          >
            {distanceCm >= 900 ? "—" : distanceCm.toFixed(1)}
          </span>
          <span className="font-mono text-xs text-muted">cm</span>

          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase",
              isCriticalObstacle
                ? "bg-danger/20 text-danger border border-danger/40 animate-pulse"
                : isCautionObstacle
                ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                : "bg-safe/15 text-safe border border-safe/30"
            )}
          >
            {isCriticalObstacle
              ? "CRITICAL (<5cm)"
              : isCautionObstacle
              ? "CAUTION"
              : "CLEAR"}
          </span>
        </div>

        {/* Visual Safety Threshold Gauge */}
        <div className="mt-4 space-y-1.5">
          <div className="relative h-3 w-full rounded-md bg-base-950 border border-border/80 overflow-hidden">
            {/* Danger Zone (0 to 5 cm = 10%) */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-danger/25 border-r-2 border-danger z-10"
              style={{ width: `${thresholdBarPercent}%` }}
              title="Critical safety zone (<5.0 cm)"
            />

            {/* Current distance indicator bar */}
            <div
              className={cn(
                "h-full transition-all duration-300",
                isCriticalObstacle
                  ? "bg-danger"
                  : isCautionObstacle
                  ? "bg-amber-400"
                  : "bg-safe"
              )}
              style={{ width: `${distanceBarPercent}%` }}
            />
          </div>

          <div className="flex justify-between font-mono text-[10px] text-muted">
            <span className="text-danger font-semibold">0 cm</span>
            <span className="text-danger font-semibold underline decoration-danger">
              ▲ 5.0 cm THRESHOLD
            </span>
            <span>50 cm</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[10px] font-mono text-muted">
          <span>Ultrasonic Pulse: TRIG 5 / ECHO 18</span>
          <span className={isCriticalObstacle ? "text-danger" : "text-safe"}>
            {isCriticalObstacle ? "STOP TRIGGERED" : "BEAM CLEAR"}
          </span>
        </div>
      </div>

      {/* ── CARD 4: SYSTEM STATUS ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/70 to-base-950 p-5 shadow-panel backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
              METRIC 04 // PIPELINE
            </div>
            <h3 className="text-xs font-semibold text-slate-300 mt-0.5">
              SYSTEM STATUS
            </h3>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary-light">
            <Radio className="h-4 w-4" />
          </div>
        </div>

        {/* Three subsystem indicators */}
        <div className="mt-3.5 space-y-2.5">
          {/* Subsystem 1: ESP32 Microcontroller */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-base-950/60 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-muted" />
              <span className="font-medium text-slate-300">ESP32 MCU</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  esp32Connected ? "bg-safe animate-pulse" : "bg-watch"
                )}
              />
              <span
                className={cn(
                  "font-bold",
                  esp32Connected ? "text-safe" : "text-slate-400"
                )}
              >
                {esp32Connected ? "ONLINE (3.3V)" : "OFFLINE"}
              </span>
            </div>
          </div>

          {/* Subsystem 2: WebSocket Server */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-base-950/60 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Wifi className="h-3.5 w-3.5 text-muted" />
              <span className="font-medium text-slate-300">WebSocket</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  telemetry.wsStatus === "CONNECTING"
                    ? "bg-amber-400 animate-pulse"
                    : wsConnected
                    ? "bg-safe"
                    : "bg-danger"
                )}
              />
              <span
                className={cn(
                  "font-bold",
                  telemetry.wsStatus === "CONNECTING"
                    ? "text-amber-300"
                    : wsConnected
                    ? "text-safe"
                    : "text-danger"
                )}
              >
                {telemetry.wsStatus === "CONNECTING"
                  ? "CONNECTING..."
                  : wsConnected
                  ? `LINKED (${latencyMs}ms)`
                  : "DISCONNECTED"}
              </span>
            </div>
          </div>

          {/* Subsystem 3: Sensors Array */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-base-950/60 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted" />
              <span className="font-medium text-slate-300">Sensors</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  !esp32Connected
                    ? "bg-slate-500"
                    : isCriticalObstacle
                    ? "bg-danger animate-pulse"
                    : "bg-safe"
                )}
              />
              <span
                className={cn(
                  "font-bold",
                  !esp32Connected
                    ? "text-slate-400"
                    : isCriticalObstacle
                    ? "text-danger"
                    : "text-safe"
                )}
              >
                {!esp32Connected
                  ? "OFFLINE"
                  : isCriticalObstacle
                  ? "HAZARD ACTIVE"
                  : "ALL NOMINAL"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[10px] font-mono text-muted">
          <span>IR1: {ir1Active ? "BEAM TRIP" : "READY"}</span>
          <span>IR2: {ir2Active ? "BEAM TRIP" : "READY"}</span>
        </div>
      </div>
    </div>
  );
}

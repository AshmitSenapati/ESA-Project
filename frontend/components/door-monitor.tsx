"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Volume2,
  VolumeX,
  Gauge,
  Radio,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { BusTelemetry } from "../lib/types";

interface DoorMonitorProps {
  telemetry: BusTelemetry;
  onSimulateObstacle: () => void;
  onSimulateEntry: () => void;
  onSimulateExit: () => void;
}

export function DoorMonitor({
  telemetry,
  onSimulateObstacle,
  onSimulateEntry,
  onSimulateExit,
}: DoorMonitorProps) {
  const {
    doorState,
    servoAngle,
    distanceCm,
    obstacleThresholdCm,
    ir1Active,
    ir2Active,
    buzzerActive,
    ledActive,
  } = telemetry;

  const isCriticalObstacle = distanceCm < obstacleThresholdCm;
  const isCautionObstacle = distanceCm >= obstacleThresholdCm && distanceCm < 15;

  // Door leaf percentage translation:
  // OPEN: -85% / +85%
  // CLOSED: 0% / 0%
  // CLOSING: -20% / +20%
  // REOPENING: -70% / +70%
  // BLOCKED: -35% / +35%
  let leftDoorTransform = "translateX(-88%)";
  let rightDoorTransform = "translateX(88%)";
  let doorStatusText = "PASSAGEWAY CLEAR";
  let doorStatusColor = "text-safe border-safe/30 bg-safe/10";

  if (doorState === "CLOSED") {
    leftDoorTransform = "translateX(0%)";
    rightDoorTransform = "translateX(0%)";
    doorStatusText = "DOOR SECURED & LOCKED";
    doorStatusColor = "text-slate-300 border-slate-700 bg-slate-800/60";
  } else if (doorState === "CLOSING") {
    leftDoorTransform = "translateX(-20%)";
    rightDoorTransform = "translateX(20%)";
    doorStatusText = "TRANSIT CLOSING IN PROGRESS";
    doorStatusColor = "text-amber-400 border-amber-400/40 bg-amber-400/10";
  } else if (doorState === "REOPENING") {
    leftDoorTransform = "translateX(-72%)";
    rightDoorTransform = "translateX(72%)";
    doorStatusText = "SAFETY REOPENING TRIGGERED";
    doorStatusColor = "text-primary-light border-primary/40 bg-primary/10";
  } else if (doorState === "BLOCKED") {
    leftDoorTransform = "translateX(-35%)";
    rightDoorTransform = "translateX(35%)";
    doorStatusText = "EMERGENCY SAFETY INTERLOCK ACTIVATED";
    doorStatusColor = "text-danger border-danger/50 bg-danger/15 animate-pulse";
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary-light animate-ping" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary-light font-bold">
              PHYSICAL EMBEDDED DIGITAL TWIN
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-100 mt-0.5">
            LIVE BUS DOOR MONITOR
          </h2>
          <p className="text-xs text-muted">
            Bi-directional entry portal, ultrasonic collision barrier & sequential infrared breakbeam gate
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Buzzer Indicator */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition",
              buzzerActive
                ? "border-danger/60 bg-danger/20 text-danger animate-pulse"
                : "border-border/60 bg-base-950/60 text-muted"
            )}
            title="Active Piezo Buzzer on GPIO 23"
          >
            {buzzerActive ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            <span>BUZZER: {buzzerActive ? "ACTIVE" : "SILENT"}</span>
          </div>

          {/* Red LED Indicator */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition",
              ledActive
                ? "border-danger bg-danger/20 text-danger shadow-[0_0_15px_rgba(255,100,112,0.4)]"
                : "border-border/60 bg-base-950/60 text-muted"
            )}
            title="Red Warning Strobe on GPIO 2 (220Ω series resistor)"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                ledActive ? "bg-danger animate-ping" : "bg-slate-700"
              )}
            />
            <span>ALARM LED: {ledActive ? "FLASHING" : "OFF"}</span>
          </div>

          {/* Main Door Safety Pill */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-xs font-bold uppercase",
              doorStatusColor
            )}
          >
            {isCriticalObstacle ? (
              <ShieldAlert className="h-3.5 w-3.5 text-danger" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-safe" />
            )}
            <span>{doorState}</span>
          </div>
        </div>
      </div>

      {/* ── Main Door Graphic Visualization Frame ────────────────────────── */}
      <div className="relative mt-5 rounded-2xl border border-border/80 bg-base-950/90 p-4 sm:p-6 overflow-hidden min-h-[460px] flex flex-col justify-between">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(45,156,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(45,156,255,0.1) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Top Header Lintel of Door Frame: Sensors, Actuator & Strobe */}
        <div className="relative z-20 flex items-center justify-between border-b border-slate-800/80 bg-base-900/90 rounded-xl px-4 py-2.5 backdrop-blur-sm shadow-md">
          {/* Left: SG90 Servo Actuator Visual */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Gauge className="h-4 w-4 text-primary-light" />
              {/* Rotating servo horn needle */}
              <div
                className="absolute h-3 w-0.5 bg-primary-light origin-bottom transition-transform duration-300"
                style={{
                  transform: `rotate(${servoAngle - 45}deg)`,
                  bottom: "50%",
                }}
              />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold text-slate-300">
                SG90 SERVO (GPIO 19)
              </div>
              <div className="text-[10px] font-mono text-primary-light">
                Position: {servoAngle}° PWM
              </div>
            </div>
          </div>

          {/* Center: HC-SR04 Sensor Unit */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1 text-xs font-mono transition shadow-sm",
                isCriticalObstacle
                  ? "border-danger bg-danger/20 text-danger animate-pulse shadow-glow-danger"
                  : "border-primary/40 bg-base-950 text-slate-200"
              )}
            >
              {/* Twin Ultrasonic transducer eyes */}
              <div className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full border border-slate-500 bg-slate-800 flex items-center justify-center text-[7px] font-bold text-slate-300">
                  T
                </span>
                <span className="h-3 w-3 rounded-full border border-slate-500 bg-slate-800 flex items-center justify-center text-[7px] font-bold text-slate-300">
                  R
                </span>
              </div>
              <span className="font-bold text-[11px]">HC-SR04</span>
              <span className="text-muted text-[10px] hidden sm:inline">
                (TRIG 5 / ECHO 18)
              </span>
            </div>

            <div className="font-mono text-[10px] text-muted mt-0.5">
              Target: <span className={cn("font-bold", isCriticalObstacle ? "text-danger" : "text-safe")}>
                {distanceCm >= 900 ? "OUT OF RANGE" : `${distanceCm.toFixed(1)} cm`}
              </span>{" "}
              / Limit 5.0 cm
            </div>
          </div>

          {/* Right: Red LED Warning Beacon */}
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-mono font-bold text-slate-300">
                RED BEACON
              </div>
              <div className="text-[10px] font-mono text-muted">GPIO 2 (220Ω)</div>
            </div>
            <div
              className={cn(
                "h-6 w-6 rounded-full border flex items-center justify-center transition-all",
                ledActive
                  ? "border-danger bg-danger text-white shadow-[0_0_20px_rgba(255,100,112,0.8)] animate-pulse"
                  : "border-slate-700 bg-slate-900 text-slate-600"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-white/80" />
            </div>
          </div>
        </div>

        {/* ── Door Portal Center Stage ─────────────────────────────────────── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-6">
          {/* Ultrasonic Sonar Projection Cone */}
          <div
            className={cn(
              "absolute top-0 w-48 sm:w-72 h-44 pointer-events-none transition-all duration-300 flex flex-col items-center",
              isCriticalObstacle
                ? "opacity-90"
                : "opacity-40"
            )}
          >
            {/* SVG ultrasonic cone */}
            <svg
              className="w-full h-full"
              viewBox="0 0 200 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="sonarGrad"
                  x1="100"
                  y1="0"
                  x2="100"
                  y2="120"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop
                    offset="0%"
                    stopColor={isCriticalObstacle ? "#ff6875" : "#2d9cff"}
                    stopOpacity="0.6"
                  />
                  <stop
                    offset="100%"
                    stopColor={isCriticalObstacle ? "#ff6875" : "#2d9cff"}
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>
              <polygon
                points="95,0 105,0 180,120 20,120"
                fill="url(#sonarGrad)"
              />
              {/* Sonar pulse rings */}
              <path
                d="M 60,40 Q 100,55 140,40"
                stroke={isCriticalObstacle ? "#ff6875" : "#55b8ff"}
                strokeWidth="1.5"
                strokeDasharray="4 2"
                className="animate-pulse"
              />
              <path
                d="M 40,80 Q 100,100 160,80"
                stroke={isCriticalObstacle ? "#ff6875" : "#55b8ff"}
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </svg>

            {/* Ultrasonic Distance Callout Tag */}
            <div
              className={cn(
                "absolute top-14 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase border shadow-lg backdrop-blur-md transition-all",
                isCriticalObstacle
                  ? "border-danger bg-danger text-white animate-bounce"
                  : "border-primary/50 bg-base-950/90 text-primary-light"
              )}
            >
              {isCriticalObstacle
                ? `COLLISION STOP: ${distanceCm.toFixed(1)} cm < 5.0 cm`
                : `Beam clearance: ${distanceCm.toFixed(1)} cm`}
            </div>
          </div>

          {/* Bus Physical Door Portal Frame */}
          <div className="relative w-full max-w-md h-64 rounded-xl border-4 border-slate-700 bg-base-950 shadow-2xl overflow-hidden flex">
            {/* Door Threshold Sill with Hazard Stripes at Bottom */}
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-r from-amber-500/20 via-slate-800 to-amber-500/20 border-t border-slate-700 z-30 flex items-center justify-center">
              <span className="font-mono text-[8px] uppercase tracking-widest text-slate-400">
                BUS ENTRANCE THRESHOLD
              </span>
            </div>

            {/* Left Door Leaf */}
            <div
              className="relative w-1/2 h-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-r-2 border-primary/40 transition-transform duration-500 ease-out z-20 flex flex-col justify-between p-3"
              style={{
                transform: leftDoorTransform,
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
              }}
            >
              {/* Door Glass Window Pane */}
              <div className="w-full h-32 rounded-lg border border-slate-700/80 bg-gradient-to-br from-primary/15 via-base-950/60 to-primary/5 flex items-center justify-center backdrop-blur-xs">
                <div className="w-8 h-12 border-t-2 border-l-2 border-primary/30 opacity-40" />
              </div>
              {/* Door Handle & Lock */}
              <div className="flex items-center justify-end pr-1">
                <div className="h-10 w-2 rounded-sm bg-slate-500 border border-slate-400" />
              </div>
            </div>

            {/* Right Door Leaf */}
            <div
              className="relative w-1/2 h-full bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 border-l-2 border-primary/40 transition-transform duration-500 ease-out z-20 flex flex-col justify-between p-3"
              style={{
                transform: rightDoorTransform,
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
              }}
            >
              {/* Door Glass Window Pane */}
              <div className="w-full h-32 rounded-lg border border-slate-700/80 bg-gradient-to-bl from-primary/15 via-base-950/60 to-primary/5 flex items-center justify-center backdrop-blur-xs">
                <div className="w-8 h-12 border-t-2 border-r-2 border-primary/30 opacity-40" />
              </div>
              {/* Door Handle & Lock */}
              <div className="flex items-center justify-start pl-1">
                <div className="h-10 w-2 rounded-sm bg-slate-500 border border-slate-400" />
              </div>
            </div>

            {/* Center Portal Interior (visible when doors open) */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-radial-glow">
              {/* Cabin interior ambience */}
              <div className="text-center font-mono text-[11px] text-slate-500">
                <div className="text-slate-400 font-semibold tracking-wider">
                  BUS INTERIOR DECK
                </div>
                <div className="text-[10px] text-muted">PASSENGER SEATING AREA</div>
              </div>

              {/* Obstacle simulation graphic if obstacle < 5cm */}
              {isCriticalObstacle && (
                <div className="absolute z-25 flex flex-col items-center justify-center animate-pulse">
                  <div className="h-12 w-12 rounded-full border-2 border-danger bg-danger/30 flex items-center justify-center shadow-glow-danger">
                    <AlertTriangle className="h-6 w-6 text-danger" />
                  </div>
                  <span className="mt-1 rounded bg-danger px-2 py-0.5 font-mono text-[9px] font-bold text-white uppercase tracking-wider">
                    OBSTACLE AT {distanceCm.toFixed(1)} cm
                  </span>
                </div>
              )}
            </div>

            {/* Blocked emergency hatch overlay */}
            {doorState === "BLOCKED" && (
              <div className="absolute inset-0 z-30 pointer-events-none border-2 border-danger/60 bg-danger/10 flex items-center justify-center">
                <div className="rounded-xl border border-danger bg-base-950/90 px-4 py-2 font-mono text-xs font-bold text-danger text-center shadow-2xl">
                  ⚠️ SAFETY INTERLOCK // REOPEN COMMAND ISSUED
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Sequential Infrared Breakbeam Gate (IR1 & IR2) ────────── */}
        <div className="relative z-20 border-t border-slate-800 bg-base-900/80 rounded-xl p-3 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
            {/* IR1 Sensor (Outside / Entry) */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 w-full sm:w-auto transition",
                ir1Active
                  ? "border-danger bg-danger/15 text-danger shadow-[0_0_15px_rgba(255,100,112,0.3)]"
                  : "border-border/70 bg-base-950/60 text-slate-300"
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  ir1Active ? "bg-danger animate-ping" : "bg-safe"
                )}
              />
              <div>
                <div className="font-bold text-[11px] flex items-center gap-1.5">
                  IR SENSOR 1
                  <span className="text-[9px] text-muted font-normal">(GPIO 27)</span>
                </div>
                <div className="text-[10px] text-muted">
                  Position: EXTERIOR // {ir1Active ? "BEAM BROKEN" : "BEAM INTACT"}
                </div>
              </div>
            </div>

            {/* Directional Transit Arrows */}
            <div className="flex items-center gap-6 px-2 py-1 bg-base-950/80 rounded-lg border border-border/60">
              {/* Entry Direction */}
              <div className="flex items-center gap-1 text-[11px] font-semibold text-entry-blue">
                <ArrowDownToLine className="h-4 w-4 animate-bounce" />
                <span>ENTRY FLOW (IR1 → IR2)</span>
              </div>

              <div className="h-4 w-px bg-border" />

              {/* Exit Direction */}
              <div className="flex items-center gap-1 text-[11px] font-semibold text-exit-violet">
                <ArrowUpFromLine className="h-4 w-4 animate-bounce" />
                <span>EXIT FLOW (IR2 → IR1)</span>
              </div>
            </div>

            {/* IR2 Sensor (Inside / Exit) */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 w-full sm:w-auto transition",
                ir2Active
                  ? "border-danger bg-danger/15 text-danger shadow-[0_0_15px_rgba(255,100,112,0.3)]"
                  : "border-border/70 bg-base-950/60 text-slate-300"
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  ir2Active ? "bg-danger animate-ping" : "bg-safe"
                )}
              />
              <div>
                <div className="font-bold text-[11px] flex items-center gap-1.5">
                  IR SENSOR 2
                  <span className="text-[9px] text-muted font-normal">(GPIO 26)</span>
                </div>
                <div className="text-[10px] text-muted">
                  Position: INTERIOR // {ir2Active ? "BEAM BROKEN" : "BEAM INTACT"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

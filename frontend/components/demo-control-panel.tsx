"use client";

import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Gauge,
  Radio,
  Clock,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { DemoStatus } from "../lib/use-demo-simulator";
import { DemoStep } from "../lib/demo-sequence";
import { cn } from "../lib/utils";

interface DemoControlPanelProps {
  demoStatus: DemoStatus;
  currentStepNumber: number;
  totalSteps: number;
  currentStepDef: DemoStep;
  speedMultiplier: number;
  onSetSpeed: (speed: number) => void;
  onStartDemo: () => void;
  onStopDemo: () => void;
  onResetDemo: () => void;
  isHardwareLocked: boolean;
  isDemoMode: boolean;
}

export function DemoControlPanel({
  demoStatus,
  currentStepNumber,
  totalSteps,
  currentStepDef,
  speedMultiplier,
  onSetSpeed,
  onStartDemo,
  onStopDemo,
  onResetDemo,
  isHardwareLocked,
  isDemoMode,
}: DemoControlPanelProps) {
  const isRunning = demoStatus === "RUNNING";
  const progressPercent = Math.round((currentStepNumber / totalSteps) * 100);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition shadow-lg backdrop-blur-md",
        isHardwareLocked
          ? "border-safe/30 bg-base-950/90 text-slate-300"
          : isDemoMode || isRunning
          ? "border-amber-500/50 bg-gradient-to-r from-base-950 via-amber-950/20 to-base-950 shadow-[0_0_25px_rgba(255,197,92,0.12)]"
          : "border-border/80 bg-base-950/80"
      )}
    >
      {/* ── Top Bar: Mode Header, Prominent DEMO MODE Indicator & Controls ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-3.5">
        {/* Left: Title & Prominent DEMO MODE Indicator */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-glow-yellow">
            <Zap className="h-4 w-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider font-extrabold text-slate-100">
                DETERMINISTIC TWIN SIMULATOR
              </span>

              {/* PROMINENT DEMO MODE INDICATOR DISPLAYED AT ALL TIMES */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase transition",
                  isHardwareLocked
                    ? "border border-safe/40 bg-safe/10 text-safe"
                    : "border border-amber-500/60 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(255,197,92,0.25)]"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isHardwareLocked
                      ? "bg-safe animate-ping"
                      : "bg-amber-400 animate-pulse"
                  )}
                />
                {isHardwareLocked ? "LIVE ESP32 ACTIVE" : "DEMO MODE"}
              </span>
            </div>

            <p className="text-[11px] text-muted font-mono">
              21-Step Embedded Door Safety &amp; Breakbeam Passenger Count Verification
            </p>
          </div>
        </div>

        {/* Right: Simulator Action Controls (START, STOP, RESET) & Speed Multiplier */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Hardware Lockout Banner if Real ESP32 is Active */}
          {isHardwareLocked ? (
            <div className="flex items-center gap-2 rounded-xl border border-safe/40 bg-safe/10 px-3 py-1.5 text-xs font-mono font-semibold text-safe">
              <Lock className="h-3.5 w-3.5" />
              <span>LOCKED: Real Hardware Stream</span>
            </div>
          ) : (
            <>
              {/* Speed Multiplier Pill */}
              <div className="flex items-center rounded-xl border border-border/80 bg-base-900/90 p-1 text-xs font-mono">
                <span className="text-[10px] text-muted px-2 hidden sm:inline">Speed:</span>
                {[1.0, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => onSetSpeed(s)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg transition font-bold text-[11px]",
                      speedMultiplier === s
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "text-muted hover:text-slate-200"
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Button 1: START DEMO */}
              <button
                onClick={onStartDemo}
                disabled={isRunning || isHardwareLocked}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 font-mono text-xs font-bold transition shadow-sm",
                  isRunning
                    ? "border-slate-800 bg-base-900 text-muted opacity-50 cursor-not-allowed"
                    : "border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 hover:border-amber-400 shadow-glow-yellow"
                )}
                title="Execute 21-step deterministic sequence"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>START DEMO</span>
              </button>

              {/* Button 2: STOP DEMO */}
              <button
                onClick={onStopDemo}
                disabled={!isRunning || isHardwareLocked}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition",
                  !isRunning
                    ? "border-slate-800 bg-base-900 text-muted opacity-50 cursor-not-allowed"
                    : "border-danger/50 bg-danger/15 text-danger hover:bg-danger/25"
                )}
                title="Pause sequence execution"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>STOP DEMO</span>
              </button>

              {/* Button 3: RESET DEMO */}
              <button
                onClick={onResetDemo}
                disabled={isHardwareLocked}
                className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-base-900/90 px-3 py-1.5 font-mono text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-slate-100 transition"
                title="Reset sequence to Step 1 baseline"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>RESET DEMO</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Progress Bar & Step Tracker ───────────────────────────────────── */}
      <div className="mt-3.5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-300">
              STEP {currentStepNumber} OF {totalSteps}:
            </span>
            <span className="text-slate-100 font-semibold">
              {currentStepDef.name}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className="capitalize text-slate-300 font-semibold">
              Status: {demoStatus.toLowerCase()}
            </span>
            <span>•</span>
            <span>{progressPercent}% Complete</span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="h-2 w-full rounded-full bg-base-900/90 border border-border/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-primary-light transition-all duration-300 shadow-glow-yellow"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Live Step Action Description */}
        <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-base-900/60 px-3 py-2 text-xs">
          <ChevronRight className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-slate-300 font-mono text-[11px]">
            {currentStepDef.description}
          </span>
        </div>
      </div>
    </div>
  );
}

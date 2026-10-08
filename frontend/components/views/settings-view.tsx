"use client";

import { useState } from "react";
import {
  Settings,
  ShieldAlert,
  Users,
  DoorOpen,
  DoorClosed,
  Radio,
  Wifi,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Sliders,
  Check,
  X,
  Lock,
  Info,
  Volume2,
  Lightbulb,
  Loader2,
  Zap,
} from "lucide-react";
import { BusTelemetry, CommandFeedback } from "../../lib/types";
import { cn } from "../../lib/utils";

interface SettingsViewProps {
  telemetry: BusTelemetry;
  commandFeedback?: CommandFeedback | null;
  onUpdateThreshold: (threshold: number) => void;
  onUpdateCapacity: (capacity: number) => void;
  onResetCount: () => void;
  onOpenDoor: () => void;
  onCloseDoor: () => void;
  onTestBuzzer?: () => void;
  onTestLed?: () => void;
  onToggleDemoMode: () => void;
  onReconnectWs?: () => void;
}

type ConfirmActionType =
  | { type: "RESET_COUNT" }
  | { type: "CHANGE_THRESHOLD"; newThreshold: number }
  | { type: "DOOR_COMMAND"; command: "OPEN" | "CLOSE" }
  | { type: "TEST_BUZZER" }
  | { type: "TEST_LED" }
  | null;

export function SettingsView({
  telemetry,
  commandFeedback,
  onUpdateThreshold,
  onUpdateCapacity,
  onResetCount,
  onOpenDoor,
  onCloseDoor,
  onTestBuzzer,
  onTestLed,
  onToggleDemoMode,
  onReconnectWs,
}: SettingsViewProps) {
  // Local form state
  const [thresholdInput, setThresholdInput] = useState<number>(
    telemetry.obstacleThresholdCm
  );
  const [capacityInput, setCapacityInput] = useState<number>(
    telemetry.maxCapacity
  );
  const [wsUrlInput, setWsUrlInput] = useState<string>(
    telemetry.serverUrl || "ws://localhost:8089"
  );

  // Reconnection feedback
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Modal Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmActionType>(null);

  // Controls are only enabled if ESP32 hardware is connected OR Demo Mode is explicitly on
  const controlsEnabled = telemetry.esp32Connected || telemetry.isDemoMode;

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Execute confirmed action
  const handleConfirmAction = () => {
    if (!confirmDialog) return;

    if (confirmDialog.type === "RESET_COUNT") {
      onResetCount();
      showNotification(
        telemetry.esp32Connected
          ? "Command sent: RESET_PASSENGER_COUNT"
          : "Passenger count reset to 0 (Demo Mode)"
      );
    } else if (confirmDialog.type === "CHANGE_THRESHOLD") {
      onUpdateThreshold(confirmDialog.newThreshold);
      showNotification(
        telemetry.esp32Connected
          ? `Command sent: SET_SAFETY_THRESHOLD (${confirmDialog.newThreshold.toFixed(1)} cm)`
          : `Obstacle safety threshold updated to ${confirmDialog.newThreshold.toFixed(1)} cm (Demo Mode)`
      );
    } else if (confirmDialog.type === "DOOR_COMMAND") {
      if (confirmDialog.command === "OPEN") {
        onOpenDoor();
        showNotification(
          telemetry.esp32Connected
            ? "Command sent: OPEN_DOOR"
            : "Door commanded OPEN (Demo Mode)"
        );
      } else {
        onCloseDoor();
        showNotification(
          telemetry.esp32Connected
            ? "Command sent: CLOSE_DOOR"
            : "Door commanded CLOSED (Demo Mode)"
        );
      }
    } else if (confirmDialog.type === "TEST_BUZZER") {
      if (onTestBuzzer) onTestBuzzer();
      showNotification("Command sent: TEST_BUZZER (300 ms pulse)");
    } else if (confirmDialog.type === "TEST_LED") {
      if (onTestLed) onTestLed();
      showNotification("Command sent: TEST_LED (600 ms strobe)");
    }

    setConfirmDialog(null);
  };

  // Reconnect trigger
  const handleReconnect = () => {
    setIsReconnecting(true);
    if (onReconnectWs) {
      onReconnectWs();
    }
    setTimeout(() => {
      setIsReconnecting(false);
      showNotification("WebSocket reconnection attempt initiated");
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl relative">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary-light" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary-light font-bold">
              SYSTEM CONFIGURATION
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
            Fleet Operations &amp; Safety Controls
          </h2>
          <p className="text-xs text-muted">
            Two-way dashboard commands: Dashboard → Node.js Relay → ESP32 Edge Controller
          </p>
        </div>

        {feedbackMsg && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-safe bg-safe/10 border border-safe/30 px-3 py-1.5 rounded-xl animate-fade-in">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {feedbackMsg}
          </span>
        )}
      </div>

      {/* ── TWO-WAY COMMAND LIFECYCLE STATUS BANNER ──────────────────────── */}
      {commandFeedback && (
        <div
          className={cn(
            "rounded-2xl border p-4 font-mono text-xs shadow-panel backdrop-blur-md transition-all animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3",
            commandFeedback.state === "sent" && "border-primary/50 bg-primary/10 text-primary-light",
            commandFeedback.state === "accepted" && "border-safe/50 bg-safe/15 text-safe",
            commandFeedback.state === "rejected" && "border-danger/50 bg-danger/15 text-danger",
            commandFeedback.state === "device_offline" && "border-slate-700 bg-slate-900/90 text-slate-300"
          )}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            {commandFeedback.state === "sent" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary-light shrink-0 mt-0.5 sm:mt-0" />
            )}
            {commandFeedback.state === "accepted" && (
              <CheckCircle2 className="h-4 w-4 text-safe shrink-0 mt-0.5 sm:mt-0" />
            )}
            {commandFeedback.state === "rejected" && (
              <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5 sm:mt-0" />
            )}
            {commandFeedback.state === "device_offline" && (
              <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div>
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                <span>
                  {commandFeedback.state === "sent" && "Command Sent"}
                  {commandFeedback.state === "accepted" && "Command Accepted"}
                  {commandFeedback.state === "rejected" && "Command Rejected"}
                  {commandFeedback.state === "device_offline" && "Device Offline"}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-base-950/60 border border-current opacity-80">
                  {commandFeedback.command}
                </span>
              </div>
              <div className="text-[12px] mt-0.5 opacity-90">{commandFeedback.message}</div>
            </div>
          </div>
          <span className="text-[10px] text-muted font-mono shrink-0">
            {new Date(commandFeedback.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Global Device Offline Guard Banner */}
      {!controlsEnabled && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 flex items-start gap-3 text-xs font-mono text-danger shadow-panel">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
          <div>
            <span className="font-bold uppercase tracking-wider">HARDWARE CONTROLS DISABLED (DEVICE OFFLINE):</span>
            <p className="mt-1 text-slate-300 font-sans leading-relaxed">
              The physical ESP32 microcontroller is currently disconnected from the telemetry server. Per safety integrity guidelines, website commands cannot actuate hardware when offline. Connect the ESP32 Wi-Fi node or switch <strong>Demo Mode ON</strong> to simulate operations.
            </p>
          </div>
        </div>
      )}

      {/* ── SECTION 1: SAFETY SETTINGS (SET_SAFETY_THRESHOLD) ─────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger/40 bg-danger/10 text-danger">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase text-slate-100">
                SAFETY SETTINGS
              </h3>
              <p className="text-[11px] text-muted">
                HC-SR04 doorway collision threshold &amp; auto-reversal parameters (Downlink: SET_SAFETY_THRESHOLD)
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-danger font-bold bg-danger/10 border border-danger/30 px-2.5 py-1 rounded-lg">
            Active: {telemetry.obstacleThresholdCm.toFixed(1)} cm
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-mono">
              <label htmlFor="threshold-slider" className="text-slate-300 font-semibold flex items-center gap-1.5">
                <span>Obstacle Threshold Distance:</span>
                <span className="text-danger font-bold">{thresholdInput.toFixed(1)} cm</span>
              </label>
              <span className="text-muted text-[10px]">Configured Default: 5.0 cm</span>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <input
                id="threshold-slider"
                type="range"
                min="2.0"
                max="20.0"
                step="0.5"
                disabled={!controlsEnabled}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(parseFloat(e.target.value))}
                className={cn(
                  "flex-1 accent-danger h-2 bg-base-950 rounded-lg",
                  controlsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                )}
              />
              <div className="flex items-center gap-1 font-mono text-xs">
                <input
                  type="number"
                  min="2.0"
                  max="20.0"
                  step="0.5"
                  disabled={!controlsEnabled}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(parseFloat(e.target.value) || 5.0)}
                  className="w-16 rounded-lg border border-border bg-base-950 px-2 py-1 text-center font-bold text-slate-200 focus:border-danger focus:outline-none disabled:opacity-50"
                />
                <span className="text-muted text-[11px]">cm</span>
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-muted mt-1.5">
              <span>2.0 cm (Pinch minimum)</span>
              <span className="text-danger font-bold">▲ 5.0 cm (Recommended Bus Standard)</span>
              <span>20.0 cm (Wide perimeter)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
            <span className="text-xs text-muted max-w-lg">
              Modifying this parameter transmits an authoritative <code className="text-slate-300">SET_SAFETY_THRESHOLD</code> downlink packet to the ESP32. Distances below this value immediately halt closing transit and reopen the door.
            </span>
            <button
              onClick={() => {
                if (thresholdInput !== telemetry.obstacleThresholdCm) {
                  setConfirmDialog({
                    type: "CHANGE_THRESHOLD",
                    newThreshold: thresholdInput,
                  });
                }
              }}
              disabled={!controlsEnabled || thresholdInput === telemetry.obstacleThresholdCm}
              className={cn(
                "rounded-xl px-4 py-2 font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0",
                controlsEnabled && thresholdInput !== telemetry.obstacleThresholdCm
                  ? "bg-danger text-white hover:bg-danger/90 shadow-glow-danger"
                  : "bg-base-950 text-slate-500 border border-border cursor-not-allowed opacity-60"
              )}
            >
              <Check className="h-3.5 w-3.5" />
              Apply Safety Threshold
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PASSENGER COUNTER (RESET_PASSENGER_COUNT) ──────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary-light">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase text-slate-100">
                PASSENGER COUNTER
              </h3>
              <p className="text-[11px] text-muted">
                Directional passenger tracking &amp; maximum bus capacity boundaries
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-primary-light bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-lg">
            Onboard: {telemetry.passengerCount} Pax
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Reset Counter */}
          <div className="rounded-xl border border-border/80 bg-base-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300 font-semibold">
                  Trip Passenger Count
                </span>
                <span className="font-mono text-xs text-muted">
                  Current: <strong className="text-slate-100 font-bold">{telemetry.passengerCount}</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Sends a downlink <code className="text-slate-300">RESET_PASSENGER_COUNT</code> command to the ESP32 hardware to zero onboard passenger tally at route terminus.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border/60">
              <button
                onClick={() => setConfirmDialog({ type: "RESET_COUNT" })}
                disabled={!controlsEnabled || telemetry.passengerCount === 0}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl py-2 font-mono text-xs font-bold border transition",
                  controlsEnabled && telemetry.passengerCount > 0
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 shadow-sm"
                    : "border-border bg-base-950 text-slate-600 cursor-not-allowed opacity-50"
                )}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                [Reset Counter] to 0 Pax
              </button>
            </div>
          </div>

          {/* Card B: Max Capacity */}
          <div className="rounded-xl border border-border/80 bg-base-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300 font-semibold">
                  Maximum Bus Capacity
                </span>
                <div className="flex items-center gap-1 font-mono text-xs">
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={capacityInput}
                    onChange={(e) => setCapacityInput(parseInt(e.target.value) || 40)}
                    className="w-14 rounded-lg border border-border bg-base-950 px-2 py-0.5 text-center font-bold text-slate-200 focus:border-primary focus:outline-none"
                  />
                  <span className="text-muted text-[11px]">Seats</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Governs capacity percentage bar, overload alerts, and standing room calculations on the operations dashboard.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border/60">
              <button
                onClick={() => {
                  onUpdateCapacity(capacityInput);
                  showNotification(`Max capacity updated to ${capacityInput} passengers`);
                }}
                disabled={capacityInput === telemetry.maxCapacity}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl py-2 font-mono text-xs font-bold transition",
                  capacityInput !== telemetry.maxCapacity
                    ? "bg-primary text-base-950 hover:bg-primary/90 font-extrabold shadow-glow-blue"
                    : "bg-base-950 text-slate-500 border border-border cursor-not-allowed opacity-50"
                )}
              >
                <Check className="h-3.5 w-3.5" />
                Save Capacity Limit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: DOOR CONTROL (OPEN_DOOR / CLOSE_DOOR) ─────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-400">
              <DoorOpen className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase text-slate-100">
                DOOR CONTROL
              </h3>
              <p className="text-[11px] text-muted">
                Authoritative door command dispatch (Downlink: OPEN_DOOR / CLOSE_DOOR)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                telemetry.esp32Connected
                  ? "border-safe/40 bg-safe/10 text-safe"
                  : telemetry.isDemoMode
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 bg-slate-900 text-slate-500"
              )}
            >
              {telemetry.esp32Connected
                ? "LIVE ESP32 CONTROL"
                : telemetry.isDemoMode
                ? "DEMO SIMULATOR"
                : "OFFLINE (LOCKED)"}
            </span>
            <span className="font-mono text-xs text-slate-300 bg-base-950 px-2.5 py-1 rounded-lg border border-border">
              State: {telemetry.doorState} ({telemetry.servoAngle}°)
            </span>
          </div>
        </div>

        {/* Safety & Protocol Banner */}
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 mb-4 flex items-start gap-2.5 text-xs text-primary-light font-mono leading-relaxed">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span>SAFETY INTERLOCK RULE:</span> Website commands can <strong>never bypass obstacle safety logic</strong>. A <code className="text-white">CLOSE_DOOR</code> command will be immediately rejected or interrupted by the ESP32 if the HC-SR04 sonar detects an obstacle below {telemetry.obstacleThresholdCm.toFixed(1)} cm.
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setConfirmDialog({ type: "DOOR_COMMAND", command: "OPEN" })}
            disabled={!controlsEnabled || telemetry.doorState === "OPEN"}
            title={controlsEnabled ? "Command entrance door OPEN" : "Device offline — controls disabled"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 font-mono text-xs font-bold border transition",
              !controlsEnabled
                ? "border-border/40 bg-base-950 text-slate-600 opacity-50 cursor-not-allowed"
                : telemetry.doorState === "OPEN"
                ? "border-safe/30 bg-safe/10 text-safe opacity-60 cursor-not-allowed"
                : "border-safe/50 bg-safe/15 text-safe hover:bg-safe/25 shadow-glow-safe"
            )}
          >
            <DoorOpen className="h-4 w-4" />
            [Open Door] (90° Aperture)
          </button>

          <button
            onClick={() => setConfirmDialog({ type: "DOOR_COMMAND", command: "CLOSE" })}
            disabled={!controlsEnabled || telemetry.doorState === "CLOSED" || telemetry.doorState === "BLOCKED"}
            title={
              !controlsEnabled
                ? "Device offline — controls disabled"
                : telemetry.doorState === "BLOCKED"
                ? "Doorway obstructed by obstacle (< 5 cm)"
                : "Command entrance door CLOSE"
            }
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 font-mono text-xs font-bold border transition",
              !controlsEnabled
                ? "border-border/40 bg-base-950 text-slate-600 opacity-50 cursor-not-allowed"
                : telemetry.doorState === "CLOSED"
                ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                : telemetry.doorState === "BLOCKED"
                ? "border-danger/40 bg-danger/10 text-danger cursor-not-allowed"
                : "border-slate-600 bg-base-950 text-slate-200 hover:border-amber-400 hover:text-amber-300"
            )}
          >
            <DoorClosed className="h-4 w-4" />
            [Close Door] (0° Latch)
          </button>
        </div>
      </div>

      {/* ── SECTION 4: HARDWARE DIAGNOSTICS (TEST_BUZZER / TEST_LED) ─────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase text-slate-100">
                HARDWARE DIAGNOSTIC TESTS
              </h3>
              <p className="text-[11px] text-muted">
                Non-blocking audio &amp; visual actuator tests (Downlink: TEST_BUZZER / TEST_LED)
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-lg">
            GPIO 23 &amp; GPIO 2
          </span>
        </div>

        <p className="text-xs text-muted font-mono mb-4 leading-relaxed">
          Trigger non-blocking diagnostic test pulses on the ESP32. Actuators pulse briefly without interrupting background sonar safety monitoring or breakbeam passenger counting.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setConfirmDialog({ type: "TEST_BUZZER" })}
            disabled={!controlsEnabled}
            title={controlsEnabled ? "Trigger 300 ms buzzer test chirp" : "Device offline — controls disabled"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 font-mono text-xs font-bold border transition",
              controlsEnabled
                ? "border-purple-500/50 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 shadow-sm"
                : "border-border/40 bg-base-950 text-slate-600 opacity-50 cursor-not-allowed"
            )}
          >
            <Volume2 className="h-4 w-4 text-purple-400" />
            [Test Buzzer] (300 ms Chirp • GPIO 23)
          </button>

          <button
            onClick={() => setConfirmDialog({ type: "TEST_LED" })}
            disabled={!controlsEnabled}
            title={controlsEnabled ? "Trigger 600 ms warning LED test strobe" : "Device offline — controls disabled"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 font-mono text-xs font-bold border transition",
              controlsEnabled
                ? "border-danger/50 bg-danger/15 text-danger hover:bg-danger/25 shadow-sm"
                : "border-border/40 bg-base-950 text-slate-600 opacity-50 cursor-not-allowed"
            )}
          >
            <Lightbulb className="h-4 w-4 text-danger" />
            [Test Warning LED] (600 ms Strobe • GPIO 2)
          </button>
        </div>
      </div>

      {/* ── SECTION 5: SYSTEM (WEBSOCKET & RELAY) ─────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary-light">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase text-slate-100">
                SYSTEM &amp; TELEMETRY RELAY
              </h3>
              <p className="text-[11px] text-muted">
                Node.js WebSocket streaming server configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                telemetry.wsStatus === "CONNECTING"
                  ? "bg-amber-400 animate-pulse"
                  : telemetry.wsConnected
                  ? "bg-safe animate-ping"
                  : "bg-danger"
              )}
            />
            <span
              className={cn(
                "font-bold uppercase",
                telemetry.wsStatus === "CONNECTING"
                  ? "text-amber-300"
                  : telemetry.wsConnected
                  ? "text-safe"
                  : "text-danger"
              )}
            >
              {telemetry.wsStatus === "CONNECTING"
                ? "CONNECTING..."
                : telemetry.wsConnected
                ? `CONNECTED (${telemetry.latencyMs}ms)`
                : "DISCONNECTED"}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-slate-300 font-semibold block mb-1.5">
              WebSocket Server URL:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={wsUrlInput}
                onChange={(e) => setWsUrlInput(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-base-950 px-3.5 py-2 font-mono text-xs text-slate-200 focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="flex items-center justify-center gap-2 rounded-xl border border-primary/50 bg-primary/20 px-4 py-2 font-mono text-xs font-bold text-primary-light hover:bg-primary/30 transition shadow-glow-blue"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", isReconnecting && "animate-spin")}
                />
                {isReconnecting ? "Connecting..." : "Reconnect"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-muted border-t border-border/60 pt-3">
            <div>Device Endpoint: /ws/device</div>
            <div>Dashboard Endpoint: /ws/dashboard</div>
            <div>Command Route: POST /api/command</div>
          </div>
        </div>
      </div>

      {/* ── SECTION 6: DEMO MODE (ON / OFF) ───────────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border",
                telemetry.isDemoMode
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                  : "border-safe/50 bg-safe/20 text-safe"
              )}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase text-slate-100">
                DEMO MODE CONFIGURATION
              </h3>
              <p className="text-[11px] text-muted">
                Governs whether synthetic telemetry may be generated
              </p>
            </div>
          </div>

          {/* Large Toggle Control */}
          <button
            onClick={onToggleDemoMode}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-extrabold border transition shadow-sm",
              telemetry.isDemoMode
                ? "border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(255,197,92,0.3)]"
                : "border-safe bg-safe/20 text-safe shadow-glow-safe"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                telemetry.isDemoMode ? "bg-amber-400 animate-pulse" : "bg-safe"
              )}
            />
            <span>DEMO MODE: {telemetry.isDemoMode ? "ON" : "OFF"}</span>
          </button>
        </div>

        {/* Behavioral Specifications Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className={cn(
              "rounded-xl border p-3.5 transition",
              telemetry.isDemoMode
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-border/60 bg-base-950/60 opacity-60"
            )}
          >
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-300 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              When Demo Mode is ON:
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              The UI may generate simulated telemetry to test workflows, visual doorway animations, occupancy curves, and threshold alerts without physical hardware connected.
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border p-3.5 transition",
              !telemetry.isDemoMode
                ? "border-safe/40 bg-safe/10"
                : "border-border/60 bg-base-950/60 opacity-60"
            )}
          >
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-safe mb-1">
              <Lock className="h-3.5 w-3.5" />
              When Demo Mode is OFF:
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              The UI must <strong>never fabricate hardware telemetry</strong>. Displays reflect strict live sensor readings received from physical ESP32 Wi-Fi packets. If disconnected, status shows OFFLINE.
            </p>
          </div>
        </div>
      </div>

      {/* ── MODAL CONFIRMATION DIALOG ─────────────────────────────────────── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-base-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/50 bg-amber-500/20 text-amber-300 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-mono text-base font-bold text-slate-100">
                  {confirmDialog.type === "RESET_COUNT"
                    ? "Reset Passenger Counter?"
                    : confirmDialog.type === "CHANGE_THRESHOLD"
                    ? "Modify Safety Threshold?"
                    : confirmDialog.type === "TEST_BUZZER"
                    ? "Execute Buzzer Test?"
                    : confirmDialog.type === "TEST_LED"
                    ? "Execute Warning LED Test?"
                    : `Execute Door Command (${confirmDialog.command})?`}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {confirmDialog.type === "RESET_COUNT" &&
                    `Are you sure you want to dispatch RESET_PASSENGER_COUNT? This will reset the onboard passenger counter to 0 ${
                      telemetry.esp32Connected ? "on the ESP32 hardware" : "in the demo simulator"
                    }.`}
                  {confirmDialog.type === "CHANGE_THRESHOLD" &&
                    `You are changing the obstacle safety threshold from ${telemetry.obstacleThresholdCm.toFixed(1)} cm to ${confirmDialog.newThreshold.toFixed(1)} cm. Any obstacle detected below this limit will immediately trigger emergency door reopening on the ESP32.`}
                  {confirmDialog.type === "DOOR_COMMAND" &&
                    `You are about to dispatch a manual door ${confirmDialog.command} command ${
                      telemetry.esp32Connected
                        ? "to the physical ESP32 servo actuator. The hardware safety interlock will reject CLOSE_DOOR if an obstacle is present."
                        : "in Demo Mode simulation."
                    }`}
                  {confirmDialog.type === "TEST_BUZZER" &&
                    "Transmit a 300 ms diagnostic acoustic chirp to the active piezo buzzer on ESP32 GPIO 23?"}
                  {confirmDialog.type === "TEST_LED" &&
                    "Transmit a 600 ms diagnostic visual strobe to the red warning LED on ESP32 GPIO 2?"}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/70">
              <button
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl border border-border bg-base-950 px-4 py-2 font-mono text-xs text-slate-300 hover:border-slate-500 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={cn(
                  "rounded-xl px-4 py-2 font-mono text-xs font-bold text-white transition shadow-sm",
                  confirmDialog.type === "RESET_COUNT"
                    ? "bg-danger hover:bg-danger/90"
                    : confirmDialog.type === "CHANGE_THRESHOLD"
                    ? "bg-danger hover:bg-danger/90"
                    : "bg-primary hover:bg-primary/90 text-base-950"
                )}
              >
                Confirm &amp; Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

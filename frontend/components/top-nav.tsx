"use client";

import { useEffect, useState } from "react";
import {
  BusFront,
  Cpu,
  Radio,
  Settings,
  Clock,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  ShieldAlert,
  UserPlus,
  UserMinus,
  DoorOpen,
  DoorClosed,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "../lib/utils";
import { BusTelemetry, NavigationTab } from "../lib/types";

interface TopNavProps {
  telemetry: BusTelemetry;
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onSimulateObstacle: () => void;
  onSimulateEntry: () => void;
  onSimulateExit: () => void;
  onToggleDoor: () => void;
  onToggleConnection: () => void;
  onStartDemo?: () => void;
}

export function TopNav({
  telemetry,
  activeTab,
  onTabChange,
  onSimulateObstacle,
  onSimulateEntry,
  onSimulateExit,
  onToggleDoor,
  onToggleConnection,
  onStartDemo,
}: TopNavProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [showSimMenu, setShowSimMenu] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const isSystemOnline = telemetry.esp32Connected && telemetry.wsConnected;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-base-950/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-gradient-to-br from-primary/20 via-base-900 to-base-950 shadow-glow-blue">
            <BusFront className="h-5 w-5 text-primary-light" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                  isSystemOnline
                    ? "animate-ping bg-safe"
                    : "bg-watch animate-pulse"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  isSystemOnline ? "bg-safe" : "bg-watch"
                )}
              />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold tracking-wider text-slate-50">
                SMARTBUS
              </span>
              <span className="hidden rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-light sm:inline-block">
                UNIT-04 // LIVE
              </span>
            </div>
            <p className="text-[10px] font-medium tracking-wider text-muted">
              DOOR SAFETY + PASSENGER MONITORING
            </p>
          </div>
        </div>

        {/* Right: Telemetry Status, Realtime Clock & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Simulation Trigger Pill */}
          <div className="relative">
            <button
              onClick={() => setShowSimMenu(!showSimMenu)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary-light transition hover:bg-primary/20 focus:outline-none"
              title="Interactive simulation events"
            >
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="hidden md:inline">Simulate Event</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {showSimMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSimMenu(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-border bg-base-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Hardware Simulation Bench
                  </div>
                  {onStartDemo && (
                    <button
                      onClick={() => {
                        onStartDemo();
                        setShowSimMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-amber-300 hover:bg-amber-500/10 transition font-bold"
                    >
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      <span>Run Full 21-Step Demo</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-border/50" />
                  <button
                    onClick={() => {
                      onSimulateObstacle();
                      setShowSimMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-danger hover:bg-danger/10 transition"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Obstacle Detected (&lt;5cm)
                  </button>
                  <button
                    onClick={() => {
                      onSimulateEntry();
                      setShowSimMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-entry-blue hover:bg-entry-blue/10 transition"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Passenger Entry (IR1 → IR2)
                  </button>
                  <button
                    onClick={() => {
                      onSimulateExit();
                      setShowSimMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-exit-violet hover:bg-exit-violet/10 transition"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Passenger Exit (IR2 → IR1)
                  </button>
                  <button
                    onClick={() => {
                      onToggleDoor();
                      setShowSimMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5 transition"
                  >
                    {telemetry.doorState === "OPEN" ? (
                      <DoorClosed className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <DoorOpen className="h-3.5 w-3.5 text-safe" />
                    )}
                    Toggle Door ({telemetry.doorState === "OPEN" ? "Close" : "Open"})
                  </button>
                  <div className="my-1 border-t border-border/50" />
                  <button
                    onClick={() => {
                      onToggleConnection();
                      setShowSimMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted hover:bg-white/5 transition"
                  >
                    {telemetry.esp32Connected ? (
                      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5 text-safe" />
                    )}
                    Toggle ESP32 Link ({telemetry.esp32Connected ? "Disconnect" : "Connect"})
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 1. WebSocket Lifecycle Indicator (CONNECTING / CONNECTED / DISCONNECTED) */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition",
              telemetry.wsStatus === "CONNECTING"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : telemetry.wsStatus === "CONNECTED"
                ? "border-safe/30 bg-safe/10 text-safe shadow-[0_0_12px_rgba(93,229,160,0.15)]"
                : "border-danger/30 bg-danger/10 text-danger"
            )}
            title={`WebSocket Link Status: ${telemetry.wsStatus} (${telemetry.latencyMs}ms)`}
          >
            <Radio
              className={cn(
                "h-3.5 w-3.5",
                telemetry.wsStatus === "CONNECTING" && "animate-spin text-amber-400",
                telemetry.wsStatus === "CONNECTED" && "text-safe animate-pulse",
                telemetry.wsStatus === "DISCONNECTED" && "text-danger"
              )}
            />
            <span className="hidden sm:inline font-semibold">WS</span>
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {telemetry.wsStatus === "CONNECTING"
                ? "CONNECTING"
                : telemetry.wsStatus === "CONNECTED"
                ? "CONNECTED"
                : "DISCONNECTED"}
            </span>
          </div>

          {/* 2. Data Source Priority Indicator (LIVE DATA / DEMO MODE / OFFLINE) */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition",
              telemetry.esp32Connected && !telemetry.isDemoMode
                ? "border-safe/40 bg-safe/10 text-safe shadow-[0_0_12px_rgba(93,229,160,0.15)]"
                : telemetry.isDemoMode
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(255,197,92,0.15)]"
                : "border-slate-800 bg-base-900/90 text-slate-400"
            )}
            title={
              telemetry.esp32Connected && !telemetry.isDemoMode
                ? "HARDWARE ACTIVE: Real-time telemetry streaming from ESP32"
                : telemetry.isDemoMode
                ? "DEMO MODE ACTIVE: Using synthetic in-memory benchmark data"
                : "HARDWARE OFFLINE: ESP32 is not connected. Telemetry not fabricated."
            }
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                telemetry.esp32Connected && !telemetry.isDemoMode
                  ? "bg-safe animate-ping"
                  : telemetry.isDemoMode
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-500"
              )}
            />
            <span className="font-bold">
              {telemetry.esp32Connected && !telemetry.isDemoMode
                ? "LIVE DATA"
                : telemetry.isDemoMode
                ? "DEMO MODE"
                : "OFFLINE"}
            </span>
          </div>

          {/* 3. ESP32 Connection Indicator */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition",
              telemetry.esp32Connected
                ? "border-safe/30 bg-safe/10 text-safe shadow-[0_0_12px_rgba(93,229,160,0.15)]"
                : "border-border bg-base-900 text-muted"
            )}
            title={`ESP32 Hardware status: ${telemetry.esp32Connected ? "Linked via Wi-Fi" : "Disconnected / Offline"}`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline font-semibold">ESP32</span>
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {telemetry.esp32Connected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {/* 4. Complete System Link Status */}
          <div
            className={cn(
              "hidden xl:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition",
              isSystemOnline
                ? "border-primary/40 bg-primary/10 text-primary-light"
                : "border-border bg-base-900 text-muted"
            )}
            title="Complete System Link (ESP32 + WebSocket telemetry pipeline)"
          >
            <Radio
              className={cn(
                "h-3.5 w-3.5",
                isSystemOnline && "text-primary animate-pulse"
              )}
            />
            <span className="text-[11px] font-semibold text-slate-300">
              SYSTEM
            </span>
            <span
              className={cn(
                "text-[10px] font-bold tracking-wider uppercase",
                isSystemOnline ? "text-primary-light" : "text-muted"
              )}
            >
              {isSystemOnline ? "ACTIVE" : "STANDBY"}
            </span>
          </div>

          {/* Realtime Clock */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-border/80 bg-base-900 px-2.5 py-1.5 font-mono text-xs text-slate-300 md:flex">
            <Clock className="h-3.5 w-3.5 text-muted" />
            <span className="font-semibold">{timeStr || "--:--:--"}</span>
            <span className="text-[10px] text-muted hidden xl:inline">
              {dateStr}
            </span>
          </div>

          {/* Settings Icon */}
          <button
            onClick={() => onTabChange("settings")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition",
              activeTab === "settings"
                ? "border-primary bg-primary/20 text-primary-light"
                : "border-border bg-base-900 text-muted hover:border-slate-600 hover:text-slate-200"
            )}
            title="Dashboard Settings & Thresholds"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

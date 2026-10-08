"use client";

import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { TopNav } from "../components/top-nav";
import { Sidebar } from "../components/sidebar";
import { MetricCards } from "../components/metric-cards";
import { DemoControlPanel } from "../components/demo-control-panel";
import { DoorMonitor } from "../components/door-monitor";
import { OccupancyChart } from "../components/occupancy-chart";
import { EventStream } from "../components/event-stream";
import { HardwareStrip } from "../components/hardware-strip";
import { AnalyticsView } from "../components/views/analytics-view";
import { SafetyEventsView } from "../components/views/safety-events-view";
import { HardwareView } from "../components/views/hardware-view";
import { HardwareTestView } from "../components/views/hardware-test-view";
import { ArchitectureView } from "../components/views/architecture-view";
import { SettingsView } from "../components/views/settings-view";
import { NavigationTab } from "../lib/types";
import { useTelemetrySocket } from "../lib/use-telemetry-socket";
import { useDemoSimulator } from "../lib/use-demo-simulator";
import { cn } from "../lib/utils";

export default function SmartBusDashboard() {
  const [activeTab, setActiveTab] = useState<NavigationTab>("live-monitor");

  // Reusable WebSocket Client Hook for real-time telemetry
  const {
    telemetry,
    setTelemetry,
    events,
    addEvent,
    clearEvents,
    occupancyHistory,
    setOccupancyHistory,
    commandFeedback,
    sendCommand,
    testBuzzer,
    testLed,
    toggleDemoMode,
    simulateObstacle,
    simulateEntry,
    simulateExit,
    toggleDoor,
    resetCount,
    updateThreshold,
    updateCapacity,
    reconnectWs,
  } = useTelemetrySocket();

  // Deterministic 21-step demonstration simulator
  const {
    demoStatus,
    currentStepNumber,
    totalSteps,
    currentStepDef,
    speedMultiplier,
    setSpeedMultiplier,
    startDemo,
    stopDemo,
    resetDemo,
    isHardwareLocked,
  } = useDemoSimulator({
    telemetry,
    setTelemetry,
    addEvent,
    onOccupancyChange: (pax) => {
      const nowTime = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      setOccupancyHistory((h) => [
        ...h.slice(h.length > 15 ? 1 : 0),
        { time: nowTime, passengers: pax, capacity: telemetry.maxCapacity },
      ]);
    },
  });

  // Count of critical obstacle events for badge
  const obstacleEventCount = useMemo(
    () => events.filter((e) => e.type === "OBSTACLE_DETECTED").length,
    [events]
  );

  return (
    <div className="min-h-screen bg-base-950 text-slate-100 flex flex-col font-sans selection:bg-primary/30">
      {/* ── TOP NAVIGATION ──────────────────────────────────────────────── */}
      <TopNav
        telemetry={telemetry}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSimulateObstacle={simulateObstacle}
        onSimulateEntry={simulateEntry}
        onSimulateExit={simulateExit}
        onToggleDoor={toggleDoor}
        onToggleConnection={toggleDemoMode}
        onStartDemo={startDemo}
      />

      {/* ── MAIN WORKSPACE: SIDEBAR + CONTENT ───────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* ── SIDEBAR NAVIGATION ────────────────────────────────────────── */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          eventCount={events.length}
          obstacleCount={obstacleEventCount}
        />

        {/* ── MAIN ROUTED VIEW CONTENT ─────────────────────────────────── */}
        <main className="flex-1 p-3 sm:p-5 lg:p-7 max-w-[1600px] mx-auto w-full space-y-4 sm:space-y-6">
          {/* Global Two-Way Command Feedback Toast (visible across all tabs) */}
          {commandFeedback && activeTab !== "settings" && (
            <div
              className={cn(
                "rounded-2xl border p-3.5 font-mono text-xs shadow-panel backdrop-blur-md transition-all animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                commandFeedback.state === "sent" && "border-primary/50 bg-primary/10 text-primary-light",
                commandFeedback.state === "accepted" && "border-safe/50 bg-safe/15 text-safe",
                commandFeedback.state === "rejected" && "border-danger/50 bg-danger/15 text-danger",
                commandFeedback.state === "device_offline" && "border-slate-700 bg-slate-900/95 text-slate-300"
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

          {/* VIEW 1: LIVE MONITOR (Primary Dashboard) */}
          {activeTab === "live-monitor" && (
            <div className="space-y-4 sm:space-y-6">
              {/* 1. Four Major Metric Cards */}
              <MetricCards
                telemetry={telemetry}
                onCommandOpen={() => sendCommand("OPEN_DOOR")}
                onCommandClose={() => sendCommand("CLOSE_DOOR")}
                onCommandReset={resetCount}
              />

              {/* 2. Deterministic 21-Step SmartBus Demonstration Simulator Panel */}
              <DemoControlPanel
                demoStatus={demoStatus}
                currentStepNumber={currentStepNumber}
                totalSteps={totalSteps}
                currentStepDef={currentStepDef}
                speedMultiplier={speedMultiplier}
                onSetSpeed={setSpeedMultiplier}
                onStartDemo={startDemo}
                onStopDemo={stopDemo}
                onResetDemo={resetDemo}
                isHardwareLocked={isHardwareLocked}
                isDemoMode={telemetry.isDemoMode}
              />

              {/* 3. Large Live Bus Door Monitor Panel */}
              <DoorMonitor
                telemetry={telemetry}
                onSimulateObstacle={simulateObstacle}
                onSimulateEntry={simulateEntry}
                onSimulateExit={simulateExit}
              />

              {/* 4. Grid: Left Occupancy Chart, Right Event Stream */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <OccupancyChart
                  data={occupancyHistory}
                  currentCount={telemetry.passengerCount}
                  maxCapacity={telemetry.maxCapacity}
                  peakCount={Math.max(28, telemetry.passengerCount)}
                />

                <EventStream
                  events={events}
                  onClearEvents={clearEvents}
                />
              </div>

              {/* 5. Bottom Hardware Health Strip */}
              <HardwareStrip telemetry={telemetry} />
            </div>
          )}

          {/* VIEW 2: PASSENGER ANALYTICS */}
          {activeTab === "passenger-analytics" && (
            <AnalyticsView
              telemetry={telemetry}
              events={events}
              onToggleDemoMode={toggleDemoMode}
            />
          )}

          {/* VIEW 3: SAFETY EVENTS */}
          {activeTab === "safety-events" && (
            <SafetyEventsView
              events={events}
              telemetry={telemetry}
              onSimulateObstacle={simulateObstacle}
            />
          )}

          {/* VIEW 4: HARDWARE VISUALIZATION */}
          {activeTab === "hardware" && (
            <HardwareView
              telemetry={telemetry}
              onSimulateObstacle={simulateObstacle}
              onSimulateEntry={simulateEntry}
              onSimulateExit={simulateExit}
              onNavigateToTestBench={() => setActiveTab("hardware-test")}
            />
          )}

          {/* VIEW 5: HARDWARE TEST & VERIFICATION BENCH */}
          {activeTab === "hardware-test" && (
            <HardwareTestView
              telemetry={telemetry}
              commandFeedback={commandFeedback}
              onOpenDoor={() => sendCommand("OPEN_DOOR")}
              onCloseDoor={() => sendCommand("CLOSE_DOOR")}
              onResetCount={resetCount}
              onTestBuzzer={testBuzzer}
              onTestLed={testLed}
              onReconnectWs={reconnectWs}
            />
          )}

          {/* VIEW 6: SYSTEM ARCHITECTURE */}
          {activeTab === "system-architecture" && (
            <ArchitectureView />
          )}

          {/* VIEW 6: SETTINGS */}
          {activeTab === "settings" && (
            <SettingsView
              telemetry={telemetry}
              commandFeedback={commandFeedback}
              onUpdateThreshold={updateThreshold}
              onUpdateCapacity={updateCapacity}
              onResetCount={resetCount}
              onOpenDoor={() => sendCommand("OPEN_DOOR")}
              onCloseDoor={() => sendCommand("CLOSE_DOOR")}
              onTestBuzzer={testBuzzer}
              onTestLed={testLed}
              onToggleDemoMode={toggleDemoMode}
              onReconnectWs={reconnectWs}
            />
          )}

          {/* Persistent Fleet Bottom Signature */}
          <footer className="mt-8 border-t border-border/60 pt-4 pb-6 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-muted gap-2">
            <div>
              SMARTBUS PROTOTYPE • ESP32 DOOR SAFETY + PASSENGER MONITORING
            </div>
            <div className="flex items-center gap-3">
              <span>FIRMWARE: v2.4.1</span>
              <span>NODE: ESP32-WROOM</span>
              <span className="text-safe flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-safe" />
                SYSTEM READY
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

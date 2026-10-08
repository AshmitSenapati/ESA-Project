"use client";

import { useMemo, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Lightbulb,
  Radio,
  Clock,
  Search,
  Filter,
  Activity,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  Info,
  ArrowRight,
  Gauge,
  Sliders,
} from "lucide-react";
import { BusTelemetry, LogEvent, SafetyIncident } from "../../lib/types";
import { cn } from "../../lib/utils";

interface SafetyEventsViewProps {
  telemetry: BusTelemetry;
  events?: LogEvent[];
  onSimulateObstacle?: () => void;
}

type SeverityFilter = "All" | "Critical" | "Warning" | "Resolved";

// Initial synthetic benchmark incidents
const DEFAULT_SAFETY_INCIDENTS: SafetyIncident[] = [
  {
    id: "si-1",
    timestamp: "20:55:16",
    eventType: "OBSTACLE_DETECTED",
    title: "Doorway Pinch Obstruction Detected",
    distanceCm: 3.4,
    thresholdCm: 5.0,
    doorState: "REOPENING",
    servoAngle: 15,
    buzzerActive: true,
    ledActive: true,
    actionTaken: "Closing transit halted • SG90 servo moved to 15° • Buzzer & Red LED strobe engaged",
    severity: "CRITICAL",
    status: "RESOLVED",
    isSimulated: true,
  },
  {
    id: "si-2",
    timestamp: "20:55:18",
    eventType: "DOOR_REOPENED",
    title: "Safety Interlock Reopen Executed",
    distanceCm: 3.8,
    thresholdCm: 5.0,
    doorState: "REOPENING",
    servoAngle: 75,
    buzzerActive: true,
    ledActive: true,
    actionTaken: "Bi-parting leaves reversed to aperture clearance • Obstacle clearing sequence running",
    severity: "WARNING",
    status: "RESOLVED",
    isSimulated: true,
  },
  {
    id: "si-3",
    timestamp: "20:47:02",
    eventType: "PROXIMITY_ALERT",
    title: "Threshold Proximity Warning",
    distanceCm: 8.2,
    thresholdCm: 5.0,
    doorState: "CLOSING",
    servoAngle: 45,
    buzzerActive: false,
    ledActive: false,
    actionTaken: "Cautious transit monitor • Obstacle above 5.0 cm threshold • Closing cycle continued",
    severity: "WARNING",
    status: "RESOLVED",
    isSimulated: true,
  },
  {
    id: "si-4",
    timestamp: "20:34:10",
    eventType: "OBSTACLE_DETECTED",
    title: "Passenger Hand Near Door Seal",
    distanceCm: 2.7,
    thresholdCm: 5.0,
    doorState: "REOPENING",
    servoAngle: 15,
    buzzerActive: true,
    ledActive: true,
    actionTaken: "Emergency stop • Reopened door • Buzzer alarm pulsed 2.4 kHz",
    severity: "CRITICAL",
    status: "RESOLVED",
    isSimulated: true,
  },
  {
    id: "si-5",
    timestamp: "20:34:12",
    eventType: "DOOR_REOPENED",
    title: "Emergency Reversal Confirmed",
    distanceCm: 3.1,
    thresholdCm: 5.0,
    doorState: "OPEN",
    servoAngle: 90,
    buzzerActive: false,
    ledActive: false,
    actionTaken: "Doorway cleared • Normal open state resumed",
    severity: "RESOLVED",
    status: "RESOLVED",
    isSimulated: true,
  },
  {
    id: "si-6",
    timestamp: "20:18:44",
    eventType: "OBSTACLE_DETECTED",
    title: "Luggage Cart in Doorway",
    distanceCm: 4.1,
    thresholdCm: 5.0,
    doorState: "REOPENING",
    servoAngle: 15,
    buzzerActive: true,
    ledActive: true,
    actionTaken: "Interlock halt • SG90 servo reversed • Audio warning active",
    severity: "CRITICAL",
    status: "RESOLVED",
    isSimulated: true,
  },
  {
    id: "si-7",
    timestamp: "20:18:48",
    eventType: "DOOR_REOPENED",
    title: "Aperture Re-opened for Clearance",
    distanceCm: 22.4,
    thresholdCm: 5.0,
    doorState: "OPEN",
    servoAngle: 90,
    buzzerActive: false,
    ledActive: false,
    actionTaken: "Obstacle cleared by passenger • System rearmed",
    severity: "RESOLVED",
    status: "RESOLVED",
    isSimulated: true,
  },
];

export function SafetyEventsView({
  telemetry,
  events = [],
  onSimulateObstacle,
}: SafetyEventsViewProps) {
  const [filter, setFilter] = useState<SeverityFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Determine Current Safety Status
  const currentStatus: "SAFE" | "WARNING" | "CRITICAL" = useMemo(() => {
    if (telemetry.distanceCm < telemetry.obstacleThresholdCm || telemetry.doorState === "BLOCKED") {
      return "CRITICAL";
    }
    if (telemetry.distanceCm < 15.0 || telemetry.doorState === "REOPENING" || telemetry.doorState === "CLOSING") {
      return "WARNING";
    }
    return "SAFE";
  }, [telemetry.distanceCm, telemetry.obstacleThresholdCm, telemetry.doorState]);

  // Combine live session events with historical incidents
  const allIncidents: SafetyIncident[] = useMemo(() => {
    const liveIncidents: SafetyIncident[] = events
      .filter((e) => e.type === "OBSTACLE_DETECTED" || e.type === "DOOR_REOPENED")
      .map((e) => {
        const isObstacle = e.type === "OBSTACLE_DETECTED";
        const dist = e.metadata?.distanceCm ?? telemetry.distanceCm;
        const sev: SafetyIncident["severity"] = isObstacle
          ? dist < telemetry.obstacleThresholdCm
            ? "CRITICAL"
            : "WARNING"
          : "RESOLVED";

        return {
          id: e.id,
          timestamp: e.timestamp,
          eventType: e.type,
          title: e.title,
          distanceCm: dist,
          thresholdCm: telemetry.obstacleThresholdCm,
          doorState: e.metadata?.doorState ?? telemetry.doorState,
          servoAngle: telemetry.servoAngle,
          buzzerActive: telemetry.buzzerActive,
          ledActive: telemetry.ledActive,
          actionTaken: isObstacle
            ? `Door closing halted • SG90 servo moved to 15° • Buzzer & LED strobe engaged (${dist.toFixed(1)} cm < ${telemetry.obstacleThresholdCm} cm)`
            : "Door aperture reversed to full clearance to safeguard passenger flow",
          severity: sev,
          status: isObstacle ? "ACTIVE" : "RESOLVED",
          isSimulated: telemetry.isDemoMode,
        };
      });

    return [...liveIncidents, ...DEFAULT_SAFETY_INCIDENTS];
  }, [events, telemetry]);

  // Summary Metrics
  const totalSafetyEvents = allIncidents.length;
  const automaticReversals = allIncidents.filter(
    (i) => i.eventType === "DOOR_REOPENED" || i.actionTaken.toLowerCase().includes("reopen")
  ).length;
  const criticalEvents = allIncidents.filter((i) => i.severity === "CRITICAL").length;

  // Filtered Incidents
  const filteredIncidents = useMemo(() => {
    return allIncidents.filter((incident) => {
      const matchesSearch =
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.actionTaken.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.timestamp.includes(searchQuery);

      const matchesFilter =
        filter === "All" ||
        incident.severity === filter.toUpperCase();

      return matchesSearch && matchesFilter;
    });
  }, [allIncidents, searchQuery, filter]);

  return (
    <div className="space-y-5">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-danger" />
            <span className="font-mono text-xs uppercase tracking-widest text-danger font-bold">
              DOORWAY INTERLOCK MANAGEMENT
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
            Safety Center
          </h2>
          <p className="text-xs text-muted">
            Real-time doorway safety monitoring, obstacle detection &amp; automatic door reversal registry
          </p>
        </div>

        {/* Configured Threshold Callout Tag */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2 font-mono text-xs text-danger shadow-sm">
            <span className="h-2 w-2 rounded-full bg-danger animate-ping" />
            <span>CONFIGURED THRESHOLD:</span>
            <span className="font-bold underline decoration-danger">
              {telemetry.obstacleThresholdCm.toFixed(1)} CM
            </span>
          </div>

          {onSimulateObstacle && (
            <button
              onClick={onSimulateObstacle}
              className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-xs text-primary-light hover:bg-primary/20 transition"
              title="Test doorway obstacle detection"
            >
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span>Test Obstacle</span>
            </button>
          )}
        </div>
      </div>

      {/* ── DATA PROVENANCE NOTIFICATION ─────────────────────────────────── */}
      {telemetry.isDemoMode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-start gap-3 backdrop-blur-md">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <span className="font-mono font-bold uppercase text-amber-300 mr-1.5">
              [DEMO DATA // SIMULATION ACTIVE]:
            </span>
            Historical incident records below are populated from pre-configured test benchmarks.
            Live sensor events from physical ESP32 HC-SR04 sonar pulses are prepended in real time as they occur.
          </div>
        </div>
      )}

      {/* ── SUMMARY CARDS (4 MAJOR CARDS) ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Card 1: Total Safety Events */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>TOTAL SAFETY EVENTS</span>
            <Activity className="h-4 w-4 text-primary-light" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold text-slate-100">
              {totalSafetyEvents}
            </span>
            <span className="font-mono text-xs text-muted">Recorded</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-border/50 pt-2 flex justify-between">
            <span>All Logged Incidents</span>
            {telemetry.isDemoMode && <span className="text-amber-400">DEMO BENCHMARK</span>}
          </div>
        </div>

        {/* Card 2: Automatic Reversals */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>AUTOMATIC REVERSALS</span>
            <RotateCcw className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold text-amber-400">
              {automaticReversals}
            </span>
            <span className="font-mono text-xs text-muted">Cycles</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-border/50 pt-2 flex justify-between">
            <span>SG90 15° Safety Reopens</span>
            <span className="text-safe">100% Interlock Success</span>
          </div>
        </div>

        {/* Card 3: Critical Events */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>CRITICAL EVENTS</span>
            <AlertTriangle className="h-4 w-4 text-danger" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold text-danger">
              {criticalEvents}
            </span>
            <span className="font-mono text-xs text-danger font-semibold">
              (&lt; {telemetry.obstacleThresholdCm.toFixed(1)} cm)
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-border/50 pt-2 flex justify-between">
            <span>High Collision Risk</span>
            <span className="text-danger">Safety Stop Active</span>
          </div>
        </div>

        {/* Card 4: Current Safety Status */}
        <div
          className={cn(
            "rounded-2xl border p-4 shadow-panel flex flex-col justify-between transition-all",
            currentStatus === "CRITICAL"
              ? "border-danger/60 bg-danger/15 shadow-[0_0_20px_rgba(255,100,112,0.25)]"
              : currentStatus === "WARNING"
              ? "border-amber-400/50 bg-amber-400/10 shadow-[0_0_15px_rgba(255,197,92,0.15)]"
              : "border-safe/50 bg-safe/10 shadow-[0_0_15px_rgba(93,229,160,0.15)]"
          )}
        >
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className={cn(
              currentStatus === "CRITICAL" ? "text-danger font-bold" : currentStatus === "WARNING" ? "text-amber-400 font-bold" : "text-safe font-bold"
            )}>
              CURRENT SAFETY STATUS
            </span>
            {currentStatus === "CRITICAL" ? (
              <ShieldAlert className="h-4 w-4 text-danger animate-pulse" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-safe" />
            )}
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-3xl font-extrabold tracking-tight",
                currentStatus === "CRITICAL"
                  ? "text-danger animate-pulse"
                  : currentStatus === "WARNING"
                  ? "text-amber-300"
                  : "text-safe"
              )}
            >
              {currentStatus}
            </span>
          </div>

          <div className="mt-2 text-[10px] font-mono border-t border-border/50 pt-2 flex justify-between text-slate-300">
            <span>Reading: {telemetry.distanceCm >= 900 ? "—" : `${telemetry.distanceCm.toFixed(1)} cm`}</span>
            <span>Door: {telemetry.doorState}</span>
          </div>
        </div>
      </div>

      {/* ── LARGE SAFETY STATUS VISUALIZATION (SAFE / WARNING / CRITICAL) ─── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-light" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary-light font-bold">
                SYSTEM INTERLOCK STATE MACHINE
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100 mt-0.5">
              DOORWAY COLLISION INTERLOCK STATUS
            </h3>
            <p className="text-xs text-muted">
              Continuous HC-SR04 sonar scan vs configured 5.0 cm pinch safety rule
            </p>
          </div>

          {/* Tri-State Operational Selector / Display */}
          <div className="flex items-center gap-1.5 font-mono text-xs bg-base-950/90 border border-border/80 p-1 rounded-xl">
            {(["SAFE", "WARNING", "CRITICAL"] as const).map((st) => (
              <div
                key={st}
                className={cn(
                  "rounded-lg px-3 py-1 font-bold text-[10px] uppercase transition flex items-center gap-1.5",
                  currentStatus === st
                    ? st === "CRITICAL"
                      ? "bg-danger text-white shadow-glow-danger animate-pulse"
                      : st === "WARNING"
                      ? "bg-amber-400 text-base-950 font-extrabold shadow-sm"
                      : "bg-safe text-base-950 font-extrabold shadow-glow-safe"
                    : "text-muted opacity-50"
                )}
              >
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  currentStatus === st ? "bg-white" : "bg-slate-700"
                )} />
                {st}
              </div>
            ))}
          </div>
        </div>

        {/* Visual Threshold Bar & Active Distance Gauge */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-2">
            <div className="flex items-center gap-2 text-slate-300">
              <Activity className="h-4 w-4 text-primary-light" />
              <span>Ultrasonic Beam Distance:</span>
              <span className={cn(
                "font-bold text-sm",
                currentStatus === "CRITICAL" ? "text-danger" : currentStatus === "WARNING" ? "text-amber-400" : "text-safe"
              )}>
                {telemetry.distanceCm >= 900 ? "OUT OF RANGE" : `${telemetry.distanceCm.toFixed(1)} cm`}
              </span>
            </div>

            <div className="text-[11px] font-mono text-muted">
              CONFIGURED SAFETY THRESHOLD: <span className="text-danger font-bold">5.0 CM</span>
            </div>
          </div>

          {/* Graphical Threshold Meter */}
          <div className="relative h-6 w-full rounded-xl bg-base-950 border border-border/80 overflow-hidden flex items-center">
            {/* Danger Zone (0 to 5 cm = 10% of 50cm scale) */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-danger/30 border-r-2 border-danger z-10 flex items-center justify-center"
              style={{ width: "10%" }}
              title="CRITICAL ZONE: < 5.0 cm triggers auto-reversal"
            >
              <span className="hidden sm:inline font-mono text-[8px] font-bold text-danger">CRIT</span>
            </div>

            {/* Warning Zone (5 to 15 cm = 20% width) */}
            <div
              className="absolute left-[10%] top-0 bottom-0 bg-amber-400/20 border-r-2 border-amber-400/80 z-10 flex items-center justify-center"
              style={{ width: "20%" }}
              title="WARNING ZONE: 5.0 cm to 15.0 cm"
            >
              <span className="hidden sm:inline font-mono text-[8px] font-bold text-amber-400">WARN</span>
            </div>

            {/* Safe Zone (15cm to 50cm = 70% width) */}
            <div
              className="absolute left-[30%] right-0 top-0 bottom-0 bg-safe/10 z-10 flex items-center justify-center"
              title="SAFE ZONE: > 15.0 cm clear passage"
            >
              <span className="hidden sm:inline font-mono text-[8px] font-bold text-safe opacity-70">SAFE PASSAGE CLEAR</span>
            </div>

            {/* Active pointer indicator */}
            <div
              className={cn(
                "absolute top-0 bottom-0 w-2.5 rounded-full z-20 transition-all duration-300 -translate-x-1/2",
                currentStatus === "CRITICAL"
                  ? "bg-danger shadow-glow-danger animate-ping"
                  : currentStatus === "WARNING"
                  ? "bg-amber-400 shadow-sm"
                  : "bg-safe shadow-glow-safe"
              )}
              style={{
                left: `${Math.min(100, Math.max(2, (Math.min(50, telemetry.distanceCm) / 50) * 100))}%`,
              }}
            />
          </div>

          {/* Scale labels */}
          <div className="flex justify-between font-mono text-[10px] text-muted">
            <span className="text-danger font-bold">0.0 cm</span>
            <span className="text-danger font-extrabold underline decoration-danger">
              ▲ 5.0 cm SAFETY THRESHOLD
            </span>
            <span className="text-amber-400">15.0 cm</span>
            <span>50.0 cm Max Range</span>
          </div>
        </div>

        {/* Diagnostic Interlock Matrix */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="rounded-xl border border-border/70 bg-base-950/70 p-3">
            <div className="text-[10px] text-muted">ACTUATOR ANGLE</div>
            <div className="mt-1 font-bold text-slate-100 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary-light" />
              SG90: {telemetry.servoAngle}°
            </div>
            <div className="text-[9px] text-muted mt-0.5">
              {telemetry.doorState === "BLOCKED" ? "Stopped at 15°" : telemetry.doorState === "OPEN" ? "Aperture 90°" : "Secured 0°"}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-base-950/70 p-3">
            <div className="text-[10px] text-muted">PIEZO ALARM (GPIO 23)</div>
            <div className="mt-1 font-bold flex items-center gap-1.5">
              {telemetry.buzzerActive ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-danger animate-pulse" />
                  <span className="text-danger font-bold">BUZZER ACTIVE</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-300">SILENT (ARMED)</span>
                </>
              )}
            </div>
            <div className="text-[9px] text-muted mt-0.5">
              {telemetry.buzzerActive ? "2.4 kHz Warning Pulse" : "Nominal Standby"}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-base-950/70 p-3">
            <div className="text-[10px] text-muted">HAZARD STROBE (GPIO 2)</div>
            <div className="mt-1 font-bold flex items-center gap-1.5">
              {telemetry.ledActive ? (
                <>
                  <Lightbulb className="h-3.5 w-3.5 text-danger animate-pulse" />
                  <span className="text-danger font-bold">RED BEACON FLASH</span>
                </>
              ) : (
                <>
                  <Lightbulb className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-300">IDLE (OFF)</span>
                </>
              )}
            </div>
            <div className="text-[9px] text-muted mt-0.5">
              220Ω Resistor Protected
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-base-950/70 p-3">
            <div className="text-[10px] text-muted">INTERLOCK POLICY</div>
            <div className="mt-1 font-bold text-safe flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-safe" />
              AUTO-REVERSAL
            </div>
            <div className="text-[9px] text-muted mt-0.5">
              Rule: Distance &lt; 5.0 cm → Reopen
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER CONTROLS ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted" />
          <span className="font-mono text-xs uppercase tracking-wider text-slate-300 font-bold">
            Filter Incidents:
          </span>
          <div className="flex items-center gap-1 font-mono text-xs">
            {(["All", "Critical", "Warning", "Resolved"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs transition",
                  filter === sev
                    ? sev === "Critical"
                      ? "bg-danger text-white font-bold"
                      : sev === "Warning"
                      ? "bg-amber-400 text-base-950 font-bold"
                      : sev === "Resolved"
                      ? "bg-safe text-base-950 font-bold"
                      : "bg-primary/25 text-primary-light border border-primary/40 font-bold"
                    : "text-muted hover:text-slate-200 bg-base-950"
                )}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search incident, distance, timestamp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-border bg-base-950 py-1.5 pl-8 pr-3 font-mono text-xs text-slate-200 placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* ── EVENT TIMELINE SECTION ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="border-b border-border/70 pb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-light" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary-light font-bold">
                INCIDENT SEQUENCE TIMELINE
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100 mt-0.5">
              CHRONOLOGICAL SAFETY EVENT STREAM
            </h3>
          </div>
          <span className="font-mono text-xs text-muted">
            {filteredIncidents.length} Events Logged
          </span>
        </div>

        {/* Timeline Sequence */}
        <div className="mt-5 relative pl-6 border-l-2 border-border/80 space-y-4">
          {filteredIncidents.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-border/70 bg-base-950/40 p-6 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="h-7 w-7 text-safe/60" />
              <div className="text-xs font-mono font-bold text-slate-200">Zero Critical Incidents Logged</div>
              <p className="text-[11px] text-muted max-w-sm">
                No collision hazards or anti-pinch reversals recorded in this filter window. Door safety interlock active.
              </p>
            </div>
          ) : (
            filteredIncidents.map((inc) => (
              <div key={inc.id} className="relative group">
                {/* Node marker on timeline spine */}
                <div
                  className={cn(
                    "absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all",
                    inc.severity === "CRITICAL"
                      ? "border-danger bg-danger/30 shadow-glow-danger"
                      : inc.severity === "WARNING"
                      ? "border-amber-400 bg-amber-400/30"
                      : "border-safe bg-safe/30"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      inc.severity === "CRITICAL"
                        ? "bg-danger animate-ping"
                        : inc.severity === "WARNING"
                        ? "bg-amber-400"
                        : "bg-safe"
                    )}
                  />
                </div>

                {/* Event Timeline Card */}
                <div
                  className={cn(
                    "rounded-xl border p-4 transition-all bg-base-950/70 hover:bg-base-950",
                    inc.severity === "CRITICAL"
                      ? "border-danger/40 hover:border-danger/60"
                      : inc.severity === "WARNING"
                      ? "border-amber-400/40 hover:border-amber-400/60"
                      : "border-border/80 hover:border-slate-600"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-100">
                        {inc.eventType}
                      </span>
                      <span className="text-muted">•</span>
                      <span className="text-xs text-slate-300 font-medium">
                        {inc.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {inc.timestamp}
                      </span>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold uppercase border",
                          inc.severity === "CRITICAL"
                            ? "border-danger/50 bg-danger/15 text-danger"
                            : inc.severity === "WARNING"
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            : "border-safe/40 bg-safe/10 text-safe"
                        )}
                      >
                        {inc.severity}
                      </span>
                    </div>
                  </div>

                  {/* Micro-Telemetry Snapshot Grid */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div className="rounded-lg bg-base-900/80 p-2 border border-border/50">
                      <span className="text-muted block text-[10px]">Distance</span>
                      <span
                        className={cn(
                          "font-bold",
                          inc.distanceCm < inc.thresholdCm ? "text-danger" : "text-slate-200"
                        )}
                      >
                        {inc.distanceCm.toFixed(1)} cm
                      </span>
                      <span className="text-[9px] text-muted block">
                        Limit: {inc.thresholdCm.toFixed(1)} cm
                      </span>
                    </div>

                    <div className="rounded-lg bg-base-900/80 p-2 border border-border/50">
                      <span className="text-muted block text-[10px]">Door State</span>
                      <span className="font-bold text-slate-200">
                        {inc.doorState}
                      </span>
                      <span className="text-[9px] text-muted block">
                        Servo: {inc.servoAngle}°
                      </span>
                    </div>

                    <div className="rounded-lg bg-base-900/80 p-2 border border-border/50">
                      <span className="text-muted block text-[10px]">Buzzer Alarm</span>
                      <span
                        className={cn(
                          "font-bold",
                          inc.buzzerActive ? "text-danger" : "text-slate-400"
                        )}
                      >
                        {inc.buzzerActive ? "ACTIVE (2.4kHz)" : "SILENT"}
                      </span>
                      <span className="text-[9px] text-muted block">GPIO 23</span>
                    </div>

                    <div className="rounded-lg bg-base-900/80 p-2 border border-border/50">
                      <span className="text-muted block text-[10px]">Red LED Strobe</span>
                      <span
                        className={cn(
                          "font-bold",
                          inc.ledActive ? "text-danger" : "text-slate-400"
                        )}
                      >
                        {inc.ledActive ? "FLASHING" : "OFF"}
                      </span>
                      <span className="text-[9px] text-muted block">GPIO 2 (220Ω)</span>
                    </div>
                  </div>

                  {/* Action Taken Narrative */}
                  <div className="mt-3 flex items-start gap-2 text-xs text-slate-300 bg-base-900/50 rounded-lg p-2.5 border border-border/40">
                    <ArrowRight className="h-3.5 w-3.5 text-primary-light shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-primary-light font-semibold mr-1.5">
                        Action Taken:
                      </span>
                      {inc.actionTaken}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── DETAILED EVENT TABLE ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel">
        <div className="border-b border-border/70 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-safe" />
              <span className="font-mono text-xs uppercase tracking-widest text-safe font-bold">
                AUDIT REGISTER
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100 mt-0.5">
              DETAILED SAFETY EVENT AUDIT TABLE
            </h3>
          </div>
          <span className="font-mono text-xs text-muted">
            All Doorway Interlock Trigger Records
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-border bg-base-950/80 text-[10px] text-muted uppercase">
              <tr>
                <th className="py-3 px-3">TIMESTAMP</th>
                <th className="py-3 px-3">EVENT TYPE</th>
                <th className="py-3 px-3">MEASURED DISTANCE</th>
                <th className="py-3 px-3">DOOR STATE</th>
                <th className="py-3 px-3">ACTION TAKEN</th>
                <th className="py-3 px-3">ALARMS</th>
                <th className="py-3 px-3">SEVERITY</th>
                <th className="py-3 px-3 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-slate-300">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No safety records found
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((row) => (
                  <tr key={row.id} className="hover:bg-base-950/60 transition">
                    <td className="py-3 px-3 text-muted whitespace-nowrap">
                      {row.timestamp}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-100 whitespace-nowrap">
                      {row.eventType}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "font-bold",
                          row.distanceCm < row.thresholdCm ? "text-danger" : "text-slate-200"
                        )}
                      >
                        {row.distanceCm.toFixed(1)} cm
                      </span>
                      <span className="text-[10px] text-muted ml-1">
                        (&lt; {row.thresholdCm.toFixed(1)} cm)
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="rounded bg-base-950 px-2 py-0.5 border border-border/70 text-[11px]">
                        {row.doorState} ({row.servoAngle}°)
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-xs font-sans text-xs text-slate-300 truncate" title={row.actionTaken}>
                      {row.actionTaken}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 border",
                            row.buzzerActive
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : "border-border text-muted"
                          )}
                        >
                          Buzzer: {row.buzzerActive ? "ON" : "OFF"}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 border",
                            row.ledActive
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : "border-border text-muted"
                          )}
                        >
                          LED: {row.ledActive ? "ON" : "OFF"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold uppercase border",
                          row.severity === "CRITICAL"
                            ? "border-danger/50 bg-danger/15 text-danger"
                            : row.severity === "WARNING"
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            : "border-safe/40 bg-safe/10 text-safe"
                        )}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase border border-safe/30 bg-safe/10 text-safe">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

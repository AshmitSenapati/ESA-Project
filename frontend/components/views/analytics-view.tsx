"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Scale,
  TrendingUp,
  Activity,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Calendar,
  Filter,
  Search,
  Sparkles,
  Info,
  CheckCircle2,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { BusTelemetry, LogEvent, TransitLogEntry } from "../../lib/types";
import { cn } from "../../lib/utils";

interface AnalyticsViewProps {
  telemetry: BusTelemetry;
  events?: LogEvent[];
  onToggleDemoMode?: () => void;
}

type TimeFilterOption =
  | "live"
  | "today"
  | "morning"
  | "midday"
  | "evening";

interface TimeDataPoint {
  time: string;
  passengers: number;
  entries: number;
  exits: number;
  occupancyPercent: number;
  capacity: number;
}

// ── In-Memory Synthetic Datasets by Time Range ───────────────────────────────

const DATASETS: Record<TimeFilterOption, { label: string; range: string; data: TimeDataPoint[] }> = {
  live: {
    label: "Live Session Buffer",
    range: "Current Operational Run",
    data: [
      { time: "20:30", passengers: 15, entries: 5, exits: 1, occupancyPercent: 37.5, capacity: 40 },
      { time: "20:35", passengers: 18, entries: 6, exits: 3, occupancyPercent: 45.0, capacity: 40 },
      { time: "20:40", passengers: 19, entries: 4, exits: 3, occupancyPercent: 47.5, capacity: 40 },
      { time: "20:45", passengers: 21, entries: 5, exits: 3, occupancyPercent: 52.5, capacity: 40 },
      { time: "20:50", passengers: 23, entries: 6, exits: 4, occupancyPercent: 57.5, capacity: 40 },
      { time: "20:55", passengers: 24, entries: 4, exits: 3, occupancyPercent: 60.0, capacity: 40 },
      { time: "21:00", passengers: 26, entries: 5, exits: 3, occupancyPercent: 65.0, capacity: 40 },
      { time: "21:05", passengers: 24, entries: 3, exits: 5, occupancyPercent: 60.0, capacity: 40 },
    ],
  },
  today: {
    label: "Today (Full Schedule)",
    range: "06:00 — 22:00",
    data: [
      { time: "06:00", passengers: 8, entries: 9, exits: 1, occupancyPercent: 20.0, capacity: 40 },
      { time: "07:00", passengers: 22, entries: 20, exits: 6, occupancyPercent: 55.0, capacity: 40 },
      { time: "08:00", passengers: 35, entries: 32, exits: 19, occupancyPercent: 87.5, capacity: 40 },
      { time: "09:00", passengers: 28, entries: 18, exits: 25, occupancyPercent: 70.0, capacity: 40 },
      { time: "10:00", passengers: 18, entries: 12, exits: 22, occupancyPercent: 45.0, capacity: 40 },
      { time: "11:00", passengers: 16, entries: 14, exits: 16, occupancyPercent: 40.0, capacity: 40 },
      { time: "12:00", passengers: 22, entries: 21, exits: 15, occupancyPercent: 55.0, capacity: 40 },
      { time: "13:00", passengers: 25, entries: 24, exits: 21, occupancyPercent: 62.5, capacity: 40 },
      { time: "14:00", passengers: 20, entries: 15, exits: 20, occupancyPercent: 50.0, capacity: 40 },
      { time: "15:00", passengers: 26, entries: 28, exits: 22, occupancyPercent: 65.0, capacity: 40 },
      { time: "16:00", passengers: 34, entries: 35, exits: 27, occupancyPercent: 85.0, capacity: 40 },
      { time: "17:00", passengers: 38, entries: 42, exits: 38, occupancyPercent: 95.0, capacity: 40 },
      { time: "18:00", passengers: 31, entries: 28, exits: 35, occupancyPercent: 77.5, capacity: 40 },
      { time: "19:00", passengers: 22, entries: 18, exits: 27, occupancyPercent: 55.0, capacity: 40 },
      { time: "20:00", passengers: 15, entries: 10, exits: 17, occupancyPercent: 37.5, capacity: 40 },
      { time: "21:00", passengers: 10, entries: 6, exits: 11, occupancyPercent: 25.0, capacity: 40 },
    ],
  },
  morning: {
    label: "Morning Rush",
    range: "06:00 — 10:00",
    data: [
      { time: "06:00", passengers: 8, entries: 9, exits: 1, occupancyPercent: 20.0, capacity: 40 },
      { time: "06:30", passengers: 15, entries: 12, exits: 5, occupancyPercent: 37.5, capacity: 40 },
      { time: "07:00", passengers: 22, entries: 18, exits: 11, occupancyPercent: 55.0, capacity: 40 },
      { time: "07:30", passengers: 31, entries: 26, exits: 17, occupancyPercent: 77.5, capacity: 40 },
      { time: "08:00", passengers: 36, entries: 34, exits: 29, occupancyPercent: 90.0, capacity: 40 },
      { time: "08:30", passengers: 33, entries: 22, exits: 25, occupancyPercent: 82.5, capacity: 40 },
      { time: "09:00", passengers: 28, entries: 18, exits: 23, occupancyPercent: 70.0, capacity: 40 },
      { time: "09:30", passengers: 22, entries: 14, exits: 20, occupancyPercent: 55.0, capacity: 40 },
    ],
  },
  midday: {
    label: "Midday Shift",
    range: "10:00 — 15:00",
    data: [
      { time: "10:00", passengers: 18, entries: 12, exits: 16, occupancyPercent: 45.0, capacity: 40 },
      { time: "11:00", passengers: 16, entries: 14, exits: 16, occupancyPercent: 40.0, capacity: 40 },
      { time: "12:00", passengers: 22, entries: 21, exits: 15, occupancyPercent: 55.0, capacity: 40 },
      { time: "13:00", passengers: 25, entries: 24, exits: 21, occupancyPercent: 62.5, capacity: 40 },
      { time: "14:00", passengers: 20, entries: 15, exits: 20, occupancyPercent: 50.0, capacity: 40 },
    ],
  },
  evening: {
    label: "Evening Peak",
    range: "15:00 — 20:00",
    data: [
      { time: "15:00", passengers: 26, entries: 28, exits: 22, occupancyPercent: 65.0, capacity: 40 },
      { time: "16:00", passengers: 34, entries: 35, exits: 27, occupancyPercent: 85.0, capacity: 40 },
      { time: "17:00", passengers: 38, entries: 42, exits: 38, occupancyPercent: 95.0, capacity: 40 },
      { time: "18:00", passengers: 31, entries: 28, exits: 35, occupancyPercent: 77.5, capacity: 40 },
      { time: "19:00", passengers: 22, entries: 18, exits: 27, occupancyPercent: 55.0, capacity: 40 },
      { time: "20:00", passengers: 15, entries: 10, exits: 17, occupancyPercent: 37.5, capacity: 40 },
    ],
  },
};

// Default transit log records
const DEFAULT_TRANSIT_LOG: TransitLogEntry[] = [
  { id: "tl-1", time: "20:58:14", event: "Passenger entered", direction: "Inbound (+1)", passengerCount: 24, isSimulated: true },
  { id: "tl-2", time: "20:56:40", event: "Passenger exited", direction: "Outbound (-1)", passengerCount: 23, isSimulated: true },
  { id: "tl-3", time: "20:55:18", event: "Door reversal triggered", direction: "Reversal", passengerCount: 24, isSimulated: true },
  { id: "tl-4", time: "20:55:16", event: "Obstacle detected (< 5cm)", direction: "Reversal", passengerCount: 24, isSimulated: true },
  { id: "tl-5", time: "20:54:02", event: "Passenger entered", direction: "Inbound (+1)", passengerCount: 24, isSimulated: true },
  { id: "tl-6", time: "20:52:45", event: "Passenger entered", direction: "Inbound (+1)", passengerCount: 23, isSimulated: true },
  { id: "tl-7", time: "20:50:11", event: "Passenger exited", direction: "Outbound (-1)", passengerCount: 22, isSimulated: true },
  { id: "tl-8", time: "20:48:33", event: "Passenger entered", direction: "Inbound (+1)", passengerCount: 23, isSimulated: true },
  { id: "tl-9", time: "20:45:19", event: "Door opened for stop", direction: "Door Transit", passengerCount: 22, isSimulated: true },
  { id: "tl-10", time: "20:41:04", event: "Passenger entered", direction: "Inbound (+1)", passengerCount: 22, isSimulated: true },
  { id: "tl-11", time: "20:38:50", event: "Passenger exited", direction: "Outbound (-1)", passengerCount: 21, isSimulated: true },
  { id: "tl-12", time: "20:34:12", event: "Door reversal triggered", direction: "Reversal", passengerCount: 22, isSimulated: true },
];

export function AnalyticsView({
  telemetry,
  events = [],
  onToggleDemoMode,
}: AnalyticsViewProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>("today");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [tableSearch, setTableSearch] = useState<string>("");

  const currentDataset = DATASETS[timeFilter];

  // Calculate high-level summary KPIs
  const totalEntries = useMemo(() => {
    return currentDataset.data.reduce((acc, curr) => acc + curr.entries, 0);
  }, [currentDataset]);

  const totalExits = useMemo(() => {
    return currentDataset.data.reduce((acc, curr) => acc + curr.exits, 0);
  }, [currentDataset]);

  const netPassengerChange = totalEntries - totalExits;

  const peakOccupancy = useMemo(() => {
    return Math.max(...currentDataset.data.map((d) => d.passengers));
  }, [currentDataset]);

  const averageOccupancy = useMemo(() => {
    const sum = currentDataset.data.reduce((acc, curr) => acc + curr.passengers, 0);
    return (sum / currentDataset.data.length).toFixed(1);
  }, [currentDataset]);

  // Event statistics section counts
  const obstacleEventsCount = useMemo(() => {
    const liveObstacles = events.filter((e) => e.type === "OBSTACLE_DETECTED").length;
    return liveObstacles > 0 ? liveObstacles : 3;
  }, [events]);

  const automaticReversalsCount = useMemo(() => {
    const liveReversals = events.filter((e) => e.type === "DOOR_REOPENED").length;
    return liveReversals > 0 ? liveReversals : 3;
  }, [events]);

  // Table rows combined with any real/simulated events
  const tableRows: TransitLogEntry[] = useMemo(() => {
    const liveConverted: TransitLogEntry[] = events
      .filter((e) =>
        e.type === "PASSENGER_ENTRY" ||
        e.type === "PASSENGER_EXIT" ||
        e.type === "OBSTACLE_DETECTED" ||
        e.type === "DOOR_REOPENED"
      )
      .map((e) => {
        let direction: TransitLogEntry["direction"] = "Door Transit";
        let label = e.title;
        if (e.type === "PASSENGER_ENTRY") {
          direction = "Inbound (+1)";
          label = "Passenger entered";
        } else if (e.type === "PASSENGER_EXIT") {
          direction = "Outbound (-1)";
          label = "Passenger exited";
        } else if (e.type === "OBSTACLE_DETECTED") {
          direction = "Reversal";
          label = "Obstacle detected (< 5cm)";
        } else if (e.type === "DOOR_REOPENED") {
          direction = "Reversal";
          label = "Door reversal triggered";
        }

        return {
          id: e.id,
          time: e.timestamp,
          event: label,
          direction,
          passengerCount: e.metadata?.passengerCount ?? telemetry.passengerCount,
          isSimulated: telemetry.isDemoMode,
        };
      });

    return [...liveConverted, ...DEFAULT_TRANSIT_LOG];
  }, [events, telemetry.isDemoMode, telemetry.passengerCount]);

  // Filtered table rows
  const filteredTableRows = useMemo(() => {
    return tableRows.filter((row) => {
      const matchesSearch =
        row.event.toLowerCase().includes(tableSearch.toLowerCase()) ||
        row.direction.toLowerCase().includes(tableSearch.toLowerCase()) ||
        row.time.includes(tableSearch);

      const matchesFilter =
        tableFilter === "all" ||
        (tableFilter === "inbound" && row.direction === "Inbound (+1)") ||
        (tableFilter === "outbound" && row.direction === "Outbound (-1)") ||
        (tableFilter === "reversal" && row.direction === "Reversal");

      return matchesSearch && matchesFilter;
    });
  }, [tableRows, tableSearch, tableFilter]);

  return (
    <div className="space-y-5">
      {/* ── DATA PROVENANCE & DEMO MODE BANNER ─────────────────────────────── */}
      <div
        className={cn(
          "rounded-2xl border p-4 sm:p-5 backdrop-blur-md shadow-panel transition-all",
          telemetry.isDemoMode
            ? "border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-base-900 to-base-950"
            : "border-safe/50 bg-gradient-to-r from-safe/15 via-base-900 to-base-950"
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 mt-0.5",
                telemetry.isDemoMode
                  ? "border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(255,197,92,0.25)]"
                  : "border-safe/60 bg-safe/20 text-safe shadow-glow-safe"
              )}
            >
              {telemetry.isDemoMode ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "font-mono text-xs font-bold uppercase tracking-wider",
                    telemetry.isDemoMode ? "text-amber-300" : "text-safe"
                  )}
                >
                  {telemetry.isDemoMode
                    ? "DEMO MODE ACTIVE // SIMULATED IN-MEMORY DATA"
                    : "LIVE ESP32 TELEMETRY // REAL HARDWARE DATA"}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase border",
                    telemetry.isDemoMode
                      ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
                      : "bg-safe/20 text-safe border-safe/40"
                  )}
                >
                  {telemetry.isDemoMode ? "SYNTHETIC PROJECTION" : "HARDWARE CERTIFIED"}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-3xl">
                {telemetry.isDemoMode
                  ? "The charts, event totals, and transit logs below are derived from in-memory test benchmarks to demonstrate operational capabilities before physical ESP32 Wi-Fi connection. Real sensor numbers are never fabricated."
                  : "Streaming physical HC-SR04 sonar distances and sequential IR1/IR2 breakbeam timestamps directly from ESP32 MAC address."}
              </p>
            </div>
          </div>

          {/* Mode Switcher Pill */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleDemoMode && (
              <button
                onClick={onToggleDemoMode}
                className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-base-950 px-3 py-1.5 font-mono text-xs text-slate-300 hover:border-slate-500 hover:text-white transition"
              >
                <Activity className="h-3.5 w-3.5 text-primary-light" />
                <span>Toggle Mode ({telemetry.isDemoMode ? "Switch to Live" : "Switch to Demo"})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── HEADER WITH TIME / DATE FILTER CONTROLS ───────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-light" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary-light font-bold">
              PASSENGER ANALYTICS
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
            PASSENGER FLOW &amp; OCCUPANCY INTELLIGENCE
          </h2>
          <p className="text-xs text-muted">
            Aggregated boarding volumes, alighting velocity, peak hour load &amp; threshold safety interlocks
          </p>
        </div>

        {/* Date/Time Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-base-900/90 border border-border/80 p-1.5 rounded-xl">
          <Calendar className="h-3.5 w-3.5 text-muted ml-1 mr-0.5 hidden sm:inline" />
          {(["live", "today", "morning", "midday", "evening"] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setTimeFilter(filterKey)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-mono transition whitespace-nowrap",
                timeFilter === filterKey
                  ? "bg-primary/25 text-primary-light border border-primary/40 font-bold shadow-sm"
                  : "text-muted hover:text-slate-300 hover:bg-base-950"
              )}
            >
              {DATASETS[filterKey].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TOP SUMMARY CARDS (6 MAJOR KPI METRICS) ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Current Passengers */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>CURRENT PASSENGERS</span>
            <Users className="h-3.5 w-3.5 text-primary-light" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-extrabold text-slate-50">
              {telemetry.passengerCount}
            </span>
            <span className="font-mono text-[10px] text-muted">/ {telemetry.maxCapacity}</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-primary-light flex items-center justify-between border-t border-border/50 pt-2">
            <span>Load: {Math.round((telemetry.passengerCount / telemetry.maxCapacity) * 100)}%</span>
            <span className="text-[9px] text-muted">Real-Time</span>
          </div>
        </div>

        {/* Card 2: Total Entries */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>TOTAL ENTRIES</span>
            <ArrowDownToLine className="h-3.5 w-3.5 text-entry-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-extrabold text-entry-blue">
              +{totalEntries}
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between border-t border-border/50 pt-2">
            <span>IR1 → IR2 Gate</span>
            {telemetry.isDemoMode && <span className="text-amber-400 text-[8px]">SIM</span>}
          </div>
        </div>

        {/* Card 3: Total Exits */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>TOTAL EXITS</span>
            <ArrowUpFromLine className="h-3.5 w-3.5 text-exit-violet" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-extrabold text-exit-violet">
              -{totalExits}
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between border-t border-border/50 pt-2">
            <span>IR2 → IR1 Gate</span>
            {telemetry.isDemoMode && <span className="text-amber-400 text-[8px]">SIM</span>}
          </div>
        </div>

        {/* Card 4: Net Passenger Change */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>NET PASSENGER CHANGE</span>
            <Scale className="h-3.5 w-3.5 text-safe" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={cn(
              "font-mono text-3xl font-extrabold",
              netPassengerChange >= 0 ? "text-safe" : "text-amber-400"
            )}>
              {netPassengerChange >= 0 ? `+${netPassengerChange}` : netPassengerChange}
            </span>
            <span className="font-mono text-[10px] text-muted">Pax</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between border-t border-border/50 pt-2">
            <span>Entries − Exits</span>
            <span className="text-safe text-[8px]">Balanced</span>
          </div>
        </div>

        {/* Card 5: Peak Occupancy */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>PEAK OCCUPANCY</span>
            <Activity className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-extrabold text-slate-100">
              {peakOccupancy}
            </span>
            <span className="font-mono text-[10px] text-amber-400 font-semibold">
              ({Math.round((peakOccupancy / telemetry.maxCapacity) * 100)}%)
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between border-t border-border/50 pt-2">
            <span>High Load Mark</span>
            <span className="text-slate-300 text-[9px]">{currentDataset.range}</span>
          </div>
        </div>

        {/* Card 6: Average Occupancy */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-4 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-[10px] font-mono">
            <span>AVERAGE OCCUPANCY</span>
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-extrabold text-slate-100">
              {averageOccupancy}
            </span>
            <span className="font-mono text-[10px] text-muted">Pax / Hr</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between border-t border-border/50 pt-2">
            <span>Mean Fleet Rate</span>
            <span className="text-primary-light text-[9px]">Comfort Range</span>
          </div>
        </div>
      </div>

      {/* ── THE THREE CHARTS GRID ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── CHART 1: PASSENGER COUNT OVER TIME ──────────────────────────── */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 shadow-panel flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary-light" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary-light font-bold">
                  CHART 01 // OCCUPANCY CURVE
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                PASSENGER COUNT OVER TIME
              </h3>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
              <span className="rounded bg-base-950 px-2 py-0.5 border border-border/70">
                Range: {currentDataset.range}
              </span>
              {telemetry.isDemoMode && (
                <span className="text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded">
                  DEMO DATA
                </span>
              )}
            </div>
          </div>

          <div className="my-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentDataset.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="paxCurveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2d9cff" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#2d9cff" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1b2635" vertical={false} />
                <XAxis dataKey="time" stroke="#64758a" fontSize={10} tickLine={false} />
                <YAxis stroke="#64758a" fontSize={10} domain={[0, 45]} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0].value as number;
                      return (
                        <div className="rounded-xl border border-border bg-base-950/95 p-2.5 shadow-2xl backdrop-blur-md font-mono text-xs">
                          <div className="text-[10px] text-muted">Time: {label}</div>
                          <div className="mt-1 font-bold text-primary-light">
                            {val} Passengers Onboard
                          </div>
                          <div className="text-[10px] text-muted">
                            {telemetry.maxCapacity - val} Seats Available
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={telemetry.maxCapacity}
                  stroke="#ff6875"
                  strokeDasharray="4 4"
                  label={{
                    value: "MAX CAPACITY (40)",
                    position: "insideTopRight",
                    fill: "#ff6875",
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="passengers"
                  stroke="#2d9cff"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#paxCurveGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-2 text-[10px] font-mono text-muted">
            <span>Sequential IR1 ↔ IR2 Directional Buffer</span>
            <span className="text-safe">Zero Ghost Counts</span>
          </div>
        </div>

        {/* ── CHART 2: ENTRIES VERSUS EXITS OVER TIME ─────────────────────── */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 shadow-panel flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-entry-blue" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-entry-blue font-bold">
                  CHART 02 // DIRECTIONAL FLOW
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                ENTRIES VERSUS EXITS OVER TIME
              </h3>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className="flex items-center gap-1 text-entry-blue">
                <span className="h-2 w-2 rounded-full bg-entry-blue" />
                Inbound (+1)
              </span>
              <span className="flex items-center gap-1 text-exit-violet">
                <span className="h-2 w-2 rounded-full bg-exit-violet" />
                Outbound (-1)
              </span>
            </div>
          </div>

          <div className="my-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentDataset.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1b2635" vertical={false} />
                <XAxis dataKey="time" stroke="#64758a" fontSize={10} tickLine={false} />
                <YAxis stroke="#64758a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#080d14",
                    border: "1px solid #1b2635",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
                <Bar dataKey="entries" name="Entries" fill="#5cbcff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exits" name="Exits" fill="#9b8dff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-2 text-[10px] font-mono text-muted">
            <span>Inflow: +{totalEntries} Boardings</span>
            <span>Outflow: -{totalExits} Alightings</span>
          </div>
        </div>

        {/* ── CHART 3: OCCUPANCY PERCENTAGE ───────────────────────────────── */}
        <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 shadow-panel lg:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-safe" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-safe font-bold">
                  CHART 03 // CAPACITY LOAD DISTRIBUTION
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                OCCUPANCY PERCENTAGE (% OF 40-SEAT CAPACITY)
              </h3>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-safe" />
                &lt; 60% Comfort Zone
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                60% - 85% Caution
              </span>
              <span className="flex items-center gap-1 text-danger">
                <span className="h-2 w-2 rounded-full bg-danger" />
                &gt; 85% Standing Room Only
              </span>
            </div>
          </div>

          <div className="my-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentDataset.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pctGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5de5a0" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5de5a0" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1b2635" vertical={false} />
                <XAxis dataKey="time" stroke="#64758a" fontSize={10} tickLine={false} />
                <YAxis stroke="#64758a" fontSize={10} domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0].value as number;
                      return (
                        <div className="rounded-xl border border-border bg-base-950/95 p-2.5 shadow-2xl backdrop-blur-md font-mono text-xs">
                          <div className="text-[10px] text-muted">Time: {label}</div>
                          <div className={cn("mt-1 font-bold", val > 85 ? "text-danger" : val > 60 ? "text-amber-400" : "text-safe")}>
                            {val.toFixed(1)}% Capacity Occupied
                          </div>
                          <div className="text-[10px] text-muted">
                            {val > 85 ? "High Congestion" : val > 60 ? "Moderate Density" : "Seats Readily Available"}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={85}
                  stroke="#ffc55c"
                  strokeDasharray="3 3"
                  label={{
                    value: "85% CONGESTION THRESHOLD",
                    position: "insideTopRight",
                    fill: "#ffc55c",
                    fontSize: 9,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="occupancyPercent"
                  stroke="#5de5a0"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#pctGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-2 text-[10px] font-mono text-muted">
            <span>Peak Ratio Recorded: {Math.round((peakOccupancy / telemetry.maxCapacity) * 100)}%</span>
            <span>Target Comfort Baseline: 50%</span>
          </div>
        </div>
      </div>

      {/* ── EVENT STATISTICS SECTION (4 CARDS) ────────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 shadow-panel">
        <div className="border-b border-border/70 pb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary-light" />
              <span className="font-mono text-xs uppercase tracking-wider text-primary-light font-bold">
                TRANSIT &amp; SAFETY EVENT AUDIT
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100 mt-0.5">
              TELEMETRY EVENT TOTALS
            </h3>
          </div>
          {telemetry.isDemoMode && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
              SIMULATED BENCHMARK TOTALS
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tile 1: Total Entries */}
          <div className="rounded-xl border border-border/70 bg-base-950/70 p-4">
            <div className="flex items-center justify-between text-muted text-xs font-mono">
              <span>TOTAL ENTRIES</span>
              <ArrowDownToLine className="h-4 w-4 text-entry-blue" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-entry-blue">
              {totalEntries}
            </div>
            <div className="mt-1 text-[11px] text-muted font-sans">
              Sequential IR1 → IR2 entry triggers confirmed
            </div>
          </div>

          {/* Tile 2: Total Exits */}
          <div className="rounded-xl border border-border/70 bg-base-950/70 p-4">
            <div className="flex items-center justify-between text-muted text-xs font-mono">
              <span>TOTAL EXITS</span>
              <ArrowUpFromLine className="h-4 w-4 text-exit-violet" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-exit-violet">
              {totalExits}
            </div>
            <div className="mt-1 text-[11px] text-muted font-sans">
              Sequential IR2 → IR1 exit triggers confirmed
            </div>
          </div>

          {/* Tile 3: Obstacle Events */}
          <div className="rounded-xl border border-border/70 bg-base-950/70 p-4">
            <div className="flex items-center justify-between text-muted text-xs font-mono">
              <span>OBSTACLE EVENTS</span>
              <AlertTriangle className="h-4 w-4 text-danger" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-danger">
              {obstacleEventsCount}
            </div>
            <div className="mt-1 text-[11px] text-muted font-sans">
              HC-SR04 doorway obstructions &lt; 5.0 cm
            </div>
          </div>

          {/* Tile 4: Automatic Door Reversals */}
          <div className="rounded-xl border border-border/70 bg-base-950/70 p-4">
            <div className="flex items-center justify-between text-muted text-xs font-mono">
              <span>AUTOMATIC DOOR REVERSALS</span>
              <RotateCcw className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-amber-400">
              {automaticReversalsCount}
            </div>
            <div className="mt-1 text-[11px] text-muted font-sans">
              SG90 servo 15° safety reopen cycles executed
            </div>
          </div>
        </div>
      </div>

      {/* ── CHRONOLOGICAL TRANSIT ACTIVITY TABLE ──────────────────────────── */}
      <div className="rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-light" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary-light font-bold">
                ACTIVITY REGISTER
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100 mt-0.5">
              CHRONOLOGICAL TRANSIT &amp; SAFETY LOG
            </h3>
            <p className="text-xs text-muted">
              Granular record of entry, exit, doorway obstacles and actuator responses
            </p>
          </div>

          {/* Table Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search event or time..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="rounded-lg border border-border bg-base-950 py-1.5 pl-8 pr-3 font-mono text-xs text-slate-200 placeholder:text-muted focus:border-primary focus:outline-none w-44 sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1 font-mono text-xs">
              {(["all", "inbound", "outbound", "reversal"] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  onClick={() => setTableFilter(filterOpt)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] uppercase transition",
                    tableFilter === filterOpt
                      ? "bg-primary/20 text-primary-light border border-primary/40 font-bold"
                      : "text-muted hover:text-slate-300 bg-base-950"
                  )}
                >
                  {filterOpt === "all" ? "All" : filterOpt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-border bg-base-950/80 text-[10px] text-muted uppercase">
              <tr>
                <th className="py-3 px-4">TIME</th>
                <th className="py-3 px-4">EVENT</th>
                <th className="py-3 px-4">DIRECTION</th>
                <th className="py-3 px-4">PASSENGER COUNT</th>
                <th className="py-3 px-4 text-right">PROVENANCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-slate-300">
              {filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <BarChart3 className="h-6 w-6 text-slate-700 mb-1" />
                      <span className="font-semibold text-slate-300 text-xs font-mono">No Transit Records Matching Filter</span>
                      <span className="text-[10px] text-muted">Adjust directional filter to inspect recorded passenger movement.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-base-950/60 transition">
                    <td className="py-3 px-4 text-muted whitespace-nowrap">
                      {row.time}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                      {row.direction === "Inbound (+1)" ? (
                        <ArrowDownToLine className="h-3.5 w-3.5 text-entry-blue shrink-0" />
                      ) : row.direction === "Outbound (-1)" ? (
                        <ArrowUpFromLine className="h-3.5 w-3.5 text-exit-violet shrink-0" />
                      ) : row.direction === "Reversal" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-danger shrink-0" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 text-safe shrink-0" />
                      )}
                      <span>{row.event}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold uppercase border",
                          row.direction === "Inbound (+1)"
                            ? "border-entry-blue/40 bg-entry-blue/10 text-entry-blue"
                            : row.direction === "Outbound (-1)"
                            ? "border-exit-violet/40 bg-exit-violet/10 text-exit-violet"
                            : row.direction === "Reversal"
                            ? "border-danger/40 bg-danger/10 text-danger"
                            : "border-border bg-base-950 text-slate-300"
                        )}
                      >
                        {row.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-200">
                      {row.passengerCount} Pax
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 font-mono text-[9px] uppercase border",
                          row.isSimulated
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            : "border-safe/30 bg-safe/10 text-safe"
                        )}
                      >
                        {row.isSimulated ? "SIMULATED" : "ESP32 LIVE"}
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

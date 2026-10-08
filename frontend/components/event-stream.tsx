"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Siren,
  ArrowDownToLine,
  ArrowUpFromLine,
  DoorOpen,
  DoorClosed,
  AlertTriangle,
  RotateCcw,
  Wifi,
  WifiOff,
  Filter,
  Trash2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { EventType, LogEvent } from "../lib/types";

interface EventStreamProps {
  events: LogEvent[];
  onClearEvents: () => void;
}

export function EventStream({ events, onClearEvents }: EventStreamProps) {
  const [filter, setFilter] = useState<"all" | "safety" | "transit" | "system">("all");

  const filteredEvents = events.filter((ev) => {
    if (filter === "safety") {
      return (
        ev.type === "OBSTACLE_DETECTED" ||
        ev.type === "DOOR_REOPENED"
      );
    }
    if (filter === "transit") {
      return (
        ev.type === "PASSENGER_ENTRY" ||
        ev.type === "PASSENGER_EXIT" ||
        ev.type === "DOOR_OPEN" ||
        ev.type === "DOOR_CLOSE"
      );
    }
    if (filter === "system") {
      return (
        ev.type === "SYSTEM_CONNECTED" ||
        ev.type === "SYSTEM_DISCONNECTED"
      );
    }
    return true;
  });

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case "PASSENGER_ENTRY":
        return <ArrowDownToLine className="h-3.5 w-3.5 text-entry-blue" />;
      case "PASSENGER_EXIT":
        return <ArrowUpFromLine className="h-3.5 w-3.5 text-exit-violet" />;
      case "DOOR_OPEN":
        return <DoorOpen className="h-3.5 w-3.5 text-safe" />;
      case "DOOR_CLOSE":
        return <DoorClosed className="h-3.5 w-3.5 text-slate-300" />;
      case "OBSTACLE_DETECTED":
        return <AlertTriangle className="h-3.5 w-3.5 text-danger" />;
      case "DOOR_REOPENED":
        return <RotateCcw className="h-3.5 w-3.5 text-primary-light" />;
      case "SYSTEM_CONNECTED":
        return <Wifi className="h-3.5 w-3.5 text-safe" />;
      case "SYSTEM_DISCONNECTED":
        return <WifiOff className="h-3.5 w-3.5 text-danger" />;
      default:
        return <CheckCircle2 className="h-3.5 w-3.5 text-muted" />;
    }
  };

  const getBadgeStyle = (severity: LogEvent["severity"]) => {
    switch (severity) {
      case "critical":
        return "border-danger/50 bg-danger/15 text-danger";
      case "warning":
        return "border-amber-400/40 bg-amber-400/10 text-amber-400";
      case "safe":
        return "border-safe/40 bg-safe/10 text-safe";
      case "info":
      default:
        return "border-primary/40 bg-primary/10 text-primary-light";
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel backdrop-blur-md flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-primary-light" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary-light font-bold">
              SECURITY & TELEMETRY LOG
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-100 mt-0.5">
            LIVE EVENT STREAM
          </h3>
          <p className="text-xs text-muted">
            Real-time event log for door safety interlocks, passenger flow & system state
          </p>
        </div>

        {/* Clear & count */}
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-border/60 bg-base-950/60 px-2 py-1 font-mono text-xs text-muted">
            {events.length} Events
          </span>
          <button
            onClick={onClearEvents}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 text-muted hover:border-slate-500 hover:text-slate-200 transition"
            title="Clear event history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-3 flex items-center gap-1.5 border-b border-border/60 pb-2 text-[11px] font-medium overflow-x-auto scrollbar-none">
        <Filter className="h-3 w-3 text-muted mr-1 shrink-0" />
        {(["all", "safety", "transit", "system"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={cn(
              "rounded-lg px-2.5 py-1 uppercase font-mono text-[10px] tracking-wider transition whitespace-nowrap",
              filter === mode
                ? "bg-primary/20 text-primary-light border border-primary/40 font-bold"
                : "text-muted hover:text-slate-300 hover:bg-base-950"
            )}
          >
            {mode === "all" ? "All Activity" : mode}
          </button>
        ))}
      </div>

      {/* Event Items List */}
      <div className="my-3 h-64 sm:h-72 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-border">
        {filteredEvents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-border/70 bg-base-950/40">
            <CheckCircle2 className="h-7 w-7 text-safe/50 mb-2" />
            <span className="font-mono text-xs font-bold text-slate-300">No Events in Active Buffer</span>
            <span className="text-[11px] text-muted max-w-xs mt-1">
              Awaiting safety interrupts or passenger ingress/egress triggers from the ESP32 node.
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredEvents.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="group rounded-xl border border-border/60 bg-base-950/60 p-2.5 hover:border-slate-700 transition flex items-start gap-2.5"
              >
                {/* Event Type Icon Bubble */}
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-base-900 shadow-sm">
                  {getEventIcon(ev.type)}
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-200 truncate">
                      {ev.title}
                    </span>
                    <span className="font-mono text-[10px] text-muted shrink-0 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {ev.timestamp}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-2">
                    {ev.description}
                  </p>

                  <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px]">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 font-semibold uppercase border",
                        getBadgeStyle(ev.severity)
                      )}
                    >
                      {ev.type.replace(/_/g, " ")}
                    </span>

                    {ev.metadata?.distanceCm !== undefined && (
                      <span className="text-slate-400">
                        dist: {ev.metadata.distanceCm.toFixed(1)} cm
                      </span>
                    )}

                    {ev.metadata?.passengerCount !== undefined && (
                      <span className="text-slate-400">
                        pax: {ev.metadata.passengerCount}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-border/70 pt-2.5 text-[10px] font-mono text-muted">
        <span>Log Buffer: In-Memory Ring (Latest 40)</span>
        <span className="text-safe flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-safe animate-ping" />
          Ingestion Ready
        </span>
      </div>
    </div>
  );
}

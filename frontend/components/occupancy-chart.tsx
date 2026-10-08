"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  TrendingUp,
  Users,
  Maximize2,
  Clock,
} from "lucide-react";
import { cn } from "../lib/utils";

interface OccupancyChartProps {
  data: Array<{
    time: string;
    passengers: number;
    capacity: number;
  }>;
  currentCount: number;
  maxCapacity: number;
  peakCount: number;
}

export function OccupancyChart({
  data,
  currentCount,
  maxCapacity,
  peakCount,
}: OccupancyChartProps) {
  const [viewMode, setViewMode] = useState<"live" | "hourly">("live");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 lg:p-6 shadow-panel backdrop-blur-md flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-light" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary-light font-bold">
              TRANSIT TELEMETRY STREAM
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-100 mt-0.5">
            PASSENGER OCCUPANCY TREND
          </h3>
          <p className="text-xs text-muted">
            Live onboard passenger load vs configured 40-seat max bus capacity
          </p>
        </div>

        {/* Chart Stats summary pills */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-border/70 bg-base-950/70 px-2.5 py-1 text-right font-mono">
            <div className="text-[9px] text-muted uppercase">Peak Load</div>
            <div className="text-xs font-bold text-slate-200">
              {peakCount} / {maxCapacity}
            </div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-right font-mono">
            <div className="text-[9px] text-primary-light uppercase">Now</div>
            <div className="text-xs font-bold text-primary-light">
              {currentCount} Pax
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Graphic */}
      <div className="my-4 h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="occupancyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2d9cff" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2d9cff" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1b2635"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              stroke="#64758a"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#1b2635" }}
            />

            <YAxis
              stroke="#64758a"
              fontSize={10}
              domain={[0, maxCapacity + 5]}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  return (
                    <div className="rounded-xl border border-border bg-base-900/95 p-2.5 shadow-2xl backdrop-blur-md font-mono text-xs">
                      <div className="text-[10px] text-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {label}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary-light" />
                        <span className="font-bold text-slate-100">
                          {val} Passengers
                        </span>
                        <span className="text-[10px] text-muted">
                          ({Math.round((val / maxCapacity) * 100)}% load)
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Capacity Limit Guideline */}
            <ReferenceLine
              y={maxCapacity}
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
              fill="url(#occupancyFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-[11px] font-mono text-muted">
        <div>
          <span className="text-muted block text-[10px]">Fleet Unit</span>
          <span className="text-slate-300 font-semibold">BUS #04 (Downtown)</span>
        </div>
        <div>
          <span className="text-muted block text-[10px]">Safety Margins</span>
          <span className="text-safe font-semibold">
            {maxCapacity - currentCount} Seats Available
          </span>
        </div>
        <div className="text-right">
          <span className="text-muted block text-[10px]">Sample Window</span>
          <span className="text-primary-light font-semibold">Real-Time Ticks</span>
        </div>
      </div>
    </div>
  );
}

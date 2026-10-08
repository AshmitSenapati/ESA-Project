"use client";

import {
  Activity,
  BarChart3,
  ShieldAlert,
  Cpu,
  Network,
  Settings,
  ShieldCheck,
  ChevronRight,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/utils";
import { NavigationTab } from "../lib/types";

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  eventCount: number;
  obstacleCount: number;
}

interface NavItemDef {
  id: NavigationTab;
  label: string;
  icon: typeof Activity;
  badge?: string | number;
  badgeColor?: "primary" | "danger" | "safe";
}

export function Sidebar({
  activeTab,
  onTabChange,
  eventCount,
  obstacleCount,
}: SidebarProps) {
  const navItems: NavItemDef[] = [
    {
      id: "live-monitor",
      label: "Live Monitor",
      icon: Activity,
    },
    {
      id: "passenger-analytics",
      label: "Passenger Analytics",
      icon: BarChart3,
    },
    {
      id: "safety-events",
      label: "Safety Events",
      icon: ShieldAlert,
      badge: obstacleCount > 0 ? obstacleCount : undefined,
      badgeColor: "danger",
    },
    {
      id: "hardware",
      label: "Hardware",
      icon: Cpu,
    },
    {
      id: "hardware-test",
      label: "Hardware Test",
      icon: Wrench,
    },
    {
      id: "system-architecture",
      label: "System Architecture",
      icon: Network,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 lg:min-h-[calc(100vh-4rem)] border-b lg:border-b-0 lg:border-r border-border/80 bg-base-950/70 p-3 lg:p-4 backdrop-blur-sm">
      <div className="flex lg:flex-col justify-between h-full gap-4">
        {/* Navigation list */}
        <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 scrollbar-none w-full">
          <div className="hidden lg:block px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted">
            Operations Console
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "group relative flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition whitespace-nowrap",
                  isActive
                    ? "bg-primary/15 text-primary-light border border-primary/30 shadow-[0_0_20px_rgba(45,156,255,0.15)]"
                    : "text-slate-400 hover:bg-base-900/80 hover:text-slate-200 border border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition",
                      isActive
                        ? "text-primary-light"
                        : "text-muted group-hover:text-slate-300"
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5">
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold leading-none",
                        item.badgeColor === "danger"
                          ? "bg-danger/20 text-danger border border-danger/40 animate-pulse"
                          : "bg-primary/20 text-primary-light"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="hidden lg:inline-block h-1.5 w-1.5 rounded-full bg-primary-light" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Fleet Node Metadata Card */}
        <div className="hidden lg:block rounded-xl border border-border/80 bg-base-900/60 p-3.5 text-[11px] text-muted">
          <div className="flex items-center justify-between text-slate-300 font-mono text-xs mb-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-safe" />
              Node Spec
            </span>
            <span className="text-[10px] text-primary-light bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              ESP32-WROOM
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between">
              <span>Firmware</span>
              <span className="text-slate-300">v2.4.1 IoT</span>
            </div>
            <div className="flex justify-between">
              <span>Safety Rule</span>
              <span className="text-amber-400">&lt; 5.0 cm Trigger</span>
            </div>
            <div className="flex justify-between">
              <span>IR Breakbeam</span>
              <span className="text-slate-300">Dual Seq (Entry/Exit)</span>
            </div>
            <div className="flex justify-between">
              <span>Door Servo</span>
              <span className="text-slate-300">SG90 (0° - 90°)</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

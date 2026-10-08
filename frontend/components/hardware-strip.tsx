"use client";

import {
  Cpu,
  Radio,
  Eye,
  Sliders,
  Volume2,
  Lightbulb,
  Tv,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
} from "lucide-react";
import { cn } from "../lib/utils";
import { BusTelemetry, HardwareStatus } from "../lib/types";

interface HardwareStripProps {
  telemetry: BusTelemetry;
}

interface ComponentSpec {
  id: string;
  name: string;
  role: string;
  pin: string;
  getStatus: (t: BusTelemetry) => HardwareStatus;
  getReadout: (t: BusTelemetry) => string;
  icon: typeof Cpu;
}

export function HardwareStrip({ telemetry }: HardwareStripProps) {
  const specs: ComponentSpec[] = [
    {
      id: "esp32",
      name: "ESP32",
      role: "Microcontroller Node",
      pin: "SoC 240MHz",
      getStatus: (t) => (t.esp32Connected ? "ONLINE" : "OFFLINE"),
      getReadout: (t) => (t.esp32Connected ? "Wi-Fi Telemetry Link" : "Standby Mode"),
      icon: Cpu,
    },
    {
      id: "hcsr04",
      name: "HC-SR04",
      role: "Ultrasonic Sonar",
      pin: "TRIG 5 / ECHO 18",
      getStatus: (t) => {
        if (!t.esp32Connected) return "OFFLINE";
        return t.distanceCm < t.obstacleThresholdCm ? "WARNING" : "ONLINE";
      },
      getReadout: (t) =>
        t.distanceCm >= 900
          ? "No Echo"
          : `${t.distanceCm.toFixed(1)} cm (${t.distanceCm < 5 ? "OBSTACLE" : "CLEAR"})`,
      icon: Activity,
    },
    {
      id: "ir1",
      name: "IR SENSOR 1",
      role: "Entry Gate Breakbeam",
      pin: "GPIO 27",
      getStatus: (t) => {
        if (!t.esp32Connected) return "OFFLINE";
        return t.ir1Active ? "WARNING" : "ONLINE";
      },
      getReadout: (t) => (t.ir1Active ? "Beam Broken (Active)" : "Beam Clear (Idle)"),
      icon: Eye,
    },
    {
      id: "ir2",
      name: "IR SENSOR 2",
      role: "Exit Gate Breakbeam",
      pin: "GPIO 26",
      getStatus: (t) => {
        if (!t.esp32Connected) return "OFFLINE";
        return t.ir2Active ? "WARNING" : "ONLINE";
      },
      getReadout: (t) => (t.ir2Active ? "Beam Broken (Active)" : "Beam Clear (Idle)"),
      icon: Eye,
    },
    {
      id: "sg90",
      name: "SG90 SERVO",
      role: "Door Mechanism",
      pin: "GPIO 19 (PWM)",
      getStatus: (t) => {
        if (!t.esp32Connected) return "OFFLINE";
        return t.doorState === "BLOCKED" ? "WARNING" : "ONLINE";
      },
      getReadout: (t) => `${t.servoAngle}° Angle (${t.doorState})`,
      icon: Sliders,
    },
    {
      id: "buzzer",
      name: "BUZZER",
      role: "Piezo Audio Alarm",
      pin: "GPIO 23",
      getStatus: (t) => {
        if (!t.esp32Connected) return "OFFLINE";
        return t.buzzerActive ? "WARNING" : "ONLINE";
      },
      getReadout: (t) => (t.buzzerActive ? "ALERT SOUNDING (2.4kHz)" : "Silent (Armed)"),
      icon: Volume2,
    },
    {
      id: "led",
      name: "RED LED",
      role: "Safety Warning Strobe",
      pin: "GPIO 2 (220Ω)",
      getStatus: (t) => {
        if (!t.esp32Connected) return "OFFLINE";
        return t.ledActive ? "WARNING" : "ONLINE";
      },
      getReadout: (t) => (t.ledActive ? "FLASHING RED" : "Standby (Off)"),
      icon: Lightbulb,
    },
    {
      id: "lcd",
      name: "LCD (16×2)",
      role: "Passenger Display",
      pin: "SDA 21 / SCL 22 (0x27)",
      getStatus: (t) => (t.esp32Connected ? "ONLINE" : "OFFLINE"),
      getReadout: (t) =>
        t.esp32Connected
          ? t.distanceCm < t.obstacleThresholdCm
            ? "!!! OBSTACLE !!!"
            : `PAX: ${t.passengerCount} | DOOR: ${t.doorState}`
          : "Display Offline",
      icon: Tv,
    },
  ];

  const getStatusBadge = (status: HardwareStatus) => {
    switch (status) {
      case "ONLINE":
        return {
          pill: "border-safe/30 bg-safe/10 text-safe",
          dot: "bg-safe",
          icon: CheckCircle2,
          label: "ONLINE",
        };
      case "WARNING":
        return {
          pill: "border-amber-400/40 bg-amber-400/10 text-amber-400 animate-pulse",
          dot: "bg-amber-400",
          icon: AlertTriangle,
          label: "WARNING",
        };
      case "OFFLINE":
      default:
        return {
          pill: "border-slate-700 bg-slate-800/60 text-slate-400",
          dot: "bg-slate-600",
          icon: XCircle,
          label: "OFFLINE",
        };
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/90 bg-gradient-to-br from-base-900/95 via-base-900/80 to-base-950 p-5 shadow-panel backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary-light" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            HARDWARE COMPONENT BUS // 8 MODULES INTEGRATED
          </h3>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-safe" />
            Online (Nominal)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Warning (Triggered/Active)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            Offline
          </span>
        </div>
      </div>

      {/* Grid of 8 Hardware Component Cards */}
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {specs.map((item) => {
          const status = item.getStatus(telemetry);
          const badge = getStatusBadge(status);
          const Icon = item.icon;
          const readout = item.getReadout(telemetry);

          return (
            <div
              key={item.id}
              className={cn(
                "group relative rounded-xl border p-2.5 transition-all duration-200 flex flex-col justify-between bg-base-950/70 hover:border-slate-600",
                status === "WARNING"
                  ? "border-amber-400/40 bg-amber-400/5 shadow-[0_0_12px_rgba(255,197,92,0.1)]"
                  : status === "ONLINE"
                  ? "border-border/80 hover:bg-base-900/80"
                  : "border-slate-800 opacity-70"
              )}
            >
              {/* Top: Icon + Status */}
              <div className="flex items-start justify-between gap-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-base-900 text-slate-300 group-hover:text-primary-light transition">
                  <Icon className="h-3 w-3" />
                </div>

                <div
                  className={cn(
                    "flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wider border",
                    badge.pill
                  )}
                  title={`${item.name} is ${badge.label}`}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} />
                  <span>{badge.label}</span>
                </div>
              </div>

              {/* Middle: Title & Pin */}
              <div className="mt-2 min-w-0">
                <div className="font-mono text-xs font-bold text-slate-100 truncate">
                  {item.name}
                </div>
                <div className="text-[9px] text-muted truncate">{item.role}</div>
                <div className="mt-1 font-mono text-[9px] text-primary-light truncate">
                  {item.pin}
                </div>
              </div>

              {/* Bottom: Realtime Readout */}
              <div className="mt-2 border-t border-border/50 pt-1.5 font-mono text-[9px] text-slate-300 truncate">
                {readout}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * SMARTBUS Deterministic Demo Simulator Hook
 * Executes the 21-step hardware twin sequence with configurable timing,
 * step-by-step progress tracking, pause/resume, and real-hardware lockout safety.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_STEPS, DEMO_TIMING_CONFIG, DemoStep } from "./demo-sequence";
import { BusTelemetry, EventType, LogEvent } from "./types";

export type DemoStatus = "IDLE" | "RUNNING" | "STOPPED" | "COMPLETED";

interface UseDemoSimulatorProps {
  telemetry: BusTelemetry;
  setTelemetry: React.Dispatch<React.SetStateAction<BusTelemetry>>;
  addEvent: (
    type: EventType,
    title: string,
    description: string,
    severity: LogEvent["severity"],
    metadata?: LogEvent["metadata"]
  ) => void;
  onOccupancyChange?: (passengers: number) => void;
}

export function useDemoSimulator({
  telemetry,
  setTelemetry,
  addEvent,
  onOccupancyChange,
}: UseDemoSimulatorProps) {
  const [demoStatus, setDemoStatus] = useState<DemoStatus>("IDLE");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(
    DEMO_TIMING_CONFIG.speedMultiplier
  );

  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const speedRef = useRef<number>(speedMultiplier);
  speedRef.current = speedMultiplier;

  // Real ESP32 hardware safeguard: Never allow demo mode when real telemetry is connected
  const isHardwareLocked = telemetry.esp32Connected && !telemetry.isDemoMode;

  const clearTimer = useCallback(() => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  }, []);

  // Stop demo immediately if real hardware connects
  useEffect(() => {
    if (isHardwareLocked && isRunningRef.current) {
      clearTimer();
      isRunningRef.current = false;
      setDemoStatus("IDLE");
      setCurrentStepIndex(0);
      console.warn("[DEMO-SIMULATOR] Real ESP32 connected! Aborting demo simulation.");
    }
  }, [isHardwareLocked, clearTimer]);

  // Execute a single step and schedule the next
  const runStep = useCallback(
    (index: number) => {
      if (!isRunningRef.current) return;
      if (index >= DEMO_STEPS.length) {
        setDemoStatus("COMPLETED");
        isRunningRef.current = false;
        return;
      }

      const step = DEMO_STEPS[index];
      setCurrentStepIndex(index);

      // 1. Apply updated telemetry state
      setTelemetry((prev) => {
        const patch = step.applyState(prev);
        const nextState = {
          ...prev,
          ...patch,
          isDemoMode: true,
          dataSource: "DEMO" as const,
          timestamp: Date.now(),
        };

        if (
          patch.passengerCount !== undefined &&
          patch.passengerCount !== prev.passengerCount &&
          onOccupancyChange
        ) {
          onOccupancyChange(patch.passengerCount);
        }

        return nextState;
      });

      // 2. Dispatch event log if defined for this step
      if (step.event) {
        addEvent(
          step.event.type,
          step.event.title,
          step.event.description,
          step.event.severity,
          step.event.metadata
        );
      }

      // 3. Compute duration for this step using centralized timing configuration
      const baseDuration =
        DEMO_TIMING_CONFIG.stepDurationsMs[step.step] || 1200;
      const duration = Math.max(300, Math.round(baseDuration / speedRef.current));

      // 4. Schedule next step
      clearTimer();
      stepTimerRef.current = setTimeout(() => {
        if (isRunningRef.current) {
          runStep(index + 1);
        }
      }, duration);
    },
    [setTelemetry, addEvent, onOccupancyChange, clearTimer]
  );

  // START DEMO: Starts from beginning or resumes from paused step
  const startDemo = useCallback(() => {
    if (isHardwareLocked) {
      console.warn("[DEMO-SIMULATOR] Cannot start demo: Real ESP32 is connected.");
      return;
    }

    isRunningRef.current = true;
    setDemoStatus("RUNNING");

    // If currently at the end or idle, start from Step 1 (index 0)
    const startIndex =
      demoStatus === "COMPLETED" || currentStepIndex >= DEMO_STEPS.length - 1
        ? 0
        : currentStepIndex;

    runStep(startIndex);
  }, [isHardwareLocked, demoStatus, currentStepIndex, runStep]);

  // STOP DEMO: Pauses current sequence execution
  const stopDemo = useCallback(() => {
    isRunningRef.current = false;
    clearTimer();
    setDemoStatus("STOPPED");
  }, [clearTimer]);

  // RESET DEMO: Halts and restores step 1 initial baseline
  const resetDemo = useCallback(() => {
    isRunningRef.current = false;
    clearTimer();
    setDemoStatus("IDLE");
    setCurrentStepIndex(0);

    // Apply baseline step 1 state
    const initialStep = DEMO_STEPS[0];
    setTelemetry((prev) => ({
      ...prev,
      ...initialStep.applyState(prev),
      isDemoMode: true,
      dataSource: "DEMO",
      timestamp: Date.now(),
    }));

    if (onOccupancyChange) {
      onOccupancyChange(0);
    }
  }, [clearTimer, setTelemetry, onOccupancyChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const currentStepDef: DemoStep =
    DEMO_STEPS[currentStepIndex] || DEMO_STEPS[0];

  return {
    demoStatus,
    currentStepIndex,
    currentStepNumber: currentStepDef.step,
    currentStepDef,
    totalSteps: DEMO_STEPS.length,
    speedMultiplier,
    setSpeedMultiplier,
    startDemo,
    stopDemo,
    resetDemo,
    isHardwareLocked,
  };
}

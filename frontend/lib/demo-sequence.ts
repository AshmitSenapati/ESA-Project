/**
 * SMARTBUS Deterministic 21-Step Demonstration Sequence & Timing Configuration
 *
 * Sequence:
 * 1.  System connected
 * 2.  Door opens
 * 3.  Passenger enters
 * 4.  IR1 triggers
 * 5.  IR2 triggers
 * 6.  Passenger count increases
 * 7.  Door closes
 * 8.  HC-SR04 detects clear distance
 * 9.  Door remains closed
 * 10. New passenger approaches
 * 11. HC-SR04 detects distance below 5 cm
 * 12. OBSTACLE_DETECTED event
 * 13. Door becomes REOPENING
 * 14. Buzzer becomes ACTIVE
 * 15. Red LED becomes ACTIVE
 * 16. Door returns to OPEN
 * 17. Alert resolves
 * 18. Passenger exits
 * 19. IR2 triggers
 * 20. IR1 triggers
 * 21. Passenger count decreases
 */

import { BusTelemetry, EventType, LogEvent } from "./types";

// ── Timing Configuration (Centralized in One Place) ──────────────────────────
export const DEMO_TIMING_CONFIG = {
  /** Global speed multiplier: 1.0 = normal, 1.5 = 1.5x, 2.0 = 2x, 0.5 = slow-motion */
  speedMultiplier: 1.0,

  /** Base duration in milliseconds per step (Configured in one place) */
  stepDurationsMs: {
    1: 1500, // 1. System connected
    2: 1300, // 2. Door opens
    3: 1000, // 3. Passenger enters (approach)
    4: 850,  // 4. IR1 triggers
    5: 850,  // 5. IR2 triggers
    6: 1200, // 6. Passenger count increases (+1)
    7: 1400, // 7. Door closes
    8: 1000, // 8. HC-SR04 detects clear distance
    9: 1100, // 9. Door remains closed
    10: 1000,// 10. New passenger approaches
    11: 1000,// 11. HC-SR04 detects distance below 5 cm (<5cm)
    12: 1200,// 12. OBSTACLE_DETECTED event
    13: 1200,// 13. Door becomes REOPENING
    14: 900, // 14. Buzzer becomes ACTIVE
    15: 900, // 15. Red LED becomes ACTIVE
    16: 1300,// 16. Door returns to OPEN
    17: 1200,// 17. Alert resolves
    18: 1000,// 18. Passenger exits (approach)
    19: 850, // 19. IR2 triggers
    20: 850, // 20. IR1 triggers
    21: 1400,// 21. Passenger count decreases (-1)
  } as Record<number, number>,
};

export interface DemoStep {
  step: number;
  name: string;
  description: string;
  applyState: (prev: BusTelemetry) => Partial<BusTelemetry>;
  event?: {
    type: EventType;
    title: string;
    description: string;
    severity: LogEvent["severity"];
    metadata?: LogEvent["metadata"];
  };
}

// ── Authoritative 21-Step Sequence Definitions ──────────────────────────────
export const DEMO_STEPS: DemoStep[] = [
  // Step 1: System connected
  {
    step: 1,
    name: "System Connected",
    description: "ESP32 node linked, doorway safety subsystem armed & initialized",
    applyState: () => ({
      doorState: "CLOSED",
      servoAngle: 0,
      distanceCm: 105.0,
      ir1Active: false,
      ir2Active: false,
      buzzerActive: false,
      ledActive: false,
      passengerCount: 0,
      entryCount: 0,
      exitCount: 0,
      isDemoMode: true,
      dataSource: "DEMO",
    }),
    event: {
      type: "SYSTEM_CONNECTED",
      title: "ESP32 Node Online",
      description: "SmartBus hardware subsystem online • Digital twin initialized",
      severity: "safe",
    },
  },

  // Step 2: Door opens
  {
    step: 2,
    name: "Door Opens",
    description: "SG90 servo commanded to 90° • Entrance passageway clear for boarding",
    applyState: () => ({
      doorState: "OPEN",
      servoAngle: 90,
      distanceCm: 105.0,
    }),
    event: {
      type: "DOOR_OPENED",
      title: "Door Aperture Opened",
      description: "SG90 servo rotated to 90° • Passageway clear for passenger ingress",
      severity: "info",
    },
  },

  // Step 3: Passenger enters
  {
    step: 3,
    name: "Passenger Enters",
    description: "Passenger approaching doorway portal for boarding",
    applyState: () => ({
      distanceCm: 65.0,
      ir1Active: false,
      ir2Active: false,
    }),
  },

  // Step 4: IR1 triggers
  {
    step: 4,
    name: "IR1 Triggers",
    description: "Exterior breakbeam IR1 broken (Passenger crossing outer perimeter)",
    applyState: () => ({
      ir1Active: true,
      ir2Active: false,
    }),
  },

  // Step 5: IR2 triggers
  {
    step: 5,
    name: "IR2 Triggers",
    description: "Interior breakbeam IR2 broken • IR1 clears (Passenger entering interior)",
    applyState: () => ({
      ir1Active: false,
      ir2Active: true,
    }),
  },

  // Step 6: Passenger count increases
  {
    step: 6,
    name: "Passenger Count Increases",
    description: "Sequential breakbeam sequence IR1 → IR2 verified (+1 Passenger onboard)",
    applyState: (prev) => ({
      ir1Active: false,
      ir2Active: false,
      passengerCount: prev.passengerCount + 1,
      entryCount: prev.entryCount + 1,
    }),
    event: {
      type: "PASSENGER_ENTRY",
      title: "Passenger Entry (+1)",
      description: "Sequential breakbeam IR1 → IR2 confirmed • Total onboard: 1",
      severity: "safe",
      metadata: { passengerCount: 1 },
    },
  },

  // Step 7: Door closes
  {
    step: 7,
    name: "Door Closes",
    description: "Boarding completed • SG90 servo rotating to 0° • Entrance locked",
    applyState: () => ({
      doorState: "CLOSED",
      servoAngle: 0,
    }),
    event: {
      type: "DOOR_CLOSED",
      title: "Door Closed & Latched",
      description: "SG90 servo latched at 0° • Ultrasonic doorway barrier armed",
      severity: "info",
    },
  },

  // Step 8: HC-SR04 detects clear distance
  {
    step: 8,
    name: "HC-SR04 Detects Clear Distance",
    description: "Ultrasonic echo verifies doorway clear (118.0 cm > 5 cm safety threshold)",
    applyState: () => ({
      distanceCm: 118.0,
      doorState: "CLOSED",
      servoAngle: 0,
    }),
  },

  // Step 9: Door remains closed
  {
    step: 9,
    name: "Door Remains Closed",
    description: "Bus in nominal transit condition • Door secured & latched",
    applyState: () => ({
      doorState: "CLOSED",
      servoAngle: 0,
      distanceCm: 118.0,
      buzzerActive: false,
      ledActive: false,
    }),
  },

  // Step 10: New passenger approaches
  {
    step: 10,
    name: "New Passenger Approaches",
    description: "Passenger moves close to closed doorway • Distance drops to 8.2 cm",
    applyState: () => ({
      distanceCm: 8.2,
      doorState: "CLOSING",
      servoAngle: 35,
    }),
  },

  // Step 11: HC-SR04 detects distance below 5 cm
  {
    step: 11,
    name: "HC-SR04 Detects Distance < 5 cm",
    description: "HC-SR04 measures 3.4 cm — breach of the 5.0 cm safety perimeter!",
    applyState: () => ({
      distanceCm: 3.4,
      doorState: "BLOCKED",
      servoAngle: 25,
    }),
  },

  // Step 12: OBSTACLE_DETECTED event
  {
    step: 12,
    name: "OBSTACLE_DETECTED Event",
    description: "Safety interlock trip: Obstacle detected at 3.4 cm while door in transit",
    applyState: () => ({
      distanceCm: 3.4,
      doorState: "BLOCKED",
      servoAngle: 25,
    }),
    event: {
      type: "OBSTACLE_DETECTED",
      title: "Obstacle Collision Warning",
      description: "Obstacle detected at 3.4 cm (< 5 cm threshold) • Closing halted",
      severity: "critical",
      metadata: { distanceCm: 3.4, doorState: "BLOCKED" },
    },
  },

  // Step 13: Door becomes REOPENING
  {
    step: 13,
    name: "Door Becomes REOPENING",
    description: "Automatic safety reversal initiated: SG90 reversing to prevent pinch injury",
    applyState: () => ({
      doorState: "REOPENING",
      servoAngle: 65,
    }),
    event: {
      type: "DOOR_REOPENED",
      title: "Safety Reversal Interlock",
      description: "Anti-pinch safety interlock triggered: Door reversing toward open",
      severity: "warning",
    },
  },

  // Step 14: Buzzer becomes ACTIVE
  {
    step: 14,
    name: "Buzzer Becomes ACTIVE",
    description: "Active Piezo Buzzer on GPIO 23 pulsing 2.4 kHz audible hazard tone",
    applyState: () => ({
      buzzerActive: true,
      doorState: "REOPENING",
      servoAngle: 75,
    }),
  },

  // Step 15: Red LED becomes ACTIVE
  {
    step: 15,
    name: "Red LED Becomes ACTIVE",
    description: "High-intensity Red Warning LED on GPIO 2 strobe flashing",
    applyState: () => ({
      buzzerActive: true,
      ledActive: true,
      doorState: "REOPENING",
      servoAngle: 85,
    }),
  },

  // Step 16: Door returns to OPEN
  {
    step: 16,
    name: "Door Returns to OPEN",
    description: "SG90 servo fully rotated to 90° • Doorway fully reopened for safety",
    applyState: () => ({
      doorState: "OPEN",
      servoAngle: 90,
      buzzerActive: true,
      ledActive: true,
    }),
  },

  // Step 17: Alert resolves
  {
    step: 17,
    name: "Alert Resolves",
    description: "Obstacle cleared • Distance restored to 88.0 cm • Buzzer & LED deactivated",
    applyState: () => ({
      distanceCm: 88.0,
      buzzerActive: false,
      ledActive: false,
      doorState: "OPEN",
      servoAngle: 90,
    }),
  },

  // Step 18: Passenger exits
  {
    step: 18,
    name: "Passenger Exits",
    description: "Passenger initiates alighting movement from bus interior",
    applyState: () => ({
      distanceCm: 55.0,
      ir1Active: false,
      ir2Active: false,
    }),
  },

  // Step 19: IR2 triggers
  {
    step: 19,
    name: "IR2 Triggers",
    description: "Interior breakbeam IR2 broken (Passenger entering doorway from inside)",
    applyState: () => ({
      ir2Active: true,
      ir1Active: false,
    }),
  },

  // Step 20: IR1 triggers
  {
    step: 20,
    name: "IR1 Triggers",
    description: "Exterior breakbeam IR1 broken • IR2 clears (Passenger crossing outside)",
    applyState: () => ({
      ir2Active: false,
      ir1Active: true,
    }),
  },

  // Step 21: Passenger count decreases
  {
    step: 21,
    name: "Passenger Count Decreases",
    description: "Sequential breakbeam IR2 → IR1 verified (-1 Passenger • Onboard: 0)",
    applyState: (prev) => ({
      ir1Active: false,
      ir2Active: false,
      passengerCount: Math.max(0, prev.passengerCount - 1),
      exitCount: prev.exitCount + 1,
      doorState: "OPEN",
      servoAngle: 90,
      distanceCm: 95.0,
    }),
    event: {
      type: "PASSENGER_EXIT",
      title: "Passenger Exit (-1)",
      description: "Sequential breakbeam IR2 → IR1 confirmed • Total onboard: 0",
      severity: "safe",
      metadata: { passengerCount: 0 },
    },
  },
];

/*
  ══════════════════════════════════════════════════════════════════════════════
  SMARTBUS — Smart Bus Door Safety & Passenger Monitoring System
  Authoritative ESP32 Firmware Implementation (USB Serial Architecture)
  ══════════════════════════════════════════════════════════════════════════════

  Hardware Pinout:
    IR Sensor 1 (Exterior Entry) : GPIO 27 (Active LOW on breakbeam interrupt)
    IR Sensor 2 (Interior Exit)  : GPIO 26 (Active LOW on breakbeam interrupt)
    HC-SR04 TRIG                 : GPIO 5
    HC-SR04 ECHO                 : GPIO 18 (★ REQUIREMENT: 5V → 3.3V Voltage Divider)
    SG90 Door Servo (PWM)        : GPIO 19 (★ REQUIREMENT: Dedicated 5V Power Supply)
    Piezo Active Buzzer          : GPIO 23
    Red Safety Warning LED       : GPIO 2  (With 220Ω series current-limiting resistor)
    16×2 LCD with I2C Backpack   : SDA → GPIO 21, SCL → GPIO 22

  Communication Layer:
    Transport : USB Serial (115200 baud, 8N1)
    Format    : Newline-delimited JSON (\n terminated)
    Schema    : docs/TELEMETRY_PROTOCOL.md

  SAFETY & ARCHITECTURAL DIRECTIVES:
    1. The physical safety interlock logic runs 100% locally on the ESP32 CPU.
    2. Obstacle detection and door reversal remain fully functional even if
       the USB cable is disconnected or the host PC crashes.
    3. The loop is strictly non-blocking: NO long delay() calls in loop().
    4. All timings use millis() state trackers and non-blocking scheduling.
    5. The web dashboard is a monitoring/command interface, NEVER the safety-critical controller.
*/

#include <ArduinoJson.h>        // ArduinoJson by Benoit Blanchon (v6 or v7)
#include <ESP32Servo.h>         // ESP32Servo by Kevin Harrington
#include <Wire.h>
#include <LiquidCrystal_I2C.h>  // LiquidCrystal I2C by Frank de Brabander

// ── External Configuration (Baud Rate, Device ID, LCD Address) ────────────────
#include "config.h"

// ── Pin Allocations ───────────────────────────────────────────────────────────
const int PIN_IR1       = 27;
const int PIN_IR2       = 26;
const int PIN_TRIG      = 5;
const int PIN_ECHO      = 18;
const int PIN_SERVO     = 19;
const int PIN_BUZZER    = 23;
const int PIN_LED       = 2;

// ── Operational Constants & Runtime Config ─────────────────────────────────────
float obstacleSafetyThresholdCm = 5.0f; // Configurable runtime safety threshold (default 5.0 cm)
const unsigned long IR_SEQUENCE_TIMEOUT_MS = 1000; // Max time to complete 2-sensor sequence
const unsigned long TELEMETRY_SEND_INTERVAL_MS = TELEMETRY_INTERVAL_MS; // Publish status every 500 ms
const unsigned long SONAR_SAMPLE_INTERVAL_MS = 50;    // Ping sonar every 50 ms
const unsigned long LCD_REFRESH_INTERVAL_MS = 250;    // Refresh LCD 4x / sec

// ── Global Hardware Instances ─────────────────────────────────────────────────
Servo doorServo;
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);

// Differential LCD buffer cache to eliminate unnecessary repeated I2C writes & screen flicker
char cachedLcdLine0[LCD_COLS + 1] = "";
char cachedLcdLine1[LCD_COLS + 1] = "";

// ── Embedded Runtime Telemetry State ──────────────────────────────────────────
int passengerCount = 0;
bool ir1Active = false;
bool ir2Active = false;
int firstSensorTriggered = 0; // 0 = Idle, 1 = IR1 first, 2 = IR2 first
unsigned long sequenceStartMs = 0;

float currentDistanceCm = 100.0f;
bool obstacleActive = false;
int servoAngle = 90; // Default: 90° = OPEN
const char* currentDoorState = "OPEN"; // "OPEN", "CLOSED", "CLOSING", "REOPENING", "BLOCKED"

// Timing State Trackers
unsigned long lastTelemetryMs = 0;
unsigned long lastSonarMs = 0;
unsigned long lastLcdMs = 0;

// Diagnostic Test Timers
unsigned long buzzerTestUntilMs = 0;
unsigned long ledTestUntilMs = 0;

// Non-blocking Serial RX Buffer
char serialRxBuffer[384];
size_t serialRxIndex = 0;

// ── Forward Declarations ──────────────────────────────────────────────────────
void sendTelemetryStatus();
void sendEvent(const char* eventType, const char* message, float dist = -1.0f, int count = -1);
void sendCommandAck(const char* cmd, bool success, const char* reason = nullptr);
float sampleHCSR04();
void updateDoorSafetyInterlock(float dist);
void handleBreakbeamCounting();
void refreshLcdDisplay();
void handleSerialInput();
void processCommandJson(const char* jsonStr);

// ══════════════════════════════════════════════════════════════════════════════
// Non-Blocking Ultrasonic Sonar Sampling (HC-SR04)
// ══════════════════════════════════════════════════════════════════════════════
float sampleHCSR04() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // Measure pulse duration with 25000 µs timeout (~4.2 meters maximum)
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, 25000UL);
  if (duration == 0) {
    return 999.0f; // Clear / out of range
  }

  // Speed of sound = 343 m/s = 0.0343 cm/µs. Divide by 2 for round-trip distance.
  float dist = (duration * 0.0343f) / 2.0f;
  return dist;
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCAL PHYSICAL DOOR SAFETY INTERLOCK (Safety-Critical Controller)
// ══════════════════════════════════════════════════════════════════════════════
void updateDoorSafetyInterlock(float dist) {
  currentDistanceCm = dist;

  // Obstacle detected below safety threshold
  if (dist < obstacleSafetyThresholdCm) {
    if (!obstacleActive) {
      obstacleActive = true;
      currentDoorState = "BLOCKED";
      servoAngle = 35;
      doorServo.write(servoAngle);

      // Instantly trigger local audio/visual alerts
      digitalWrite(PIN_BUZZER, HIGH);
      digitalWrite(PIN_LED, HIGH);

      char alertMsg[96];
      snprintf(alertMsg, sizeof(alertMsg), "Obstacle detected at %.1f cm (< %.1f cm threshold)! Closing halted.",
               dist, obstacleSafetyThresholdCm);

      // Dispatch authoritative event immediately
      sendEvent("OBSTACLE_DETECTED", alertMsg, dist, passengerCount);

      // Trigger automatic anti-pinch door reopening
      currentDoorState = "REOPENING";
      servoAngle = 90;
      doorServo.write(servoAngle);

      sendEvent("DOOR_REOPENED", "Safety interlock triggered: Door aperture reopening.", dist, passengerCount);

      // Instantly update physical LCD display to hazard screen
      refreshLcdDisplay();
    }
  } else {
    // Distance clear
    if (obstacleActive) {
      obstacleActive = false;

      // Silence alarms
      digitalWrite(PIN_BUZZER, LOW);
      digitalWrite(PIN_LED, LOW);

      // Return door to fully open clear position
      currentDoorState = "OPEN";
      servoAngle = 90;
      doorServo.write(servoAngle);

      sendEvent("DOOR_OPENED", "Obstacle cleared: Door fully reopened for passenger safety.", dist, passengerCount);

      // Instantly update physical LCD display to normal state
      refreshLcdDisplay();
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Directional Breakbeam Passenger Counting (IR1 & IR2)
// ══════════════════════════════════════════════════════════════════════════════
void handleBreakbeamCounting() {
  // Active-LOW logic: beam interrupted = LOW
  bool s1 = (digitalRead(PIN_IR1) == LOW);
  bool s2 = (digitalRead(PIN_IR2) == LOW);
  unsigned long now = millis();

  ir1Active = s1;
  ir2Active = s2;

  if (firstSensorTriggered == 0) {
    if (s1 && !s2) {
      firstSensorTriggered = 1;
      sequenceStartMs = now;
    } else if (s2 && !s1) {
      firstSensorTriggered = 2;
      sequenceStartMs = now;
    }
  } else {
    // Sequence timeout check
    if (now - sequenceStartMs > IR_SEQUENCE_TIMEOUT_MS) {
      firstSensorTriggered = 0;
    }
    // IR1 → IR2: Passenger Entry (+1)
    else if (firstSensorTriggered == 1 && s2) {
      passengerCount++;
      firstSensorTriggered = 0;
      sendEvent("PASSENGER_ENTRY", "Passenger boarding confirmed via breakbeam sequence IR1 -> IR2", currentDistanceCm, passengerCount);
      refreshLcdDisplay();
    }
    // IR2 → IR1: Passenger Exit (-1)
    else if (firstSensorTriggered == 2 && s1) {
      passengerCount = max(0, passengerCount - 1);
      firstSensorTriggered = 0;
      sendEvent("PASSENGER_EXIT", "Passenger alighting confirmed via breakbeam sequence IR2 -> IR1", currentDistanceCm, passengerCount);
      refreshLcdDisplay();
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Send Authoritative Status Telemetry Message (docs/TELEMETRY_PROTOCOL.md)
// ══════════════════════════════════════════════════════════════════════════════
void sendTelemetryStatus() {
  StaticJsonDocument<256> doc;
  doc["type"]           = "status";
  doc["timestamp"]      = millis();
  doc["deviceId"]       = DEVICE_ID;
  doc["passengerCount"] = passengerCount;
  doc["doorState"]      = currentDoorState;
  doc["distanceCm"]     = (int)(currentDistanceCm * 10.0f) / 10.0f;
  doc["ir1"]            = ir1Active;
  doc["ir2"]            = ir2Active;
  doc["servoAngle"]     = servoAngle;
  doc["buzzer"]         = obstacleActive || (buzzerTestUntilMs > 0);
  doc["led"]            = obstacleActive || (ledTestUntilMs > 0);

  serializeJson(doc, Serial);
  Serial.print('\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// Send Authoritative Event Message (docs/TELEMETRY_PROTOCOL.md)
// ══════════════════════════════════════════════════════════════════════════════
void sendEvent(const char* eventType, const char* message, float dist, int count) {
  StaticJsonDocument<320> doc;
  doc["type"]           = "event";
  doc["timestamp"]      = millis();
  doc["deviceId"]       = DEVICE_ID;
  doc["event"]          = eventType;
  doc["eventType"]      = eventType;
  doc["message"]        = message;
  doc["doorState"]      = currentDoorState;
  doc["buzzer"]         = obstacleActive || (buzzerTestUntilMs > 0);
  doc["led"]            = obstacleActive || (ledTestUntilMs > 0);

  if (dist >= 0.0f) {
    doc["distanceCm"] = (int)(dist * 10.0f) / 10.0f;
  } else {
    doc["distanceCm"] = (int)(currentDistanceCm * 10.0f) / 10.0f;
  }

  if (count >= 0) {
    doc["passengerCount"] = count;
  } else {
    doc["passengerCount"] = passengerCount;
  }

  serializeJson(doc, Serial);
  Serial.print('\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// Send Downlink Command Acknowledgement (docs/TELEMETRY_PROTOCOL.md)
// ══════════════════════════════════════════════════════════════════════════════
void sendCommandAck(const char* cmd, bool success, const char* reason) {
  StaticJsonDocument<256> doc;
  doc["type"]      = "command_ack";
  doc["timestamp"] = millis();
  doc["command"]   = cmd;
  doc["success"]   = success;
  if (reason) {
    doc["reason"]  = reason;
  }

  serializeJson(doc, Serial);
  Serial.print('\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// Non-Blocking Serial Command Reader & Parser
// ══════════════════════════════════════════════════════════════════════════════
void handleSerialInput() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialRxIndex > 0) {
        serialRxBuffer[serialRxIndex] = '\0';
        processCommandJson(serialRxBuffer);
        serialRxIndex = 0;
      }
    } else if (serialRxIndex < sizeof(serialRxBuffer) - 1) {
      serialRxBuffer[serialRxIndex++] = c;
    } else {
      // Line too long: safely flush buffer to prevent overflow
      serialRxIndex = 0;
    }
  }
}

void processCommandJson(const char* jsonStr) {
  StaticJsonDocument<384> doc;
  DeserializationError err = deserializeJson(doc, jsonStr);
  if (err) {
    // Malformed JSON received over serial; ignore or reject safely
    return;
  }

  const char* msgType = doc["type"];
  if (!msgType || strcmp(msgType, "command") != 0) {
    return;
  }

  const char* cmd = doc["command"];
  if (!cmd) {
    sendCommandAck("UNKNOWN", false, "Missing 'command' identifier");
    return;
  }

  // 1. OPEN_DOOR
  if (strcmp(cmd, "OPEN_DOOR") == 0) {
    currentDoorState = "OPEN";
    servoAngle = 90;
    doorServo.write(servoAngle);
    sendCommandAck("OPEN_DOOR", true, "Door aperture opened to 90°");
    sendEvent("DOOR_OPENED", "Door aperture opened by dashboard operator command");
    refreshLcdDisplay();
  }
  // 2. CLOSE_DOOR (SAFETY INTERLOCK PROTECTED)
  else if (strcmp(cmd, "CLOSE_DOOR") == 0) {
    // Safety Rule: Website commands must NEVER bypass obstacle safety logic.
    if (obstacleActive || currentDistanceCm < obstacleSafetyThresholdCm) {
      sendCommandAck("CLOSE_DOOR", false, "Obstacle detected in doorway (< safety threshold)");
      sendEvent("OBSTACLE_DETECTED", "Close command rejected: Doorway obstructed by object");
    } else {
      currentDoorState = "CLOSED";
      servoAngle = 0;
      doorServo.write(servoAngle);
      sendCommandAck("CLOSE_DOOR", true, "Door aperture secured at 0°");
      sendEvent("DOOR_CLOSED", "Door closed by dashboard operator command");
      refreshLcdDisplay();
    }
  }
  // 3. RESET_PASSENGER_COUNT (and RESET_COUNT alias)
  else if (strcmp(cmd, "RESET_PASSENGER_COUNT") == 0 || strcmp(cmd, "RESET_COUNT") == 0) {
    passengerCount = 0;
    sendCommandAck(cmd, true, "Passenger count reset to 0");
    sendEvent("PASSENGER_ENTRY", "Passenger counter reset to 0 by operator", -1.0f, 0);
    refreshLcdDisplay();
  }
  // 4. SET_SAFETY_THRESHOLD (with value parameter)
  else if (strcmp(cmd, "SET_SAFETY_THRESHOLD") == 0) {
    if (doc.containsKey("value") && doc["value"].is<float>()) {
      float newVal = doc["value"].as<float>();
      if (newVal >= 2.0f && newVal <= 50.0f) {
        obstacleSafetyThresholdCm = newVal;
        char ackMsg[64];
        snprintf(ackMsg, sizeof(ackMsg), "Safety threshold updated to %.1f cm", newVal);
        sendCommandAck("SET_SAFETY_THRESHOLD", true, ackMsg);
        refreshLcdDisplay();
      } else {
        sendCommandAck("SET_SAFETY_THRESHOLD", false, "Threshold out of range (allowed: 2.0 to 50.0 cm)");
      }
    } else {
      sendCommandAck("SET_SAFETY_THRESHOLD", false, "Missing or non-numeric 'value' parameter");
    }
  }
  // 5. TEST_BUZZER (Non-blocking acoustic test chirp)
  else if (strcmp(cmd, "TEST_BUZZER") == 0) {
    digitalWrite(PIN_BUZZER, HIGH);
    buzzerTestUntilMs = millis() + 300;
    sendCommandAck("TEST_BUZZER", true, "Acoustic buzzer test chirp activated (300ms)");
  }
  // 6. TEST_LED (Non-blocking visual test strobe)
  else if (strcmp(cmd, "TEST_LED") == 0) {
    digitalWrite(PIN_LED, HIGH);
    ledTestUntilMs = millis() + 600;
    sendCommandAck("TEST_LED", true, "Visual LED test strobe activated (600ms)");
  }
  // Unknown or unsupported command
  else {
    char errMsg[64];
    snprintf(errMsg, sizeof(errMsg), "Unknown or unsupported command: %s", cmd);
    sendCommandAck(cmd, false, errMsg);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Physical 16×2 LCD Display (I2C) — Non-Blocking & Flicker-Free
// ══════════════════════════════════════════════════════════════════════════════
void refreshLcdDisplay() {
  char nextLine0[LCD_COLS + 1];
  char nextLine1[LCD_COLS + 1];

  // 1. OBSTACLE SAFETY STATE (Safety-critical priority display)
  if (obstacleActive || strcmp(currentDoorState, "BLOCKED") == 0 || strcmp(currentDoorState, "REOPENING") == 0) {
    // 16 characters exactly: "!!! OBSTACLE !!!"
    snprintf(nextLine0, sizeof(nextLine0), "%-16.16s", "!!! OBSTACLE !!!");
    // 16 characters exactly: "REOPENING...    "
    snprintf(nextLine1, sizeof(nextLine1), "%-16.16s", "REOPENING...");
  }
  // 2. NORMAL / CLOSING / SECURED STATES
  else {
    // Row 0: Concise passenger tally ("PASSENGERS: 24  ")
    char paxBuf[32];
    snprintf(paxBuf, sizeof(paxBuf), "PASSENGERS: %d", passengerCount);
    snprintf(nextLine0, sizeof(nextLine0), "%-16.16s", paxBuf);

    // Row 1: Door status
    if (strcmp(currentDoorState, "OPEN") == 0) {
      snprintf(nextLine1, sizeof(nextLine1), "%-16.16s", "DOOR: OPEN");
    } else if (strcmp(currentDoorState, "CLOSING") == 0 || strcmp(currentDoorState, "CLOSED") == 0) {
      snprintf(nextLine1, sizeof(nextLine1), "%-16.16s", "DOOR: CLOSE");
    } else {
      char doorBuf[32];
      snprintf(doorBuf, sizeof(doorBuf), "DOOR: %s", currentDoorState);
      snprintf(nextLine1, sizeof(nextLine1), "%-16.16s", doorBuf);
    }
  }

  // Differential write: Only write Row 0 if content changed (prevents flicker & avoids I2C bus traffic)
  if (strcmp(nextLine0, cachedLcdLine0) != 0) {
    lcd.setCursor(0, 0);
    lcd.print(nextLine0);
    memcpy(cachedLcdLine0, nextLine0, sizeof(cachedLcdLine0));
  }

  // Differential write: Only write Row 1 if content changed
  if (strcmp(nextLine1, cachedLcdLine1) != 0) {
    lcd.setCursor(0, 1);
    lcd.print(nextLine1);
    memcpy(cachedLcdLine1, nextLine1, sizeof(cachedLcdLine1));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// setup() — Hardware Initialization
// ══════════════════════════════════════════════════════════════════════════════
void setup() {
  // Initialize USB Serial communication at 115200 baud
  Serial.begin(BAUD_RATE);

  // Configure GPIO directions
  pinMode(PIN_IR1, INPUT);
  pinMode(PIN_IR2, INPUT);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  // Initialize outputs to safe inactive states
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED, LOW);
  digitalWrite(PIN_TRIG, LOW);

  // Servo configuration (SG90)
  doorServo.attach(PIN_SERVO);
  servoAngle = 90;
  currentDoorState = "OPEN";
  doorServo.write(servoAngle); // Start in safe OPEN position for passengers

  // Initialize 16×2 LCD display
  Wire.begin();
  lcd.init();
  lcd.backlight();
  refreshLcdDisplay();

  // Transmit initial startup event and status over USB Serial
  sendEvent("SYSTEM_CONNECTED", "ESP32 hardware controller online via USB Serial");
  sendTelemetryStatus();
}

// ══════════════════════════════════════════════════════════════════════════════
// loop() — Real-Time Non-Blocking Executive Loop
// ══════════════════════════════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  // 1. Process incoming USB Serial command frames
  handleSerialInput();

  // 2. Sample HC-SR04 ultrasonic distance sensor (Every 50 ms)
  if (now - lastSonarMs >= SONAR_SAMPLE_INTERVAL_MS) {
    lastSonarMs = now;
    float dist = sampleHCSR04();

    // 3. Run local physical safety interlock (CRITICAL: Runs locally always)
    updateDoorSafetyInterlock(dist);
  }

  // 4. Run directional passenger breakbeam counting (IR1 & IR2)
  handleBreakbeamCounting();

  // 5. Refresh physical LCD screen (Every 250 ms)
  if (now - lastLcdMs >= LCD_REFRESH_INTERVAL_MS) {
    lastLcdMs = now;
    refreshLcdDisplay();
  }

  // 6. Publish periodic USB Serial status telemetry snapshot (Every 500 ms)
  if (now - lastTelemetryMs >= TELEMETRY_SEND_INTERVAL_MS) {
    lastTelemetryMs = now;
    sendTelemetryStatus();
  }

  // 7. Expire non-blocking diagnostic test pulses (BUZZER & LED)
  if (buzzerTestUntilMs > 0 && now >= buzzerTestUntilMs) {
    if (!obstacleActive) {
      digitalWrite(PIN_BUZZER, LOW);
    }
    buzzerTestUntilMs = 0;
  }
  if (ledTestUntilMs > 0 && now >= ledTestUntilMs) {
    if (!obstacleActive) {
      digitalWrite(PIN_LED, LOW);
    }
    ledTestUntilMs = 0;
  }

  // Zero blocking delay() — ESP32 runs at full speed for safety responsiveness!
}

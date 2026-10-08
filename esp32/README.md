# SMARTBUS ESP32 Firmware Documentation

Authoritative embedded firmware implementation in Arduino C++ for the **SMARTBUS Smart Bus Door Safety & Passenger Monitoring System** using direct **USB Serial** communication.

---

## 1. Hardware Pinout Map

| Hardware Component | ESP32 GPIO Pin | Direction / Mode | Electrical Notes |
|---|---|---|---|
| **HC-SR04 TRIG** | GPIO 5 | Output | Ultrasonic trigger pulse (10 µs) |
| **HC-SR04 ECHO** | GPIO 18 | Input | **★ CAUTION: 5 V logic. MUST use voltage divider (1 kΩ series + 2 kΩ to GND) to 3.3 V!** |
| **IR Sensor 1 (Exterior)** | GPIO 27 | Input (Active-LOW) | Breakbeam sensor detecting passenger boarding |
| **IR Sensor 2 (Interior)** | GPIO 26 | Input (Active-LOW) | Breakbeam sensor detecting passenger alighting |
| **SG90 Servo Motor** | GPIO 19 | Output (PWM) | **★ CAUTION: Power from dedicated 5 V rail, NOT ESP32 3.3 V pin! Common GND.** |
| **Active Piezo Buzzer** | GPIO 23 | Output | 2.4 kHz audible hazard alarm |
| **Red Warning LED** | GPIO 2 | Output | Connect with 220 Ω series current-limiting resistor to GND |
| **16×2 LCD SDA** | GPIO 21 | I2C Data | Default I2C address `0x27` (or `0x3F`) |
| **16×2 LCD SCL** | GPIO 22 | I2C Clock | Default I2C address `0x27` (or `0x3F`) |

---

## 2. Required Arduino Libraries

Install the following libraries in **Arduino IDE 2.x** via **Tools → Manage Libraries...**:

| Library Name | Author | Recommended Version | Purpose |
|---|---|---|---|
| **ESP32 Board Package** | Espressif Systems | 2.0.14+ or 3.0+ | Official ESP32 microcontroller core support |
| **ArduinoJson** | Benoit Blanchon | v6.21.x or v7.x | High-speed JSON serialization & deserialization |
| **ESP32Servo** | Kevin Harrington | v1.1.x+ | ESP32 hardware PWM servo motor driver |
| **LiquidCrystal I2C** | Frank de Brabander / Marco Schwartz | v1.1.x+ | I2C backpack interface for 16×2 LCD screen |

*(Note: No Wi-Fi or WebSockets libraries are required; communication operates directly over USB Serial).*

---

## 3. Configuration & Parameter Separation

Parameters are isolated in [`esp32/config.h`](config.h):

```cpp
// 1. USB Serial Communication Parameters
#define BAUD_RATE              115200       // Standard baud rate for USB Serial
#define TELEMETRY_INTERVAL_MS  500          // Telemetry broadcast period (ms)

// 2. Device Identification
#define DEVICE_ID              "smartbus-01" // Authoritative hardware unit identifier

// 3. I2C 16×2 Character LCD Configuration
#define LCD_I2C_ADDR           0x27         // Default I2C address (0x27 or 0x3F)
#define LCD_COLS               16           // Columns
#define LCD_ROWS               2            // Rows
```

---

## 4. Physical 16×2 LCD Synchronization & States

The 16×2 LCD is driven **directly by the ESP32 CPU** and operates with complete **network independence**. If the USB cable is unplugged, the LCD continues displaying accurate real-time safety status without interruption.

Updates use a **non-blocking differential buffer (`cachedLcdLine0`, `cachedLcdLine1`)** that only issues I2C write transactions when characters actually change.

### Concise Display Layouts:
1. **Normal Operational State (Door Open)**:
   ```text
   PASSENGERS: 24  
   DOOR: OPEN      
   ```
2. **Closing / Secured State**:
   ```text
   PASSENGERS: 24  
   DOOR: CLOSE     
   ```
3. **Obstacle Detected State**:
   ```text
   !!! OBSTACLE !!!
   REOPENING...    
   ```

*Address Note: Default backpack address is `0x27` (PCF8574). For PCF8574A backpacks, update `LCD_I2C_ADDR` to `0x3F` in `config.h`.*

---

## 5. Architectural Safety Principles

1. **Local Physical Safety Controller**:
   The door safety interlock logic runs **100% locally and synchronously on the ESP32 CPU**. Obstacle detection (< 5 cm), door reversal to 90°, and buzzer/LED hazard alarms execute regardless of host PC connection.
2. **Zero Internet / Network Decoupling**:
   Disconnection of the USB cable or host PC crash **NEVER** disables obstacle detection or door safety. The dashboard is a monitoring/command interface, not the safety-critical controller.
3. **Non-Blocking Execution**:
   The main `loop()` contains **zero blocking `delay()` calls**. All sampling intervals (HC-SR04 sonar at 50 ms, LCD at 250 ms, telemetry push at 500 ms) use non-blocking `millis()` time tracking.
4. **Newline-Delimited JSON Serial Telemetry**:
   Sends periodic status messages (every 500 ms), immediate transition events, and command acknowledgements terminated with `\n` at 115200 baud according to [`docs/TELEMETRY_PROTOCOL.md`](../docs/TELEMETRY_PROTOCOL.md).

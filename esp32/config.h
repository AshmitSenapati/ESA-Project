#ifndef CONFIG_H
#define CONFIG_H

// ══════════════════════════════════════════════════════════════════════════════
// SMARTBUS ESP32 Firmware Configuration (USB Serial Architecture)
// ══════════════════════════════════════════════════════════════════════════════
// Communication with the Node.js backend operates entirely over USB Serial.
// No Wi-Fi credentials, SSIDs, or network dependencies are required.

// ── 1. USB Serial Communication Parameters ────────────────────────────────────
#define BAUD_RATE              115200       // Standard baud rate for USB Serial
#define TELEMETRY_INTERVAL_MS  500          // Telemetry broadcast period (ms)

// ── 2. Device Identification ──────────────────────────────────────────────────
#define DEVICE_ID              "smartbus-01" // Authoritative hardware identifier

// ── 3. I2C 16×2 Character LCD Configuration ──────────────────────────────────
// Default 7-bit I2C slave address for PCF8574 / PCF8574T backpack is 0x27 (A0=A1=A2 open).
// For PCF8574A backpack chip, default address is 0x3F.
// If solder pads A0, A1, A2 are bridged, address ranges from 0x20-0x27 or 0x38-0x3F.
#define LCD_I2C_ADDR           0x27         // I2C slave address (0x27 or 0x3F)
#define LCD_COLS               16           // LCD character columns (16)
#define LCD_ROWS               2            // LCD character rows (2)

#endif // CONFIG_H

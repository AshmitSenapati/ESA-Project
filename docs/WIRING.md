# SMARTBUS ESP32 Hardware Wiring & Power Architecture Guide

Authoritative hardware pin configuration, signal voltage conditioning, power distribution, and electrical safety reference for the **SMARTBUS Smart Bus Door Safety & Passenger Monitoring System**.

---

## 1. Master Hardware Pin Allocation

| ESP32 GPIO | Connected Component | Module Pin / Lead | Signal Purpose | Operating Voltage | Direction | Hardware & Safety Notes |
|:---|:---|:---|:---|:---|:---|:---|
| **GPIO 27** | IR Obstacle Sensor 1 | `OUT` | Exterior Entry Breakbeam | 3.3 V Logic | Input (Active-LOW) | Power module from **3.3 V rail** for native 3.3 V logic safety |
| **GPIO 26** | IR Obstacle Sensor 2 | `OUT` | Interior Exit Breakbeam | 3.3 V Logic | Input (Active-LOW) | Power module from **3.3 V rail** for native 3.3 V logic safety |
| **GPIO 5** | HC-SR04 Ultrasonic | `TRIG` | Sonar Transmitter Trigger | 3.3 V Logic | Output | 10 µs pulse initiates 8-cycle 40 kHz acoustic burst |
| **GPIO 18** | HC-SR04 Ultrasonic | `ECHO` | Sonar Receiver Echo | **3.3 V Conditioned** | Input | **★ CRITICAL: 5 V → 3.3 V voltage divider required (1 kΩ + 2 kΩ)** |
| **GPIO 19** | SG90 Micro Servo | `PWM` (Orange/Yellow) | Door Actuator Signal | 3.3 V PWM | Output | Hardware LEDC PWM. **VCC MUST connect to external 5 V rail** |
| **GPIO 23** | Active Piezo Buzzer | `+` (Anode / VCC) | Acoustic Collision Alarm | 3.3 V / 5 V Logic | Output | High = 2.4 kHz audible alarm; Low = Silent |
| **GPIO 2** | Red Warning LED | Anode (`+` long leg) | Visual Collision Strobe | 3.3 V Logic | Output | **MUST use 220 Ω series resistor to GND** |
| **GPIO 21** | 16×2 LCD Backpack | `SDA` | I2C Serial Data | 3.3 V / 5 V Bus | Bi-directional | Default ESP32 Wire SDA line (Address `0x27` or `0x3F`) |
| **GPIO 22** | 16×2 LCD Backpack | `SCL` | I2C Serial Clock | 3.3 V / 5 V Bus | Output | Default ESP32 Wire SCL line |
| **GND** | All Components | `GND` | Common Reference Ground | 0 V | Reference | **★ CRITICAL: Connect ALL power supply & module GNDs together** |

---

## 2. GPIO Conflict & Boot Strapping Analysis

The ESP32 SoC has specific pins tied to internal silicon functions, strapping registers, and SPI flash memory. Every pin in this configuration has been rigorously evaluated for electrical and architectural compatibility:

### A. Strapping Pin Verification
- **GPIO 0**: *(Not used)* — Avoided. Controls bootloader flashing mode.
- **GPIO 2**: **Used for RED LED**.
  - *Silicon Constraint*: GPIO 2 is a boot strapping pin (must not be pulled strongly HIGH during power-on reset, or the chip may fail to boot from flash).
  - *Circuit Compliance*: The Red LED is wired with its anode to GPIO 2 and its cathode through a 220 Ω resistor to **GND**. This acts as a passive pull-down during power-on reset, **guaranteeing nominal bootloader and normal boot execution**.
- **GPIO 5**: **Used for HC-SR04 TRIG**.
  - *Silicon Constraint*: Strapping pin that configures SDIO slave timing during boot (internally pulled HIGH at reset).
  - *Circuit Compliance*: The HC-SR04 `TRIG` pin is a high-impedance CMOS digital input. It does not drag GPIO 5 to an invalid level during boot, nor does the boot pulse trigger ranging (the HC-SR04 requires a specific 10 µs pulse after boot).
- **GPIO 12 & GPIO 15**: *(Not used)* — Avoided. Controls internal flash voltage ($V_{DD\_SDIO}$) and boot silence.

### B. Internal Bus & Restricted Pins (Completely Avoided)
- **GPIO 6–11**: *(Not used)* — Directly wired to the ESP32's internal SPI flash memory. Using these causes instant kernel panic/reboot.
- **GPIO 34–39**: *(Not used)* — Input-only pins lacking internal pull-up/pull-down resistors and output drivers. All chosen outputs (GPIO 5, 19, 23, 2, 22) reside on fully functional bidirectional matrix GPIOs.

---

## 3. Safety Critical Circuit 1: HC-SR04 ECHO Voltage Divider

> [!CAUTION]
> **OVERVOLTAGE HAZARD (5 V → 3.3 V)**
> The standard HC-SR04 operates from 5 V VCC and outputs a **5.0 V logic pulse on its ECHO pin**.
> The ESP32's GPIO pins are **NOT 5 V tolerant**. The absolute maximum rating on any ESP32 GPIO is **3.6 V**.
> Connecting 5 V directly to GPIO 18 will forward-bias the internal silicon clamping diodes, cause dielectric breakdown, and **permanently destroy the GPIO pin or the entire ESP32 SoC**.

### A. Resistor Voltage Divider Schematic

A simple, reliable passive resistor divider steps down the 5.0 V return pulse to safe 3.33 V CMOS logic levels:

```
                          ┌─────────────┐
                          │   HC-SR04   │
                          │  ULTRASONIC │
                          │             │
                          │   ECHO OUT  │
                          └──────┬──────┘
                                 │
                                 │ 5.0 V Logic Pulse
                                 ▼
                           [ R1 = 1 kΩ ]
                                 │
                                 ├────────────────────────► To ESP32 GPIO 18 (3.33 V Safe)
                                 │
                           [ R2 = 2 kΩ ]
                                 │
                                 ▼
                            COMMON GND (0 V)
```

### B. Mathematical Verification
$$V_{GPIO18} = V_{ECHO} \times \frac{R_2}{R_1 + R_2} = 5.0\text{ V} \times \frac{2000\,\Omega}{1000\,\Omega + 2000\,\Omega} = 5.0\text{ V} \times \frac{2}{3} = \mathbf{3.33\text{ V}}$$

- **Input Voltage ($V_{IN}$)**: 5.0 V (from HC-SR04 ECHO)
- **Output Voltage ($V_{OUT}$)**: **3.33 V** (Safe: well below the 3.6 V absolute maximum, and above the 2.64 V $V_{IH}$ minimum for a clean logic HIGH).
- **Current Draw**: $5\text{ V} / 3000\,\Omega = 1.66\text{ mA}$ (well within HC-SR04 output drive capability).

*(Alternative acceptable pairs: $R_1 = 2\text{ k}\Omega$ with $R_2 = 3.3\text{ k}\Omega \rightarrow 3.11\text{ V}$, or a dedicated 4-channel bi-directional logic level shifter module like the BSS138/TXS0108E).*

---

## 4. Safety Critical Circuit 2: SG90 Servo Power & Brownout Mitigation

> [!WARNING]
> **BROWNOUT & INDUCTIVE NOISE HAZARD**
> An SG90 micro-servo motor draws:
> - **Idle / Holding Current**: 10 – 25 mA
> - **Continuous Motion Current**: 150 – 250 mA
> - **Stall / Inrush Starting Current**: **500 – 800 mA peak**
>
> **NEVER power the SG90 servo from the ESP32's on-board 3.3 V regulator.**
> The on-board AMS1117 / ME6211 linear regulator can only supply 500 – 800 mA total. During Wi-Fi transmission bursts (which draw up to 240 mA peak), servo movement will cause the 3.3 V rail to drop below the ESP32's 2.8 V Brownout threshold. The microcontroller will reset continuously with:
> `rst:0xc (SW_CPU_RESET), boot:0x13 ... Brownout detector was triggered`

### A. Power Supply Separation Architecture

```
                 DEDICATED 5V POWER SUPPLY (≥ 2.0 A)
              (External 5V Adapter or Powered Breadboard Rail)
                     │                            │
                     ▼ 5.0 V                      ▼ GND
          ┌──────────────────────┐         ┌──────────────────────┐
          │   SG90 SERVO MOTOR   │         │      COMMON GND      │
          │                      │         │    STAR CONNECTION   │
          │  VCC (Red Wire)      │         │                      │
          │  GND (Brown Wire)────┼─────────► All Grounds Tied     │
          │  Signal (Orange)     │         │ Together (0 V)       │
          └──────────▲───────────┘         └──────────▲───────────┘
                     │                                │
                     │ 3.3V PWM (GPIO 19)             │
                     │                                │
          ┌──────────┴───────────┐                    │
          │      ESP32 NODE      │                    │
          │  GND Pin ────────────┼────────────────────┘
          │  3.3V Rail           │
          └──────────────────────┘
```

### B. Recommended Decoupling Buffer Capacitor
Place a **220 µF to 470 µF electrolytic capacitor** (rated for $\ge 10\text{ V}$) directly across the external $5\text{ V}$ and $\text{GND}$ power rails adjacent to the servo's power leads. This capacitor absorbs instantaneous inductive current spikes when the servo starts or reverses rotation, keeping the DC rail stable.

---

## 5. Common-Ground Star Architecture (Mandatory Rule)

> [!IMPORTANT]
> **THE COMMON-GROUND RULE**
> If you use multiple power sources (e.g., PC USB cable powering the ESP32 + external 5V adapter powering the SG90 servo and HC-SR04):
> **ALL GROUND (GND) WIRES MUST BE TIED TOGETHER TO A SINGLE COMMON GROUND RAIL.**
>
> If the grounds are not connected:
> 1. The PWM signal on GPIO 19 and the ECHO pulse on GPIO 18 will have no reference voltage return path.
> 2. The servo will jitter uncontrollably, fail to rotate, or draw excessive current.
> 3. Floating potentials can feed unintended reverse voltages into the ESP32 inputs.

---

## 6. Component-by-Component Wiring Specifications

### 1. HC-SR04 Ultrasonic Sensor
- **VCC** $\rightarrow$ External **5 V Rail** (Requires 5 V for full ultrasonic transducer power)
- **TRIG** $\rightarrow$ **GPIO 5** (Direct connection; 3.3 V logic from ESP32 triggers 5 V CMOS reliably)
- **ECHO** $\rightarrow$ Through **1 kΩ resistor** to **GPIO 18**, and from GPIO 18 through **2 kΩ resistor** to **GND**
- **GND** $\rightarrow$ **Common GND**

### 2. IR Obstacle Avoidance Sensors (IR1 & IR2)
- **VCC** $\rightarrow$ **ESP32 3.3 V Pin** (Operating at 3.3 V ensures the comparator output is natively 3.3 V safe)
- **GND** $\rightarrow$ **Common GND**
- **IR1 OUT** $\rightarrow$ **GPIO 27** (Active-LOW: output goes LOW when breakbeam is blocked)
- **IR2 OUT** $\rightarrow$ **GPIO 26** (Active-LOW: output goes LOW when breakbeam is blocked)
- *Calibration*: Use the on-board single-turn potentiometer on each module to set detection distance (~10–15 cm across the bus entryway).

### 3. SG90 Micro Servo Motor
- **VCC (Red Wire)** $\rightarrow$ External **5 V Rail** (Dedicated supply)
- **GND (Brown / Black Wire)** $\rightarrow$ **Common GND**
- **PWM Signal (Orange / Yellow Wire)** $\rightarrow$ **GPIO 19** (ESP32 3.3 V PWM is recognized cleanly by the servo control IC)

### 4. Active Piezo Buzzer
- **VCC / Anode (`+`)** $\rightarrow$ **GPIO 23**
- **GND / Cathode (`-`)** $\rightarrow$ **Common GND**
- *Note*: An active buzzer has an internal oscillating circuit and sounds automatically when GPIO 23 is driven HIGH. If using an unbuffered buzzer drawing $> 15\text{ mA}$, place a $100\,\Omega$ resistor in series or drive through a 2N2222 NPN transistor.

### 5. Red Safety Warning LED
- **Anode (`+` longer lead)** $\rightarrow$ **GPIO 2**
- **Cathode (`-` shorter lead)** $\rightarrow$ In series with a **220 Ω resistor** $\rightarrow$ **Common GND**
- *Current calculation*: $(3.3\text{ V} - 1.8\text{ V}) / 220\,\Omega \approx 6.8\text{ mA}$ (Safe and bright).

### 6. 16×2 Character LCD with I2C Backpack (PCF8574 / PCF8574A)
- **VCC** $\rightarrow$ External **5 V Rail** (The LCD liquid crystal fluid requires 5 V for crisp character contrast)
- **GND** $\rightarrow$ **Common GND**
- **SDA** $\rightarrow$ **GPIO 21** (ESP32 hardware default I2C Wire Data)
- **SCL** $\rightarrow$ **GPIO 22** (ESP32 hardware default I2C Wire Clock)

#### A. I2C Backpack Address Configuration
The 16×2 LCD utilizes an 8-bit I/O expander backpack chip, typically either the **PCF8574** or **PCF8574A**:
- **PCF8574 / PCF8574T**: Base address `0x20`. Factory default with address solder pads A0, A1, A2 unbridged (HIGH) is **`0x27`**.
- **PCF8574A / PCF8574AT**: Base address `0x38`. Factory default with address solder pads A0, A1, A2 unbridged (HIGH) is **`0x3F`**.

Firmware configuration is defined in [`esp32/config.h`](file:///c:/Users/Ashmit/ESA/esp32/config.h):
```cpp
#define LCD_I2C_ADDR    0x27   // Change to 0x3F if using PCF8574A backpack
#define LCD_COLS        16     // 16 columns
#define LCD_ROWS        2      // 2 rows
```

#### B. Solder Jumper Address Matrix (A2, A1, A0)
If multiple I2C devices conflict or if custom address pads are soldered on the back of the module:

| Solder Jumper A2 | Solder Jumper A1 | Solder Jumper A0 | PCF8574 / PCF8574T Address | PCF8574A / PCF8574AT Address |
|:---:|:---:|:---:|:---:|:---:|
| Open (HIGH) | Open (HIGH) | Open (HIGH) | **`0x27` (Default)** | **`0x3F` (Default)** |
| Open | Open | Bridged (GND) | `0x26` | `0x3E` |
| Open | Bridged | Open | `0x25` | `0x3D` |
| Open | Bridged | Bridged | `0x24` | `0x3C` |
| Bridged | Open | Open | `0x23` | `0x3B` |
| Bridged | Open | Bridged | `0x22` | `0x3A` |
| Bridged | Bridged | Open | `0x21` | `0x39` |
| Bridged | Bridged | Bridged | `0x20` | `0x38` |

#### C. Finding Unknown Backpack Address (I2C Bus Scanner)
If your display remains blank with solid blue boxes, upload this minimal I2C scanner helper to detect the active bus address:
```cpp
#include <Wire.h>
void setup() {
  Wire.begin(21, 22);
  Serial.begin(115200);
  Serial.println("\nScanning I2C bus...");
  for (byte addr = 1; addr < 127; ++addr) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("Discovered I2C device at address: 0x%02X\n", addr);
    }
  }
}
void loop() {}
```

#### D. Contrast Potentiometer Adjustment
The small blue single-turn trimpot on the back of the I2C backpack controls the LCD contrast voltage ($V_0$ pin 3 of the HD44780).
- If the screen displays only a lit blue backlight with **no text visible**, rotate the trimpot clockwise with a precision screwdriver until black/white character pixels stand out clearly.
- If the screen displays solid white/black blocks across all 16 cells, rotate counter-clockwise slightly until the background blocks fade and clear text appears.

#### E. Local Firmware Synchronization & Non-Blocking Design
- **Wi-Fi Independence**: The LCD is driven 100% locally by the ESP32 CPU. Loss of Wi-Fi or server disconnection never degrades or interrupts display updates.
- **Differential Line Buffer (`cachedLcdLine0`, `cachedLcdLine1`)**: The firmware computes string values into fixed 16-character buffers (`%-16.16s`) and performs an in-memory `strcmp()`. I2C transmission occurs **only when characters actually change**, reducing I2C bus traffic to near zero and completely eliminating screen flicker.
- **Concise 16×2 Layout**:
  - Normal State: Row 0: `PASSENGERS: 24  ` | Row 1: `DOOR: OPEN      `
  - Closing State: Row 0: `PASSENGERS: 24  ` | Row 1: `DOOR: CLOSE     `
  - Obstacle State: Row 0: `!!! OBSTACLE !!!` | Row 1: `REOPENING...    `

---

## 7. Complete System Breadboard ASCII Schematic

```
                             +-------------------+
                             | ESP32 DEVKIT V1   |
                             |                   |
                             |  [3.3V]  [VIN/5V] |<== (Optional 5V USB in)
                             |  [GND]     [GND]  |
                             |                   |
  +--------------------------|  GPIO 27          |
  | (IR1 OUT, 3.3V Safe)     |                   |
  |                          |                   |
  |  +-----------------------|  GPIO 26          |
  |  | (IR2 OUT, 3.3V Safe)  |                   |
  |  |                       |                   |
  |  |  +--------------------|  GPIO 5           |
  |  |  | (TRIG Out, 3.3V)   |                   |
  |  |  |                    |                   |
  |  |  |    +---------------|  GPIO 18          |
  |  |  |    | (ECHO In)     |                   |
  |  |  |    |               |                   |
  |  |  |    |  +------------|  GPIO 19          |
  |  |  |    |  | (PWM Out)  |                   |
  |  |  |    |  |            |                   |
  |  |  |    |  |  +---------|  GPIO 23          |
  |  |  |    |  |  | (Buzzer)|                   |
  |  |  |    |  |  |         |                   |
  |  |  |    |  |  |  +------|  GPIO 2           |
  |  |  |    |  |  |  | (LED)|                   |
  |  |  |    |  |  |  |      |                   |
  |  |  |    |  |  |  |  +---|  GPIO 21 (SDA)    |
  |  |  |    |  |  |  |  | +-|  GPIO 22 (SCL)    |
  |  |  |    |  |  |  |  | | |                   |
  |  |  |    |  |  |  |  | | +-------------------+
  |  |  |    |  |  |  |  | |
  |  |  |    |  |  |  |  | |      I2C LCD (5V VCC, Common GND)
  |  |  |    |  |  |  |  | +----► SCL Pin
  |  |  |    |  |  |  |  +------► SDA Pin
  |  |  |    |  |  |  |
  |  |  |    |  |  |  +---------► [Anode] RED LED [Cathode] ──► [220Ω] ──► GND
  |  |  |    |  |  |
  |  |  |    |  |  +------------► (+) ACTIVE BUZZER (-) ────────────────► GND
  |  |  |    |  |
  |  |  |    |  +---------------► (Signal/Orange) SG90 SERVO
  |  |  |    |                    (VCC/Red) ────► DEDICATED 5V RAIL (Buffer 470µF)
  |  |  |    |                    (GND/Brown) ──► COMMON GND RAIL
  |  |  |    |
  |  |  |    +──► [1kΩ Resistor] ──┬──► HC-SR04 ECHO (5V Out)
  |  |  |                          │
  |  |  |                     [2kΩ Resistor]
  |  |  |                          │
  |  |  |                          ▼
  |  |  |                         GND
  |  |  |
  |  |  +-----------------------► HC-SR04 TRIG (5V VCC from Ext Rail, GND)
  |  |
  |  +--------------------------► IR SENSOR 2 (3.3V VCC from ESP32, GND)
  |
  +-----------------------------► IR SENSOR 1 (3.3V VCC from ESP32, GND)
```

---

## 8. Host Computer USB Connection (USB Serial Architecture)

The SMARTBUS system operates directly over a physical USB connection between the development host computer (laptop/PC) and the ESP32 microcontroller:

```
┌─────────────────────────────────┐                       ┌────────────────────────────────┐
│   Host Laptop / Control PC      │                       │     ESP32 NodeMCU / DevKit     │
│                                 │   USB-A to USB-C      │                                │
│   Node.js Ingestion Server      │◄═════════════════════►│   USB-to-UART Bridge           │
│   (SerialPort @ 115200 Baud)    │      DATA Cable       │   (CP2102 / CH340 / CH9102)    │
└─────────────────────────────────┘                       └────────────────────────────────┘
```

### A. Cable Requirements
- **Must be a USB Data Cable**: Verify that your USB-A to USB-C cable is capable of data transmission. Many cheap cables are "charge-only" (missing the D+ and D- data lines) and will not enumerate in Device Manager.
- **Port Identification on Windows**:
  1. Open **Device Manager** (`Win + X` $\to$ **Device Manager**).
  2. Expand **Ports (COM & LPT)**.
  3. Look for **Silicon Labs CP210x USB to UART Bridge (COMx)** or **USB-SERIAL CH340 (COMx)**.
  4. Note the port number (e.g. `COM3`, `COM4`, `COM5`).
  5. Configure `SERIAL_PORT=COM5` (replace `COM5` with your detected port) in `server/.env`.

### B. Serial Communication Specifications
- **Baud Rate**: `115200`
- **Data Bits**: `8`
- **Parity**: `None`
- **Stop Bits**: `1` (`8N1`)
- **Protocol**: Newline-delimited JSON (`\n` terminated)
- **Zero Internet / Wi-Fi Dependency**: The physical safety system and telemetry pipeline operate completely offline without routers, Wi-Fi passwords, or internet access.

---

## 9. Pre-Flight Hardware Verification Checklist

Perform these tests with a digital multimeter (DMM) **before connecting the ESP32 to a computer via USB**:

1. [ ] **USB Data Cable Check**: Plug the ESP32 into your PC and verify the COM port appears in Windows Device Manager.
2. [ ] **Common Ground Continuity**: Place the DMM in continuity mode (`BEEP`). Verify zero ohms resistance between ESP32 GND, External 5V GND, Servo GND, HC-SR04 GND, and LCD GND.
3. [ ] **Voltage Divider Sanity Check**: Disconnect GPIO 18. Power on the HC-SR04 with 5V. Place an object in front of the sonar and measure the voltage between the 1kΩ/2kΩ midpoint and GND using a DMM. Confirm the voltage **never exceeds 3.4 V**.
4. [ ] **No 5V on 3.3V Rail**: Verify with a DMM that the ESP32's 3.3 V pin reads approximately $3.28\text{ V} - 3.33\text{ V}$ and has no short to the external 5 V rail.
5. [ ] **Servo Supply Decoupling**: Confirm that the 220 µF – 470 µF electrolytic capacitor is installed across the 5V and GND rail near the servo with correct polarity (striped negative lead to GND).
6. [ ] **IR Sensor Threshold Calibration**: Power on the sensors. Pass a hand across IR1 and verify its onboard indicator LED illuminates cleanly; repeat for IR2.
7. [ ] **LCD Contrast Trimpot**: Adjust the blue potentiometer on the PCF8574 backpack until the 16×2 white-on-blue characters are crisp and legible.


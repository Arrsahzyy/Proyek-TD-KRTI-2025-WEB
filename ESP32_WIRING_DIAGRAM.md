# 📋 ESP32 Wiring Diagram - UAV Telemetry System

```
==============================================================
                    ESP32 PINOUT DIAGRAM
==============================================================

                         ESP32 DevKit
                    ┌─────────────────────┐
                    │                     │
                3V3 │●                   ●│ VIN (5V)
                    │                     │
                 EN │●                   ●│ GND
                    │                     │
              VP/36 │●                   ●│ 13
                    │                     │
              VN/39 │●                   ●│ 12
                    │                     │
                 34 │●                   ●│ 14
                    │                     │
                 35 │●                   ●│ 27
                    │                     │
                 32 │●                   ●│ 26
                    │                     │
                 33 │●                   ●│ 25
                    │                     │
                 25 │●                   ●│ 33
                    │                     │
                 26 │●                   ●│ 32
                    │                     │
                 27 │●                   ●│ 35
                    │                     │
                 14 │●                   ●│ 34
                    │                     │
                 12 │●                   ●│ VN/39
                    │                     │
                GND │●                   ●│ VP/36
                    │                     │
                 13 │●                   ●│ EN
                    │                     │
                  2 │●   [USB]   [ANT]   ●│ 3V3
                    │                     │
                  0 │●                   ●│ 1
                    │                     │
                  4 │●                   ●│ 3
                    │                     │
               16/RX│● (GPS_RX_PIN)      ●│ 21/SDA (INA219_SDA)
                    │                     │
               17/TX│● (GPS_TX_PIN)      ●│ 22/SCL (INA219_SCL)
                    │                     │
                  5 │● (RELAY_PIN)       ●│ 19
                    │                     │
                 18 │●                   ●│ 23
                    │                     │
                    └─────────────────────┘

==============================================================
                     CONNECTION DIAGRAM
==============================================================

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GPS MODULE    │    │   INA219 SENSOR │    │  RELAY MODULE   │
│                 │    │                 │    │                 │
│  VCC ●──────────┼────┼─● 3.3V          │    │  VCC ●────────● │ 5V/3.3V
│  GND ●──────────┼────┼─● GND           │    │  GND ●────────● │ GND  
│  TX  ●─────────●│16  │                 │    │  IN  ●─────●5 │     
│  RX  ●─────────●│17  │  SDA ●─────────●│21  │                 │     
│                 │    │  SCL ●─────────●│22  │                 │     
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        
                              ESP32
                         ┌─────────────┐
                         │             │
                    ●16──┤ GPS RX      │
                    ●17──┤ GPS TX      │
                    ●21──┤ INA SDA     │
                    ●22──┤ INA SCL     │
                    ●5───┤ RELAY       │
                    ●2───┤ LED (built) │
                         │             │
                         └─────────────┘

==============================================================
                      POWER CONNECTIONS
==============================================================

Power Distribution:
├── ESP32 Main Power: 5V via USB atau VIN pin
├── GPS Module: 3.3V dari ESP32 3.3V pin  
├── INA219 Sensor: 3.3V dari ESP32 3.3V pin
└── Relay Module: 5V dari VIN atau external 5V

Ground Connections:
├── All GND pins connected together
├── Common ground untuk semua komponen
└── ESP32 GND sebagai reference ground

==============================================================================
                            STEP-BY-STEP WIRING
==============================================================================

Step 1: Power Connections
─────────────────────────
1. Connect ESP32 VIN to 5V power source (atau gunakan USB)
2. Connect ESP32 GND to common ground
3. Connect GPS VCC to ESP32 3.3V
4. Connect INA219 VCC to ESP32 3.3V  
5. Connect Relay VCC to ESP32 VIN (5V) atau external 5V
6. Connect all GND pins together

Step 2: GPS Module (NEO-6M/NEO-8M)
──────────────────────────────────
1. GPS TX  → ESP32 Pin 16 (GPS_RX_PIN)
2. GPS RX  → ESP32 Pin 17 (GPS_TX_PIN)
3. GPS VCC → ESP32 3.3V
4. GPS GND → ESP32 GND

Step 3: INA219 Current Sensor
─────────────────────────────
1. INA219 SDA → ESP32 Pin 21
2. INA219 SCL → ESP32 Pin 22
3. INA219 VCC → ESP32 3.3V
4. INA219 GND → ESP32 GND

Step 4: Relay Module
────────────────────
1. Relay Signal → ESP32 Pin 5
2. Relay VCC   → ESP32 VIN (5V) atau external 5V
3. Relay GND   → ESP32 GND

Step 5: Verification
───────────────────
1. Double-check all connections
2. Ensure no short circuits
3. Verify power supply ratings
4. Test continuity with multimeter

==============================================================================
                              SAFETY NOTES
==============================================================================

⚠️  IMPORTANT SAFETY GUIDELINES:
├── Always disconnect power before wiring
├── Double-check polarity (VCC/GND) before connecting power
├── Use appropriate gauge wire for current requirements
├── Ensure secure connections (solder recommended)
├── Test with multimeter before powering on
├── Start with low voltage testing
├── Monitor for overheating during initial tests
└── Have fire safety equipment ready during testing

🔋 POWER REQUIREMENTS:
├── ESP32: 5V @ 500mA (via USB atau VIN)
├── GPS: 3.3V @ 50mA 
├── INA219: 3.3V @ 1mA
├── Relay: 5V @ 70mA (tergantung relay type)
└── Total: ~620mA @ 5V (plus relay load)

🔧 TOOLS NEEDED:
├── Soldering iron & solder
├── Wire strippers
├── Multimeter
├── Breadboard (untuk prototyping)
├── Jumper wires
└── Heat shrink tubing (recommended)

==============================================================================
                           TROUBLESHOOTING WIRING
==============================================================================

Problem: ESP32 tidak menyala
Solution:
├── Check power supply (5V, sufficient current)
├── Verify VIN/GND connections  
├── Test USB cable
└── Check for short circuits

Problem: GPS tidak terdeteksi  
Solution:
├── Verify RX/TX connections (TX→16, RX→17)
├── Check GPS power (3.3V)
├── Ensure GPS has clear view to sky
└── Test GPS dengan GPS software

Problem: INA219 tidak terdeteksi
Solution:  
├── Verify I2C connections (SDA→21, SCL→22)
├── Check INA219 power (3.3V)
├── Test dengan I2C scanner code
└── Verify I2C address (default 0x40)

Problem: Relay tidak bekerja
Solution:
├── Check relay signal connection (Pin 5)
├── Verify relay power (5V for most relays)
├── Test relay dengan manual trigger
└── Check relay specifications

==============================================================================

📋 FINAL CHECKLIST BEFORE POWER-ON:
├── [ ] All VCC connections to correct voltage rails
├── [ ] All GND connections common  
├── [ ] No short circuits between VCC/GND
├── [ ] Signal wires to correct ESP32 pins
├── [ ] Secure physical connections
├── [ ] Power supply adequate for total current
├── [ ] Safety equipment ready
└── [ ] Code uploaded and verified

READY TO POWER ON! 🚀
```

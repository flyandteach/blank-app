# ✈️ Takeoff Acceleration Warning System (TAWS)

A Progressive Web App (PWA) that monitors aircraft acceleration during takeoff and provides visual and audio warnings if acceleration is insufficient for safe takeoff given the remaining runway distance.

## ⚠️ DISCLAIMER

**THIS IS A SUPPLEMENTAL TOOL ONLY - NOT CERTIFIED AVIONICS**

This application is designed for educational and supplemental use only. It is NOT certified avionics equipment and should NOT be used as a primary safety system. Always follow proper aviation procedures and rely on certified equipment for flight operations.

## 🎯 Overview

The Takeoff Acceleration Warning System helps pilots monitor their aircraft's acceleration during takeoff by:

- Integrating real-time weather data (METAR)
- Calculating performance adjustments for wind, temperature, and pressure
- Monitoring GPS position and accelerometer data
- Providing visual and audio warnings if acceleration is insufficient
- Alerting when approaching the end of the runway

## ✨ Features

### Airport & Runway Selection
- Search for airports by ICAO code
- Select specific runways from available options
- Display runway length, heading, and other parameters

### Weather Integration
- Fetch METAR data from Aviation Weather Center
- Parse wind, temperature, altimeter, and visibility
- Calculate wind components (headwind/crosswind)

### Performance Calculations
- Input rotation speed (Vr) in knots
- Calculate density altitude
- Compute rotation groundspeed based on wind and atmospheric conditions
- Account for temperature and pressure effects on performance

### Real-Time Monitoring
- **GPS Tracking**: Monitor position, speed, and distance to runway end
- **Accelerometer**: Measure acceleration during takeoff roll
- **Warning System**: Visual and audio alerts for insufficient acceleration

### Warning System
- **Visual Warnings**:
  - Green background when acceleration is normal
  - Red background with flashing alerts when insufficient
  - Distance remaining display
  
- **Audio Warnings**:
  - Voice synthesis: "ACCELERATION" warning every 5 seconds when insufficient
  - Rapid warnings (every 1 second) when less than 1000 feet remaining

## 🚀 Getting Started

### Prerequisites

- Modern web browser with support for:
  - Geolocation API
  - DeviceMotion API (accelerometer)
  - Web Speech API (text-to-speech)
- HTTPS connection (required for sensor access)
- Mobile device recommended (for accelerometer)

### Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/flyandteach/blank-app.git
   cd blank-app
   ```

2. **Serve the application over HTTPS**
   
   Option A: Use Python's built-in server
   ```bash
   python3 -m http.server 8000
   ```
   
   Option B: Use a production web server (nginx, Apache, etc.)
   
   Option C: Deploy to a hosting service (GitHub Pages, Netlify, Vercel, etc.)

3. **Access the application**
   - Open your browser and navigate to the application URL
   - For local testing: `http://localhost:8000`
   - For HTTPS (required for sensors): Deploy to a hosting service or use ngrok/similar

### Add to Home Screen (PWA)

1. Open the application in your mobile browser
2. Tap the "Share" button (iOS) or "Menu" (Android)
3. Select "Add to Home Screen"
4. The app will install as a standalone application

## 📱 Usage Instructions

### Basic Operation

1. **Enter Airport Information**
   - Enter a 4-letter ICAO code (e.g., KJFK, KLAX, KORD)
   - Click "Search" to load airport data
   - Available airports: KJFK, KLAX, KORD, EGLL, LFPG, EDDF

2. **Select Runway**
   - Choose your departure runway from the dropdown
   - Review runway length and heading

3. **Fetch Weather**
   - Click "Fetch Weather" to load current METAR
   - Review wind, temperature, and altimeter settings
   - Note: If live METAR is unavailable, simulated data will be used

4. **Enter Rotation Speed**
   - Input your aircraft's rotation speed (Vr) in knots
   - The system will calculate rotation groundspeed based on conditions

5. **ARM System**
   - Once all data is loaded, click "ARM SYSTEM"
   - Grant GPS and accelerometer permissions when prompted
   - The monitoring panel will appear

6. **During Takeoff**
   - The system monitors your position and acceleration in real-time
   - Visual and audio warnings activate if acceleration is insufficient
   - Monitor distance remaining and current speed

7. **After Takeoff/Abort**
   - Click "DISARM SYSTEM" to stop monitoring
   - Return to configuration panel for next flight

### Testing Without Flying

Since actual takeoff testing requires being in an aircraft, you can test the system's functionality:

1. **Desktop Testing**:
   - GPS will work but accelerometer may not be available
   - You can move around with your device to test GPS tracking
   - Simulated METAR data will be used

2. **Mobile Testing**:
   - Walk or drive slowly to simulate movement
   - The accelerometer should detect motion
   - The system will calculate based on your current movement

3. **Simulation Mode**:
   - The app uses simulated METAR when live data is unavailable
   - All calculations are performed with real physics equations

## 🔧 Technical Details

### File Structure

```
blank-app/
├── index.html          # Main HTML structure
├── styles.css          # Aviation-themed styling
├── app.js             # Main application logic
├── api.js             # API integration (airport/weather)
├── calculations.js    # Physics and performance calculations
├── sensors.js         # GPS and accelerometer handling
├── warnings.js        # Warning system logic
├── manifest.json      # PWA manifest
└── README.md          # This file
```

### APIs Used

1. **Aviation Weather Center** (NOAA)
   - Endpoint: `https://aviationweather.gov/cgi-bin/data/metar.php`
   - No API key required
   - Provides METAR data

2. **Airport Data**
   - Built-in database of major airports
   - Includes: KJFK, KLAX, KORD, EGLL, LFPG, EDDF
   - Runway data includes length, heading, width

### Browser APIs

- **Geolocation API**: High-accuracy GPS positioning
- **DeviceMotion API**: Accelerometer data
- **Web Speech API**: Text-to-speech for warnings

### Calculations

The system performs various aviation calculations:

- **Wind Components**: Headwind and crosswind from wind direction and runway heading
- **Density Altitude**: Based on elevation, temperature, and altimeter setting
- **True Airspeed**: Conversion from indicated airspeed using density altitude
- **Groundspeed**: TAS adjusted for wind component
- **Acceleration Analysis**: Using kinematic equations (v² = u² + 2as)

### Physics Formulas

```javascript
// Wind component (headwind)
headwind = windSpeed × cos(windDirection - runwayHeading)

// Density altitude
pressureAltitude = elevation + ((29.92 - altimeter) × 1000)
densityAltitude = pressureAltitude + (120 × temperatureDeviation)

// Required acceleration to reach rotation speed
requiredAccel = (vf² - v₀²) / (2 × distance)
```

## 🔒 Security & Privacy

- All data processing is done locally on your device
- No data is sent to external servers (except API calls for weather/airport data)
- GPS data is not stored or transmitted
- Accelerometer data is not stored or transmitted

### HTTPS Requirement

Modern browsers require HTTPS for accessing:
- Geolocation API
- DeviceMotion API (on some browsers)
- Service Workers (for PWA offline functionality)

## 🛠️ Development

### Adding More Airports

Edit `api.js` and add airport data to the `getAirportFromCache()` function:

```javascript
'KXXX': {
    icao: 'KXXX',
    name: 'Airport Name',
    elevation: 100, // feet
    lat: 40.0000,
    lon: -75.0000,
    runways: [
        { id: '09', heading: 90, length: 8000, width: 150 }
    ]
}
```

### Customizing Warnings

Edit `warnings.js` to adjust:
- Warning intervals (default: 5 seconds normal, 1 second critical)
- Critical distance threshold (default: 1000 feet)
- Voice settings (rate, pitch, volume)

### Modifying Calculations

Edit `calculations.js` to adjust:
- Wind component calculations
- Density altitude formula
- Acceleration analysis thresholds

## 🐛 Known Limitations

1. **Accelerometer Accuracy**: Device accelerometers may not be as accurate as aviation-grade sensors
2. **GPS Accuracy**: Consumer GPS has limitations in accuracy and update rate
3. **Airport Database**: Limited to pre-loaded airports (easily expandable)
4. **METAR Availability**: Live METAR may not always be available; falls back to simulated data
5. **Device Orientation**: Accelerometer readings assume specific device orientation

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please ensure any additions:
- Maintain the aviation safety focus
- Include appropriate disclaimers
- Follow existing code structure
- Are well-documented

---

**Remember: This is a supplemental tool only. Always follow proper aviation procedures and use certified equipment for flight operations.**

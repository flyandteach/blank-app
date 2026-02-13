/**
 * Main Application File
 * Orchestrates all modules and handles UI interactions
 */

const App = {
    // Application state
    state: {
        airport: null,
        runway: null,
        weather: null,
        vrIAS: null,
        vrGroundspeed: null,
        densityAltitude: null,
        armed: false,
        monitoring: false,
        runwayEndpoint: null,
        headwindComponent: 0
    },

    // Monitoring interval
    monitoringInterval: null,

    /**
     * Initialize the application
     */
    init() {
        console.log('Initializing Takeoff Acceleration Warning System');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize warning system
        Warnings.init();
        
        // Update status bar
        this.updateStatusBar();
        
        console.log('Application initialized');
    },

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Airport search
        document.getElementById('search-airport-btn').addEventListener('click', () => {
            this.searchAirport();
        });

        // Enter key on airport search
        document.getElementById('airport-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchAirport();
            }
        });

        // Runway selection
        document.getElementById('runway-select').addEventListener('change', (e) => {
            this.selectRunway(e.target.value);
        });

        // Weather fetch
        document.getElementById('fetch-weather-btn').addEventListener('click', () => {
            this.fetchWeather();
        });

        // Vr input
        document.getElementById('vr-input').addEventListener('change', (e) => {
            this.updateVr(parseInt(e.target.value));
        });

        // Arm button
        document.getElementById('arm-btn').addEventListener('click', () => {
            this.armSystem();
        });

        // Disarm button
        document.getElementById('disarm-btn').addEventListener('click', () => {
            this.disarmSystem();
        });
    },

    /**
     * Search for airport by ICAO code
     */
    async searchAirport() {
        const input = document.getElementById('airport-search');
        const icao = input.value.trim().toUpperCase();
        const infoBox = document.getElementById('airport-info');

        if (!icao || icao.length !== 4) {
            this.showInfo(infoBox, 'Please enter a 4-letter ICAO code', 'error');
            return;
        }

        this.showInfo(infoBox, 'Searching...', '');

        const result = await API.fetchAirportData(icao);

        if (result.success) {
            this.state.airport = result.data;
            this.loadRunways(result.data.runways);
            this.showInfo(
                infoBox,
                `✓ ${result.data.name}<br>Elevation: ${result.data.elevation} ft`,
                'success'
            );
            
            // Enable weather fetch
            document.getElementById('fetch-weather-btn').disabled = false;
            
            this.updateStatusBar();
        } else {
            this.showInfo(infoBox, `✗ ${result.error}`, 'error');
        }
    },

    /**
     * Load runways into selector
     */
    loadRunways(runways) {
        const select = document.getElementById('runway-select');
        select.innerHTML = '<option value="">-- Select Runway --</option>';
        
        runways.forEach(runway => {
            const option = document.createElement('option');
            option.value = JSON.stringify(runway);
            option.textContent = `Runway ${runway.id} (${runway.length} ft)`;
            select.appendChild(option);
        });
        
        select.disabled = false;
    },

    /**
     * Select a runway
     */
    selectRunway(runwayJSON) {
        const infoBox = document.getElementById('runway-info');
        
        if (!runwayJSON) {
            this.state.runway = null;
            infoBox.classList.remove('active');
            this.checkArmingConditions();
            return;
        }

        const runway = JSON.parse(runwayJSON);
        this.state.runway = runway;

        this.showInfo(
            infoBox,
            `✓ Runway ${runway.id}<br>` +
            `Length: ${runway.length} ft<br>` +
            `Heading: ${runway.heading}°<br>` +
            `Width: ${runway.width} ft`,
            'success'
        );

        // Calculate runway endpoint
        if (this.state.airport) {
            this.state.runwayEndpoint = Calculations.calculateRunwayEnd(
                this.state.airport.lat,
                this.state.airport.lon,
                runway.heading,
                runway.length
            );
        }

        this.checkArmingConditions();
    },

    /**
     * Fetch weather data
     */
    async fetchWeather() {
        if (!this.state.airport) {
            return;
        }

        const infoBox = document.getElementById('weather-info');
        this.showInfo(infoBox, 'Fetching METAR...', '');

        const result = await API.fetchMETAR(this.state.airport.icao);

        if (result.success) {
            this.state.weather = result.data;
            
            let weatherHtml = `✓ METAR: ${result.raw}<br><br>`;
            
            if (result.data.windDirection !== null) {
                weatherHtml += `Wind: ${result.data.windDirection}° at ${result.data.windSpeed} kt`;
                if (result.data.windGust) {
                    weatherHtml += ` gusting ${result.data.windGust} kt`;
                }
                weatherHtml += '<br>';
            }
            
            if (result.data.temperature !== null) {
                weatherHtml += `Temperature: ${result.data.temperature}°C<br>`;
                weatherHtml += `Dewpoint: ${result.data.dewpoint}°C<br>`;
            }
            
            if (result.data.altimeter !== null) {
                weatherHtml += `Altimeter: ${result.data.altimeter.toFixed(2)} inHg<br>`;
            }
            
            if (result.simulated) {
                weatherHtml += '<br><em>⚠️ Simulated data (real METAR unavailable)</em>';
            }

            this.showInfo(infoBox, weatherHtml, 'success');
            this.checkArmingConditions();
        } else {
            this.showInfo(infoBox, `✗ ${result.error}`, 'error');
        }
    },

    /**
     * Update rotation speed
     */
    updateVr(vr) {
        const infoBox = document.getElementById('vr-info');
        
        if (!vr || vr < 40 || vr > 300) {
            this.state.vrIAS = null;
            infoBox.classList.remove('active');
            this.checkArmingConditions();
            return;
        }

        this.state.vrIAS = vr;

        // Calculate groundspeed if we have weather and airport data
        if (this.state.weather && this.state.runway && this.state.airport) {
            // Calculate wind component
            const windComp = Calculations.calculateWindComponents(
                this.state.weather.windDirection,
                this.state.weather.windSpeed,
                this.state.runway.heading
            );

            this.state.headwindComponent = windComp.headwind;

            // Calculate density altitude
            this.state.densityAltitude = Calculations.calculateDensityAltitude(
                this.state.airport.elevation,
                this.state.weather.temperature,
                this.state.weather.altimeter
            );

            // Calculate rotation groundspeed
            this.state.vrGroundspeed = Calculations.calculateRotationGroundspeed(
                vr,
                windComp.headwind,
                this.state.densityAltitude
            );

            let infoHtml = `✓ Vr (IAS): ${vr} kts<br>`;
            infoHtml += `Rotation Groundspeed: ${this.state.vrGroundspeed} kts<br>`;
            infoHtml += `Density Altitude: ${this.state.densityAltitude} ft<br>`;
            infoHtml += `Headwind Component: ${windComp.headwind > 0 ? '+' : ''}${windComp.headwind} kts<br>`;
            infoHtml += `Crosswind Component: ${windComp.crosswind > 0 ? '+' : ''}${windComp.crosswind} kts`;

            this.showInfo(infoBox, infoHtml, 'success');
        } else {
            this.showInfo(infoBox, `✓ Vr set to ${vr} kts (IAS)<br>Fetch weather to calculate groundspeed`, 'success');
        }

        this.checkArmingConditions();
    },

    /**
     * Check if system can be armed
     */
    checkArmingConditions() {
        const armBtn = document.getElementById('arm-btn');
        
        const canArm = this.state.airport !== null &&
                      this.state.runway !== null &&
                      this.state.weather !== null &&
                      this.state.vrIAS !== null;

        armBtn.disabled = !canArm;

        if (canArm) {
            armBtn.textContent = 'ARM SYSTEM';
        }
    },

    /**
     * Arm the monitoring system
     */
    async armSystem() {
        console.log('Arming system...');

        // Initialize sensors
        const gpsOk = await Sensors.initGPS(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handleSensorError(error)
        );

        if (!gpsOk) {
            alert('Failed to initialize GPS. Please enable location services and try again.');
            return;
        }

        const accelOk = Sensors.initAccelerometer(
            (accel) => this.handleAccelerationUpdate(accel)
        );

        if (!accelOk) {
            console.warn('Accelerometer initialization failed, continuing anyway');
        }

        // Update UI
        this.state.armed = true;
        this.state.monitoring = true;
        
        document.getElementById('config-panel').style.display = 'none';
        document.getElementById('monitor-panel').style.display = 'block';
        document.getElementById('arm-status').classList.add('armed');
        
        // Update required speed display
        document.getElementById('required-speed').textContent = 
            `${this.state.vrGroundspeed} kts`;

        // Start monitoring
        this.startMonitoring();
        
        this.updateStatusBar();
    },

    /**
     * Disarm the monitoring system
     */
    disarmSystem() {
        console.log('Disarming system...');

        this.state.armed = false;
        this.state.monitoring = false;

        // Stop sensors
        Sensors.reset();
        
        // Stop monitoring
        this.stopMonitoring();

        // Reset warnings
        Warnings.reset();

        // Update UI
        document.getElementById('config-panel').style.display = 'block';
        document.getElementById('monitor-panel').style.display = 'none';
        document.getElementById('arm-status').classList.remove('armed');

        this.updateStatusBar();
    },

    /**
     * Start monitoring loop
     */
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.updateMonitoring();
        }, 100); // Update 10 times per second
    },

    /**
     * Stop monitoring loop
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    },

    /**
     * Handle position updates from GPS
     */
    handlePositionUpdate(position) {
        // Position updates are stored in Sensors module
        // We'll process them in updateMonitoring()
    },

    /**
     * Handle acceleration updates
     */
    handleAccelerationUpdate(accel) {
        // Acceleration updates are stored in Sensors module
        // We'll process them in updateMonitoring()
    },

    /**
     * Handle sensor errors
     */
    handleSensorError(error) {
        console.error('Sensor error:', error);
        // Could show error in UI
    },

    /**
     * Update monitoring display and check conditions
     */
    updateMonitoring() {
        if (!this.state.monitoring) {
            return;
        }

        const position = Sensors.getCurrentPosition();
        
        if (!position || !this.state.runwayEndpoint) {
            return;
        }

        // Calculate distance to runway end
        const distanceRemaining = Calculations.calculateDistance(
            position.lat,
            position.lon,
            this.state.runwayEndpoint.lat,
            this.state.runwayEndpoint.lon
        );

        // Get current speed (from GPS or calculated)
        let currentSpeed = 0;
        if (position.speed !== null && position.speed !== undefined) {
            currentSpeed = position.speed / Calculations.constants.KNOTS_TO_MS;
        }

        // Get acceleration
        const acceleration = Sensors.getForwardAcceleration(position.heading || 0);

        // Update displays
        document.getElementById('current-speed').textContent = 
            `${Math.round(currentSpeed)} kts`;
        document.getElementById('distance-remaining').textContent = 
            `${Math.round(distanceRemaining)} ft`;
        document.getElementById('acceleration-value').textContent = 
            `${acceleration.toFixed(2)} m/s²`;

        // Analyze acceleration
        const analysis = Calculations.analyzeAcceleration(
            currentSpeed,
            this.state.vrGroundspeed,
            acceleration,
            distanceRemaining
        );

        // Update warnings
        Warnings.updateWarnings({
            accelerationSufficient: analysis.sufficient,
            distanceRemaining: distanceRemaining,
            currentSpeed: currentSpeed,
            targetSpeed: this.state.vrGroundspeed
        });
    },

    /**
     * Show info in an info box
     */
    showInfo(element, message, type) {
        element.innerHTML = message;
        element.classList.remove('success', 'error');
        element.classList.add('active');
        
        if (type) {
            element.classList.add(type);
        }
    },

    /**
     * Update status bar
     */
    updateStatusBar() {
        const gpsStatus = document.getElementById('gps-status');
        const gpsText = document.getElementById('gps-text');
        const sensorStatus = document.getElementById('sensor-status');
        const sensorText = document.getElementById('sensor-text');
        const dataStatus = document.getElementById('data-status');
        const dataText = document.getElementById('data-text');

        // GPS status
        if (Sensors.gpsActive) {
            gpsStatus.classList.add('active');
            gpsStatus.classList.remove('inactive');
            gpsText.textContent = 'GPS: Active';
        } else {
            gpsStatus.classList.remove('active');
            gpsStatus.classList.add('inactive');
            gpsText.textContent = 'GPS: Not Active';
        }

        // Sensor status
        if (Sensors.accelerometerActive) {
            sensorStatus.classList.add('active');
            sensorStatus.classList.remove('inactive');
            sensorText.textContent = 'Sensors: Active';
        } else {
            sensorStatus.classList.remove('active');
            sensorStatus.classList.add('inactive');
            sensorText.textContent = 'Sensors: Not Active';
        }

        // Data status
        const dataLoaded = this.state.airport && this.state.runway && this.state.weather && this.state.vrIAS;
        if (dataLoaded) {
            dataStatus.classList.add('active');
            dataStatus.classList.remove('inactive');
            dataText.textContent = 'Data: Loaded';
        } else {
            dataStatus.classList.remove('active');
            dataStatus.classList.add('inactive');
            dataText.textContent = 'Data: Not Loaded';
        }
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}

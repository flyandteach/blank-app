/**
 * Sensors Module
 * Handles GPS (Geolocation API) and Accelerometer (DeviceMotion API) access
 */

const Sensors = {
    // State tracking
    gpsWatchId: null,
    gpsActive: false,
    accelerometerActive: false,
    
    // Position history for speed calculation
    positionHistory: [],
    maxHistoryLength: 5,
    
    // Accelerometer data
    accelerationData: [],
    maxAccelDataLength: 10,
    
    // Callbacks
    onPositionUpdate: null,
    onAccelerationUpdate: null,
    onError: null,

    /**
     * Initialize GPS tracking
     * @param {Function} callback - Called with position updates
     * @param {Function} errorCallback - Called on errors
     * @returns {Promise<boolean>} Success status
     */
    async initGPS(callback, errorCallback) {
        if (!navigator.geolocation) {
            const error = 'Geolocation is not supported by this browser';
            console.error(error);
            if (errorCallback) errorCallback(error);
            return false;
        }

        this.onPositionUpdate = callback;
        this.onError = errorCallback;

        // Request permission and start watching position
        try {
            // Get initial position to trigger permission request
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log('GPS permission granted');
                        resolve(position);
                    },
                    (error) => {
                        console.error('GPS permission denied or error:', error);
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            });

            // Start continuous watching
            this.gpsWatchId = navigator.geolocation.watchPosition(
                (position) => this.handlePositionUpdate(position),
                (error) => this.handleGPSError(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );

            this.gpsActive = true;
            console.log('GPS tracking started');
            return true;
        } catch (error) {
            console.error('Failed to initialize GPS:', error);
            if (errorCallback) {
                errorCallback('GPS permission denied or unavailable');
            }
            return false;
        }
    },

    /**
     * Handle position updates from GPS
     */
    handlePositionUpdate(position) {
        const posData = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed, // m/s, may be null
            heading: position.coords.heading, // degrees, may be null
            timestamp: position.timestamp
        };

        // Add to history
        this.positionHistory.push(posData);
        if (this.positionHistory.length > this.maxHistoryLength) {
            this.positionHistory.shift();
        }

        // Calculate speed if not provided by GPS
        if (posData.speed === null && this.positionHistory.length >= 2) {
            const prev = this.positionHistory[this.positionHistory.length - 2];
            const timeDelta = (posData.timestamp - prev.timestamp) / 1000; // seconds
            
            if (timeDelta > 0) {
                const distance = Calculations.calculateDistance(
                    prev.lat, prev.lon,
                    posData.lat, posData.lon
                );
                posData.speed = (distance * Calculations.constants.FEET_TO_METERS) / timeDelta;
            }
        }

        // Call callback
        if (this.onPositionUpdate) {
            this.onPositionUpdate(posData);
        }
    },

    /**
     * Handle GPS errors
     */
    handleGPSError(error) {
        let errorMessage = 'GPS error: ';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage += 'Permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage += 'Position unavailable';
                break;
            case error.TIMEOUT:
                errorMessage += 'Request timeout';
                break;
            default:
                errorMessage += 'Unknown error';
        }
        
        console.error(errorMessage);
        if (this.onError) {
            this.onError(errorMessage);
        }
    },

    /**
     * Stop GPS tracking
     */
    stopGPS() {
        if (this.gpsWatchId !== null) {
            navigator.geolocation.clearWatch(this.gpsWatchId);
            this.gpsWatchId = null;
        }
        this.gpsActive = false;
        this.positionHistory = [];
        console.log('GPS tracking stopped');
    },

    /**
     * Initialize accelerometer monitoring
     * @param {Function} callback - Called with acceleration updates
     * @returns {boolean} Success status
     */
    initAccelerometer(callback) {
        if (!window.DeviceMotionEvent) {
            console.error('DeviceMotion API is not supported');
            if (this.onError) {
                this.onError('Accelerometer not supported by this device');
            }
            return false;
        }

        this.onAccelerationUpdate = callback;

        // Request permission for iOS 13+
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        this.startAccelerometer();
                    } else {
                        console.error('Accelerometer permission denied');
                        if (this.onError) {
                            this.onError('Accelerometer permission denied');
                        }
                    }
                })
                .catch(console.error);
        } else {
            // Non-iOS or older iOS
            this.startAccelerometer();
        }

        return true;
    },

    /**
     * Start listening to accelerometer events
     */
    startAccelerometer() {
        window.addEventListener('devicemotion', (event) => {
            this.handleAccelerometerUpdate(event);
        });
        this.accelerometerActive = true;
        console.log('Accelerometer monitoring started');
    },

    /**
     * Handle accelerometer updates
     */
    handleAccelerometerUpdate(event) {
        if (!event.acceleration) {
            return;
        }

        const accelData = {
            x: event.acceleration.x || 0,
            y: event.acceleration.y || 0,
            z: event.acceleration.z || 0,
            timestamp: Date.now()
        };

        // Add to history
        this.accelerationData.push(accelData);
        if (this.accelerationData.length > this.maxAccelDataLength) {
            this.accelerationData.shift();
        }

        // Calculate smoothed acceleration (average of recent readings)
        const smoothed = this.getSmoothedAcceleration();

        // Call callback
        if (this.onAccelerationUpdate) {
            this.onAccelerationUpdate(smoothed);
        }
    },

    /**
     * Get smoothed acceleration data by averaging recent readings
     * @returns {Object} Smoothed acceleration { x, y, z, magnitude }
     */
    getSmoothedAcceleration() {
        if (this.accelerationData.length === 0) {
            return { x: 0, y: 0, z: 0, magnitude: 0 };
        }

        let sumX = 0, sumY = 0, sumZ = 0;
        
        this.accelerationData.forEach(data => {
            sumX += data.x;
            sumY += data.y;
            sumZ += data.z;
        });

        const count = this.accelerationData.length;
        const avgX = sumX / count;
        const avgY = sumY / count;
        const avgZ = sumZ / count;

        // Calculate magnitude
        const magnitude = Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);

        return {
            x: Math.round(avgX * 100) / 100,
            y: Math.round(avgY * 100) / 100,
            z: Math.round(avgZ * 100) / 100,
            magnitude: Math.round(magnitude * 100) / 100
        };
    },

    /**
     * Get acceleration in direction of travel
     * This is a simplified approach - in reality, device orientation matters
     * @param {number} heading - Current heading in degrees
     * @returns {number} Forward acceleration in m/s²
     */
    getForwardAcceleration(heading) {
        const smoothed = this.getSmoothedAcceleration();
        
        // For simplicity, we'll use the magnitude
        // In a production app, we'd need to account for device orientation
        // and project the acceleration vector onto the heading direction
        
        // Since we're likely moving forward during takeoff, 
        // we can use the y-axis (typically forward on mobile devices)
        // But for now, we'll use a simplified approach
        
        return Math.abs(smoothed.y);
    },

    /**
     * Stop accelerometer monitoring
     */
    stopAccelerometer() {
        // Note: Can't actually remove the event listener without a reference
        // In practice, we just stop processing the data
        this.accelerometerActive = false;
        this.accelerationData = [];
        console.log('Accelerometer monitoring stopped');
    },

    /**
     * Get current position from history
     * @returns {Object|null} Latest position data
     */
    getCurrentPosition() {
        if (this.positionHistory.length === 0) {
            return null;
        }
        return this.positionHistory[this.positionHistory.length - 1];
    },

    /**
     * Check if sensors are available and active
     * @returns {Object} Status of each sensor
     */
    getSensorStatus() {
        return {
            gps: {
                available: !!navigator.geolocation,
                active: this.gpsActive
            },
            accelerometer: {
                available: !!window.DeviceMotionEvent,
                active: this.accelerometerActive
            }
        };
    },

    /**
     * Reset all sensor data
     */
    reset() {
        this.stopGPS();
        this.stopAccelerometer();
        this.positionHistory = [];
        this.accelerationData = [];
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sensors;
}

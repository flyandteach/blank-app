/**
 * Calculations Module
 * Handles all physics and performance calculations for takeoff monitoring
 */

const Calculations = {
    /**
     * Standard atmospheric constants
     */
    constants: {
        ISA_TEMP_SEA_LEVEL: 15, // °C
        ISA_PRESSURE_SEA_LEVEL: 29.92, // inHg
        TEMP_LAPSE_RATE: 1.98, // °C per 1000 ft
        GRAVITY: 9.81, // m/s²
        KNOTS_TO_MS: 0.514444, // Conversion factor
        FEET_TO_METERS: 0.3048, // Conversion factor
        METERS_TO_FEET: 3.28084 // Conversion factor
    },

    /**
     * Calculate headwind component from wind direction and runway heading
     * @param {number} windDirection - Wind direction in degrees (0-360)
     * @param {number} windSpeed - Wind speed in knots
     * @param {number} runwayHeading - Runway heading in degrees (0-360)
     * @returns {Object} Wind components { headwind, crosswind }
     */
    calculateWindComponents(windDirection, windSpeed, runwayHeading) {
        if (windDirection === null || windSpeed === null || runwayHeading === null) {
            return { headwind: 0, crosswind: 0 };
        }

        // Calculate angle between wind and runway
        let angleDiff = windDirection - runwayHeading;
        
        // Normalize to -180 to 180
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        // Convert to radians
        const angleRad = angleDiff * Math.PI / 180;

        // Calculate components
        const headwind = windSpeed * Math.cos(angleRad); // Positive = headwind, negative = tailwind
        const crosswind = windSpeed * Math.sin(angleRad);

        return {
            headwind: Math.round(headwind * 10) / 10,
            crosswind: Math.round(crosswind * 10) / 10
        };
    },

    /**
     * Calculate density altitude
     * @param {number} elevation - Airport elevation in feet
     * @param {number} temperature - Temperature in °C
     * @param {number} altimeter - Altimeter setting in inHg
     * @returns {number} Density altitude in feet
     */
    calculateDensityAltitude(elevation, temperature, altimeter) {
        // Calculate pressure altitude
        const pressureAltitude = elevation + ((29.92 - altimeter) * 1000);
        
        // Calculate ISA temperature at pressure altitude
        const isaTemp = this.constants.ISA_TEMP_SEA_LEVEL - 
                       (this.constants.TEMP_LAPSE_RATE * pressureAltitude / 1000);
        
        // Calculate density altitude
        const tempDeviation = temperature - isaTemp;
        const densityAltitude = pressureAltitude + (120 * tempDeviation);
        
        return Math.round(densityAltitude);
    },

    /**
     * Calculate true airspeed from indicated airspeed
     * @param {number} ias - Indicated airspeed in knots
     * @param {number} densityAltitude - Density altitude in feet
     * @returns {number} True airspeed in knots
     */
    calculateTAS(ias, densityAltitude) {
        // Simplified TAS calculation: TAS = IAS * sqrt(density ratio)
        // At sea level, density ratio = 1
        // Approximate: TAS increases by ~2% per 1000 ft density altitude
        const correction = 1 + (densityAltitude / 1000) * 0.02;
        return Math.round(ias * correction * 10) / 10;
    },

    /**
     * Calculate rotation groundspeed
     * @param {number} vrIAS - Rotation speed (indicated airspeed) in knots
     * @param {number} headwindComponent - Headwind component in knots (positive = headwind)
     * @param {number} densityAltitude - Density altitude in feet
     * @returns {number} Rotation groundspeed in knots
     */
    calculateRotationGroundspeed(vrIAS, headwindComponent, densityAltitude) {
        // Calculate TAS from IAS
        const vrTAS = this.calculateTAS(vrIAS, densityAltitude);
        
        // Groundspeed = TAS - headwind (subtract because headwind reduces groundspeed)
        const groundspeed = vrTAS - headwindComponent;
        
        return Math.round(groundspeed * 10) / 10;
    },

    /**
     * Calculate distance to runway end from current position
     * @param {number} currentLat - Current latitude
     * @param {number} currentLon - Current longitude
     * @param {number} runwayEndLat - Runway end latitude
     * @param {number} runwayEndLon - Runway end longitude
     * @returns {number} Distance in feet
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula
        const R = 6371000; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                 Math.cos(φ1) * Math.cos(φ2) *
                 Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distanceMeters = R * c;
        const distanceFeet = distanceMeters * this.constants.METERS_TO_FEET;
        
        return Math.round(distanceFeet);
    },

    /**
     * Calculate bearing between two points
     * @param {number} lat1 - Start latitude
     * @param {number} lon1 - Start longitude
     * @param {number} lat2 - End latitude
     * @param {number} lon2 - End longitude
     * @returns {number} Bearing in degrees (0-360)
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) -
                 Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360;
        
        return Math.round(bearing);
    },

    /**
     * Calculate runway end coordinates from start point, heading, and length
     * @param {number} lat - Runway start latitude
     * @param {number} lon - Runway start longitude
     * @param {number} heading - Runway heading in degrees
     * @param {number} lengthFeet - Runway length in feet
     * @returns {Object} End coordinates { lat, lon }
     */
    calculateRunwayEnd(lat, lon, heading, lengthFeet) {
        const R = 6371000; // Earth radius in meters
        const lengthMeters = lengthFeet * this.constants.FEET_TO_METERS;
        const bearingRad = heading * Math.PI / 180;
        const φ1 = lat * Math.PI / 180;
        const λ1 = lon * Math.PI / 180;

        const φ2 = Math.asin(
            Math.sin(φ1) * Math.cos(lengthMeters / R) +
            Math.cos(φ1) * Math.sin(lengthMeters / R) * Math.cos(bearingRad)
        );

        const λ2 = λ1 + Math.atan2(
            Math.sin(bearingRad) * Math.sin(lengthMeters / R) * Math.cos(φ1),
            Math.cos(lengthMeters / R) - Math.sin(φ1) * Math.sin(φ2)
        );

        return {
            lat: φ2 * 180 / Math.PI,
            lon: λ2 * 180 / Math.PI
        };
    },

    /**
     * Check if current acceleration is sufficient to reach rotation speed
     * @param {number} currentSpeed - Current groundspeed in knots
     * @param {number} targetSpeed - Target rotation groundspeed in knots
     * @param {number} acceleration - Current acceleration in m/s²
     * @param {number} distanceRemaining - Distance remaining in feet
     * @returns {Object} Analysis { sufficient, requiredAcceleration, timeToRotation }
     */
    analyzeAcceleration(currentSpeed, targetSpeed, acceleration, distanceRemaining) {
        // Convert speeds to m/s
        const v0 = currentSpeed * this.constants.KNOTS_TO_MS;
        const vf = targetSpeed * this.constants.KNOTS_TO_MS;
        
        // Convert distance to meters
        const distance = distanceRemaining * this.constants.FEET_TO_METERS;

        // Calculate required acceleration using: v² = u² + 2as
        // a = (v² - u²) / (2s)
        const requiredAcceleration = (vf * vf - v0 * v0) / (2 * distance);

        // Calculate time to rotation at current acceleration (if positive)
        let timeToRotation = null;
        if (acceleration > 0 && vf > v0) {
            // t = (v - u) / a
            timeToRotation = (vf - v0) / acceleration;
        }

        // Calculate distance needed at current acceleration
        let distanceNeeded = Infinity;
        if (acceleration > 0 && vf > v0) {
            // s = (v² - u²) / (2a)
            distanceNeeded = (vf * vf - v0 * v0) / (2 * acceleration);
            distanceNeeded *= this.constants.METERS_TO_FEET; // Convert to feet
        }

        return {
            sufficient: acceleration >= requiredAcceleration && acceleration > 0,
            requiredAcceleration: Math.round(requiredAcceleration * 100) / 100,
            currentAcceleration: Math.round(acceleration * 100) / 100,
            timeToRotation: timeToRotation ? Math.round(timeToRotation * 10) / 10 : null,
            distanceNeeded: Math.round(distanceNeeded)
        };
    },

    /**
     * Calculate groundspeed from GPS coordinates over time
     * @param {number} lat1 - Previous latitude
     * @param {number} lon1 - Previous longitude
     * @param {number} lat2 - Current latitude
     * @param {number} lon2 - Current longitude
     * @param {number} timeDelta - Time elapsed in seconds
     * @returns {number} Groundspeed in knots
     */
    calculateGroundspeed(lat1, lon1, lat2, lon2, timeDelta) {
        if (timeDelta <= 0) return 0;

        const distanceMeters = this.calculateDistance(lat1, lon1, lat2, lon2) * 
                              this.constants.FEET_TO_METERS;
        
        const speedMS = distanceMeters / timeDelta;
        const speedKnots = speedMS / this.constants.KNOTS_TO_MS;
        
        return Math.round(speedKnots * 10) / 10;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculations;
}

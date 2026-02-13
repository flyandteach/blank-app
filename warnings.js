/**
 * Warnings Module
 * Handles visual and audio warning system
 */

const Warnings = {
    // Warning state
    warningActive: false,
    criticalWarningActive: false,
    
    // Speech synthesis
    speechSynthesis: window.speechSynthesis,
    voiceEnabled: true,
    
    // Warning intervals
    normalWarningInterval: null,
    criticalWarningInterval: null,
    
    // Timing
    lastWarningTime: 0,
    normalWarningDelay: 5000, // 5 seconds
    criticalWarningDelay: 1000, // 1 second
    criticalDistanceThreshold: 1000, // feet

    /**
     * Initialize warning system
     * @returns {boolean} Success status
     */
    init() {
        // Check if speech synthesis is available
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not available');
            this.voiceEnabled = false;
            return false;
        }

        // Test speech synthesis
        try {
            const testUtterance = new SpeechSynthesisUtterance('');
            this.speechSynthesis.speak(testUtterance);
            this.speechSynthesis.cancel();
            console.log('Warning system initialized');
            return true;
        } catch (error) {
            console.error('Speech synthesis error:', error);
            this.voiceEnabled = false;
            return false;
        }
    },

    /**
     * Update warning state based on current conditions
     * @param {Object} conditions - Current flight conditions
     */
    updateWarnings(conditions) {
        const {
            accelerationSufficient,
            distanceRemaining,
            currentSpeed,
            targetSpeed
        } = conditions;

        // Determine if we need warnings
        const needsWarning = !accelerationSufficient && currentSpeed < targetSpeed;
        const isCritical = distanceRemaining < this.criticalDistanceThreshold;

        // Update visual warnings
        this.updateVisualWarning(needsWarning, isCritical, distanceRemaining);

        // Update audio warnings
        if (needsWarning) {
            if (isCritical && !this.criticalWarningActive) {
                this.startCriticalWarning();
            } else if (!isCritical && !this.warningActive) {
                this.startNormalWarning();
            }
        } else {
            this.stopAllWarnings();
        }
    },

    /**
     * Update visual warning display
     * @param {boolean} warning - Whether warning should be active
     * @param {boolean} critical - Whether warning is critical
     * @param {number} distance - Distance remaining
     */
    updateVisualWarning(warning, critical, distance) {
        const warningDisplay = document.getElementById('warning-display');
        const warningMessage = document.getElementById('warning-message');
        const body = document.body;

        if (!warningDisplay || !warningMessage) {
            return;
        }

        if (warning) {
            warningDisplay.classList.remove('normal');
            warningDisplay.classList.add('warning');
            
            if (critical) {
                warningMessage.innerHTML = `
                    <div style="color: #e74c3c; font-size: 2rem; font-weight: bold;">
                        ⚠️ CRITICAL WARNING ⚠️
                    </div>
                    <div style="margin-top: 1rem; font-size: 1.3rem;">
                        INSUFFICIENT ACCELERATION
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 1.1rem;">
                        ${Math.round(distance)} feet remaining
                    </div>
                    <div style="margin-top: 1rem; font-size: 1rem; color: #ff6b6b;">
                        CONSIDER ABORT
                    </div>
                `;
                body.style.backgroundColor = '#4a1010';
            } else {
                warningMessage.innerHTML = `
                    <div style="color: #e74c3c; font-size: 1.8rem; font-weight: bold;">
                        ⚠️ WARNING ⚠️
                    </div>
                    <div style="margin-top: 1rem; font-size: 1.2rem;">
                        ACCELERATION INSUFFICIENT
                    </div>
                    <div style="margin-top: 0.5rem;">
                        ${Math.round(distance)} feet remaining
                    </div>
                `;
                body.style.backgroundColor = '#3a1a1a';
            }
        } else {
            warningDisplay.classList.remove('warning');
            warningDisplay.classList.add('normal');
            warningMessage.innerHTML = `
                <div style="color: #2ecc71; font-size: 1.5rem; font-weight: bold;">
                    ✓ ACCELERATION NORMAL
                </div>
                <div style="margin-top: 0.5rem; font-size: 1rem;">
                    System monitoring active
                </div>
            `;
            body.style.backgroundColor = '';
        }
    },

    /**
     * Start normal warning announcements (every 5 seconds)
     */
    startNormalWarning() {
        if (this.warningActive) {
            return;
        }

        console.log('Starting normal warnings');
        this.warningActive = true;
        this.criticalWarningActive = false;

        // Clear any existing intervals
        if (this.criticalWarningInterval) {
            clearInterval(this.criticalWarningInterval);
            this.criticalWarningInterval = null;
        }

        // Speak immediately
        this.speakWarning('ACCELERATION');

        // Set up interval for repeated warnings
        this.normalWarningInterval = setInterval(() => {
            this.speakWarning('ACCELERATION');
        }, this.normalWarningDelay);
    },

    /**
     * Start critical warning announcements (every 1 second)
     */
    startCriticalWarning() {
        console.log('Starting critical warnings');
        this.warningActive = false;
        this.criticalWarningActive = true;

        // Clear any existing intervals
        if (this.normalWarningInterval) {
            clearInterval(this.normalWarningInterval);
            this.normalWarningInterval = null;
        }

        // Speak immediately
        this.speakWarning('ACCELERATION');

        // Set up interval for rapid warnings
        this.criticalWarningInterval = setInterval(() => {
            this.speakWarning('ACCELERATION');
        }, this.criticalWarningDelay);
    },

    /**
     * Speak a warning message
     * @param {string} message - Message to speak
     */
    speakWarning(message) {
        if (!this.voiceEnabled || !this.speechSynthesis) {
            return;
        }

        // Cancel any ongoing speech
        this.speechSynthesis.cancel();

        // Create and speak new utterance
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.2; // Slightly faster for urgency
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Try to use a male voice if available (more authoritative)
        const voices = this.speechSynthesis.getVoices();
        if (voices.length > 0) {
            // Look for male voices with common names
            const maleVoice = voices.find(voice => 
                voice.name.includes('Male') || 
                voice.name.includes('male') ||
                voice.name.includes('Daniel') ||
                voice.name.includes('James') ||
                voice.name.includes('David')
            );
            
            // Fall back to any English voice if no male voice found
            const englishVoice = voices.find(voice => 
                voice.lang.startsWith('en')
            );
            
            utterance.voice = maleVoice || englishVoice || voices[0];
        }

        this.speechSynthesis.speak(utterance);
    },

    /**
     * Stop all warnings
     */
    stopAllWarnings() {
        if (!this.warningActive && !this.criticalWarningActive) {
            return;
        }

        console.log('Stopping all warnings');
        
        this.warningActive = false;
        this.criticalWarningActive = false;

        // Clear intervals
        if (this.normalWarningInterval) {
            clearInterval(this.normalWarningInterval);
            this.normalWarningInterval = null;
        }

        if (this.criticalWarningInterval) {
            clearInterval(this.criticalWarningInterval);
            this.criticalWarningInterval = null;
        }

        // Cancel speech
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
    },

    /**
     * Enable or disable voice warnings
     * @param {boolean} enabled - Whether to enable voice
     */
    setVoiceEnabled(enabled) {
        this.voiceEnabled = enabled;
        if (!enabled && this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
    },

    /**
     * Test the warning system
     */
    testWarning() {
        console.log('Testing warning system');
        this.speakWarning('Warning system test');
    },

    /**
     * Reset warning system
     */
    reset() {
        this.stopAllWarnings();
        
        // Reset visual display
        const warningDisplay = document.getElementById('warning-display');
        const warningMessage = document.getElementById('warning-message');
        const body = document.body;

        if (warningDisplay && warningMessage) {
            warningDisplay.classList.remove('warning', 'normal');
            warningMessage.innerHTML = '';
            body.style.backgroundColor = '';
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Warnings;
}

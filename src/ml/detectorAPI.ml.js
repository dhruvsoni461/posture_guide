/**
 * Detector API for Real-time Posture Detection - FINAL STRICT VERSION
 * 30-second windows, strict thresholds, ensemble decisions, reliable voice alerts
 *
 * HOW TO WIRE setUserGesture() FROM UI:
 *   Call setUserGesture() once after any button click to enable voice alerts.
 */

import { DEFAULT_CONFIG } from './constants.ml.js';
import { computeFeaturesFromKeypoints, hasValidPose, normalizeFeatures, computeWindowStatistics } from './poseUtils.ml.js';
import { loadModel, predict } from './modelService.ml.js';
import { loadModelMeta } from './storage.ml.js';

class PostureDetector {
  constructor() {
    this.getKeypoints = null;
    this.onAlert = null;
    this.onUpdate = null;
    this.onDebug = null;
    this.config = { ...DEFAULT_CONFIG };

    this.model = null;
    this.normalizationStats = null;
    this.baselineAngle = null;
    this.isRunning = false;
    this.detectionTimer = null;

    this.windowHistory = [];
    this.currentWindow = [];
    this.windowStartTime = null;
    this.windowIndex = 0;

    this.lastAlertTime = 0;
    this.isMuted = false;
    this.snoozeUntil = 0;
    this.userGestureAllowed = false;
    this.badPersistenceMs = 0;

    this.debug = false;
    this.featureStats = this.createFeatureStats();
    this.personalizedThresholds = null;
  }

  async init({ getKeypoints, onAlert, onUpdate, onDebug, config = {} } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debug = this.config.DEBUG || false;

    if (getKeypoints && typeof getKeypoints === 'function') {
      this.getKeypoints = getKeypoints;
    } else {
      this.getKeypoints = this.autoDetectKeypointSource();
    }

    this.onAlert = onAlert || this.defaultAlertHandler.bind(this);
    this.onUpdate = onUpdate || ((msg) => { if (this.debug) console.log('[Detector]', msg); });
    this.onDebug = onDebug || ((msg) => { if (this.debug) console.log('[Detector Debug]', msg); });

    if (!this.getKeypoints) {
      const msg = 'No keypoint source found. Detector will not function properly.';
      this.onUpdate(msg);
      console.warn(msg);
      return false;
    }

    await this.loadTrainedModel();

    this.onUpdate(`Detector initialized (${this.model ? 'ML model' : 'fallback threshold'} mode)`);
    return true;
  }

  autoDetectKeypointSource() {
    if (typeof window === 'undefined') return null;
    if (typeof window.getLatestKeypoints === 'function') {
      if (this.debug) console.log('[Detector] Using window.getLatestKeypoints()');
      return window.getLatestKeypoints;
    }
    if (window.__LATEST_KEYPOINTS__) {
      if (this.debug) console.log('[Detector] Using window.__LATEST_KEYPOINTS__');
      return () => window.__LATEST_KEYPOINTS__;
    }
    return null;
  }

  async loadTrainedModel() {
    try {
      this.model = await loadModel();
      if (this.model) {
        const metadata = await loadModelMeta();
        if (metadata) {
          this.normalizationStats = metadata.normalizationStats;
          this.baselineAngle = metadata.baselineAngle || this.config.BASELINE_ANGLE;
        }
        this.onUpdate('ML model loaded successfully');
      } else {
        this.baselineAngle = this.config.BASELINE_ANGLE;
        this.onUpdate('Using fallback threshold-based detection');
      }
    } catch (error) {
      console.warn('Failed to load model:', error);
      this.baselineAngle = this.config.BASELINE_ANGLE;
      this.onUpdate('Model load failed, using fallback');
    }
  }

  setUserGesture() {
    this.userGestureAllowed = true;
    this.onUpdate('User gesture enabled - voice alerts ready');
    if ('speechSynthesis' in window) {
      speechSynthesis.getVoices();
    }
  }

  async startDetector() {
    if (!this.getKeypoints) {
      throw new Error('Detector not initialized. Call init() first.');
    }
    if (this.isRunning) {
      this.onUpdate('Detector already running');
      return;
    }

    this.isRunning = true;
    this.windowHistory = [];
    this.currentWindow = [];
    this.windowStartTime = Date.now();
    this.windowIndex = 0;
    this.badPersistenceMs = 0;
    this.featureStats = this.createFeatureStats();
    this.personalizedThresholds = null;
    this.lastClassification = null; // For hysteresis

    this.onUpdate(`Detector started (window: ${this.config.SAMPLING_WINDOW_MS/1000}s, ${this.config.FPS_DURING_WINDOW} FPS)`);

    this.startDetectionLoop();
  }

  stopDetector() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }
    this.currentWindow = [];
    this.windowStartTime = null;
    this.onUpdate('Detector stopped');
  }

  startDetectionLoop() {
    const intervalMs = this.config.FRAME_INTERVAL_MS;
    this.detectionTimer = setInterval(() => {
      if (!this.isRunning) return;
      this.collectSample();
      this.checkWindowComplete();
    }, intervalMs);
  }

  collectSample() {
    try {
      const keypoints = this.getKeypoints();
      if (!keypoints) return;
      if (this.containsImageData(keypoints)) {
        if (this.debug) this.onDebug('Frame rejected: contains image data');
        return;
      }
      if (!hasValidPose(keypoints, this.config.MIN_CONFIDENCE)) {
        if (this.debug) this.onDebug('Frame rejected: low confidence or invalid pose');
        return;
      }
      const result = computeFeaturesFromKeypoints(keypoints, this.baselineAngle);
      if (!result.features || result.confidence < this.config.MIN_CONFIDENCE) {
        if (this.debug) this.onDebug('Frame rejected: feature extraction failed');
        return;
      }
      const angle = result.metadata.spineAngle;
      if (angle < this.config.MIN_ANGLE || angle > this.config.MAX_ANGLE) {
        if (this.debug) this.onDebug(`Frame rejected: invalid angle ${angle}°`);
        return;
      }
      const weight = Math.max(0.001, result.metadata.frameQuality ?? result.confidence);
      if (weight < this.config.MIN_ALIGNMENT_SCORE) {
        if (this.debug) this.onDebug('Frame rejected: poor alignment');
        return;
      }
      this.currentWindow.push({
        features: result.features,
        confidence: result.confidence,
        angle: result.metadata.spineAngle,
        angleRel: result.metadata.spineAngleRel,
        timestamp: Date.now(),
        metadata: result.metadata,
        weight
      });
      this.updateFeatureStats(result.features);
    } catch (error) {
      if (this.debug) console.warn('Sample collection failed:', error);
    }
  }

  containsImageData(data) {
    if (typeof data === 'string') {
      return data.includes('data:image') || data.includes('base64') || data.length > 10000;
    }
    if (typeof data === 'object') {
      try {
        const str = JSON.stringify(data);
        return str.includes('data:image') || str.includes('base64') || str.length > 10000;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  checkWindowComplete() {
    const now = Date.now();
    if (!this.windowStartTime) {
      this.windowStartTime = now;
      return;
    }
    if ((now - this.windowStartTime) >= this.config.SAMPLING_WINDOW_MS) {
      this.processWindow();
      this.currentWindow = [];
      this.windowStartTime = now;
      this.windowIndex++;
    }
  }

  async processWindow() {
    if (this.currentWindow.length < this.config.MIN_VALID_FRAMES) {
      const status = {
        windowLabel: DEFAULT_CONFIG.LABELS.INSUFFICIENT,
        windowIndex: this.windowIndex,
        validFrames: this.currentWindow.length,
        avgAngle: null,
        avgAngleRel: null,
        medianAngleRel: null,
        stdAngleRel: null,
        modelProbabilities: null,
        reason: `Insufficient frames: ${this.currentWindow.length} < ${this.config.MIN_VALID_FRAMES}`
      };
      this.onUpdate(status);
      return;
    }

    try {
      const stats = computeWindowStatistics(this.currentWindow);
      if (!stats) {
        this.onUpdate({
          windowLabel: DEFAULT_CONFIG.LABELS.INSUFFICIENT,
          windowIndex: this.windowIndex,
          validFrames: this.currentWindow.length,
          reason: 'Failed to compute window statistics'
        });
        return;
      }

      const medianAngleRel = stats.median;
      let windowLabel;
      let modelProbs = null;

      const normalizationStats = this.normalizationStats || this.featureStatsToNormalization();

      if (this.model && normalizationStats) {
        const avgFeatures = this.averageFeatures(this.currentWindow);
        const normalizedFeatures = normalizeFeatures(avgFeatures, normalizationStats);
        const modelPrediction = await predict(this.model, normalizedFeatures);

        modelProbs = {
          good: modelPrediction.probs[0] || 0,
          slouch: modelPrediction.probs[1] || 0
        };

        const thresholdLabel = this.thresholdClassification(medianAngleRel);

        if (modelPrediction.label === DEFAULT_CONFIG.LABELS.SLOUCH && thresholdLabel === DEFAULT_CONFIG.LABELS.BAD) {
          windowLabel = DEFAULT_CONFIG.LABELS.BAD;
        } else {
          const modelBadScore = modelProbs.slouch * this.config.MODEL_WEIGHT;
          const thresholdBadScore = (thresholdLabel === DEFAULT_CONFIG.LABELS.BAD ? 1 : 0) * this.config.THRESHOLD_WEIGHT;
          const combinedBadScore = modelBadScore + thresholdBadScore;
          if (combinedBadScore > 0.5) {
            windowLabel = DEFAULT_CONFIG.LABELS.BAD;
          } else if (thresholdLabel === DEFAULT_CONFIG.LABELS.MILD) {
            windowLabel = DEFAULT_CONFIG.LABELS.MILD;
          } else {
            windowLabel = DEFAULT_CONFIG.LABELS.GOOD;
          }
        }
      } else {
        windowLabel = this.thresholdClassification(medianAngleRel);
      }

      if (windowLabel === DEFAULT_CONFIG.LABELS.GOOD && stats.absolute) {
        this.updateAdaptiveBaseline(stats);
      }

      const windowStatus = {
        windowLabel,
        windowIndex: this.windowIndex,
        validFrames: this.currentWindow.length,
        avgAngle: (stats.absolute?.mean ?? stats.mean).toFixed(1),
        avgAngleRel: stats.mean.toFixed(1),
        medianAngleRel: stats.median.toFixed(1),
        stdAngleRel: stats.std.toFixed(1),
        modelProbabilities: modelProbs,
        reason: `Median angle: ${stats.median.toFixed(1)}°, Label: ${windowLabel}`
      };

      this.windowHistory.push({ label: windowLabel, timestamp: Date.now(), status: windowStatus, stats });

      if (this.windowHistory.length > this.config.WINDOWS_HISTORY) {
        this.windowHistory.shift();
      }

      this.onUpdate(windowStatus);

      this.badPersistenceMs = this.windowHistory.reduce((sum, window) => {
        return window.label === DEFAULT_CONFIG.LABELS.BAD ? sum + this.config.SAMPLING_WINDOW_MS : sum;
      }, 0);

      this.checkForAlert();

    } catch (error) {
      console.warn('Window processing failed:', error);
      if (this.debug) this.onDebug(`Window processing error: ${error.message}`);
    }
  }

  averageFeatures(samples) {
    const featureCount = samples[0].features.length;
    const avgFeatures = new Array(featureCount).fill(0);
    samples.forEach(sample => {
      sample.features.forEach((value, i) => {
        avgFeatures[i] += value;
      });
    });
    return avgFeatures.map(sum => sum / samples.length);
  }

  thresholdClassification(angleRel) {
    const thresholds = this.getThresholds();
    
    // Add hysteresis to prevent rapid switching
    // If current label exists, require larger change to switch
    const currentLabel = this.lastClassification || null;
    const goodThreshold = thresholds.good || DEFAULT_CONFIG.GOOD_THRESHOLD;
    const mildThreshold = thresholds.mild || DEFAULT_CONFIG.MILD_THRESHOLD;
    const badThreshold = thresholds.bad || DEFAULT_CONFIG.BAD_THRESHOLD;
    
    // Hysteresis: require 1-2° more to switch from good to bad
    const hysteresis = 1.5;
    
    if (currentLabel === DEFAULT_CONFIG.LABELS.GOOD) {
      // If currently good, require higher angle to switch to bad
      if (angleRel <= mildThreshold + hysteresis) {
        return DEFAULT_CONFIG.LABELS.GOOD;
      } else if (angleRel <= badThreshold + hysteresis) {
        return DEFAULT_CONFIG.LABELS.MILD;
      } else {
        this.lastClassification = DEFAULT_CONFIG.LABELS.BAD;
        return DEFAULT_CONFIG.LABELS.BAD;
      }
    } else if (currentLabel === DEFAULT_CONFIG.LABELS.MILD) {
      // If currently mild, easier to go to bad, harder to go back to good
      if (angleRel <= goodThreshold) {
        this.lastClassification = DEFAULT_CONFIG.LABELS.GOOD;
        return DEFAULT_CONFIG.LABELS.GOOD;
      } else if (angleRel <= badThreshold) {
        return DEFAULT_CONFIG.LABELS.MILD;
      } else {
        this.lastClassification = DEFAULT_CONFIG.LABELS.BAD;
        return DEFAULT_CONFIG.LABELS.BAD;
      }
    } else {
      // If currently bad or null, use normal thresholds
      if (angleRel <= goodThreshold) {
        this.lastClassification = DEFAULT_CONFIG.LABELS.GOOD;
        return DEFAULT_CONFIG.LABELS.GOOD;
      } else if (angleRel <= mildThreshold) {
        this.lastClassification = DEFAULT_CONFIG.LABELS.MILD;
        return DEFAULT_CONFIG.LABELS.MILD;
      } else {
        this.lastClassification = DEFAULT_CONFIG.LABELS.BAD;
        return DEFAULT_CONFIG.LABELS.BAD;
      }
    }
  }

  checkForAlert() {
    const now = Date.now();
    
    // Simplified alert logic: Check if we have enough bad windows
    if (this.windowHistory.length < 2) return; // Need at least 2 windows
    
    const recentWindows = this.windowHistory.slice(-this.config.WINDOWS_HISTORY || 3);
    const badWindows = recentWindows.filter(w => w.label === DEFAULT_CONFIG.LABELS.BAD);
    const badCount = badWindows.length;
    
    // Alert if: 2+ consecutive bad windows OR 2+ bad windows in last 3 windows
    const consecutiveBad = recentWindows.length >= 2 && 
      recentWindows[recentWindows.length - 1].label === DEFAULT_CONFIG.LABELS.BAD &&
      recentWindows[recentWindows.length - 2].label === DEFAULT_CONFIG.LABELS.BAD;
    
    const votesMet = badCount >= (this.config.WINDOWS_VOTES_REQUIRED || 2);
    const persistenceMet = this.badPersistenceMs >= (this.config.PERSIST_MS || 8000);
    const cooldownMet = (now - this.lastAlertTime) >= (this.config.ALERT_COOLDOWN_MS || 30000);
    const notSnoozed = !this.isMuted && now > this.snoozeUntil;

    // Trigger alert if we have consecutive bad OR enough bad windows with persistence
    if ((consecutiveBad || votesMet) && persistenceMet && cooldownMet && notSnoozed) {
      this.lastAlertTime = now;
      this.triggerAlert();
    }
  }

  triggerAlert() {
    const alertData = { label: DEFAULT_CONFIG.LABELS.BAD, message: this.config.VOICE_MESSAGE, timestamp: Date.now() };

    try { this.onAlert(alertData); } catch (error) { console.warn('Alert callback failed:', error); }

    // Always play alert sound (not just voice)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 800; // Alert tone
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.6);
      setTimeout(() => ctx.close?.(), 700);
    } catch (e) {
      console.warn('Alert sound failed:', e);
    }

    // Also play voice if enabled
    if (this.userGestureAllowed && 'speechSynthesis' in window) {
      try {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(this.config.VOICE_MESSAGE);
        utterance.rate = this.config.VOICE_RATE;
        utterance.pitch = this.config.VOICE_PITCH;
        utterance.volume = this.config.VOICE_VOLUME;
        const voices = speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => voice.lang.startsWith('en') && (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('samantha'))) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.onerror = (event) => { console.warn('Speech synthesis error:', event.error); };
        // Delay voice slightly after beep
        setTimeout(() => {
          speechSynthesis.speak(utterance);
        }, 700);
        this.onUpdate(`Voice alert: ${this.config.VOICE_MESSAGE}`);
      } catch (error) {
        console.warn('Speech synthesis failed:', error);
      }
    } else {
      if (!this.userGestureAllowed) {
        this.onUpdate('Voice alert skipped: user gesture not enabled. Call setUserGesture() after button click.');
      }
    }
  }

  defaultAlertHandler(alertData) { console.log('🔔 POSTURE ALERT:', alertData.message); }

  async forceInferOnce() {
    if (!this.getKeypoints) throw new Error('Detector not initialized');
    const keypoints = this.getKeypoints();
    if (!keypoints || !hasValidPose(keypoints, this.config.MIN_CONFIDENCE)) return { error: 'No valid pose detected' };
    const result = computeFeaturesFromKeypoints(keypoints, this.baselineAngle);
    if (!result.features) return { error: 'Feature extraction failed' };
    const classification = this.thresholdClassification(result.metadata.spineAngleRel);
    return {
      label: classification,
      confidence: result.confidence,
      angle: result.metadata.spineAngle,
      angleRel: result.metadata.spineAngleRel,
      features: result.features,
      metadata: result.metadata
    };
  }

  isModelLoaded() { return this.model !== null; }

  mute(muted = true) { this.isMuted = muted; this.onUpdate(`Alerts ${muted ? 'muted' : 'unmuted'}`); }

  snooze(minutes = 10) { this.snoozeUntil = Date.now() + (minutes * 60 * 1000); this.onUpdate(`Alerts snoozed for ${minutes} minutes`); }

  getStatus() {
    return {
      running: this.isRunning,
      modelLoaded: this.isModelLoaded(),
      muted: this.isMuted,
      snoozed: Date.now() < this.snoozeUntil,
      userGestureAllowed: this.userGestureAllowed,
      windowHistory: this.windowHistory.length,
      badPersistenceMs: this.badPersistenceMs
    };
  }

  createFeatureStats() {
    return {
      count: 0,
      means: new Array(DEFAULT_CONFIG.FEATURE_COUNT).fill(0),
      m2: new Array(DEFAULT_CONFIG.FEATURE_COUNT).fill(0),
      stds: new Array(DEFAULT_CONFIG.FEATURE_COUNT).fill(1)
    };
  }

  updateFeatureStats(features) {
    if (!features || features.length !== DEFAULT_CONFIG.FEATURE_COUNT) return;
    this.featureStats.count += 1;
    features.forEach((value, idx) => {
      const delta = value - this.featureStats.means[idx];
      this.featureStats.means[idx] += delta / this.featureStats.count;
      const delta2 = value - this.featureStats.means[idx];
      this.featureStats.m2[idx] += delta * delta2;
      this.featureStats.stds[idx] = this.featureStats.count > 1
        ? Math.sqrt(this.featureStats.m2[idx] / (this.featureStats.count - 1))
        : 1;
    });
  }

  featureStatsToNormalization() {
    if (!this.featureStats || this.featureStats.count < DEFAULT_CONFIG.MIN_VALID_FRAMES) return null;
    return {
      means: this.featureStats.means,
      stds: this.featureStats.stds.map(std => std === 0 ? 1 : std)
    };
  }

  updateAdaptiveBaseline(stats) {
    const absoluteMedian = stats.absolute?.median;
    if (!isFinite(absoluteMedian)) return;
    if (this.baselineAngle == null) {
      this.baselineAngle = absoluteMedian;
    } else {
      this.baselineAngle = (1 - this.config.BASELINE_UPDATE_ALPHA) * this.baselineAngle + this.config.BASELINE_UPDATE_ALPHA * absoluteMedian;
    }
    this.personalizedThresholds = {
      good: Math.min(this.config.GOOD_THRESHOLD, Math.max(0.5, stats.median + 0.2)),
      mild: Math.min(this.config.MILD_THRESHOLD, Math.max(this.config.GOOD_THRESHOLD + 0.5, stats.median + 1.0)),
      bad: Math.max(this.config.BAD_THRESHOLD, stats.median + 2.0)
    };
  }

  getThresholds() {
    return this.personalizedThresholds || {
      good: this.config.GOOD_THRESHOLD,
      mild: this.config.MILD_THRESHOLD,
      bad: this.config.BAD_THRESHOLD
    };
  }

  calculateWeightedBadScore(windows) {
    const weights = this.config.WINDOW_WEIGHTS;
    let weightedBad = 0;
    let totalWeight = 0;
    [...windows].reverse().forEach((window, idx) => {
      const weight = weights[idx] ?? weights[weights.length - 1] ?? 1;
      totalWeight += weight;
      if (window.label === DEFAULT_CONFIG.LABELS.BAD) {
        weightedBad += weight;
      }
    });
    return { weightedBad, totalWeight: totalWeight || 1 };
  }
}

let detectorInstance = null;

export function initDetector(options = {}) {
  if (!detectorInstance) detectorInstance = new PostureDetector();
  detectorInstance.init(options);
  return detectorInstance;
}

export async function startDetector() {
  if (!detectorInstance) throw new Error('Detector not initialized. Call initDetector() first.');
  return detectorInstance.startDetector();
}

export function stopDetector() { if (detectorInstance) detectorInstance.stopDetector(); }

export async function forceInferOnce() {
  if (!detectorInstance) throw new Error('Detector not initialized. Call initDetector() first.');
  return detectorInstance.forceInferOnce();
}

export function mute(muted = true) { if (detectorInstance) detectorInstance.mute(muted); }

export function snooze(minutes = 10) { if (detectorInstance) detectorInstance.snooze(minutes); }

export function setUserGesture() { if (detectorInstance) detectorInstance.setUserGesture(); }

export function isModelLoaded() { return detectorInstance ? detectorInstance.isModelLoaded() : false; }

export function getStatus() { return detectorInstance ? detectorInstance.getStatus() : { running: false }; }
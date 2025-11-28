/**
 * ML Constants for Posture Detection - FINAL STRICT VERSION
 * Non-negotiable strict thresholds and 30-second windows
 */

export const DEFAULT_CONFIG = {
  // Training parameters
  EPOCHS: 20,
  BATCH_SIZE: 16,
  VALIDATION_SPLIT: 0.2,
  MIN_SAMPLES_PER_CLASS: 20,

  // Feature extraction - STRICT VALIDATION
  MIN_CONFIDENCE: 0.55, // require higher confidence
  BASELINE_ANGLE: 5.0, // degrees - default upright spine angle

  // Detection parameters - OPTIMIZED FOR RELIABILITY
  SAMPLING_WINDOW_MS: 5000, // 5 seconds for faster feedback
  FPS_DURING_WINDOW: 6, // 6 FPS
  FRAME_INTERVAL_MS: Math.round(1000 / 6), // ~167ms per frame
  MIN_VALID_FRAMES: 3, // need at least 3 valid frames
  WINDOWS_HISTORY: 3, // Keep last 3 windows
  WINDOWS_VOTES_REQUIRED: 2, // Require 2 of 3 windows to be BAD (more lenient)
  PERSIST_MS: 8000, // require BAD to persist >= 8s (2 windows)
  ALERT_COOLDOWN_MS: 30000, // 30 seconds cooldown (was 2 minutes)
  WINDOW_WEIGHTS: [0.5, 0.3, 0.2], // newer windows weigh more

  // IMPROVED THRESHOLDS (degrees) - More forgiving for good posture
  GOOD_THRESHOLD: 5.0, // ≤ 5° = Good (was 2°, too strict)
  MILD_THRESHOLD: 10.0, // 5° < x ≤ 10° = Mild (was 4°)
  BAD_THRESHOLD: 10.0, // > 10° = Bad (was 4°, too sensitive)

  // Fallback thresholds (when baseline NOT available)
  FALLBACK_GOOD_THRESHOLD: 5.0,
  FALLBACK_BAD_THRESHOLD: 12.0,

  // Angle validation
  MIN_ANGLE: 0,
  MAX_ANGLE: 70,
  BASELINE_UPDATE_ALPHA: 0.2, // adaptive baseline smoothing

  // Ensemble weights (if model available)
  MODEL_WEIGHT: 0.7,
  THRESHOLD_WEIGHT: 0.3,

  // Storage keys
  DATASET_KEY: 'posture_dataset_v1',
  MODEL_NAME: 'posture-model-v1',
  MODEL_META_KEY: 'posture_model_meta_v1',

  // Voice alerts
  VOICE_MESSAGE: "Please correct your posture and sit upright.",
  VOICE_RATE: 0.9,
  VOICE_PITCH: 1.0,
  VOICE_VOLUME: 0.8,

  // Frame quality
  MIN_ALIGNMENT_SCORE: 0.4, // drop frames with very tilted shoulders
  SHOULDER_SLOPE_MAX: 25, // degrees

  // Feature vector indices
  FEATURE_INDICES: {
    SPINE_ANGLE: 0,
    SPINE_ANGLE_REL: 1,
    HEAD_FORWARD_RATIO: 2,
    SHOULDER_WIDTH_RATIO: 3,
    CONFIDENCE: 4
  },

  FEATURE_COUNT: 5,

  // Class labels
  LABELS: {
    GOOD: 'good',
    MILD: 'mild',
    BAD: 'bad',
    INSUFFICIENT: 'insufficient',
    SLOUCH: 'bad'
  },

  // Debug mode
  DEBUG: false
};

export default DEFAULT_CONFIG;
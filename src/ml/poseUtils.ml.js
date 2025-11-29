/**
 * Pose utilities for feature extraction - FINAL STRICT VERSION
 * Enhanced frame filtering, feature normalization, per-window statistics
 */

import { DEFAULT_CONFIG } from './constants.ml.js';

/**
 * Extract numeric features from pose keypoints with strict validation
 */
export function computeFeaturesFromKeypoints(keypoints, baselineAngle = DEFAULT_CONFIG.BASELINE_ANGLE) {
  try {
    if (!keypoints || typeof keypoints !== 'object') {
      throw new Error('Invalid keypoints object');
    }

    const points = parseKeypoints(keypoints);

    // Required points
    const required = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'nose'];
    for (const point of required) {
      if (!points[point]) {
        throw new Error(`Missing required keypoint: ${point}`);
      }
    }

    // Average confidence
    const requiredPoints = required.map(name => points[name]);
    const confidences = requiredPoints.map(p => p.confidence || p.score || 0);
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    if (avgConfidence < DEFAULT_CONFIG.MIN_CONFIDENCE) {
      throw new Error(`Low confidence: ${avgConfidence.toFixed(2)} < ${DEFAULT_CONFIG.MIN_CONFIDENCE}`);
    }

    // Compute spine angle and other features
    const spineAngle = computeSpineAngle(points);
    if (spineAngle < DEFAULT_CONFIG.MIN_ANGLE || spineAngle > DEFAULT_CONFIG.MAX_ANGLE) {
      throw new Error(`Invalid spine angle: ${spineAngle}°`);
    }

    const spineAngleRel = Math.abs(spineAngle - baselineAngle);
    const headForwardRatio = computeHeadForwardRatio(points);
    const shoulderWidthRatio = computeShoulderWidthRatio(points);
    const shoulderSlope = computeShoulderSlope(points);
    const frameQuality = computeFrameQuality(avgConfidence, shoulderSlope);

    const features = [
      spineAngle,
      spineAngleRel,
      headForwardRatio,
      shoulderWidthRatio,
      avgConfidence
    ];

    if (features.some(f => !isFinite(f) || isNaN(f))) {
      throw new Error('Invalid feature values computed');
    }

    return {
      features,
      confidence: avgConfidence,
      metadata: {
        spineAngle,
        spineAngleRel,
        headForwardRatio,
        shoulderWidthRatio,
        shoulderSlope,
        frameQuality,
        baselineAngle,
        timestamp: Date.now()
      }
    };

  } catch (error) {
    if (DEFAULT_CONFIG.DEBUG) {
      console.warn('Feature extraction failed:', error.message);
    }
    return {
      features: null,
      confidence: 0,
      metadata: { error: error.message }
    };
  }
}

/**
 * Compute per-window statistics for better accuracy
 */
export function computeWindowStatistics(samples) {
  if (!samples || samples.length === 0) return null;

  const relEntries = [];
  const absEntries = [];

  samples.forEach(sample => {
    const angleRel = sample.metadata?.spineAngleRel ?? sample.features?.[1];
    const angleAbs = sample.metadata?.spineAngle ?? sample.features?.[0];
    const weight = Math.max(0.001, sample.weight ?? sample.metadata?.frameQuality ?? sample.confidence ?? 0.5);

    if (isFinite(angleRel) && angleRel >= 0) {
      relEntries.push({ value: angleRel, weight });
    }
    if (isFinite(angleAbs) && angleAbs >= 0) {
      absEntries.push({ value: angleAbs, weight });
    }
  });

  if (!relEntries.length) return null;

  const relStats = computeWeightedStats(relEntries);
  const absStats = absEntries.length ? computeWeightedStats(absEntries) : null;

  return {
    ...relStats,
    absolute: absStats
  };
}

/**
 * Parse keypoints from various formats
 */
export function parseKeypoints(keypoints) {
  const points = {};

  if (Array.isArray(keypoints)) {
    const names = [
      'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
      'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
      'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
      'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ];
    keypoints.forEach((point, i) => {
      if (i < names.length && point) {
        points[names[i]] = parsePoint(point);
      }
    });
  } else {
    Object.entries(keypoints).forEach(([name, point]) => {
      if (point) points[name] = parsePoint(point);
    });
  }

  return points;
}

function parsePoint(point) {
  if (Array.isArray(point)) {
    const x = point[0] || 0;
    const y = point[1] || 0;
    const z = point.length > 2 ? point[2] : 0;
    const confidence = point.length > 3 ? point[3] : (point.length === 3 ? point[2] : 1);
    return { x, y, z, confidence };
  } else if (typeof point === 'object') {
    return {
      x: point.x || point.X || 0,
      y: point.y || point.Y || 0,
      z: point.z || point.Z || 0,
      confidence: point.confidence || point.score || point.visibility || 1
    };
  }
  return { x: 0, y: 0, z: 0, confidence: 0 };
}

// Smoothing buffer for angle calculation
let angleHistory = [];
const MAX_HISTORY = 5;

function computeSpineAngle(points) {
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const leftHip = points.left_hip;
  const rightHip = points.right_hip;

  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: (leftShoulder.z + rightShoulder.z) / 2
  };
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: (leftHip.z + rightHip.z) / 2
  };

  const vector = {
    x: hipMid.x - shoulderMid.x,
    y: hipMid.y - shoulderMid.y,
    z: hipMid.z - shoulderMid.z
  };

  // Calculate angle from vertical (more stable)
  // In normalized coordinates, y increases downward, so upright = small dy
  const absY = Math.abs(vector.y) + 1e-6;
  const absX = Math.abs(vector.x);
  const absZ = Math.abs(vector.z);
  
  // Primary angle: deviation from vertical (forward/backward lean)
  const forwardAngle = Math.atan2(absZ, absY) * 180 / Math.PI;
  
  // Secondary angle: side lean (less weight)
  const sideAngle = Math.atan2(absX, absY) * 180 / Math.PI;
  
  // Combined with forward lean weighted more heavily
  const combined = Math.sqrt(forwardAngle * forwardAngle + (sideAngle * 0.3) * (sideAngle * 0.3));
  
  // Apply smoothing to reduce jitter
  angleHistory.push(combined);
  if (angleHistory.length > MAX_HISTORY) {
    angleHistory.shift();
  }
  
  // Return median of recent angles for stability
  const sorted = [...angleHistory].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  return Math.min(median, 90);
}

function computeHeadForwardRatio(points) {
  const nose = points.nose;
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
  const shoulderDepth = (leftShoulder.z + rightShoulder.z) / 2;
  const shoulderWidth = Math.sqrt(
    Math.pow(rightShoulder.x - leftShoulder.x, 2) +
    Math.pow(rightShoulder.y - leftShoulder.y, 2)
  ) + 1e-6;
  const forwardDist = Math.abs((nose.z ?? shoulderDepth) - shoulderDepth) / (Math.abs(shoulderWidth) + 1e-6);
  const fallback = Math.abs(nose.x - shoulderMid.x) / (Math.abs(shoulderWidth) + 1e-6);
  return Math.min(isFinite(forwardDist) && forwardDist > 0 ? forwardDist : fallback, 2.5);
}

function computeShoulderWidthRatio(points) {
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const dx = rightShoulder.x - leftShoulder.x;
  const dy = rightShoulder.y - leftShoulder.y;
  const width = Math.sqrt(dx * dx + dy * dy);
  return Math.min(width / 0.25, 2.0);
}

function computeShoulderSlope(points) {
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const dy = rightShoulder.y - leftShoulder.y;
  const dx = rightShoulder.x - leftShoulder.x + 1e-6;
  return Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
}

function computeFrameQuality(confidence, shoulderSlope) {
  const alignmentScore = 1 - Math.min(1, Math.abs(shoulderSlope) / DEFAULT_CONFIG.SHOULDER_SLOPE_MAX);
  return Math.max(0, Math.min(1, confidence * alignmentScore));
}

function computeWeightedStats(entries) {
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0) || 1;
  const weightedMean = entries.reduce((sum, e) => sum + e.value * e.weight, 0) / totalWeight;

  const weightedVariance = entries.reduce((sum, e) => {
    const diff = e.value - weightedMean;
    return sum + e.weight * diff * diff;
  }, 0) / totalWeight;

  const std = Math.sqrt(Math.max(0, weightedVariance));

  const percentile = (target) => {
    let acc = 0;
    for (const entry of sorted) {
      acc += entry.weight / totalWeight;
      if (acc >= target) {
        return entry.value;
      }
    }
    return sorted[sorted.length - 1].value;
  };

  const trimmed = sorted.filter((entry, idx) => {
    const rank = idx / (sorted.length - 1 || 1);
    return rank >= 0.1 && rank <= 0.9;
  });
  const trimmedWeight = trimmed.reduce((sum, e) => sum + e.weight, 0) || 1;
  const trimmedMean = trimmed.length
    ? trimmed.reduce((sum, e) => sum + e.value * e.weight, 0) / trimmedWeight
    : weightedMean;

  return {
    mean: weightedMean,
    median: percentile(0.5),
    std,
    p25: percentile(0.25),
    p75: percentile(0.75),
    trimmedMean,
    count: entries.length,
    min: sorted[0].value,
    max: sorted[sorted.length - 1].value
  };
}

/**
 * Validate if keypoints have sufficient confidence
 */
export function hasValidPose(keypoints, minConfidence = DEFAULT_CONFIG.MIN_CONFIDENCE) {
  const result = computeFeaturesFromKeypoints(keypoints);
  return result.confidence >= minConfidence && result.features !== null;
}

/**
 * Normalize features using running statistics or min-max
 */
export function normalizeFeatures(features, stats = null) {
  if (!stats) {
    const ranges = [
      [0, 90],
      [0, 45],
      [0, 2.0],
      [0, 2.0],
      [0, 1]
    ];
    return features.map((f, i) => {
      const [min, max] = ranges[i];
      return Math.max(0, Math.min(1, (f - min) / (max - min)));
    });
  }
  return features.map((f, i) => {
    const mean = stats.means?.[i] || 0;
    const std = stats.stds?.[i] || 1;
    if (std === 0) return 0;
    return (f - mean) / std;
  });
}

/**
 * Helper functions for yoga pose detection
 */

/**
 * Calculate angle between three points (in degrees)
 * @param {Object} a - Point a {x, y, z?}
 * @param {Object} b - Point b (vertex) {x, y, z?}
 * @param {Object} c - Point c {x, y, z?}
 * @returns {number} Angle in degrees
 */
export function angleBetween(a, b, c) {
  if (!a || !b || !c) return 0;
  
  // Vector from b to a
  const vec1 = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z || 0) - (b.z || 0)
  };
  
  // Vector from b to c
  const vec2 = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: (c.z || 0) - (b.z || 0)
  };
  
  // Dot product
  const dot = vec1.x * vec2.x + vec1.y * vec2.y + vec1.z * vec2.z;
  
  // Magnitudes
  const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y + vec1.z * vec1.z);
  const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y + vec2.z * vec2.z);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  // Angle in radians, convert to degrees
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle) * 180 / Math.PI;
}

/**
 * Calculate Euclidean distance between two points
 * @param {Object} a - Point a {x, y, z?}
 * @param {Object} b - Point b {x, y, z?}
 * @returns {number} Distance
 */
export function distance(a, b) {
  if (!a || !b) return 0;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = ((a.z || 0) - (b.z || 0));
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate average of an array of numbers
 * @param {number[]} values - Array of numbers
 * @returns {number} Average value
 */
export function avg(values) {
  if (!values || values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + (isFinite(val) ? val : 0), 0);
  return sum / values.length;
}

/**
 * Circular buffer for smoothing features
 */
export class SmoothingBuffer {
  constructor(size = 4) {
    this.size = size;
    this.buffer = [];
  }

  add(value) {
    this.buffer.push(value);
    if (this.buffer.length > this.size) {
      this.buffer.shift();
    }
  }

  getAverage() {
    if (this.buffer.length === 0) return null;
    return avg(this.buffer);
  }

  getValues() {
    return [...this.buffer];
  }

  clear() {
    this.buffer = [];
  }
}
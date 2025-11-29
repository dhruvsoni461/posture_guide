/**
 * Yoga Pose Detection for Quick Yoga Challenge
 * Implements pose-specific detection with leniency and smoothing
 */

import { parseKeypoints, angleBetween, distance, avg, SmoothingBuffer } from './poseUtils.ml.js';

// Leniency multiplier for yoga mode
const LENIENCY = 1.15;
const SMOOTHING_BUFFER_SIZE = 4; // ~300-500ms at 5fps
const MIN_CONFIDENCE_YOGA = 0.55;
const PASS_THRESHOLD = 0.70; // 70% of frames must be acceptable

/**
 * Global prechecks before scoring any pose
 */
export function precheckPose(keypoints) {
  if (!keypoints || typeof keypoints !== 'object') {
    return { valid: false, error: 'Invalid keypoints' };
  }

  const points = parseKeypoints(keypoints);
  
  // Check required keypoints
  const required = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];
  for (const point of required) {
    if (!points[point]) {
      return { valid: false, error: `Missing keypoint: ${point}. Please adjust camera.` };
    }
  }

  // Check average confidence
  const confidences = required.map(name => points[name]).map(p => p.confidence || p.score || 0);
  const avgConfidence = avg(confidences);
  
  if (avgConfidence < MIN_CONFIDENCE_YOGA) {
    return { valid: false, error: 'Move closer or improve lighting' };
  }

  return { valid: true, points, avgConfidence };
}

/**
 * Compute spine extension score for Cobra pose
 */
function computeSpineExtension(points, baselineAngle = 5.0) {
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const leftHip = points.left_hip;
  const rightHip = points.right_hip;

  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2
  };
  
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: ((leftHip.z || 0) + (rightHip.z || 0)) / 2
  };

  // Calculate spine angle
  const vector = {
    x: hipMid.x - shoulderMid.x,
    y: hipMid.y - shoulderMid.y,
    z: hipMid.z - shoulderMid.z
  };

  const absY = Math.abs(vector.y) + 1e-6;
  const absZ = Math.abs(vector.z);
  const forwardAngle = Math.atan2(absZ, absY) * 180 / Math.PI;

  // Spine extension: negative curvature means extension (chest lifted)
  const spineAngleRel = forwardAngle - baselineAngle;
  
  // Extension score: negative means extension
  const extensionScore = spineAngleRel < -5 / LENIENCY; // More lenient threshold
  
  // Shoulder to hip vertical distance (normalized)
  const verticalDist = Math.abs(shoulderMid.y - hipMid.y);
  const normalizedDist = verticalDist; // Already normalized in MediaPipe coordinates

  return {
    extensionScore,
    spineAngleRel,
    extensionMagnitude: Math.abs(spineAngleRel),
    verticalDist,
    normalizedDist
  };
}

/**
 * Detect Cobra pose
 */
export function detectCobra(keypoints, frameBuffer) {
  const precheck = precheckPose(keypoints);
  if (!precheck.valid) {
    return { valid: false, error: precheck.error };
  }

  const points = precheck.points;
  const result = computeSpineExtension(points);
  
  // Add to smoothing buffer
  frameBuffer.add(result.extensionScore);
  
  // Get smoothed value
  const smoothedScore = frameBuffer.getAverage();
  
  return {
    valid: true,
    passed: result.extensionScore,
    smoothed: smoothedScore !== null ? smoothedScore > 0 : false,
    score: result.extensionMagnitude,
    confidence: precheck.avgConfidence,
    metadata: result
  };
}

/**
 * Detect Cat-Cow pose (dynamic mobility)
 */
export function detectCatCow(keypoints, frameBuffer, spineAngleHistory = []) {
  const precheck = precheckPose(keypoints);
  if (!precheck.valid) {
    return { valid: false, error: precheck.error };
  }

  const points = precheck.points;
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const leftHip = points.left_hip;
  const rightHip = points.right_hip;

  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  // Calculate current spine angle
  const vector = {
    x: hipMid.x - shoulderMid.x,
    y: hipMid.y - shoulderMid.y
  };
  const absY = Math.abs(vector.y) + 1e-6;
  const absX = Math.abs(vector.x);
  const currentAngle = Math.atan2(absX, absY) * 180 / Math.PI;

  // Track spine angle history for variance
  spineAngleHistory.push(currentAngle);
  if (spineAngleHistory.length > 30) { // Keep last ~30 frames (5s at 6fps)
    spineAngleHistory.shift();
  }

  // Calculate variance in spine angle (motion detection)
  const variance = spineAngleHistory.length > 1
    ? computeVariance(spineAngleHistory)
    : 0;

  // Check if motion was performed (variance > threshold with leniency)
  const motionThreshold = 8 / LENIENCY; // More lenient
  const hasMotion = variance > motionThreshold;

  // Check final neutral position (acceptable range)
  const neutralRange = 15; // degrees
  const isNeutral = Math.abs(currentAngle - 5.0) < neutralRange / LENIENCY;

  // Add to buffer
  const frameResult = hasMotion && isNeutral;
  frameBuffer.add(frameResult ? 1 : 0);

  const smoothed = frameBuffer.getAverage();
  
  return {
    valid: true,
    passed: frameResult,
    smoothed: smoothed !== null ? smoothed > 0.5 : false,
    variance,
    hasMotion,
    isNeutral,
    currentAngle,
    confidence: precheck.avgConfidence,
    metadata: { variance, hasMotion, isNeutral, currentAngle }
  };
}

/**
 * Detect Seated Twist pose
 */
export function detectSeatedTwist(keypoints, frameBuffer, direction = 'right') {
  const precheck = precheckPose(keypoints);
  if (!precheck.valid) {
    return { valid: false, error: precheck.error };
  }

  const points = precheck.points;
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const leftHip = points.left_hip;
  const rightHip = points.right_hip;

  // Calculate shoulder line angle
  const shoulderDx = rightShoulder.x - leftShoulder.x;
  const shoulderDy = rightShoulder.y - leftShoulder.y;
  const shoulderAngle = Math.atan2(shoulderDy, shoulderDx) * 180 / Math.PI;

  // Calculate hip line angle
  const hipDx = rightHip.x - leftHip.x;
  const hipDy = rightHip.y - leftHip.y;
  const hipAngle = Math.atan2(hipDy, hipDx) * 180 / Math.PI;

  // Rotation difference (how much torso is rotated relative to hips)
  let rotationDegrees = Math.abs(shoulderAngle - hipAngle);
  
  // Normalize to 0-180 range
  if (rotationDegrees > 180) {
    rotationDegrees = 360 - rotationDegrees;
  }

  // Check hip stability (hip line should be relatively horizontal)
  const hipMovement = Math.abs(hipAngle);
  const hipStable = hipMovement < (6 * LENIENCY); // More lenient

  // Check rotation threshold (with leniency)
  const rotationThreshold = 12 / LENIENCY; // More lenient
  const hasRotation = rotationDegrees >= rotationThreshold;

  // Frame passes if has rotation AND hips are stable
  const frameResult = hasRotation && hipStable;
  frameBuffer.add(frameResult ? 1 : 0);

  const smoothed = frameBuffer.getAverage();

  return {
    valid: true,
    passed: frameResult,
    smoothed: smoothed !== null ? smoothed > 0.5 : false,
    rotationDegrees,
    hasRotation,
    hipStable,
    hipMovement,
    confidence: precheck.avgConfidence,
    metadata: { rotationDegrees, hasRotation, hipStable, hipMovement }
  };
}

/**
 * Evaluate pose over a 5-second hold period
 * Returns score and feedback
 */
export function evaluatePoseHold(detectionResults) {
  if (!detectionResults || detectionResults.length === 0) {
    return {
      score: 0,
      passed: false,
      feedback: 'No valid frames detected',
      quality: 'needs_improvement'
    };
  }

  // Count passed frames
  const passedFrames = detectionResults.filter(r => r.passed || r.smoothed).length;
  const totalFrames = detectionResults.length;
  const passRatio = totalFrames > 0 ? passedFrames / totalFrames : 0;

  // Check if passed (70% threshold)
  const passed = passRatio >= PASS_THRESHOLD;

  // Calculate average confidence
  const avgConf = avg(detectionResults.map(r => r.confidence || 0));

  // Determine quality and score
  let quality, score, feedback;
  
  if (passRatio >= 0.9 && avgConf >= 0.7) {
    quality = 'perfect';
    score = 100;
    feedback = 'Perfect!';
  } else if (passRatio >= PASS_THRESHOLD) {
    quality = 'good';
    score = Math.round(60 + (passRatio - PASS_THRESHOLD) * 200); // 60-100 range
    feedback = 'Good!';
  } else {
    quality = 'needs_improvement';
    score = Math.round(passRatio * 60); // 0-60 range
    feedback = 'Needs improvement';
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    passed,
    feedback,
    quality,
    passRatio,
    avgConfidence: avgConf,
    totalFrames,
    passedFrames
  };
}

/**
 * Helper: compute variance of an array
 */
function computeVariance(values) {
  if (values.length < 2) return 0;
  const mean = avg(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return avg(squaredDiffs);
}

/**
 * Get pose-specific feedback messages
 */
export function getPoseFeedback(poseName, evaluation, metadata = {}) {
  const { quality, passRatio } = evaluation;
  
  if (quality === 'perfect') {
    return `Excellent ${poseName}!`;
  } else if (quality === 'good') {
    return `Good ${poseName} form.`;
  } else {
    // Specific feedback based on pose
    if (poseName === 'Cobra') {
      if (metadata.extensionMagnitude < 5) {
        return 'Raise chest slightly in Cobra.';
      }
      return 'Focus on lifting your chest and squeezing shoulder blades together.';
    } else if (poseName === 'Cat-Cow') {
      if (!metadata.hasMotion) {
        return 'Add more movement - arch and dip your spine.';
      }
      return 'Complete the full range of motion.';
    } else if (poseName === 'Seated Twist') {
      if (metadata.rotationDegrees < 12) {
        return 'Rotate your torso more.';
      }
      if (!metadata.hipStable) {
        return 'Keep your hips stable while twisting.';
      }
      return 'Focus on rotating from your torso while keeping hips still.';
    }
  }
  
  return 'Keep practicing!';
}




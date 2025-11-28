# ML Integration Guide for Posture Detection

This guide explains how to integrate the new ML modules into your existing React posture app without modifying existing files.

## Overview

The ML modules provide:
- **Training API**: Collect labeled samples and train models
- **Detection API**: Real-time inference with voice alerts
- **Pose Utilities**: Feature extraction from keypoints
- **Model Service**: TensorFlow.js model management
- **Storage**: IndexedDB/localStorage persistence

## Quick Setup

### 1. Install Dependencies

```bash
npm install @tensorflow/tfjs
```

### 2. Include TensorFlow.js in HTML (Alternative)

Add to your `index.html` if you prefer CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js"></script>
```

### 3. Integration Methods

#### Method A: Import and Initialize (Recommended)

```javascript
// In your existing camera component or main app
import { initTrainer, initDetector } from './ml/trainerAPI.ml.js';
import { initDetector, startDetector } from './ml/detectorAPI.ml.js';

// Initialize trainer
initTrainer({
  getKeypoints: () => window.__LATEST_KEYPOINTS__, // Your keypoint source
  onStatus: (msg) => console.log('Trainer:', msg)
});

// Initialize detector
initDetector({
  getKeypoints: () => window.__LATEST_KEYPOINTS__,
  onAlert: (alert) => {
    console.log('POSTURE ALERT:', alert.message);
    // Custom alert handling
  },
  onUpdate: (status) => console.log('Detector:', status)
}).then(() => {
  // Start detection when camera is active
  startDetector();
});
```

#### Method B: Auto-Detection (No Code Changes)

The modules automatically detect keypoint sources:
1. `window.getLatestKeypoints()` function
2. `window.__LATEST_KEYPOINTS__` variable
3. DOM elements with keypoint data

Just set up the global variable in your camera component:

```javascript
// In your camera component, expose keypoints globally
useEffect(() => {
  window.__LATEST_KEYPOINTS__ = currentKeypoints;
}, [currentKeypoints]);
```

Then initialize from browser console or a script tag:

```javascript
// Auto-initialize (paste in console)
import('./src/ml/trainerAPI.ml.js').then(trainer => {
  trainer.initTrainer(); // Auto-detects keypoints
});

import('./src/ml/detectorAPI.ml.js').then(detector => {
  detector.initDetector().then(() => {
    detector.startDetector();
  });
});
```

## Usage Examples

### Training Workflow

```javascript
// 1. Initialize trainer
import('./src/ml/trainerAPI.ml.js').then(async (trainer) => {
  trainer.initTrainer();
  
  // 2. Record good posture samples
  console.log('Sit up straight and click enter...');
  await trainer.startRecording('good', 6000); // 6 seconds
  
  // 3. Record slouch samples  
  console.log('Now slouch and click enter...');
  await trainer.startRecording('slouch', 6000);
  
  // 4. Check dataset
  console.log('Dataset:', trainer.getDatasetStats());
  
  // 5. Train model (need 20+ samples per class)
  const result = await trainer.train({
    epochs: 20,
    onProgress: (p) => console.log(`Epoch ${p.epoch}: ${(p.accuracy*100).toFixed(1)}%`)
  });
  
  console.log('Training complete:', result);
});
```

### Detection Workflow

```javascript
// 1. Initialize detector
import('./src/ml/detectorAPI.ml.js').then(async (detector) => {
  await detector.initDetector({
    onAlert: (alert) => {
      // Custom alert - play sound, show notification, etc.
      console.log('🚨 POSTURE ALERT:', alert.message);
      new Audio('/alert.mp3').play().catch(() => {});
    },
    onUpdate: (status) => console.log('Detection:', status),
    config: {
      PERSIST_MS: 5000,        // Alert after 5s of slouching
      ALERT_COOLDOWN_MS: 60000 // 1 minute between alerts
    }
  });
  
  // 2. Start detection
  detector.startDetector();
  
  // 3. Control alerts
  // detector.mute(true);      // Mute alerts
  // detector.snooze(10);      // Snooze 10 minutes
  
  // 4. Test single inference
  const result = await detector.forceInferOnce();
  console.log('Current posture:', result);
});
```

### Data Management

```javascript
import('./src/ml/trainerAPI.ml.js').then(async (trainer) => {
  trainer.initTrainer();
  
  // Export dataset for backup
  const datasetJson = trainer.exportDataset();
  const blob = new Blob([datasetJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'posture-dataset.json';
  a.click();
  
  // Import dataset
  // const fileInput = document.createElement('input');
  // fileInput.type = 'file';
  // fileInput.onchange = (e) => {
  //   const file = e.target.files[0];
  //   const reader = new FileReader();
  //   reader.onload = (e) => {
  //     trainer.importDataset(e.target.result);
  //   };
  //   reader.readAsText(file);
  // };
  // fileInput.click();
});
```

## Integration with Existing Camera Component

### Option 1: Expose Keypoints Globally

In your `CameraAccess.jsx` (or similar), add:

```javascript
// Add this to your existing camera component
useEffect(() => {
  // Expose keypoints globally for ML modules
  if (latestKeypoints) {
    window.__LATEST_KEYPOINTS__ = latestKeypoints;
  }
}, [latestKeypoints]);

// Optional: Expose getter function
useEffect(() => {
  window.getLatestKeypoints = () => latestKeypoints;
  return () => {
    delete window.getLatestKeypoints;
  };
}, [latestKeypoints]);
```

### Option 2: Direct Integration

```javascript
import { initDetector, startDetector, stopDetector } from '../ml/detectorAPI.ml.js';

// In your camera component
useEffect(() => {
  if (isCameraActive) {
    initDetector({
      getKeypoints: () => latestKeypoints,
      onAlert: (alert) => {
        setStatusMessage(`⚠️ ${alert.message}`);
        // Trigger existing UI alerts
      }
    }).then(() => {
      startDetector();
    });
  } else {
    stopDetector();
  }
}, [isCameraActive, latestKeypoints]);
```

## Console Commands for Testing

```javascript
// Quick test commands (paste in browser console)

// 1. Test feature extraction
import('./src/ml/poseUtils.ml.js').then(pose => {
  const mockKeypoints = {
    left_shoulder: { x: 0.4, y: 0.3, confidence: 0.9 },
    right_shoulder: { x: 0.6, y: 0.3, confidence: 0.9 },
    left_hip: { x: 0.45, y: 0.6, confidence: 0.9 },
    right_hip: { x: 0.55, y: 0.6, confidence: 0.9 },
    nose: { x: 0.5, y: 0.2, confidence: 0.9 }
  };
  console.log('Features:', pose.computeFeaturesFromKeypoints(mockKeypoints));
});

// 2. Check detector status
import('./src/ml/detectorAPI.ml.js').then(detector => {
  console.log('Detector status:', detector.getStatus());
});

// 3. Test single inference
import('./src/ml/detectorAPI.ml.js').then(async (detector) => {
  const result = await detector.forceInferOnce();
  console.log('Inference result:', result);
});

// 4. Training status
import('./src/ml/trainerAPI.ml.js').then(async (trainer) => {
  trainer.initTrainer();
  console.log('Dataset stats:', trainer.getDatasetStats());
  console.log('Model status:', await trainer.getModelStatus());
});
```

## Configuration Options

```javascript
const config = {
  // Training
  EPOCHS: 20,
  BATCH_SIZE: 16,
  MIN_SAMPLES_PER_CLASS: 20,
  
  // Detection
  SAMPLING_WINDOW_MS: 10000,    // Sample for 10s
  FPS_DURING_WINDOW: 2,         // 2 FPS during sampling
  PERSIST_MS: 8000,             // Alert after 8s of slouching
  SMOOTHING_WINDOW: 5,          // Smooth over 5 predictions
  ALERT_COOLDOWN_MS: 120000,    // 2 minutes between alerts
  
  // Thresholds (fallback mode)
  SLOUCH_THRESHOLD: 20,         // degrees
  MILD_THRESHOLD: 10,           // degrees
  
  // Voice
  VOICE_MESSAGE: "Please sit up straight",
  VOICE_RATE: 0.9,
  VOICE_VOLUME: 0.8
};

// Use custom config
initDetector({ config });
```

## Troubleshooting

### No Keypoints Detected
```javascript
// Check if keypoints are available
console.log('Global keypoints:', window.__LATEST_KEYPOINTS__);
console.log('Keypoint function:', typeof window.getLatestKeypoints);

// Manual keypoint injection for testing
window.__LATEST_KEYPOINTS__ = {
  left_shoulder: { x: 0.4, y: 0.3, confidence: 0.9 },
  right_shoulder: { x: 0.6, y: 0.3, confidence: 0.9 },
  left_hip: { x: 0.45, y: 0.6, confidence: 0.9 },
  right_hip: { x: 0.55, y: 0.6, confidence: 0.9 }
};
```

### TensorFlow.js Issues
```javascript
// Check TF.js availability
console.log('TensorFlow.js:', typeof tf, tf?.version);

// Load TF.js dynamically if needed
if (typeof tf === 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js';
  document.head.appendChild(script);
}
```

### Storage Issues
```javascript
// Check storage
import('./src/ml/storage.ml.js').then(async (storage) => {
  const info = await storage.getStorageInfo();
  console.log('Storage info:', info);
  
  // Clear all data if needed
  // await storage.clearAllStorage();
});
```

## File Structure

```
src/ml/
├── constants.ml.js      # Configuration constants
├── poseUtils.ml.js      # Feature extraction from keypoints
├── storage.ml.js        # IndexedDB/localStorage wrapper
├── modelService.ml.js   # TensorFlow.js model operations
├── trainerAPI.ml.js     # Training workflow API
└── detectorAPI.ml.js    # Real-time detection API
```

## Next Steps

1. **Test Integration**: Use console commands to verify keypoint detection
2. **Collect Data**: Record 20+ samples each of good/slouch posture
3. **Train Model**: Run training and verify accuracy >80%
4. **Enable Detection**: Start real-time detection with alerts
5. **Customize**: Adjust thresholds, alert messages, and timing

The ML modules are designed to work alongside your existing app without requiring any changes to current files. They provide a complete posture detection pipeline from data collection to real-time alerts.

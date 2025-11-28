# 🚀 Quick Start Guide - Posture Detection with Real Alerts

## What's New
✅ **Real MediaPipe pose detection** (no more fake data!)  
✅ **Live spine angle calculation** with visual feedback  
✅ **Automatic ML integration** - alerts work immediately  
✅ **Training buttons** to customize your model  
✅ **Smart alerts** that actually detect slouching vs good posture  

## How to Use Right Now

### 1. Start the App
Your servers should already be running:
- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:8000/`

### 2. Test Pose Detection
1. **Login/Signup** at `http://localhost:5173/`
2. Click **"Enable Camera"** 
3. **Sit in front of camera** - you should see:
   - ✅ Green skeleton overlay on your body
   - ✅ Yellow spine line showing your posture angle
   - ✅ "Pose Detection: Active" status
   - ✅ Real-time spine angle display

### 3. Test Automatic Alerts (No Training Needed!)
The system now uses **smart thresholds** that work immediately:

1. **Sit up straight** - you should see "Posture: Good" 
2. **Slouch forward** - you should see "Posture: Poor"
3. **Keep slouching for 5+ seconds** - you'll get a voice alert: *"Please sit upright and straighten your back"*

**Alert Settings (for demo):**
- Slouch threshold: 15° (sensitive)
- Alert after: 5 seconds of slouching  
- Cooldown: 30 seconds between alerts

### 4. Train Your Personal Model (Optional)
For even better accuracy, train a custom model:

1. **Sit up straight** → Click **"Record Good"** (records for 5 seconds)
2. **Slouch** → Click **"Record Slouch"** (records for 5 seconds)  
3. **Repeat 4-5 times each** to get 20+ samples per posture
4. **Train model** in console:

```javascript
// Open browser console and paste:
import('./src/ml/trainerAPI.ml.js').then(async (trainer) => {
  const stats = trainer.getDatasetStats();
  console.log('Dataset:', stats);
  
  if (stats.canTrain) {
    console.log('Training model...');
    const result = await trainer.train({ epochs: 20 });
    console.log('Training complete:', result);
  } else {
    console.log(`Need more samples. Current: ${stats.good} good, ${stats.slouch} slouch`);
  }
});
```

### 5. Control Alerts
```javascript
// Mute alerts
import('./src/ml/detectorAPI.ml.js').then(d => d.mute(true));

// Unmute alerts  
import('./src/ml/detectorAPI.ml.js').then(d => d.mute(false));

// Snooze for 10 minutes
import('./src/ml/detectorAPI.ml.js').then(d => d.snooze(10));

// Check status
import('./src/ml/detectorAPI.ml.js').then(d => console.log(d.getStatus()));
```

## Troubleshooting

### "No pose detected"
- **Make sure you're visible** in the camera frame
- **Good lighting** helps pose detection
- **Sit facing the camera** (not sideways)
- **Upper body should be visible** (shoulders to head minimum)

### "Alerts not working"
- Check console for errors
- Verify pose detection is active (green skeleton visible)
- Try slouching more dramatically (>15° forward lean)
- Check if alerts are muted: `import('./src/ml/detectorAPI.ml.js').then(d => console.log(d.getStatus()))`

### MediaPipe loading issues
- **Refresh the page** if pose detection doesn't start
- **Check internet connection** (MediaPipe loads models from CDN)
- **Allow camera permissions** when prompted

## What You'll See

### Good Posture
- 🟢 "Posture: Good" 
- 📐 Spine angle: 0-8°
- 🔇 No alerts

### Fair Posture  
- 🟡 "Posture: Fair"
- 📐 Spine angle: 8-15°
- 🔇 No alerts (yet)

### Poor Posture
- 🔴 "Posture: Poor" 
- 📐 Spine angle: 15°+
- 🔊 Voice alert after 5 seconds

## Advanced Features

### Export Training Data
```javascript
import('./src/ml/trainerAPI.ml.js').then(trainer => {
  const data = trainer.exportDataset();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-posture-data.json';
  a.click();
});
```

### Adjust Sensitivity
```javascript
// Make alerts more/less sensitive
import('./src/ml/detectorAPI.ml.js').then(async (detector) => {
  await detector.initDetector({
    config: {
      SLOUCH_THRESHOLD: 10,    // More sensitive (10° vs 15°)
      PERSIST_MS: 3000,        // Faster alerts (3s vs 5s)
      ALERT_COOLDOWN_MS: 60000 // More frequent (1min vs 30s)
    }
  });
});
```

## Next Steps

1. **Test the basic alerts** - slouch and wait for voice feedback
2. **Record training data** if you want personalized detection  
3. **Adjust settings** via console commands
4. **Use daily** - the system learns your posture patterns

The app now provides **real posture detection with actual alerts**! No more fake data - it's detecting your actual spine angle and alerting when you slouch. 🎉

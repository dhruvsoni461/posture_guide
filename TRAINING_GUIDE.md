# 🎓 Step-by-Step Training Guide: Seat-Specific Posture Model

This guide will walk you through collecting training data and training your personal posture detection model for your specific seating setup.

## 📋 Prerequisites

1. **Camera Access**: Make sure your camera is working and you've granted permission
2. **Good Lighting**: Ensure your face and upper body are clearly visible
3. **Stable Position**: Sit in your normal working position
4. **Time**: Allow 5-10 minutes for data collection

---

## 🎯 Step 1: Enable Camera and Start Detection

1. Open the app in your browser
2. Click **"Enable Camera"** button
3. Grant camera permission when prompted
4. Wait until you see "Pose Detection: Active" in the status panel
5. Make sure you can see yourself clearly in the camera preview

---

## 📸 Step 2: Collect "Good Posture" Samples

### What is "Good Posture"?
- Sit upright with your back straight
- Shoulders relaxed and aligned
- Head positioned directly above your shoulders
- Spine in a neutral, vertical position

### How to Record:

1. **Sit in your best posture** - the way you want to maintain
2. Click the **"Record Good"** button (or use console command)
3. **Hold the position** for 5 seconds while the system records
4. You'll see a message: "Recording good posture for 5 seconds..."
5. Wait for confirmation: "Recorded X samples for good"

### Repeat 20 Times:
- **Minimum**: 20 samples (recommended: 30-40 for better accuracy)
- **Variations**: Slight natural movements are okay, but keep overall good posture
- **Take breaks**: Record 5-10 samples, then take a 30-second break

### Console Alternative:
```javascript
// Open browser console (F12) and run:
const trainer = await import('./src/ml/trainerAPI.ml.js');
await trainer.initTrainer({
  getKeypoints: () => window.__LATEST_KEYPOINTS__,
  onStatus: (msg) => console.log(msg)
});

// Record good posture (5 seconds)
await trainer.startRecording('good', 5000);
```

---

## 📸 Step 3: Collect "Slouch" Samples

### What is "Slouch"?
- Leaning forward with rounded shoulders
- Head pushed forward (forward head posture)
- Spine curved or hunched
- Any position you want the system to detect as "poor"

### How to Record:

1. **Intentionally slouch** - lean forward, round your shoulders
2. Click the **"Record Slouch"** button
3. **Hold the slouched position** for 5 seconds
4. Wait for confirmation: "Recorded X samples for slouch"

### Repeat 20 Times:
- **Minimum**: 20 samples (recommended: 30-40)
- **Variations**: Try different slouch positions:
  - Forward lean
  - Side lean
  - Rounded shoulders
  - Head forward
- **Take breaks**: Record 5-10 samples, rest, then continue

### Console Alternative:
```javascript
// Record slouch posture (5 seconds)
await trainer.startRecording('slouch', 5000);
```

---

## 📊 Step 4: Check Your Dataset

Before training, verify you have enough samples:

### Using UI:
- Check the status message after recording
- It should show: "Ready to train! Check console for training commands."

### Using Console:
```javascript
// Check dataset statistics
const stats = trainer.getDatasetStats();
console.log('Dataset Stats:', stats);
// Should show: { good: 20+, slouch: 20+, total: 40+, canTrain: true }
```

**Requirements:**
- ✅ At least 20 "good" samples
- ✅ At least 20 "slouch" samples
- ✅ `canTrain: true`

If you don't have enough:
- Go back to Step 2 or 3
- Record more samples until you reach the minimum

---

## 🤖 Step 5: Train Your Model

Once you have enough samples, train your personal model:

### Using Console (Recommended):

```javascript
// Train the model with default settings (20 epochs)
const result = await trainer.train({
  epochs: 20,        // Training iterations (20 is good for start)
  batchSize: 16,     // Samples per batch
  onProgress: (progress) => {
    console.log(`Epoch ${progress.epoch}/${progress.totalEpochs}: 
      Loss: ${progress.loss.toFixed(4)}, 
      Accuracy: ${progress.accuracy.toFixed(3)}`);
  }
});

console.log('Training Complete!', result);
// Should show: { success: true, accuracy: 0.85+, loss: < 0.5 }
```

### What Happens During Training:
1. **Data Preparation**: Normalizes your features
2. **Model Building**: Creates a neural network
3. **Training**: Runs for 20 epochs (iterations)
4. **Validation**: Tests on 20% of your data
5. **Saving**: Stores model in browser's IndexedDB

### Expected Results:
- **Accuracy**: Should be 80-95% (higher is better)
- **Loss**: Should decrease over epochs (lower is better)
- **Training Time**: 30-60 seconds depending on your computer

### If Training Fails:
- **Error: "Insufficient training data"** → Record more samples
- **Low accuracy (< 70%)** → Collect more diverse samples
- **Training takes too long** → Reduce epochs to 10-15

---

## ✅ Step 6: Verify Model is Loaded

After training, verify the model was saved:

```javascript
// Check if model exists
const status = await trainer.getModelStatus();
console.log('Model Status:', status);
// Should show: { loaded: true, exists: true, accuracy: 0.85+ }
```

The detector will automatically load this model on next startup.

---

## 🚀 Step 7: Test Your Trained Model

1. **Restart the detector** (if it was running):
   ```javascript
   // Stop and restart
   await stopDetector();
   await startDetector();
   ```

2. **Sit in good posture** - should show "GOOD" on screen
3. **Slouch intentionally** - should show "POOR" within 2-5 seconds
4. **Alert should trigger** - you'll hear a beep and see alert message

### Test Different Positions:
- ✅ Good posture → Should detect as "GOOD"
- ✅ Mild slouch → Should detect as "FAIR" or "MILD"
- ✅ Strong slouch → Should detect as "POOR" and trigger alert

---

## 🔧 Advanced: Fine-Tuning Your Model

### If Model is Too Sensitive (alerts too often):
```javascript
// Adjust thresholds in constants.ml.js
GOOD_THRESHOLD: 3.0,    // Increase to 4.0 or 5.0
MILD_THRESHOLD: 6.0,    // Increase to 8.0
```

### If Model is Not Sensitive Enough:
```javascript
// Decrease thresholds
GOOD_THRESHOLD: 2.0,    // Decrease to 1.5
MILD_THRESHOLD: 4.0,   // Decrease to 3.0
```

### Retrain with More Data:
- Collect 50+ samples per class
- Train with more epochs (30-40)
- Use different lighting conditions
- Include different times of day

---

## 📦 Export/Import Your Dataset

### Export (Backup):
```javascript
const datasetJson = trainer.exportDataset();
console.log(datasetJson);
// Copy this JSON and save it somewhere safe
```

### Import (Restore):
```javascript
// Paste your saved JSON
const jsonData = `{...your saved dataset...}`;
await trainer.importDataset(jsonData);
```

---

## 🎯 Seat-Specific Training Tips

### For Different Chairs:
1. **Office Chair**: Train while sitting in your normal work chair
2. **Couch**: If you work from couch, train there too
3. **Different Heights**: Adjust camera angle if needed

### For Different Setups:
- **Laptop on Desk**: Train with laptop at eye level
- **Laptop on Lap**: Train in that position
- **External Monitor**: Train with your normal monitor setup

### Best Practices:
- ✅ Train in your **actual working environment**
- ✅ Use **consistent lighting** during training
- ✅ Record samples at **different times** (morning, afternoon)
- ✅ Include **natural variations** (slight movements)
- ✅ **Retrain periodically** (every few weeks) as your posture improves

---

## 🐛 Troubleshooting

### Problem: "No pose detected"
- **Solution**: Improve lighting, move closer to camera, ensure upper body is visible

### Problem: "Low confidence" errors
- **Solution**: Better lighting, sit still during recording, ensure camera can see shoulders and hips

### Problem: Model always predicts "good"
- **Solution**: Record more diverse "slouch" samples, check that slouch samples are actually different

### Problem: Model always predicts "bad"
- **Solution**: Record more "good" samples, ensure you're actually sitting upright during good recordings

### Problem: Training fails with error
- **Solution**: Check browser console for specific error, ensure TensorFlow.js is loaded

### Problem: Model not loading after training
- **Solution**: Refresh page, check IndexedDB is enabled in browser, verify model was saved

---

## 📝 Quick Reference Commands

```javascript
// Initialize trainer
const trainer = await import('./src/ml/trainerAPI.ml.js');
await trainer.initTrainer({
  getKeypoints: () => window.__LATEST_KEYPOINTS__,
  onStatus: (msg) => console.log(msg)
});

// Record samples
await trainer.startRecording('good', 5000);   // 5 seconds
await trainer.startRecording('slouch', 5000);

// Check stats
const stats = trainer.getDatasetStats();
console.log(stats);

// Train model
await trainer.train({ epochs: 20 });

// Check model status
const status = await trainer.getModelStatus();
console.log(status);

// Export dataset
const json = trainer.exportDataset();
console.log(json);
```

---

## ✅ Success Checklist

Before considering training complete:

- [ ] Collected at least 20 "good" posture samples
- [ ] Collected at least 20 "slouch" posture samples
- [ ] Dataset shows `canTrain: true`
- [ ] Training completed successfully
- [ ] Model accuracy is 80% or higher
- [ ] Model status shows `loaded: true` and `exists: true`
- [ ] Tested detection with good posture → shows "GOOD"
- [ ] Tested detection with slouch → shows "POOR" and triggers alert
- [ ] Alert sound plays when posture is poor

---

## 🎉 You're Done!

Your personal posture detection model is now trained and ready to use. The system will:
- ✅ Automatically load your model on startup
- ✅ Use your trained model for more accurate detection
- ✅ Adapt to your specific seating setup
- ✅ Provide personalized alerts based on your training data

**Remember**: Retrain your model every few weeks or if you change your seating setup for best results!

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console for error messages
2. Verify camera permissions are granted
3. Ensure TensorFlow.js is loaded (check Network tab)
4. Try refreshing the page and starting over
5. Check that you have enough samples (20+ per class)

Happy training! 🚀


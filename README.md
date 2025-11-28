📘 PostureGuard – README.md

AI-powered posture detection with periodic camera sampling, ML training, and voice alerts
Frontend: React (with MediaPipe), Backend: Django (no DB yet), Client-side ML

## 🎓 Training Your Personal Model

**NEW**: See **[TRAINING_GUIDE.md](./TRAINING_GUIDE.md)** for a complete step-by-step guide on:
- Collecting 20+ samples for "good" and "slouch" postures
- Training your seat-specific model
- Testing and fine-tuning your model
- Troubleshooting common issues

Quick start: Enable camera → Record Good (20x) → Record Slouch (20x) → Train Model

🧠 Overview

PostureGuard is a smart posture monitoring system built for students and professionals who spend long hours on laptops.
Instead of keeping the camera ON continuously (which drains battery & risks privacy), our approach uses Periodic Sampling:

Camera turns on every 1 minute

Stays active for 5–10 seconds

Detects posture using MediaPipe BlazePose

Uses ML to classify posture as Good / Slouch

Plays voice alerts when slouch persists

Completely local — no video frames leave the device

This README explains the architecture, training approach, slouch detection model, integration steps, and how to wire the new ML modules into your already-built frontend.

🎯 Features
✔ Periodic camera activation

Battery-friendly: camera is ON only 10–15% of the time.

✔ MediaPipe BlazePose keypoints

Accurate face, shoulder, hip, and spine keypoints.

✔ Custom ML model (client-side, TF.js)

User-specific model trained inside the browser.

✔ Real-time slouch detection

Using angles + ML classification.

✔ Voice Alerts

Uses Web Speech API:

“Please sit upright and straighten your back.”

✔ Privacy-first

No video storage. No frames sent to backend. Only angles & labels stored.

✔ Non-invasive integration

ML modules do not modify your existing frontend code.
They integrate via:

import, or

window.__LATEST_KEYPOINTS__ (auto-detect).

🏗️ Project Structure Overview
/frontend
    /src
        /components
        /ml
            poseUtils.js
            modelService.js
            trainerAPI.js
            detectorAPI.js
            storage.js
            constants.js
        App.jsx
        Landing.jsx
        CameraAccess.jsx
    package.json

/backend
    (Django without DB; in-memory store)

🔧 How Periodic Sampling Works

Your existing flow is preserved:

Every 60 seconds:
    Turn ON camera
    For 10 seconds:
       - Run BlazePose at ~5fps
       - Collect features (angles, nose→shoulder distance, etc.)
       - Run ML inference
    Turn camera OFF
    If slouch persists → voice alert


No changes to existing logic, the new ML just plugs in internally.

🧍🏻 Posture Features Extracted

From BlazePose keypoints:

spine_angle

spine_angle_relative = spine_angle - baseline_angle

neck_tilt

head_forward_dist

shoulder_slope

avg_confidence

These are used by both:

Threshold-based fallback classifier, and

Trained TF.js neural network

🤖 The ML Model
Model Type

Small Sequential model:

Dense(32) → Dense(16) → Dense(2 softmax)

Input

5–6 numeric features (normalized).

Output

[P(good), P(slouch)]

Storage

Saved to IndexedDB as:

indexeddb://posture-model-v1

Training Requirements

You must collect at least 20 samples per class:

Good

Slouch

🎥 Data Collection UI (Trainer)

You will get a trainer API with functions:

startRecording("good")
startRecording("slouch")
stopRecording()
train()
loadModel()
exportDataset()
importDataset(json)


Use these from browser console or integrate UI buttons later.

📡 Detector API (Inference)

You will get:

initDetector({getKeypoints, onAlert, config})
startDetector()
stopDetector()
forceInferOnce()
isModelLoaded()


This does NOT modify your existing camera or periodic loop — it hooks into it.

🔊 Voice Alerts

Uses Web Speech API:

speechSynthesis.speak(new SpeechSynthesisUtterance("Please sit upright"));


Alerts respect:

persistence threshold (e.g., 8 seconds slouch)

cooldown (e.g., 2 minutes)

mute/snooze flags

🔌 How to Integrate the ML Code (IMPORTANT)
Option A — Import (recommended)

Add this to your existing code (e.g., Landing.jsx or CameraAccess.jsx):

import { initDetector, startDetector } from "./ml/detectorAPI";

useEffect(() => {
    initDetector({
        getKeypoints: () => window.__LATEST_KEYPOINTS__, // already set in your code
        onAlert: ({label}) => console.log("ALERT:", label)
    });
    startDetector();
}, []);

Option B — ZERO changes (auto-detection)

If you already update:

window.__LATEST_KEYPOINTS__ = latestKeypointFrame;


Then the ML modules will auto-detect them.

🧪 Testing Guide
1. Calibrate

Sit straight → press “Calibrate”.

2. Collect Data

In browser console:

trainer.startRecording("good")
trainer.startRecording("slouch")
trainer.train()

3. Load & Run Detector
detector.loadModel()
detector.startDetector()

4. Test Slouch

Lean forward → hold slouch for 8 seconds → voice alert triggers.

🔐 Privacy Notes

Your backend does NOT receive:

images

frames

videos

Data stored:

posture angles

numerical features

predicted labels

local model

calibration values

Everything stays on device.

🐍 Backend (Django, No DB)

Stores sessions in memory

Receives only posture events & metrics

No video

No training data

No sensitive content

Backend is optional for the core ML—ML is client-side.

🛠️ Requirements

Frontend:

npm install @tensorflow/tfjs @mediapipe/pose idb-keyval


Backend (optional):

pip install django djangorestframework pyjwt bcrypt

📦 Exporting / Importing Dataset

You can export dataset for sharing:

trainer.exportDataset()


And import on another machine:

trainer.importDataset(jsonData)

🎤 Example Console Flow (copy & paste)
1. Train Model
await trainer.startRecording("good", 6000)
await trainer.startRecording("slouch", 6000)
await trainer.train({epochs: 20})

2. Start Live Detection
await detector.loadModel()
detector.startDetector()

🧩 Troubleshooting
🔸 Model always predicts “Good”

Not enough slouch samples

Poor lighting

Wrong keypoints

Need calibration

Model not loaded (using fallback)

🔸 Voice not playing

Browser blocked audio → perform one user click first

Use startDetector() after a button click

🔸 Keypoints undefined

Check your camera component sets:

window.__LATEST_KEYPOINTS__
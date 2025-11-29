// src/components/CameraAccessWithPoseFixed.jsx
// Replaces placeholder camera component and wires MediaPipe BlazePose -> detectorAPI.ml.js
// - Uses @mediapipe/pose and @mediapipe/camera_utils
// - Exposes Enable Camera, Start/Stop Sampling (detector controls windows)
// - Calls setUserGesture() on user interaction to enable speech
// - Draws simple overlay of keypoints on canvas
//
// Ensure you have installed:
//   npm install @mediapipe/pose @mediapipe/camera_utils
//
// NOTE: This component intentionally defers window sampling and timing to the detector (detectorAPI.ml.js).
// It only manages camera, pose inference, and feeding keypoints to the detector.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

// Import the ML detector (the strict .ml.js version generated earlier)
import {
  initDetector,
  startDetector,
  stopDetector,
  setUserGesture,
  forceInferOnce,
  mute,
  snooze,
  getStatus
} from '../ml/detectorAPI.ml.js';

const CameraAccessWithPoseFixed = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectorRunning, setDetectorRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Idle');
  const [lastPostureCheck, setLastPostureCheck] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentPosture, setCurrentPosture] = useState(null); // {label: 'good'|'mild'|'bad', angle: number}
  const [poseDetected, setPoseDetected] = useState(false);
  const [samplingLoopActive, setSamplingLoopActive] = useState(false); // 15s on / 60s off loop

  // store last keypoints here (and push to window.__LATEST_KEYPOINTS__)
  const latestKeypointsRef = useRef(null);
  const detectorInstanceRef = useRef(null);
  const postureCheckIntervalRef = useRef(null);

  // Periodic sampling loop (15s detection, 60s pause)
  const samplingWindowTimeoutRef = useRef(null);
  const samplingLoopTimeoutRef = useRef(null);
  const samplingLoopFlagRef = useRef(false);

  // Helper: draw keypoints and posture status on canvas
  const drawKeypoints = useCallback((keypoints, posture) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = video.videoWidth || 640;
    const h = canvas.height = video.videoHeight || 480;

    // clear
    ctx.clearRect(0, 0, w, h);

    if (!keypoints) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '20px Arial';
      ctx.fillText('No pose detected', 20, 40);
      return;
    }

    // Draw pose landmarks if available
    if (Array.isArray(keypoints) && keypoints.length > 0) {
      // MediaPipe format - draw key points
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;

      // Draw shoulders and hips
      const drawPoint = (point, color = '#34d399') => {
        if (!point || point.x == null || point.y == null) return;
        const cx = (point.x <= 1 ? point.x * w : point.x);
        const cy = (point.y <= 1 ? point.y * h : point.y);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      };

      // Draw key points (shoulders and hips)
      if (keypoints[11]) drawPoint(keypoints[11]); // left shoulder
      if (keypoints[12]) drawPoint(keypoints[12]); // right shoulder
      if (keypoints[23]) drawPoint(keypoints[23]); // left hip
      if (keypoints[24]) drawPoint(keypoints[24]); // right hip

      // Draw spine line
      if (keypoints[11] && keypoints[12] && keypoints[23] && keypoints[24]) {
        const shoulderMid = {
          x: ((keypoints[11].x + keypoints[12].x) / 2) * (keypoints[11].x <= 1 ? w : 1),
          y: ((keypoints[11].y + keypoints[12].y) / 2) * (keypoints[11].y <= 1 ? h : 1)
        };
        const hipMid = {
          x: ((keypoints[23].x + keypoints[24].x) / 2) * (keypoints[23].x <= 1 ? w : 1),
          y: ((keypoints[23].y + keypoints[24].y) / 2) * (keypoints[23].y <= 1 ? h : 1)
        };

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(shoulderMid.x, shoulderMid.y);
        ctx.lineTo(hipMid.x, hipMid.y);
        ctx.stroke();
      }
    }

    // Draw posture status overlay
    if (posture) {
      const { label, angle } = posture;
      let statusText = '';
      let statusColor = '#FFFFFF';
      let bgColor = 'rgba(0,0,0,0.7)';

      if (label === 'good') {
        statusText = 'GOOD';
        statusColor = '#00FF00';
        bgColor = 'rgba(0,255,0,0.2)';
      } else if (label === 'mild') {
        statusText = 'FAIR';
        statusColor = '#FFFF00';
        bgColor = 'rgba(255,255,0,0.2)';
      } else if (label === 'bad') {
        statusText = 'POOR';
        statusColor = '#FF0000';
        bgColor = 'rgba(255,0,0,0.3)';
      }

      // Background box
      ctx.fillStyle = bgColor;
      ctx.fillRect(10, 10, 200, 80);

      // Status text
      ctx.fillStyle = statusColor;
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Posture: ${statusText}`, 20, 40);

      // Angle display
      if (angle !== undefined) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.fillText(`Angle: ${angle.toFixed(1)}°`, 20, 65);
      }
    } else {
      // No posture data yet
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '16px Arial';
      ctx.fillText('Analyzing posture...', 20, 40);
    }
  }, []);

  // onPose callback from MediaPipe
  const onResults = useCallback(async (results) => {
    // results.poseLandmarks may be an array
    const keypoints = results?.poseLandmarks || null;

    // Convert to our format for detector
    if (keypoints && keypoints.length > 0) {
      const formattedKeypoints = {
        nose: { x: keypoints[0].x, y: keypoints[0].y, z: keypoints[0].z ?? 0, confidence: keypoints[0].visibility || 0.9 },
        left_shoulder: { x: keypoints[11].x, y: keypoints[11].y, z: keypoints[11].z ?? 0, confidence: keypoints[11].visibility || 0.9 },
        right_shoulder: { x: keypoints[12].x, y: keypoints[12].y, z: keypoints[12].z ?? 0, confidence: keypoints[12].visibility || 0.9 },
        left_hip: { x: keypoints[23].x, y: keypoints[23].y, z: keypoints[23].z ?? 0, confidence: keypoints[23].visibility || 0.9 },
        right_hip: { x: keypoints[24].x, y: keypoints[24].y, z: keypoints[24].z ?? 0, confidence: keypoints[24].visibility || 0.9 }
      };
      latestKeypointsRef.current = formattedKeypoints;
      window.__LATEST_KEYPOINTS__ = formattedKeypoints;
      setPoseDetected(true);
    } else {
      latestKeypointsRef.current = null;
      window.__LATEST_KEYPOINTS__ = null;
      setPoseDetected(false);
      setCurrentPosture(null);
    }

    // Get real-time posture status if detector is running
    let postureToDraw = currentPosture;
    if (detectorInstanceRef.current && keypoints && keypoints.length > 0) {
      try {
        const result = await forceInferOnce();
        if (result && result.label && !result.error) {
          const newPosture = {
            label: result.label,
            angle: result.angleRel || result.angle
          };
          setCurrentPosture(newPosture);
          postureToDraw = newPosture;
          setLastPostureCheck(new Date().toLocaleTimeString());
        }
      } catch (e) {
        // Ignore inference errors
      }
    }

    // Draw overlay with posture status
    drawKeypoints(keypoints, postureToDraw);
  }, [drawKeypoints, currentPosture]);

  // Start MediaPipe Pose camera and pipeline
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return false;
    try {
      setStatusMessage('Starting camera...');
      const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      pose.onResults(onResults);

      // Use Camera Utils to stream from webcam into the pose
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await pose.send({ image: videoRef.current });
        },
        width: 1280,
        height: 720,
        facingMode: 'user'
      });

      camera.start();
      cameraRef.current = camera;
      setIsCameraActive(true);
      setStatusMessage('Camera live');
      return true;
    } catch (err) {
      console.error('startCamera failed', err);
      setStatusMessage('Camera start failed');
      return false;
    }
  }, [onResults]);

  const stopCamera = useCallback(() => {
    try {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn('stopCamera error', err);
    }
    setIsCameraActive(false);
    setStatusMessage('Camera stopped');
  }, []);

  // Initialize detector with getKeypoints bound to latestKeypointsRef
  const handleInitDetector = useCallback(async () => {
    const instance = await initDetector({
      getKeypoints: () => latestKeypointsRef.current,
      onAlert: async (alertData) => {
        // Called by detector when alert condition occurs
        console.log('POSTURE ALERT:', alertData);
        setStatusMessage(`🚨 ALERT: ${alertData.message}`);
        setCurrentPosture({ label: 'bad', angle: null });
        
        // Play alert sound immediately
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = 800; // Alert tone
          g.gain.setValueAtTime(0.3, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.5);
          setTimeout(() => ctx.close?.(), 600);
        } catch (e) {
          console.warn('Audio alert failed:', e);
        }
      },
      onUpdate: (status) => {
        if (typeof status === 'string') {
          setStatusMessage(status);
        } else if (status && status.windowLabel) {
          setStatusMessage(`Status: ${status.windowLabel.toUpperCase()} (${status.validFrames} frames)`);
          // Update current posture from window status
          if (status.windowLabel) {
            setCurrentPosture({
              label: status.windowLabel,
              angle: parseFloat(status.medianAngleRel || status.avgAngleRel || 0)
            });
          }
        } else {
          setStatusMessage(typeof status === 'object' ? JSON.stringify(status) : String(status));
        }
      },
      onDebug: (msg) => {
        if (debugMode) console.debug('[Detector Debug]', msg);
      },
      config: {
        DEBUG: debugMode,
        PERSIST_MS: 8000, // Alert after 8 seconds (2 windows of bad posture)
        ALERT_COOLDOWN_MS: 30000, // 30 seconds between alerts
        SAMPLING_WINDOW_MS: 5000, // 5 second windows for faster feedback
        WINDOWS_VOTES_REQUIRED: 2, // Require 2 bad windows out of 3
        WINDOWS_HISTORY: 3, // Keep last 3 windows
        GOOD_THRESHOLD: 5.0, // More forgiving for good posture
        MILD_THRESHOLD: 10.0,
        BAD_THRESHOLD: 10.0
      }
    });
    detectorInstanceRef.current = instance;
  }, [debugMode, muted]);

  // Helper: stop detector + camera + posture interval (single 15s window)
  const stopSamplingWindow = useCallback(async () => {
    try {
      await stopDetector();
    } catch (e) {
      console.warn('stopDetector error', e);
    }

    if (postureCheckIntervalRef.current) {
      clearInterval(postureCheckIntervalRef.current);
      postureCheckIntervalRef.current = null;
    }

    stopCamera();
    setDetectorRunning(false);
    setCurrentPosture(null);
  }, [stopCamera]);

  // Single 15s sampling window
  const startSamplingWindow = useCallback(async () => {
    // If user has stopped the loop, don't start a new window
    if (!samplingLoopFlagRef.current) {
      return;
    }

    // Set user gesture so speech can run: call this on a direct user interaction
    try {
      setUserGesture();
    } catch (e) {
      console.warn('setUserGesture error', e);
    }

    // ensure camera is running
    const ok = await startCamera();
    if (!ok) {
      setStatusMessage('Cannot start camera for sampling');
      return;
    }

    // init detector if not already
    await handleInitDetector();

    try {
      await startDetector();
      setDetectorRunning(true);
      setStatusMessage('Sampling window active (15s)');

      // Start continuous posture checking every 500ms during this 15s window
      let consecutiveBadCount = 0;
      postureCheckIntervalRef.current = setInterval(async () => {
        if (latestKeypointsRef.current && detectorInstanceRef.current) {
          try {
            const result = await forceInferOnce();
            if (result && result.label && !result.error) {
              const newPosture = {
                label: result.label,
                angle: result.angleRel || result.angle
              };
              setCurrentPosture(newPosture);
              setLastPostureCheck(new Date().toLocaleTimeString());

              // Immediate alert check: if bad posture persists for 3+ consecutive checks (1.5 seconds)
              if (result.label === 'bad') {
                consecutiveBadCount++;
                if (consecutiveBadCount >= 3) {
                  // Trigger immediate alert sound
                  try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.value = 800;
                    g.gain.setValueAtTime(0.3, ctx.currentTime);
                    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                    o.connect(g);
                    g.connect(ctx.destination);
                    o.start();
                    o.stop(ctx.currentTime + 0.5);
                    setTimeout(() => ctx.close?.(), 600);
                    consecutiveBadCount = 0; // Reset to prevent spam
                  } catch (e) {
                    console.warn('Immediate alert sound failed:', e);
                  }
                }
              } else {
                consecutiveBadCount = 0; // Reset on good posture
              }
            }
          } catch (e) {
            // Ignore inference errors
          }
        }
      }, 500); // Check every 500ms for real-time feedback

      // Stop this window after 15 seconds, then schedule next one
      if (samplingWindowTimeoutRef.current) {
        clearTimeout(samplingWindowTimeoutRef.current);
      }
      samplingWindowTimeoutRef.current = setTimeout(async () => {
        await stopSamplingWindow();
        setStatusMessage('Sampling window finished. Next check in 60s');

        // Schedule next 15s window after 60 seconds (camera off during this time)
        if (samplingLoopFlagRef.current) {
          if (samplingLoopTimeoutRef.current) {
            clearTimeout(samplingLoopTimeoutRef.current);
          }
          samplingLoopTimeoutRef.current = setTimeout(() => {
            startSamplingWindow();
          }, 60000);
        }
      }, 15000);
    } catch (err) {
      console.error('startDetector failed', err);
      setStatusMessage('Detector start failed');
      await stopSamplingWindow();
    }
  }, [handleInitDetector, startCamera, stopSamplingWindow]);

  // Start / stop the 15s-on / 60s-off loop
  const handleStartSamplingLoop = useCallback(async () => {
    if (samplingLoopFlagRef.current) {
      // Already active – should not happen, but guard
      return;
    }
    samplingLoopFlagRef.current = true;
    setSamplingLoopActive(true);

    // Start first window immediately
    await startSamplingWindow();
  }, [startSamplingWindow]);

  const handleStopSamplingLoop = useCallback(async () => {
    samplingLoopFlagRef.current = false;
    setSamplingLoopActive(false);

    // Clear all timeouts
    if (samplingWindowTimeoutRef.current) {
      clearTimeout(samplingWindowTimeoutRef.current);
      samplingWindowTimeoutRef.current = null;
    }
    if (samplingLoopTimeoutRef.current) {
      clearTimeout(samplingLoopTimeoutRef.current);
      samplingLoopTimeoutRef.current = null;
    }

    // Stop any active window
    await stopSamplingWindow();
    setStatusMessage('Sampling loop stopped');
  }, [stopSamplingWindow]);

  // Redraw canvas when posture changes
  useEffect(() => {
    if (latestKeypointsRef.current) {
      drawKeypoints(latestKeypointsRef.current, currentPosture);
    }
  }, [currentPosture, drawKeypoints]);

  // When component unmounts, cleanup
  useEffect(() => {
    return () => {
      // ensure detector & camera stopped
      try { stopDetector(); } catch (e) {}
      if (postureCheckIntervalRef.current) {
        clearInterval(postureCheckIntervalRef.current);
      }
      if (samplingWindowTimeoutRef.current) {
        clearTimeout(samplingWindowTimeoutRef.current);
      }
      if (samplingLoopTimeoutRef.current) {
        clearTimeout(samplingLoopTimeoutRef.current);
      }
      samplingLoopFlagRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  // Resize canvas to video size when metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  }, []);

  // Toggle debug
  const toggleDebug = useCallback(() => setDebugMode(d => !d), []);

  // Mute toggle (visual control only - detector.mute() is still authoritative)
  const handleMuteToggle = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    try { mute(newMuted); } catch (e) { console.warn(e); }
  }, [muted]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            // user gesture: must be performed in direct click handler to enable speech
            try { setUserGesture(); } catch (e) {/* ignore */}
            const ok = await startCamera();
            if (ok) {
              setPermissionStatus('granted');
            } else {
              setPermissionStatus('denied');
            }
          }}
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2 font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-sky-500"
        >
          Enable Camera
        </button>

        <button
          type="button"
          onClick={async () => {
            if (samplingLoopActive) {
              await handleStopSamplingLoop();
            } else {
              await handleStartSamplingLoop();
            }
          }}
          className={`inline-flex items-center rounded-xl px-4 py-2 font-semibold shadow transition ${
            samplingLoopActive
              ? 'bg-emerald-500/80 text-white shadow-emerald-500/40'
              : 'bg-slate-800 text-slate-200 shadow-slate-900'
          }`}
        >
          {samplingLoopActive ? 'Stop Sampling' : 'Start Sampling'}
        </button>

        <button
          type="button"
          onClick={() => {
            toggleDebug();
          }}
          className="inline-flex items-center rounded-xl px-3 py-2 text-sm border bg-slate-800 text-slate-200"
        >
          {debugMode ? 'Debug On' : 'Debug Off'}
        </button>

        <button
          type="button"
          onClick={handleMuteToggle}
          className="inline-flex items-center rounded-xl px-3 py-2 text-sm border bg-slate-800 text-slate-200"
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      <div className="relative mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-2xl">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              autoPlay
              muted
              onLoadedMetadata={handleLoadedMetadata}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
            />
            {!isCameraActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-slate-400">
                <p>Camera preview will appear here after permission.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Permission</dt>
          <dd className="text-white capitalize">{permissionStatus}</dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Pose Detection</dt>
          <dd className={`font-semibold ${poseDetected ? 'text-green-400' : 'text-red-400'}`}>
            {poseDetected ? 'Active' : 'No Pose'}
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Current Posture</dt>
          <dd className={`font-bold text-lg ${
            currentPosture?.label === 'good' ? 'text-green-400' :
            currentPosture?.label === 'mild' ? 'text-yellow-400' :
            currentPosture?.label === 'bad' ? 'text-red-400' : 'text-slate-400'
          }`}>
            {currentPosture ? currentPosture.label.toUpperCase() : '---'}
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Status</dt>
          <dd className="text-white text-xs break-words">{statusMessage}</dd>
        </div>
      </dl>
    </div>
  );
};

export default CameraAccessWithPoseFixed;
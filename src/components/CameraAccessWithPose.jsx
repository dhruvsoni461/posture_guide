import { useCallback, useEffect, useRef, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const CAMERA_ON_DURATION = 30_000; // 10 seconds
const SAMPLING_INTERVAL = 90_000; // once per minute

const CameraAccessWithPose = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const samplingIntervalRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);

  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [samplingEnabled, setSamplingEnabled] = useState(false);
  const [lastPostureCheck, setLastPostureCheck] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Camera idle');
  const [poseDetected, setPoseDetected] = useState(false);
  const [currentKeypoints, setCurrentKeypoints] = useState(null);

  // Initialize MediaPipe Pose
  const initializePose = useCallback(() => {
    if (poseRef.current) return poseRef.current;

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
    poseRef.current = pose;
    return pose;
  }, []);

  // Handle pose detection results
  const onPoseResults = useCallback((results) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
      // Convert MediaPipe landmarks to our format
      const landmarks = results.poseLandmarks;
      const withDepth = (index) => ({
        x: landmarks[index].x,
        y: landmarks[index].y,
        z: landmarks[index].z ?? 0,
        confidence: landmarks[index].visibility || 0.9
      });

      const keypoints = {
        nose: withDepth(0),
        left_shoulder: withDepth(11),
        right_shoulder: withDepth(12),
        left_hip: withDepth(23),
        right_hip: withDepth(24)
      };

      // Store keypoints globally for ML modules
      setCurrentKeypoints(keypoints);
      window.__LATEST_KEYPOINTS__ = keypoints;

      // Draw pose landmarks
      drawConnectors(ctx, results.poseLandmarks, Pose.POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 2
      });
      
      drawLandmarks(ctx, results.poseLandmarks, {
        color: '#FF0000',
        lineWidth: 1,
        radius: 3
      });

      // Draw spine line for visual feedback
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];

      if (leftShoulder && rightShoulder && leftHip && rightHip) {
        const shoulderMid = {
          x: (leftShoulder.x + rightShoulder.x) / 2 * canvas.width,
          y: (leftShoulder.y + rightShoulder.y) / 2 * canvas.height
        };
        const hipMid = {
          x: (leftHip.x + rightHip.x) / 2 * canvas.width,
          y: (leftHip.y + rightHip.y) / 2 * canvas.height
        };

        // Draw spine line
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(shoulderMid.x, shoulderMid.y);
        ctx.lineTo(hipMid.x, hipMid.y);
        ctx.stroke();

        // Calculate and display spine angle
        const dx = hipMid.x - shoulderMid.x;
        const dy = hipMid.y - shoulderMid.y;
        const angle = Math.abs(Math.atan2(dx, dy)) * (180 / Math.PI);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.fillText(`Spine Angle: ${angle.toFixed(1)}°`, 20, 40);
        
        // Visual feedback for posture
        const postureStatus = angle < 10 ? 'Good' : angle < 20 ? 'Fair' : 'Poor';
        const statusColor = angle < 10 ? '#00FF00' : angle < 20 ? '#FFFF00' : '#FF0000';
        
        ctx.fillStyle = statusColor;
        ctx.fillText(`Posture: ${postureStatus}`, 20, 65);
      }

      setPoseDetected(true);
      setLastPostureCheck(new Date().toLocaleTimeString());
    } else {
      // No pose detected
      setPoseDetected(false);
      setCurrentKeypoints(null);
      window.__LATEST_KEYPOINTS__ = null;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '16px Arial';
      ctx.fillText('No pose detected', 20, 40);
    }
  }, []);

  const attachStreamToVideo = useCallback(async (stream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      
      try {
        await videoRef.current.play();
        
        // Initialize MediaPipe camera
        const pose = initializePose();
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && pose) {
              await pose.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });
        
        cameraRef.current = camera;
        camera.start();
        
      } catch (error) {
        console.error('Error starting camera:', error);
        setStatusMessage('Error starting camera');
      }
    }
  }, [initializePose]);

  const stopCamera = useCallback(() => {
    setIsCameraActive(false);
    setPoseDetected(false);
    setCurrentKeypoints(null);
    window.__LATEST_KEYPOINTS__ = null;
    
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    setStatusMessage('Camera stopped to save power');
  }, []);

  const requestCameraAccess = useCallback(async () => {
    try {
      setStatusMessage('Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      
      streamRef.current = stream;
      await attachStreamToVideo(stream);
      setPermissionStatus('granted');
      setIsCameraActive(true);
      setStatusMessage('Camera live - detecting pose...');
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      setPermissionStatus('denied');
      setStatusMessage('Camera permission denied');
      return false;
    }
  }, [attachStreamToVideo]);

  const runDetectionLoop = useCallback(() => {
    // MediaPipe handles detection automatically, but we can add additional logic here
    console.log('Detection loop running with MediaPipe');
    setLastPostureCheck(new Date().toLocaleTimeString());
  }, []);

  const startSampleWindow = useCallback(async () => {
    const granted = await requestCameraAccess();
    if (!granted) return;

    runDetectionLoop();

    setTimeout(() => {
      stopCamera();
    }, CAMERA_ON_DURATION);
  }, [requestCameraAccess, runDetectionLoop, stopCamera]);

  const toggleSampling = async () => {
    if (samplingEnabled) {
      setSamplingEnabled(false);
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
        samplingIntervalRef.current = null;
      }
      stopCamera();
      return;
    }

    setSamplingEnabled(true);
    await startSampleWindow();
    samplingIntervalRef.current = setInterval(() => {
      startSampleWindow();
    }, SAMPLING_INTERVAL);
  };

  // Initialize ML detector when pose detection is active
  useEffect(() => {
    if (poseDetected && currentKeypoints) {
      // Auto-initialize ML detector if not already done
      import('../ml/detectorAPI.ml.js').then(async (detector) => {
        try {
          const initialized = await detector.initDetector({
            getKeypoints: () => window.__LATEST_KEYPOINTS__,
            onAlert: (alert) => {
              setStatusMessage(`🚨 ${alert.message}`);
              console.log('POSTURE ALERT:', alert);
            },
            onUpdate: (status) => {
              console.log('ML Detector:', status);
            },
            config: {
              PERSIST_MS: 5000,        // Alert after 5s of slouching
              ALERT_COOLDOWN_MS: 30000, // 30s between alerts for demo
              SAMPLING_WINDOW_MS: 3000, // Shorter sampling for demo
              SLOUCH_THRESHOLD: 15,     // More sensitive threshold
              MILD_THRESHOLD: 8
            }
          });
          
          if (initialized && !detector.getStatus().running) {
            detector.startDetector();
            console.log('ML Detector started automatically');
          }
        } catch (error) {
          console.warn('Could not initialize ML detector:', error);
        }
      });
    }
  }, [poseDetected, currentKeypoints]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
        samplingIntervalRef.current = null;
      }
    };
  }, [stopCamera]);

  const handleResizeCanvas = () => {
    if (!videoRef.current || !canvasRef.current) return;
    canvasRef.current.width = videoRef.current.videoWidth || 640;
    canvasRef.current.height = videoRef.current.videoHeight || 480;
  };

  // Manual ML training controls
  const startTraining = async (label) => {
    if (!currentKeypoints) {
      alert('No pose detected! Please ensure you are visible in the camera.');
      return;
    }

    try {
      const trainer = await import('../ml/trainerAPI.ml.js');
      
      if (!trainer.getDatasetStats) {
        // Initialize trainer if not done
        trainer.initTrainer({
          getKeypoints: () => window.__LATEST_KEYPOINTS__,
          onStatus: (msg) => setStatusMessage(`Training: ${msg}`)
        });
      }

      setStatusMessage(`Recording ${label} posture for 5 seconds...`);
      const result = await trainer.startRecording(label, 5000);
      setStatusMessage(`Recorded ${result.count} samples for ${label}`);
      
      const stats = trainer.getDatasetStats();
      console.log('Dataset stats:', stats);
      
      if (stats.canTrain) {
        setStatusMessage('Ready to train! Check console for training commands.');
      }
      
    } catch (error) {
      console.error('Training error:', error);
      setStatusMessage(`Training error: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={requestCameraAccess}
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2 font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-sky-500"
        >
          Enable Camera
        </button>
        <button
          type="button"
          onClick={toggleSampling}
          className={`inline-flex items-center rounded-xl px-4 py-2 font-semibold shadow transition ${
            samplingEnabled
              ? 'bg-emerald-500/80 text-white shadow-emerald-500/40'
              : 'bg-slate-800 text-slate-200 shadow-slate-900'
          }`}
        >
          {samplingEnabled ? 'Stop Sampling' : 'Start Sampling'}
        </button>
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
            isCameraActive
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          {isCameraActive ? 'Live' : 'Camera Off'}
        </span>
        
        {/* Training Controls */}
        {poseDetected && (
          <>
            <button
              type="button"
              onClick={() => startTraining('good')}
              className="inline-flex items-center rounded-xl bg-green-600 px-3 py-1 text-sm font-semibold text-white shadow transition hover:bg-green-700"
            >
              Record Good
            </button>
            <button
              type="button"
              onClick={() => startTraining('slouch')}
              className="inline-flex items-center rounded-xl bg-red-600 px-3 py-1 text-sm font-semibold text-white shadow transition hover:bg-red-700"
            >
              Record Slouch
            </button>
          </>
        )}
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
              onLoadedMetadata={handleResizeCanvas}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
              style={{ transform: 'scaleX(-1)' }}
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
          <dt className="text-slate-400">Last Check</dt>
          <dd className="text-white">{lastPostureCheck || 'Not sampled yet'}</dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Status</dt>
          <dd className="text-white text-xs">{statusMessage}</dd>
        </div>
      </dl>

      {/* Debug Info */}
      {currentKeypoints && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <h4 className="text-slate-400 text-sm mb-2">Debug - Current Keypoints:</h4>
          <pre className="text-xs text-slate-300 overflow-auto">
            {JSON.stringify(currentKeypoints, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CameraAccessWithPose;

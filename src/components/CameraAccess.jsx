import { useCallback, useEffect, useRef, useState } from 'react';

const CAMERA_ON_DURATION = 30_000; // 10 seconds
const SAMPLING_INTERVAL = 90_000; // once per minute

const CameraAccess = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const samplingIntervalRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [samplingEnabled, setSamplingEnabled] = useState(false);
  const [lastPostureCheck, setLastPostureCheck] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Camera idle');

  const drawPlaceholder = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Demo overlay showing where posture data will appear later
    ctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(14, 165, 233, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Posture overlay', 20, 40);
  }, []);

  const attachStreamToVideo = (stream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        setStatusMessage('Press play to view camera');
      });
    }
  };

  const stopCamera = useCallback(() => {
    setIsCameraActive(false);
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
        video: { facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      attachStreamToVideo(stream);
      setPermissionStatus('granted');
      setIsCameraActive(true);
      drawPlaceholder();
      setStatusMessage('Camera live');
      return true;
    } catch (err) {
      console.error(err);
      setPermissionStatus('denied');
      setStatusMessage('Camera permission denied');
      return false;
    }
  }, [drawPlaceholder]);

  const runDetectionLoop = useCallback(() => {
    if (!canvasRef.current) return;

    detectionIntervalRef.current = setInterval(() => {
      const ctx = canvasRef.current.getContext('2d');
      drawPlaceholder();

      // TODO: integrate MoveNet / MediaPipe here
      ctx.fillStyle = '#34d399';
      const x = 40 + Math.random() * (canvasRef.current.width - 80);
      const y = 60 + Math.random() * (canvasRef.current.height - 120);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();

      console.log('Mock posture detection at', new Date().toISOString());
      setLastPostureCheck(new Date().toLocaleTimeString());
    }, 1500);
  }, [drawPlaceholder]);

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
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    drawPlaceholder();
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
            />
            {!isCameraActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-slate-400">
                <p>Camera preview will appear here after permission.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Permission</dt>
          <dd className="text-white capitalize">{permissionStatus}</dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Last posture check</dt>
          <dd className="text-white">{lastPostureCheck || 'Not sampled yet'}</dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <dt className="text-slate-400">Status</dt>
          <dd className="text-white">{statusMessage}</dd>
        </div>
      </dl>
    </div>
  );
};

export default CameraAccess;

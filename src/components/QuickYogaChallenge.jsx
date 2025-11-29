import React, { useState, useEffect, useRef, useCallback } from 'react';

const POSE_DURATION_MS = 5000; // 5 seconds for practice
const COUNTDOWN_DURATION_MS = 3000; // 3 seconds

// Asset mapping with real images and detailed tutorials
const POSE_ASSETS = {
  cobra: {
    id: 'cobra',
    title: 'Cobra Pose',
    name: 'Cobra',
    image: '/assets/yoga/cobra.jpg', // Replace with actual image path
    imageAlt: 'Cobra pose demonstration',
    cues: [
      'Place hands under shoulders',
      'Inhale and lift chest',
      'Squeeze shoulder blades together'
    ],
    description: 'Lie face down, place hands under shoulders, press up lifting chest while keeping hips on ground.',
    tutorial: {
      steps: [
        {
          title: 'Starting Position',
          instruction: 'Lie flat on your stomach with your legs extended behind you. Place your palms flat on the floor, directly under your shoulders. Your fingers should point forward.',
          tips: 'Keep your toes pointed and your legs together.'
        },
        {
          title: 'Lift Your Chest',
          instruction: 'Press into your palms and slowly lift your head, chest, and upper abdomen off the floor. Keep your hips and lower body on the ground.',
          tips: 'Use your back muscles, not just your arms. Keep your shoulders away from your ears.'
        },
        {
          title: 'Hold and Breathe',
          instruction: 'Hold the pose for 5-10 seconds, breathing deeply. Feel the stretch in your abdomen and the opening in your chest.',
          tips: 'Keep your gaze forward or slightly upward. Don\'t overextend your neck.'
        },
        {
          title: 'Release',
          instruction: 'Slowly lower yourself back down to the starting position. Rest for a moment before repeating.',
          tips: 'Move slowly and with control. Listen to your body.'
        }
      ],
      benefits: [
        'Strengthens the spine',
        'Opens the chest and shoulders',
        'Stretches the abdomen',
        'Improves posture',
        'Relieves back pain'
      ],
      precautions: [
        'Avoid if you have a back injury',
        'Don\'t overextend your neck',
        'Stop if you feel pain in your lower back',
        'Keep your hips on the ground'
      ]
    }
  },
  'cat-cow': {
    id: 'cat-cow',
    title: 'Cat-Cow Pose',
    name: 'Cat-Cow',
    image: '/assets/yoga/catcow.jpg', // Replace with actual image path
    imageAlt: 'Cat-Cow pose demonstration',
    cues: [
      'On hands and knees',
      'Arch your back (cat)',
      'Then dip your spine (cow)'
    ],
    description: 'Start on hands and knees. Arch your back like a cat, then dip your spine like a cow. Repeat and hold neutral.',
    tutorial: {
      steps: [
        {
          title: 'Starting Position',
          instruction: 'Come onto your hands and knees in a tabletop position. Your wrists should be directly under your shoulders, and your knees directly under your hips.',
          tips: 'Keep your back in a neutral position. Your spine should be straight and parallel to the floor.'
        },
        {
          title: 'Cow Pose (Inhale)',
          instruction: 'As you inhale, drop your belly toward the floor. Lift your chin and chest, and look up toward the ceiling. Your tailbone should point up.',
          tips: 'Move slowly and feel the stretch in your front body. Don\'t force the movement.'
        },
        {
          title: 'Cat Pose (Exhale)',
          instruction: 'As you exhale, round your spine toward the ceiling. Tuck your chin to your chest and draw your belly button in. Your tailbone should point down.',
          tips: 'Imagine you\'re pulling your belly button up toward your spine. Feel the stretch in your back.'
        },
        {
          title: 'Flow and Hold',
          instruction: 'Continue flowing between Cat and Cow poses with your breath. After several rounds, return to neutral tabletop position and hold.',
          tips: 'Move slowly and smoothly. Let your breath guide the movement. Hold neutral for 5 seconds.'
        }
      ],
      benefits: [
        'Improves spinal flexibility',
        'Massages the spine and belly organs',
        'Relieves tension in the back',
        'Improves coordination',
        'Calms the mind'
      ],
      precautions: [
        'Move slowly if you have neck issues',
        'Avoid if you have a recent wrist injury',
        'Keep movements gentle',
        'Don\'t force the range of motion'
      ]
    }
  },
  'seated-twist': {
    id: 'seated-twist',
    title: 'Seated Twist',
    name: 'Seated Twist',
    image: '/assets/yoga/seated_twist.jpg', // Replace with actual image path
    imageAlt: 'Seated twist pose demonstration',
    cues: [
      'Sit tall',
      'Rotate torso to the right',
      'Keep hips stable'
    ],
    description: 'Sit tall with legs extended or crossed. Rotate your torso to one side while keeping your hips stable.',
    tutorial: {
      steps: [
        {
          title: 'Starting Position',
          instruction: 'Sit on the floor with your legs extended in front of you, or sit cross-legged. Keep your spine tall and straight.',
          tips: 'If sitting on the floor is uncomfortable, sit on a folded blanket or cushion. You can also sit in a chair.'
        },
        {
          title: 'Prepare for Twist',
          instruction: 'Place your right hand on the floor behind you for support. Place your left hand on your right knee or outer thigh.',
          tips: 'Keep your shoulders relaxed. Don\'t hunch forward.'
        },
        {
          title: 'Twist to the Right',
          instruction: 'As you inhale, lengthen your spine. As you exhale, gently twist your torso to the right. Use your left hand on your right knee to help deepen the twist.',
          tips: 'Twist from your waist, not your shoulders. Keep your hips facing forward. Look over your right shoulder.'
        },
        {
          title: 'Hold and Breathe',
          instruction: 'Hold the twist for 5-10 seconds, breathing deeply. Feel the stretch along your spine and in your side body.',
          tips: 'Don\'t force the twist. Go only as far as feels comfortable. Keep your spine tall.'
        },
        {
          title: 'Release and Repeat',
          instruction: 'Slowly release the twist and return to center. Repeat on the other side.',
          tips: 'Move slowly and with control. Take your time transitioning between sides.'
        }
      ],
      benefits: [
        'Improves spinal rotation',
        'Stretches the back and side body',
        'Massages internal organs',
        'Improves digestion',
        'Relieves back tension'
      ],
      precautions: [
        'Avoid if you have a recent back injury',
        'Don\'t force the twist',
        'Keep your hips stable',
        'Move slowly if you have disc issues'
      ]
    }
  }
};

// Get asset for pose with fallback
function getAssetForPose(poseId) {
  const asset = POSE_ASSETS[poseId];
  if (!asset) {
    console.warn(`[YogaChallenge] Invalid poseId: ${poseId}, using fallback`);
    return {
      id: poseId,
      title: 'Unknown Pose',
      name: 'Unknown',
      image: null,
      imageAlt: 'Yoga pose',
      cues: [],
      description: 'Unknown pose',
      tutorial: { steps: [], benefits: [], precautions: [] }
    };
  }
  return asset;
}

// Ensure camera is visible and active
async function ensureCameraVisible(videoSelector = 'video') {
  try {
    const vid = document.querySelector(videoSelector);
    if (!vid) {
      // Try alternative selectors
      const altVid = document.querySelector('#pg-video') || 
                     document.querySelector('video[playsinline]') ||
                     document.querySelector('video');
      if (!altVid) {
        console.warn('[YogaChallenge] Video element not found');
        return null;
      }
      return await ensureVideoActive(altVid);
    }
    return await ensureVideoActive(vid);
  } catch (error) {
    console.error('[YogaChallenge] Camera ensure failed:', error);
    return null;
  }
}

async function ensureVideoActive(vid) {
  // Check if video has active stream
  if (!vid.srcObject || vid.srcObject.getVideoTracks().length === 0) {
    // Request new stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      vid.srcObject = stream;
    } catch (err) {
      console.warn('[YogaChallenge] Could not get camera stream:', err);
      return vid;
    }
  }

  // Ensure video is visible and playing - be very explicit
  vid.style.display = 'block';
  vid.style.visibility = 'visible';
  vid.style.opacity = '1';
  vid.style.position = 'relative';
  vid.style.width = '100%';
  vid.style.height = '100%';
  vid.style.objectFit = 'cover';
  
  // Make video element and all parents visible
  let element = vid;
  while (element && element !== document.body) {
    if (element.style) {
      element.style.display = element.style.display || 'block';
      element.style.visibility = element.style.visibility || 'visible';
      element.style.opacity = element.style.opacity || '1';
    }
    element = element.parentElement;
  }

  // Find and ensure parent containers are visible
  const containers = [
    vid.closest('.relative'),
    vid.closest('.absolute'),
    vid.closest('[class*="aspect-video"]'),
    vid.closest('[class*="video"]'),
    vid.parentElement,
    vid.parentElement?.parentElement
  ].filter(Boolean);

  containers.forEach(container => {
    if (container && container.style) {
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      container.style.zIndex = '5'; // Behind overlay but visible
    }
  });

  // Play video
  try {
    await vid.play();
    console.log('[YogaChallenge] Camera video is playing');
  } catch (playError) {
    console.warn('[YogaChallenge] Video play failed:', playError);
    // Retry after a short delay
    setTimeout(async () => {
      try {
        await vid.play();
        console.log('[YogaChallenge] Camera video play retry successful');
      } catch (e) {
        console.error('[YogaChallenge] Camera video play retry failed:', e);
      }
    }, 500);
  }

  return vid;
}

const POSE_IDS = ['cobra', 'cat-cow', 'seated-twist'];

export default function QuickYogaChallenge({ onClose, voiceEnabled = true }) {
  const [phase, setPhase] = useState('intro'); // intro, tutorial, practice, summary
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [practiceTime, setPracticeTime] = useState(0);
  const [poseResults, setPoseResults] = useState([]);
  const [xpEarned, setXpEarned] = useState(0);
  
  const practiceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  const currentPoseAsset = getAssetForPose(POSE_IDS[currentPoseIndex] || 'cobra');
  const currentTutorial = currentPoseAsset.tutorial || { steps: [], benefits: [], precautions: [] };

  // Voice synthesis helper
  const speak = useCallback((text) => {
    if (!voiceEnabled) return;
    
    if (speechSynthesisRef.current) {
      speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    speechSynthesisRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Start practice timer
  const startPractice = useCallback(async () => {
    // Ensure camera is visible
    await ensureCameraVisible();
    
    setPhase('practice');
    setPracticeTime(0);
    setCountdown(3);
    
    // Countdown
    let count = 3;
    const countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        speak(count.toString());
      } else {
        clearInterval(countdownTimer);
        setCountdown(0);
        
        // Start practice timer
        const startTime = Date.now();
        practiceTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          setPracticeTime(Math.min(POSE_DURATION_MS, elapsed));
          
          if (elapsed >= POSE_DURATION_MS) {
            clearInterval(practiceTimerRef.current);
            finishPractice();
          }
        }, 100);
      }
    }, 1000);
    
    countdownTimerRef.current = countdownTimer;
  }, [speak]);

  // Finish practice
  const finishPractice = useCallback(() => {
    const poseResult = {
      pose: currentPoseAsset,
      completed: true,
      practiceTime: POSE_DURATION_MS
    };
    setPoseResults(prev => [...prev, poseResult]);
    
    // Play completion sound
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 500;
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.5);
      setTimeout(() => ctx.close?.(), 600);
    } catch (e) {
      console.warn('Sound playback failed:', e);
    }

    speak(`Great job completing ${currentPoseAsset.name}!`);
    
    // Auto-advance to next pose or summary
    setTimeout(() => {
      nextPose();
    }, 2000);
  }, [currentPoseAsset, speak]);

  // Move to next pose
  const nextPose = useCallback(() => {
    if (currentPoseIndex < POSE_IDS.length - 1) {
      setCurrentPoseIndex(prev => prev + 1);
      setCurrentStepIndex(0);
      setPhase('tutorial');
    } else {
      // All poses done, show summary
      const totalXP = poseResults.length * 10; // 10 XP per pose
      setXpEarned(totalXP);
      setPhase('summary');
      speak('Challenge complete! Great work!');
    }
  }, [currentPoseIndex, poseResults, speak]);

  // Skip pose
  const skipPose = useCallback(() => {
    const poseResult = {
      pose: currentPoseAsset,
      completed: false,
      skipped: true
    };
    setPoseResults(prev => [...prev, poseResult]);
    nextPose();
  }, [currentPoseAsset, nextPose]);

  // Begin challenge
  const beginChallenge = useCallback(async () => {
    // Ensure camera is available
    await ensureCameraVisible();
    setPhase('tutorial');
    speak(`Starting Quick Yoga Challenge. First pose: ${POSE_ASSETS[POSE_IDS[0]].name}.`);
  }, [speak]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (practiceTimerRef.current) clearInterval(practiceTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (speechSynthesisRef.current) speechSynthesis.cancel();
    };
  }, []);

  // Ensure camera is visible when component mounts or phase changes
  useEffect(() => {
    if (phase === 'tutorial' || phase === 'practice') {
      ensureCameraVisible();
    }
  }, [phase]);

  // Render intro modal
  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="max-w-2xl w-full rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-white mb-4">Quick Yoga Challenge</h2>
          <p className="text-slate-300 mb-6">
            Learn and practice 3 yoga poses with step-by-step tutorials. Each pose includes a 5-second practice session.
          </p>
          
          <div className="space-y-4 mb-6">
            <h3 className="text-xl font-semibold text-white">Poses:</h3>
            <ul className="space-y-2 text-slate-300">
              {POSE_IDS.map((poseId, idx) => {
                const asset = getAssetForPose(poseId);
                return (
                  <li key={poseId} className="flex items-start gap-3">
                    <span className="text-primary font-bold">{idx + 1}.</span>
                    <div>
                      <span className="font-semibold">{asset.name}</span>
                      <p className="text-sm text-slate-400">{asset.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={beginChallenge}
              className="flex-1 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-sky-500"
            >
              Begin Challenge
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-6 py-3 font-semibold text-slate-200 transition hover:border-primary hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render tutorial screen
  if (phase === 'tutorial') {
    const currentStep = currentTutorial.steps[currentStepIndex] || currentTutorial.steps[0];
    
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 overflow-y-auto">
        <div className="container mx-auto px-6 py-8 max-w-5xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Pose {currentPoseIndex + 1} of {POSE_IDS.length}: {currentPoseAsset.name}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left: Image */}
            <div className="flex items-center justify-center bg-slate-900 rounded-2xl p-8">
              <div className="text-center w-full">
                {currentPoseAsset.image ? (
                  <img
                    src={currentPoseAsset.image}
                    alt={currentPoseAsset.imageAlt}
                    className="w-full max-w-md mx-auto rounded-xl shadow-2xl"
                    onError={(e) => {
                      // Fallback if image doesn't load
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `
                        <div class="w-full h-64 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                          <div class="text-center">
                            <div class="text-4xl mb-2">🧘</div>
                            <p>Image: ${currentPoseAsset.image}</p>
                            <p class="text-sm mt-2">Add image to: public/assets/yoga/${currentPoseAsset.id}.jpg</p>
                          </div>
                        </div>
                      `;
                    }}
                  />
                ) : (
                  <div className="w-full h-64 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🧘</div>
                      <p>Add image to: public/assets/yoga/{currentPoseAsset.id}.jpg</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Tutorial Steps */}
            <div className="space-y-6">
              <div>
                <h3 className="text-3xl font-bold mb-4">{currentPoseAsset.title}</h3>
                <p className="text-slate-300 mb-6">{currentPoseAsset.description}</p>
              </div>

              {/* Step Navigation */}
              {currentTutorial.steps.length > 0 && (
                <div className="bg-slate-900 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-semibold">
                      Step {currentStepIndex + 1} of {currentTutorial.steps.length}
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentStepIndex === 0}
                        className="px-3 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => setCurrentStepIndex(prev => Math.min(currentTutorial.steps.length - 1, prev + 1))}
                        disabled={currentStepIndex === currentTutorial.steps.length - 1}
                        className="px-3 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                  
                  {currentStep && (
                    <div className="space-y-4">
                      <h5 className="text-lg font-semibold text-primary">{currentStep.title}</h5>
                      <p className="text-slate-300">{currentStep.instruction}</p>
                      {currentStep.tips && (
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <p className="text-sm text-slate-400">
                            <span className="font-semibold text-yellow-400">💡 Tip:</span> {currentStep.tips}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Benefits */}
              {currentTutorial.benefits && currentTutorial.benefits.length > 0 && (
                <div className="bg-green-900/20 border border-green-800 rounded-xl p-4">
                  <h4 className="font-semibold text-green-400 mb-2">Benefits:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
                    {currentTutorial.benefits.map((benefit, idx) => (
                      <li key={idx}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Precautions */}
              {currentTutorial.precautions && currentTutorial.precautions.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4">
                  <h4 className="font-semibold text-yellow-400 mb-2">Precautions:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
                    {currentTutorial.precautions.map((precaution, idx) => (
                      <li key={idx}>{precaution}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={skipPose}
              className="flex-1 rounded-xl border border-slate-800 px-6 py-4 font-semibold text-slate-200 transition hover:border-primary hover:text-white"
            >
              Skip
            </button>
            <button
              onClick={startPractice}
              className="flex-1 rounded-xl bg-primary px-6 py-4 font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-sky-500"
            >
              Start Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render practice phase
  if (phase === 'practice') {
    const progress = (practiceTime / POSE_DURATION_MS) * 100;
    const remainingSeconds = Math.ceil((POSE_DURATION_MS - practiceTime) / 1000);

    return (
      <div className="fixed inset-0 z-50 text-slate-100" style={{ backgroundColor: 'rgba(2, 6, 23, 0.7)' }}>
        {/* Camera should be visible behind overlay - very transparent */}
        <div className="absolute inset-0 bg-black/10" />
        
        <div className="relative container mx-auto px-6 py-8 h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center w-full max-w-md">
              <h2 className="text-3xl font-bold mb-8">{currentPoseAsset.name}</h2>
              
              {countdown > 0 ? (
                <div>
                  <div className="text-9xl font-bold text-primary mb-4">{countdown}</div>
                  <p className="text-2xl text-slate-300">Get ready...</p>
                </div>
              ) : (
                <>
                  {/* Progress ring */}
                  <div className="relative w-64 h-64 mx-auto mb-8">
                    <svg className="transform -rotate-90 w-full h-full">
                      <circle
                        cx="128"
                        cy="128"
                        r="120"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-slate-800"
                      />
                      <circle
                        cx="128"
                        cy="128"
                        r="120"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 120}`}
                        strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
                        className="text-primary transition-all duration-100"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold">{remainingSeconds}</div>
                        <div className="text-sm text-slate-400">seconds</div>
                      </div>
                    </div>
                  </div>

                  {/* Practice feedback */}
                  <div className="text-2xl font-semibold text-green-400 mb-4">
                    Practice in progress...
                  </div>
                  <p className="text-slate-400">
                    Follow the pose instructions. Camera is recording for reference.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render summary screen
  if (phase === 'summary') {
    const completedPoses = poseResults.filter(r => r.completed).length;

    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 overflow-y-auto">
        <div className="container mx-auto px-6 py-8 max-w-3xl">
          <h2 className="text-4xl font-bold text-center mb-8">Challenge Complete!</h2>

          <div className="bg-slate-900 rounded-2xl p-8 mb-6">
            <div className="text-center mb-6">
              <div className="text-6xl font-bold text-primary mb-2">{completedPoses} / {POSE_IDS.length}</div>
              <div className="text-slate-400">Poses Completed</div>
            </div>

            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-primary mb-2">{xpEarned}</div>
              <div className="text-slate-400">XP Earned</div>
            </div>

            <div className="space-y-4 mb-6">
              <h3 className="text-xl font-semibold">Progress:</h3>
              {POSE_IDS.map((poseId, idx) => {
                const asset = getAssetForPose(poseId);
                const result = poseResults[idx];
                const status = result?.completed ? '✓ Completed' : result?.skipped ? '⊘ Skipped' : '○ Not started';
                const statusColor = result?.completed ? 'text-green-400' : result?.skipped ? 'text-yellow-400' : 'text-slate-400';
                
                return (
                  <div key={poseId} className="flex justify-between items-center p-4 bg-slate-800 rounded-xl">
                    <span className="font-semibold">{asset.name}</span>
                    <span className={`font-bold ${statusColor}`}>{status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                console.log('Saving to log:', { poseResults, xpEarned });
                alert('Saved to log!');
              }}
              className="flex-1 rounded-xl border border-slate-800 px-4 py-3 font-semibold text-slate-200 transition hover:border-primary hover:text-white"
            >
              Save to Log
            </button>
            <button
              onClick={() => {
                setCurrentPoseIndex(0);
                setCurrentStepIndex(0);
                setPoseResults([]);
                setPhase('tutorial');
              }}
              className="flex-1 rounded-xl border border-slate-800 px-4 py-3 font-semibold text-slate-200 transition hover:border-primary hover:text-white"
            >
              Retry Challenge
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-sky-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Export for testing
export { POSE_ASSETS, getAssetForPose };

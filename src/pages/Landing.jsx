import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import CameraAccessWithPoseFixed from '../components/CameraAccessWithPoseFixed.jsx';
import QuickYogaChallenge from '../components/QuickYogaChallenge.jsx';

const Landing = () => {
  const navigate = useNavigate();
  const [showYogaChallenge, setShowYogaChallenge] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex flex-col gap-4 border-b border-slate-900 bg-slate-950/80 px-6 py-6 shadow-lg shadow-slate-900/40 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary">Posture Coach</p>
          <h1 className="text-3xl font-bold text-white">Real-time alignment insights</h1>
          <p className="text-slate-400">Stay mindful, confident, and pain-free at your desk.</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="self-start rounded-xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-primary hover:text-white"
        >
          Logout
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-10 text-center">
          <h2 className="text-4xl font-extrabold text-white sm:text-5xl">
            Sit taller. Breathe deeper. Own your posture.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Enable your camera to start real-time posture detection with MediaPipe AI. Train your personal model or use smart alerts.
          </p>
        </section>

        {/* Quick Yoga Challenge CTA */}
        <div className="mb-8 text-center">
          <button
            type="button"
            onClick={() => setShowYogaChallenge(true)}
            className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-purple-600 px-8 py-4 text-lg font-bold text-white shadow-2xl shadow-primary/40 transition hover:from-sky-500 hover:to-purple-500 hover:scale-105"
          >
            <span className="text-2xl">🧘</span>
            <span>Quick Yoga Challenge</span>
          </button>
          <p className="mt-3 text-sm text-slate-400">
            3 poses • 5 seconds each • ~45-60 seconds total
          </p>
        </div>

        <CameraAccessWithPoseFixed />

        {/* Quick Yoga Challenge Modal */}
        {showYogaChallenge && (
          <QuickYogaChallenge
            onClose={() => setShowYogaChallenge(false)}
            voiceEnabled={true}
          />
        )}
      </main>
    </div>
  );
};

export default Landing;

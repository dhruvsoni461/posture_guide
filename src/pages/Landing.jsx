import { useNavigate } from 'react-router-dom';
import CameraAccessWithPoseFixed from '../components/CameraAccessWithPoseFixed.jsx';

const Landing = () => {
  const navigate = useNavigate();

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

        <CameraAccessWithPoseFixed />
      </main>
    </div>
  );
};

export default Landing;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/auth.js';

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        throw new Error('Please enter a valid email.');
      }
      if (form.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const data = await login(form);
      localStorage.setItem('auth_token', data.token);
      navigate('/landing');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-slate-400 mb-6">Sign in to access your posture mentor.</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-300" htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300" htmlFor="password">
            Password
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-2.5 font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {loading ? 'Signing you in…' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Need an account?{' '}
          <Link to="/signup" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

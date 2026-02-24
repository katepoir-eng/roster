import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, profile } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  if (typeof window !== 'undefined' && profile) {
    router.replace(profile.role === 'manager' ? '/manager/roster' : '/staff/shifts');
    return null;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: 56, height: 56, background: 'var(--accent)', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', fontSize: '1.8rem'
          }}>📅</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>RosterApp</h1>
          <p style={{ color: 'var(--text-dim)', marginTop: '0.3rem', fontSize: '0.9rem' }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          Contact your manager if you don't have an account yet.
        </p>
      </div>
    </div>
  );
}

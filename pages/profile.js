import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import BottomNav from '../components/BottomNav';

export default function Profile() {
  const { profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  if (loading || !profile) return <div className="spinner" />;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      <div className="card" style={{ textAlign: 'center', marginBottom: '1rem', padding: '2rem 1rem' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--accent-dim)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '2rem', margin: '0 auto 1rem'
        }}>
          {profile.full_name.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{profile.full_name}</div>
        <div style={{ color: 'var(--text-dim)', marginTop: '0.3rem', textTransform: 'capitalize', fontSize: '0.9rem' }}>
          {profile.role === 'manager' ? '⭐ Manager' : '👤 Staff'}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>Install App</div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          On <strong style={{ color: 'var(--text)' }}>iPhone</strong>: tap the Share icon in Safari → "Add to Home Screen"<br />
          On <strong style={{ color: 'var(--text)' }}>Android</strong>: tap the menu (⋮) in Chrome → "Add to Home Screen"
        </p>
      </div>

      <button className="btn btn-ghost btn-full" onClick={handleSignOut} style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: '0.5rem' }}>
        Sign Out
      </button>

      <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
        RosterApp · Powered by Supabase & Vercel
      </p>
      <BottomNav />
    </div>
  );
}

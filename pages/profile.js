import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import BottomNav from '../components/BottomNav';

const INTEREST_OPTIONS = [
  { value: 'happy', emoji: '😊🔄', label: 'Happy', desc: 'Prefer more shifts' },
  { value: 'good', emoji: '👍', label: 'Good', desc: 'Flexible, okay with anything' },
  { value: 'change_please', emoji: '😕🔄', label: 'Change please', desc: 'Prefer fewer shifts' },
];

export default function Profile() {
  const { profile, realProfile, loading, signOut, staffViewMode, setStaffViewMode } = useAuth();
  const router = useRouter();
  const [interest, setInterest] = useState(null);
  const [savingInterest, setSavingInterest] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) setInterest(profile.interest_level || 'good');
  }, [profile]);

  async function saveInterest(val) {
    if (val === interest && val === profile.interest_level) return;
    setSavingInterest(true);
    const oldLevel = profile.interest_level;
    await supabase.from('profiles').update({ interest_level: val }).eq('id', profile.id);

    if (oldLevel !== val) {
      const { data: managers } = await supabase.from('profiles').select('id').in('role', ['manager','admin']);
      if (managers?.length) {
        const selected = INTEREST_OPTIONS.find(o => o.value === val);
        await Promise.all(managers.map(m =>
          supabase.from('notifications').insert({
            user_id: m.id,
            title: 'Staff preference changed',
            message: `${profile.full_name} updated their shift preference to: ${selected?.emoji} ${selected?.label} — ${selected?.desc}`,
          })
        ));
      }
    }

    setInterest(val);
    setSavingInterest(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  function toggleStaffView() {
    const entering = !staffViewMode;
    setStaffViewMode(entering);
    if (entering) router.push('/staff/shifts');
  }

  if (loading || !profile) return <div className="spinner" />;

  // Use realProfile to check actual role (staffViewMode spoofs role)
  const isReallyManager = ['manager','admin'].includes(realProfile?.role);
  const isAdmin = realProfile?.role === 'admin';

  return (
    <div className="container page-content" style={{ paddingTop: staffViewMode ? '3rem' : undefined }}>
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      {/* Avatar card */}
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
          {isAdmin ? '👑 Super Admin' : isReallyManager ? '⭐ Manager' : '👤 Staff'}
        </div>
      </div>

      {/* Staff View Mode toggle — manager only */}
      {isReallyManager && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
            View Mode
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
            Switch to staff view to see exactly what your team sees — shifts, availability, noticeboard, and swap requests.
          </p>
          <button
            onClick={toggleStaffView}
            className={staffViewMode ? 'btn btn-primary btn-full' : 'btn btn-ghost btn-full'}
            style={{ borderColor: staffViewMode ? undefined : 'var(--accent)', color: staffViewMode ? undefined : 'var(--accent)' }}
          >
            {staffViewMode ? '👁 Currently in Staff View — tap to exit' : '👁 Enter Staff View'}
          </button>
        </div>
      )}

      {/* Shift preference — staff only (or manager in staff view) */}
      {(!isReallyManager || staffViewMode) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
            Shift Preference
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
            Let your manager know how you're feeling about your schedule.
          </p>
          {INTEREST_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => saveInterest(opt.value)}
              disabled={savingInterest}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem',
                width: '100%', padding: '0.75rem 1rem', marginBottom: '0.5rem',
                borderRadius: '0.75rem', border: '2px solid',
                borderColor: interest === opt.value ? 'var(--accent)' : 'var(--border)',
                background: interest === opt.value ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>{opt.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{opt.desc}</div>
              </div>
              {interest === opt.value && (
                <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 800 }}>✓</span>
              )}
            </button>
          ))}
          {saved && (
            <p style={{ fontSize: '0.82rem', color: 'var(--accent)', marginTop: '0.4rem', textAlign: 'center' }}>✓ Preference saved</p>
          )}
        </div>
      )}

      {/* Install App */}
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

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import BottomNav from '../components/BottomNav';
import { format, parseISO } from 'date-fns';

const INTEREST_OPTIONS = [
  { value: 'happy', emoji: '😊🔄', label: 'Happy', desc: 'Prefer more shifts' },
  { value: 'good', emoji: '👍', label: 'Good', desc: 'Flexible, okay with anything' },
  { value: 'change_please', emoji: '😕🔄', label: 'Change please', desc: 'Prefer fewer shifts' },
];

export default function Me() {
  const { profile, realProfile, loading, signOut, staffViewMode, setStaffViewMode } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [interest, setInterest] = useState(null);
  const [savingInterest, setSavingInterest] = useState(false);
  const [savedInterest, setSavedInterest] = useState(false);
  const [tab, setTab] = useState('alerts');
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ text: '', error: false });

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) {
      fetchNotifications();
      setInterest(profile.interest_level || 'good');
      setNameVal(profile.full_name || '');
    }
  }, [profile]);

  async function fetchNotifications() {
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(50);
    setNotifications(data || []);
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', profile.id).eq('read', false);
  }

  async function saveInterest(val) {
    if (val === profile.interest_level) return;
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
    setSavedInterest(true);
    setTimeout(() => setSavedInterest(false), 2000);
  }

  async function saveName() {
    if (!nameVal.trim() || nameVal.trim() === profile.full_name) { setEditingName(false); return; }
    setSavingName(true);
    await supabase.from('profiles').update({ full_name: nameVal.trim() }).eq('id', realProfile?.id || profile.id);
    setSavingName(false);
    setEditingName(false);
    router.replace(router.asPath);
  }

  async function changePassword() {
    if (!newPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Passwords do not match.', error: true });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'Password must be at least 6 characters.', error: true });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setPasswordMsg({ text: 'Could not update password. Try signing out and back in first.', error: true });
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ text: '✓ Password updated successfully!', error: false });
      setTimeout(() => setPasswordMsg({ text: '', error: false }), 3000);
    }
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

  const isReallyManager = ['manager','admin'].includes(realProfile?.role);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container page-content" style={{ paddingTop: staffViewMode ? '3rem' : undefined }}>
      {/* Header with avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-dim)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '1.4rem',
        }}>
          {profile.full_name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="text" value={nameVal} onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()} autoFocus
                style={{ fontSize: '1rem', fontWeight: 700, flex: 1 }} />
              <button className="btn btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={saveName} disabled={savingName}>
                {savingName ? '…' : 'Save'}
              </button>
              <button className="btn btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setEditingName(false)}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{profile.full_name}</div>
              <button onClick={() => setEditingName(true)} style={{ background: 'none', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '0.1rem 0.3rem' }}>✏️</button>
            </div>
          )}
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            {isReallyManager ? '⭐ Manager' : '👤 Staff'}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={() => setTab('alerts')} className={`btn ${tab === 'alerts' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}>
          🔔 Alerts
          {unreadCount > 0 && (
            <span style={{ marginLeft: '0.4rem', background: tab === 'alerts' ? '#fff' : 'var(--accent)', color: tab === 'alerts' ? 'var(--accent)' : '#fff', borderRadius: '1rem', padding: '0.05rem 0.45rem', fontSize: '0.72rem', fontWeight: 800 }}>
              {unreadCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab('profile')} className={`btn ${tab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}>
          👤 Profile
        </button>
      </div>

      {/* ALERTS TAB */}
      {tab === 'alerts' && (
        <>
          {notifications.length === 0 ? (
            <div className="empty-state"><p>You're all caught up! 🎉</p></div>
          ) : (
            notifications.map(notif => (
              <div key={notif.id} className="card" style={{ marginBottom: '0.6rem', borderColor: notif.read ? 'var(--border)' : 'var(--accent)', opacity: notif.read ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{notif.title}</div>
                  {!notif.read && <span className="notif-dot" style={{ marginTop: 6 }} />}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{notif.message}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
                  {format(parseISO(notif.created_at), 'EEE d MMM · h:mm a')}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* PROFILE TAB */}
      {tab === 'profile' && (
        <>
          {/* Availability */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
              My Availability
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
              Mark dates you're unavailable so the team knows when you're off.
            </p>
            <button className="btn btn-ghost btn-full" onClick={() => router.push('/staff/availability')}
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
              📅 Manage Availability
            </button>
          </div>

          {/* Change Password — everyone */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
              Change Password
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" placeholder="Min 6 characters" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" placeholder="Repeat new password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && changePassword()} />
            </div>
            {passwordMsg.text && (
              <p style={{ fontSize: '0.82rem', color: passwordMsg.error ? 'var(--danger)' : 'var(--accent)', marginBottom: '0.6rem' }}>
                {passwordMsg.text}
              </p>
            )}
            <button className="btn btn-primary btn-full" onClick={changePassword}
              disabled={!newPassword || !confirmPassword || changingPassword}>
              {changingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </div>

          {/* Staff View Mode — manager only */}
          {isReallyManager && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
                View Mode
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
                Switch to staff view to see exactly what your team sees.
              </p>
              <button onClick={toggleStaffView}
                className={staffViewMode ? 'btn btn-primary btn-full' : 'btn btn-ghost btn-full'}
                style={{ borderColor: staffViewMode ? undefined : 'var(--accent)', color: staffViewMode ? undefined : 'var(--accent)' }}>
                {staffViewMode ? '👁 Currently in Staff View — tap to exit' : '👁 Enter Staff View'}
              </button>
            </div>
          )}

          {/* Shift preference — staff only */}
          {(!isReallyManager || staffViewMode) && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
                Shift Preference
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
                Let your manager know how you're feeling about your schedule.
              </p>
              {INTEREST_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => saveInterest(opt.value)} disabled={savingInterest}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.8rem',
                    width: '100%', padding: '0.75rem 1rem', marginBottom: '0.5rem',
                    borderRadius: '0.75rem', border: '2px solid',
                    borderColor: interest === opt.value ? 'var(--accent)' : 'var(--border)',
                    background: interest === opt.value ? 'var(--accent-dim)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                  <span style={{ fontSize: '1.4rem' }}>{opt.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{opt.desc}</div>
                  </div>
                  {interest === opt.value && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 800 }}>✓</span>}
                </button>
              ))}
              {savedInterest && <p style={{ fontSize: '0.82rem', color: 'var(--accent)', marginTop: '0.4rem', textAlign: 'center' }}>✓ Preference saved</p>}
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
        </>
      )}

      <BottomNav />
    </div>
  );
}

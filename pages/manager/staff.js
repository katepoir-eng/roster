import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday } from 'date-fns';

const INTEREST_OPTIONS = [
  { value: 'happy', emoji: '😊🔄', label: 'Happy', desc: 'Prefer more shifts' },
  { value: 'good', emoji: '👍', label: 'Good', desc: 'Flexible' },
  { value: 'change_please', emoji: '😕🔄', label: 'Change please', desc: 'Prefer fewer shifts' },
];

export default function ManagerStaff() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Expanded member state
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeTab, setActiveTab] = useState('availability'); // 'availability' | 'edit'

  // Availability
  const [unavailMonth, setUnavailMonth] = useState(new Date());
  const [savedUnavail, setSavedUnavail] = useState({});
  const [pendingUnavail, setPendingUnavail] = useState({});
  const [savingUnavail, setSavingUnavail] = useState(false);
  const [unavailSavedMsg, setUnavailSavedMsg] = useState('');

  // Edit name / password
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordSQL, setShowPasswordSQL] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);

  useEffect(() => {
    if (!loading && (!profile || !['manager','admin'].includes(profile.role))) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) fetchStaff();
  }, [profile]);

  useEffect(() => {
    if (selectedMember) fetchMemberUnavail();
  }, [selectedMember, unavailMonth]);

  async function fetchStaff() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'staff').order('full_name');
    setStaff(data || []);
  }

  function openMember(member) {
    if (selectedMember?.id === member.id) {
      setSelectedMember(null);
    } else {
      setSelectedMember(member);
      setUnavailMonth(new Date());
      setActiveTab('availability');
      setEditName(member.full_name);
      setNewPassword('');
      setShowPasswordSQL(false);
      setNameSaved(false);
    }
  }

  async function fetchMemberUnavail() {
    const start = format(startOfMonth(unavailMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(unavailMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('availability')
      .select('*').eq('staff_id', selectedMember.id).eq('available', false)
      .gte('date', start).lte('date', end);
    const map = {};
    (data || []).forEach(row => { map[row.date] = true; });
    setSavedUnavail(map);
    setPendingUnavail(map);
  }

  function toggleMemberDate(dateStr) {
    const isPast = new Date(dateStr + 'T12:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
    if (isPast) return;
    setPendingUnavail(p => {
      const next = { ...p };
      if (next[dateStr]) delete next[dateStr];
      else next[dateStr] = true;
      return next;
    });
  }

  async function saveMemberUnavail() {
    setSavingUnavail(true);
    const added = Object.keys(pendingUnavail).filter(d => !savedUnavail[d]);
    const removed = Object.keys(savedUnavail).filter(d => !pendingUnavail[d]);
    for (const dateStr of removed) {
      await supabase.from('availability').delete().eq('staff_id', selectedMember.id).eq('date', dateStr);
    }
    for (const dateStr of added) {
      await supabase.from('availability').upsert({
        staff_id: selectedMember.id, date: dateStr,
        available: false, note: 'Marked unavailable by manager',
      }, { onConflict: 'staff_id,date' });
    }
    setSavedUnavail({ ...pendingUnavail });
    setSavingUnavail(false);
    setUnavailSavedMsg('Saved!');
    setTimeout(() => setUnavailSavedMsg(''), 2000);
  }

  async function saveEditName() {
    if (!editName.trim() || editName.trim() === selectedMember.full_name) { setNameSaved(false); return; }
    setSavingName(true);
    await supabase.from('profiles').update({ full_name: editName.trim() }).eq('id', selectedMember.id);
    setSavingName(false);
    setNameSaved(true);
    // Update local staff list
    setStaff(s => s.map(m => m.id === selectedMember.id ? { ...m, full_name: editName.trim() } : m));
    setSelectedMember(m => ({ ...m, full_name: editName.trim() }));
    setTimeout(() => setNameSaved(false), 2000);
  }

  function getPasswordSQL() {
    return `UPDATE auth.users\nSET encrypted_password = crypt('${newPassword}', gen_salt('bf')),\n    email_confirmed_at = NOW()\nWHERE id = (\n  SELECT id FROM auth.users\n  WHERE email = (SELECT email FROM auth.users u JOIN public.profiles p ON u.id = p.id WHERE p.id = '${selectedMember.id}')\n);`;
  }

  function copySQL() {
    navigator.clipboard.writeText(getPasswordSQL());
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  }

  async function createStaff() {
    setSaving(true);
    setError('');
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: 'staff' } }
    });
    setSaving(false);
    if (error) {
      setError('Could not create account. Use Supabase dashboard > Authentication > Users to add staff manually.');
    } else {
      setSuccess(`Account created for ${form.full_name}. They can now log in.`);
      setForm({ full_name: '', email: '', password: '' });
      setShowModal(false);
      fetchStaff();
    }
  }

  if (loading || !profile) return <div className="spinner" />;

  const days = selectedMember ? eachDayOfInterval({ start: startOfMonth(unavailMonth), end: endOfMonth(unavailMonth) }) : [];
  const startPad = days.length ? getDay(days[0]) : 0;
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const hasChanges = JSON.stringify(Object.keys(pendingUnavail).sort()) !== JSON.stringify(Object.keys(savedUnavail).sort());

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Staff</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      {success && (
        <div style={{ background: '#0a2a14', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1rem', color: 'var(--success)', fontSize: '0.9rem' }}>
          {success}
        </div>
      )}

      {staff.length === 0 ? (
        <div className="empty-state"><p>No staff added yet.<br />Add your first team member above.</p></div>
      ) : (
        staff.map(member => {
          const opt = INTEREST_OPTIONS.find(o => o.value === member.interest_level);
          const isSelected = selectedMember?.id === member.id;
          return (
            <div key={member.id} style={{ marginBottom: '0.6rem' }}>
              {/* Staff card */}
              <div className="card" onClick={() => openMember(member)}
                style={{ cursor: 'pointer', borderColor: isSelected ? 'var(--accent)' : 'var(--border)', marginBottom: 0, borderBottomLeftRadius: isSelected ? 0 : undefined, borderBottomRightRadius: isSelected ? 0 : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: isSelected ? 'var(--accent)' : 'var(--accent-dim)',
                    color: isSelected ? '#fff' : 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1rem', flexShrink: 0,
                  }}>
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{member.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Tap to manage</div>
                  </div>
                  {opt ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem' }}>{opt.emoji}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{opt.label}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>No pref</div>
                  )}
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{isSelected ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded panel */}
              {isSelected && (
                <div style={{ border: '1px solid var(--accent)', borderTop: 'none', borderBottomLeftRadius: 'var(--radius)', borderBottomRightRadius: 'var(--radius)', background: 'var(--surface)' }}>

                  {/* Tabs */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                    {['availability', 'edit'].map(t => (
                      <button key={t} onClick={() => setActiveTab(t)}
                        style={{
                          flex: 1, padding: '0.6rem', fontSize: '0.82rem', fontWeight: 700,
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                          color: activeTab === t ? 'var(--accent)' : 'var(--text-dim)',
                          textTransform: 'capitalize',
                        }}>
                        {t === 'availability' ? '📅 Availability' : '✏️ Edit Details'}
                      </button>
                    ))}
                  </div>

                  {/* Availability tab */}
                  {activeTab === 'availability' && (
                    <div style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem 0.7rem' }} onClick={() => setUnavailMonth(subMonths(unavailMonth, 1))}>‹</button>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{format(unavailMonth, 'MMMM yyyy')}</span>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem 0.7rem' }} onClick={() => setUnavailMonth(addMonths(unavailMonth, 1))}>›</button>
                      </div>
                      <div className="cal-grid" style={{ marginBottom: '0.4rem' }}>
                        {dayNames.map(d => <div key={d} className="cal-day-header" style={{ fontSize: '0.65rem' }}>{d}</div>)}
                      </div>
                      <div className="cal-grid" style={{ marginBottom: '0.8rem' }}>
                        {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
                        {days.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const isPending = !!pendingUnavail[dateStr];
                          const isSavedUnavail = !!savedUnavail[dateStr];
                          const isPast = new Date(dateStr + 'T12:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
                          const isUnsaved = isPending !== isSavedUnavail;
                          return (
                            <div key={dateStr} onClick={() => toggleMemberDate(dateStr)}
                              className={`cal-day ${isToday(day) ? 'today' : ''}`}
                              style={{
                                background: isPending ? 'var(--danger)' : undefined,
                                color: isPending ? '#fff' : isPast ? 'var(--text-dim)' : undefined,
                                opacity: isPast ? 0.4 : 1, cursor: isPast ? 'default' : 'pointer',
                                fontWeight: isPending ? 700 : undefined,
                                outline: isUnsaved ? '2px dashed var(--warning, #f59e0b)' : undefined,
                                outlineOffset: '-2px', fontSize: '0.8rem',
                              }}>
                              {format(day, 'd')}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        {unavailSavedMsg && <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>{unavailSavedMsg}</span>}
                        {hasChanges ? (
                          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={() => setPendingUnavail({ ...savedUnavail })}>Discard</button>
                            <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={saveMemberUnavail} disabled={savingUnavail}>
                              {savingUnavail ? 'Saving…' : 'Save Changes'}
                            </button>
                          </div>
                        ) : (
                          !unavailSavedMsg && <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Tap dates to mark unavailable</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Edit details tab */}
                  {activeTab === 'edit' && (
                    <div style={{ padding: '1rem' }}>
                      {/* Name */}
                      <div className="form-group">
                        <label>Display Name</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveEditName()}
                            style={{ flex: 1 }} />
                          <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                            onClick={saveEditName} disabled={savingName || editName.trim() === selectedMember.full_name}>
                            {savingName ? '…' : nameSaved ? '✓' : 'Save'}
                          </button>
                        </div>
                      </div>

                      {/* Password */}
                      <div className="form-group" style={{ marginTop: '0.8rem' }}>
                        <label>Reset Password</label>
                        <input type="text" placeholder="Enter new password…" value={newPassword}
                          onChange={e => { setNewPassword(e.target.value); setShowPasswordSQL(false); }} />
                        <button
                          className="btn btn-ghost btn-full"
                          style={{ marginTop: '0.5rem', fontSize: '0.82rem', borderColor: newPassword ? 'var(--accent)' : undefined, color: newPassword ? 'var(--accent)' : undefined }}
                          onClick={() => setShowPasswordSQL(true)}
                          disabled={!newPassword.trim()}>
                          Generate SQL →
                        </button>
                      </div>

                      {showPasswordSQL && newPassword && (
                        <div style={{ marginTop: '0.6rem' }}>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
                            Copy this SQL and run it in <strong>Supabase → SQL Editor</strong>:
                          </p>
                          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.7rem', fontSize: '0.72rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '0.5rem', color: 'var(--text)' }}>
{`UPDATE auth.users
SET encrypted_password = crypt('${newPassword}', gen_salt('bf')),
    email_confirmed_at = NOW()
WHERE id = '${selectedMember.id}';`}
                          </div>
                          <button className="btn btn-primary btn-full" style={{ fontSize: '0.82rem' }} onClick={copySQL}>
                            {copiedSQL ? '✓ Copied!' : 'Copy SQL'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add Staff Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Add Staff Member</h2>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jane@example.com" />
            </div>
            <div className="form-group">
              <label>Temporary Password</label>
              <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{error}</p>}
            <button className="btn btn-primary btn-full" onClick={createStaff} disabled={!form.full_name || !form.email || !form.password || saving}>
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

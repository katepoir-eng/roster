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

  // Unavailability management
  const [selectedMember, setSelectedMember] = useState(null);
  const [unavailMonth, setUnavailMonth] = useState(new Date());
  const [savedUnavail, setSavedUnavail] = useState({});
  const [pendingUnavail, setPendingUnavail] = useState({});
  const [savingUnavail, setSavingUnavail] = useState(false);
  const [unavailSavedMsg, setUnavailSavedMsg] = useState('');

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'manager')) router.replace('/');
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

  async function fetchMemberUnavail() {
    const start = format(startOfMonth(unavailMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(unavailMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('availability')
      .select('*')
      .eq('staff_id', selectedMember.id)
      .eq('available', false)
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
      await supabase.from('availability').delete()
        .eq('staff_id', selectedMember.id).eq('date', dateStr);
    }
    for (const dateStr of added) {
      await supabase.from('availability').upsert({
        staff_id: selectedMember.id,
        date: dateStr,
        available: false,
        note: 'Marked unavailable by manager',
      }, { onConflict: 'staff_id,date' });
    }

    setSavedUnavail({ ...pendingUnavail });
    setSavingUnavail(false);
    setUnavailSavedMsg('Saved!');
    setTimeout(() => setUnavailSavedMsg(''), 2000);
  }

  function discardMemberUnavail() {
    setPendingUnavail({ ...savedUnavail });
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

  // Calendar helpers
  const days = selectedMember ? eachDayOfInterval({ start: startOfMonth(unavailMonth), end: endOfMonth(unavailMonth) }) : [];
  const startPad = days.length ? getDay(days[0]) : 0;
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const pendingKeys = Object.keys(pendingUnavail).sort();
  const savedKeys = Object.keys(savedUnavail).sort();
  const hasChanges = JSON.stringify(pendingKeys) !== JSON.stringify(savedKeys);

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

      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
        💡 <strong>Tip:</strong> Tap a staff member to manage their unavailability.
      </div>

      {staff.length === 0 ? (
        <div className="empty-state">
          <p>No staff added yet.<br />Add your first team member above.</p>
        </div>
      ) : (
        staff.map(member => {
          const opt = INTEREST_OPTIONS.find(o => o.value === member.interest_level);
          const isSelected = selectedMember?.id === member.id;
          return (
            <div key={member.id} style={{ marginBottom: '0.6rem' }}>
              {/* Staff card */}
              <div
                className="card"
                onClick={() => {
                  if (isSelected) { setSelectedMember(null); }
                  else { setSelectedMember(member); setUnavailMonth(new Date()); }
                }}
                style={{ cursor: 'pointer', borderColor: isSelected ? 'var(--accent)' : 'var(--border)', marginBottom: 0, borderBottomLeftRadius: isSelected ? 0 : undefined, borderBottomRightRadius: isSelected ? 0 : undefined }}
              >
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
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {Object.keys(savedUnavail).length > 0 && isSelected
                        ? `${Object.keys(savedUnavail).length} day${Object.keys(savedUnavail).length !== 1 ? 's' : ''} off this month`
                        : 'Tap to manage availability'}
                    </div>
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

              {/* Expanded availability panel */}
              {isSelected && (
                <div style={{ border: '1px solid var(--accent)', borderTop: 'none', borderBottomLeftRadius: 'var(--radius)', borderBottomRightRadius: 'var(--radius)', padding: '1rem', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.7rem' }} onClick={() => setUnavailMonth(subMonths(unavailMonth, 1))}>‹</button>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{format(unavailMonth, 'MMMM yyyy')}</span>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.7rem' }} onClick={() => setUnavailMonth(addMonths(unavailMonth, 1))}>›</button>
                  </div>

                  {/* Mini calendar */}
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
                        <div
                          key={dateStr}
                          onClick={() => toggleMemberDate(dateStr)}
                          className={`cal-day ${isToday(day) ? 'today' : ''}`}
                          style={{
                            background: isPending ? 'var(--danger)' : undefined,
                            color: isPending ? '#fff' : isPast ? 'var(--text-dim)' : undefined,
                            opacity: isPast ? 0.4 : 1,
                            cursor: isPast ? 'default' : 'pointer',
                            fontWeight: isPending ? 700 : undefined,
                            outline: isUnsaved ? '2px dashed var(--warning, #f59e0b)' : undefined,
                            outlineOffset: '-2px',
                            fontSize: '0.8rem',
                          }}
                        >
                          {format(day, 'd')}
                        </div>
                      );
                    })}
                  </div>

                  {/* Save / Discard */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    {unavailSavedMsg && <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>{unavailSavedMsg}</span>}
                    {hasChanges && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={discardMemberUnavail}>Discard</button>
                        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={saveMemberUnavail} disabled={savingUnavail}>
                          {savingUnavail ? 'Saving…' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                    {!hasChanges && !unavailSavedMsg && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Tap dates to mark unavailable</span>
                    )}
                  </div>
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

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, isToday, isFuture, parseISO } from 'date-fns';

export default function StaffShifts() {
  const { profile, realProfile, loading } = useAuth();
  const router = useRouter();
  const [shifts, setShifts] = useState([]);
  const [view, setView] = useState('upcoming');
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [swapNote, setSwapNote] = useState('');
  const [allStaff, setAllStaff] = useState([]);
  const [targetStaff, setTargetStaff] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [latestThread, setLatestThread] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) { fetchShifts(); fetchStaff(); fetchLatestThread(); }
  }, [profile, view]);

  async function fetchShifts() {
    const now = new Date();
    // Use realProfile.id so manager sees their own shifts even in staff view mode
    const userId = realProfile?.id || profile.id;
    let query = supabase.from('shifts').select('*').eq('staff_id', userId).order('date').order('start_time');
    if (view === 'upcoming') query = query.gte('date', format(now, 'yyyy-MM-dd'));
    else {
      query = query.gte('date', format(startOfMonth(now), 'yyyy-MM-dd'))
                   .lte('date', format(endOfMonth(now), 'yyyy-MM-dd'));
    }
    const { data } = await query;
    setShifts(data || []);
  }

  async function fetchStaff() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'staff').neq('id', profile.id);
    setAllStaff(data || []);
  }

  async function fetchLatestThread() {
    const { data } = await supabase
      .from('threads')
      .select('*, author:profiles!threads_author_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) {
      setLatestThread(data);
      const lastVisit = localStorage.getItem('noticeboard_last_visit') || '1970-01-01';
      setHasUnread(new Date(data.created_at) > new Date(lastVisit));
    }
  }

  async function requestSwap() {
    setSubmitting(true);
    const { error } = await supabase.from('swap_requests').insert({
      requester_id: realProfile?.id || profile.id,
      shift_id: selectedShift.id,
      target_staff_id: targetStaff || null,
      note: swapNote,
    });
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager');
    if (managers) {
      await supabase.from('notifications').insert(
        managers.map(m => ({
          user_id: m.id,
          title: 'New swap request',
          message: `${profile.full_name} requested a swap for ${format(parseISO(selectedShift.date), 'EEE d MMM')} ${selectedShift.start_time.slice(0,5)}–${selectedShift.end_time.slice(0,5)}`,
        }))
      );
    }
    setSubmitting(false);
    if (!error) {
      setShowSwapModal(false);
      setSwapNote('');
      setTargetStaff('');
    }
  }

  function groupByDate(shifts) {
    const groups = {};
    shifts.forEach(s => {
      if (!groups[s.date]) groups[s.date] = [];
      groups[s.date].push(s);
    });
    return groups;
  }

  if (loading || !profile) return <div className="spinner" />;

  const grouped = groupByDate(shifts);

  return (
    <div className="container page-content">
      <div className="page-header">
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Welcome back</div>
          <h1>{profile.full_name.split(' ')[0]}</h1>
        </div>
      </div>

      {/* Noticeboard preview card */}
      {latestThread && (
        <div
          className="card"
          onClick={() => router.push('/noticeboard')}
          style={{ marginBottom: '1rem', cursor: 'pointer', borderColor: hasUnread ? 'var(--accent)' : 'var(--border)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: hasUnread ? 'var(--accent)' : 'var(--text-dim)' }}>
                💬 Noticeboard
              </span>
              {hasUnread && (
                <span style={{ fontSize: '0.7rem', background: 'var(--accent)', color: '#fff', borderRadius: '1rem', padding: '0.1rem 0.5rem', fontWeight: 700 }}>
                  New
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>View all →</span>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            {latestThread.author?.full_name} · {format(new Date(latestThread.created_at), 'd MMM')}
          </div>
          <p style={{
            fontSize: '0.85rem', color: 'var(--text-dim)', margin: 0,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {latestThread.message}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['upcoming', 'this month'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`btn ${view === v ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {v}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="empty-state"><p>No shifts found.<br />Enjoy your time off! 🎉</p></div>
      ) : (
        Object.entries(grouped).map(([date, dayShifts]) => (
          <div key={date} style={{ marginBottom: '1.2rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
              {isToday(parseISO(date)) ? '📍 Today' : format(parseISO(date), 'EEEE, d MMMM')}
            </div>
            {dayShifts.map(shift => (
              <div key={shift.id} className="shift-item" style={{ borderColor: isToday(parseISO(date)) ? 'var(--accent)' : 'var(--border)' }}>
                <div className="shift-time mono">{shift.start_time.slice(0,5)}<br />{shift.end_time.slice(0,5)}</div>
                <div className="shift-info">
                  <div className="shift-name">{shift.title || 'Shift'}</div>
                  {shift.notes && <div className="shift-role">{shift.notes}</div>}
                  {shift.is_recurring && <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.2rem' }}>↻ Recurring</div>}
                </div>
                {isFuture(parseISO(date)) && (
                  <button className="btn btn-ghost" style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}
                    onClick={() => { setSelectedShift(shift); setShowSwapModal(true); }}>
                    Swap
                  </button>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {showSwapModal && selectedShift && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSwapModal(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '0.4rem' }}>Request Swap</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              {format(parseISO(selectedShift.date), 'EEE d MMM')} · {selectedShift.start_time.slice(0,5)}–{selectedShift.end_time.slice(0,5)}
            </p>
            <div className="form-group">
              <label>Swap with (optional)</label>
              <select value={targetStaff} onChange={e => setTargetStaff(e.target.value)}>
                <option value="">Anyone / Manager decides</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Reason / Note</label>
              <textarea rows={2} value={swapNote} onChange={e => setSwapNote(e.target.value)} placeholder="Why do you need to swap?" style={{ resize: 'none' }} />
            </div>
            <button className="btn btn-primary btn-full" onClick={requestSwap} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

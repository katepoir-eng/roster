import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, isFuture, parseISO, addMonths, subMonths, addWeeks, startOfDay } from 'date-fns';

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

  // Team schedule state
  const [teamMonth, setTeamMonth] = useState(new Date());
  const [teamSelectedDay, setTeamSelectedDay] = useState(new Date());
  const [teamShifts, setTeamShifts] = useState([]);
  const [teamUnavail, setTeamUnavail] = useState({}); // { 'yyyy-MM-dd': [name, ...] }
  const [upcomingShifts, setUpcomingShifts] = useState([]);

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) { fetchShifts(); fetchStaff(); fetchLatestThread(); fetchUpcoming(); }
  }, [profile, view]);

  useEffect(() => {
    if (profile) { fetchTeamShifts(); fetchTeamUnavail(); }
  }, [profile, teamMonth]);

  async function fetchShifts() {
    const now = new Date();
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

  async function fetchTeamShifts() {
    const start = format(startOfMonth(teamMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(teamMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('shifts')
      .select('*, staff:profiles!shifts_staff_id_fkey(full_name)')
      .gte('date', start).lte('date', end)
      .order('start_time');
    setTeamShifts(data || []);
  }

  async function fetchTeamUnavail() {
    const start = format(startOfMonth(teamMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(teamMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('availability')
      .select('date, profiles(full_name)')
      .eq('available', false)
      .gte('date', start).lte('date', end);
    const map = {};
    (data || []).forEach(row => {
      if (!map[row.date]) map[row.date] = [];
      map[row.date].push(row.profiles?.full_name || 'Unknown');
    });
    setTeamUnavail(map);
  }

  async function fetchUpcoming() {
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const sixWeeks = format(addWeeks(new Date(), 6), 'yyyy-MM-dd');
    const { data } = await supabase.from('shifts')
      .select('*, staff:profiles!shifts_staff_id_fkey(full_name)')
      .gte('date', today).lte('date', sixWeeks)
      .order('date').order('start_time');
    setUpcomingShifts(data || []);
  }

  async function requestSwap() {
    setSubmitting(true);
    const { error } = await supabase.from('swap_requests').insert({
      requester_id: realProfile?.id || profile.id,
      shift_id: selectedShift.id,
      target_staff_id: targetStaff || null,
      note: swapNote,
    });
    const { data: managers } = await supabase.from('profiles').select('id').in('role', ['manager','admin']);
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
    if (!error) { setShowSwapModal(false); setSwapNote(''); setTargetStaff(''); }
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

  // Team calendar
  const teamDays = eachDayOfInterval({ start: startOfMonth(teamMonth), end: endOfMonth(teamMonth) });
  const teamStartPad = getDay(teamDays[0]);
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const selectedDateStr = format(teamSelectedDay, 'yyyy-MM-dd');
  const teamDayShifts = teamShifts.filter(s => s.date === selectedDateStr);
  const teamDayUnavail = teamUnavail[selectedDateStr] || [];

  // Upcoming grouped by date
  const upcomingByDate = {};
  upcomingShifts.forEach(s => {
    if (!upcomingByDate[s.date]) upcomingByDate[s.date] = [];
    upcomingByDate[s.date].push(s);
  });

  return (
    <div className="container page-content">
      <div className="page-header">
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Welcome back</div>
          <h1>{profile.full_name.split(' ')[0]}</h1>
        </div>
      </div>

      {/* Noticeboard preview */}
      {latestThread && (
        <div className="card" onClick={() => router.push('/noticeboard')}
          style={{ marginBottom: '1rem', cursor: 'pointer', borderColor: hasUnread ? 'var(--accent)' : 'var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: hasUnread ? 'var(--accent)' : 'var(--text-dim)' }}>
                💬 Noticeboard
              </span>
              {hasUnread && <span style={{ fontSize: '0.7rem', background: 'var(--accent)', color: '#fff', borderRadius: '1rem', padding: '0.1rem 0.5rem', fontWeight: 700 }}>New</span>}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>View all →</span>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            {latestThread.author?.full_name} · {format(new Date(latestThread.created_at), 'd MMM')}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {latestThread.message}
          </p>
        </div>
      )}

      {/* My Shifts */}
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

      {/* ── Team Schedule ── */}
      <div style={{ marginTop: '2rem', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          Team Schedule
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setTeamMonth(subMonths(teamMonth, 1))}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{format(teamMonth, 'MMMM yyyy')}</span>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setTeamMonth(addMonths(teamMonth, 1))}>›</button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="cal-grid" style={{ marginBottom: '0.4rem' }}>
          {dayNames.map(d => <div key={d} className="cal-day-header">{d}</div>)}
        </div>
        <div className="cal-grid">
          {Array(teamStartPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
          {teamDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const hasShift = teamShifts.some(s => s.date === dateStr);
            const hasUnavail = !!teamUnavail[dateStr];
            const selected = isSameDay(day, teamSelectedDay);
            const myShift = teamShifts.some(s => s.date === dateStr && s.staff_id === (realProfile?.id || profile.id));
            return (
              <div key={dateStr}
                className={`cal-day ${isToday(day) ? 'today' : ''} ${hasShift ? 'has-shift' : ''} ${selected ? 'selected' : ''}`}
                onClick={() => setTeamSelectedDay(day)}
                style={{ position: 'relative' }}>
                {format(day, 'd')}
                {hasUnavail && (
                  <span style={{ position: 'absolute', top: 1, right: 2, fontSize: '0.55rem', color: 'var(--danger)', fontWeight: 900, lineHeight: 1 }}>✕</span>
                )}
                {myShift && (
                  <span style={{ position: 'absolute', bottom: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>{format(teamSelectedDay, 'EEEE, d MMMM')}</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{teamDayShifts.length} shift{teamDayShifts.length !== 1 ? 's' : ''}</span>
      </div>

      {teamDayUnavail.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '0.5rem 0.8rem', marginBottom: '0.6rem', fontSize: '0.82rem', color: 'var(--danger)' }}>
          ✕ Unavailable: {teamDayUnavail.join(', ')}
        </div>
      )}

      {teamDayShifts.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: '1rem' }}><p>Nobody scheduled this day.</p></div>
      ) : (
        teamDayShifts.map(shift => {
          const isMe = shift.staff_id === (realProfile?.id || profile.id);
          return (
            <div key={shift.id} className="shift-item" style={{ marginBottom: '0.5rem', borderColor: isMe ? 'var(--accent)' : 'var(--border)' }}>
              <div className="shift-time mono">{shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}</div>
              <div className="shift-info">
                <div className="shift-name" style={{ color: isMe ? 'var(--accent)' : undefined }}>
                  {shift.staff?.full_name} {isMe && '(you)'}
                </div>
                <div className="shift-role">{shift.title || 'Shift'}</div>
              </div>
            </div>
          );
        })
      )}

      {/* ── Upcoming 6 Weeks ── */}
      <div style={{ marginTop: '2rem', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          Upcoming — Next 6 Weeks
        </div>
      </div>
      {Object.keys(upcomingByDate).length === 0 ? (
        <div className="empty-state"><p>No upcoming shifts scheduled.</p></div>
      ) : (
        Object.entries(upcomingByDate).map(([date, dayShifts]) => (
          <div key={date} style={{ marginBottom: '0.8rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
              {isToday(new Date(date + 'T12:00:00')) ? '📍 Today' : format(new Date(date + 'T12:00:00'), 'EEE d MMM')}
            </div>
            {dayShifts.map(shift => {
              const isMe = shift.staff_id === (realProfile?.id || profile.id);
              return (
                <div key={shift.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.8rem', flexShrink: 0 }}>
                    {shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}
                  </span>
                  <span style={{ fontWeight: isMe ? 800 : 600, flex: 1, color: isMe ? 'var(--accent)' : undefined }}>
                    {shift.staff?.full_name}{isMe ? ' (you)' : ''}
                  </span>
                  {shift.title && <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{shift.title}</span>}
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Swap modal */}
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

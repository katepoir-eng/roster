import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, addMonths, subMonths, isSameMonth } from 'date-fns';

export default function Availability() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [unavailable, setUnavailable] = useState({}); // { 'yyyy-MM-dd': true }
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (!profile) return;
    fetchAvailability();
  }, [profile, currentMonth]);

  async function fetchAvailability() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('availability')
      .select('*')
      .eq('staff_id', profile.id)
      .gte('date', start).lte('date', end)
      .eq('available', false);
    const map = {};
    (data || []).forEach(row => { map[row.date] = true; });
    setUnavailable(map);
  }

  async function toggleDate(dateStr) {
    const isPast = new Date(dateStr + 'T12:00:00') < new Date(new Date().setHours(0,0,0,0));
    if (isPast) return; // can't toggle past dates

    setSaving(true);
    if (unavailable[dateStr]) {
      // Remove unavailability (mark available again)
      await supabase.from('availability')
        .delete()
        .eq('staff_id', profile.id)
        .eq('date', dateStr);
      setUnavailable(u => { const n = {...u}; delete n[dateStr]; return n; });
    } else {
      // Mark unavailable
      await supabase.from('availability').upsert({
        staff_id: profile.id,
        date: dateStr,
        available: false,
        note: 'Requested day off',
      }, { onConflict: 'staff_id,date' });
      setUnavailable(u => ({ ...u, [dateStr]: true }));

      // Notify managers
      const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager');
      managers?.forEach(m => {
        supabase.from('notifications').insert({
          user_id: m.id,
          title: 'Availability update',
          message: `${profile.full_name} marked ${format(new Date(dateStr + 'T12:00:00'), 'EEE d MMM')} as unavailable.`,
        }).then(() => {});
      });
    }

    setSaving(false);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  if (loading || !profile) return <div className="spinner" />;

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(days[0]);
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const unavailableCount = Object.keys(unavailable).length;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Availability</h1>
        {savedMsg && <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>{savedMsg}</span>}
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
        You're available by default. Tap a date to mark it as unavailable (request day off).
      </p>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{format(currentMonth, 'MMMM yyyy')}</span>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>›</button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-dim)', display: 'inline-block' }} /> Available
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} /> Unavailable
        </span>
      </div>

      {/* Calendar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="cal-grid" style={{ marginBottom: '0.4rem' }}>
          {dayNames.map(d => <div key={d} className="cal-day-header">{d}</div>)}
        </div>
        <div className="cal-grid">
          {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isUnavailable = !!unavailable[dateStr];
            const isPast = new Date(dateStr + 'T12:00:00') < new Date(new Date().setHours(0,0,0,0));
            return (
              <div
                key={dateStr}
                onClick={() => !isPast && toggleDate(dateStr)}
                className={`cal-day ${isToday(day) ? 'today' : ''}`}
                style={{
                  background: isUnavailable ? 'var(--danger)' : undefined,
                  color: isUnavailable ? '#fff' : isPast ? 'var(--text-dim)' : undefined,
                  opacity: isPast ? 0.4 : 1,
                  cursor: isPast ? 'default' : 'pointer',
                  fontWeight: isUnavailable ? 700 : undefined,
                }}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {unavailableCount > 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
            Unavailable this month ({unavailableCount} day{unavailableCount !== 1 ? 's' : ''})
          </div>
          {Object.keys(unavailable).sort().map(dateStr => (
            <div key={dateStr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.88rem' }}>{format(new Date(dateStr + 'T12:00:00'), 'EEEE, d MMMM')}</span>
              <button
                onClick={() => toggleDate(dateStr)}
                style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', padding: '0.2rem 0.4rem' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>You're available all month! 🎉<br />Tap any date to request it off.</p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

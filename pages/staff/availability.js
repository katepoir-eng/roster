import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, addMonths, subMonths, isBefore, startOfDay } from 'date-fns';

export default function StaffAvailability() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) fetchAvailability();
  }, [profile, currentMonth]);

  async function fetchAvailability() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('availability').select('*')
      .eq('staff_id', profile.id).gte('date', start).lte('date', end);
    const map = {};
    (data || []).forEach(a => { map[a.date] = a; });
    setAvailability(map);
  }

  async function toggleDay(dateStr) {
    const today = startOfDay(new Date());
    if (isBefore(new Date(dateStr), today)) return; // can't change past days

    setSaving(dateStr);
    const existing = availability[dateStr];
    if (existing) {
      // Toggle available status
      const { data } = await supabase.from('availability')
        .update({ available: !existing.available })
        .eq('id', existing.id).select().single();
      setAvailability(prev => ({ ...prev, [dateStr]: data }));
    } else {
      // Create as unavailable (default assumption: not set = available)
      const { data } = await supabase.from('availability')
        .insert({ staff_id: profile.id, date: dateStr, available: false })
        .select().single();
      setAvailability(prev => ({ ...prev, [dateStr]: data }));
    }
    setSaving(null);
  }

  if (loading || !profile) return <div className="spinner" />;

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(days[0]);
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function getDayStyle(dateStr) {
    const avail = availability[dateStr];
    const past = isBefore(new Date(dateStr), startOfDay(new Date()));
    if (past) return { opacity: 0.4, cursor: 'default' };
    if (avail && !avail.available) return { background: '#2a0a0a', borderColor: 'var(--danger)', color: 'var(--danger)' };
    return {};
  }

  const unavailableCount = Object.values(availability).filter(a => !a.available).length;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Availability</h1>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
        Tap any future date to mark yourself as <span style={{ color: 'var(--danger)' }}>unavailable</span>. Tap again to undo. Days not marked are assumed available.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>{format(currentMonth, 'MMMM yyyy')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{unavailableCount} day{unavailableCount !== 1 ? 's' : ''} unavailable</div>
        </div>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>›</button>
      </div>

      <div className="card">
        <div className="cal-grid" style={{ marginBottom: '0.4rem' }}>
          {dayNames.map(d => <div key={d} className="cal-day-header">{d}</div>)}
        </div>
        <div className="cal-grid">
          {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const avail = availability[dateStr];
            const isUnavail = avail && !avail.available;
            return (
              <div
                key={dateStr}
                className={`cal-day ${isToday(day) ? 'today' : ''}`}
                style={getDayStyle(dateStr)}
                onClick={() => toggleDay(dateStr)}
              >
                {saving === dateStr ? '…' : format(day, 'd')}
                {isUnavail && <span style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, background: 'var(--danger)', borderRadius: '50%' }} />}
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, addMonths, subMonths } from 'date-fns';

export default function Availability() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [saved, setSaved] = useState({});       // what's in the database
  const [pending, setPending] = useState({});   // local edits not yet saved
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
    setSaved(map);
    setPending(map); // start pending from saved state
  }

  function toggleDate(dateStr) {
    const isPast = new Date(dateStr + 'T12:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
    if (isPast) return;
    setPending(p => {
      const next = { ...p };
      if (next[dateStr]) delete next[dateStr];
      else next[dateStr] = true;
      return next;
    });
  }

  // Check if there are unsaved changes
  const pendingKeys = Object.keys(pending).sort();
  const savedKeys = Object.keys(saved).sort();
  const hasChanges = JSON.stringify(pendingKeys) !== JSON.stringify(savedKeys);

  // What changed
  const added = Object.keys(pending).filter(d => !saved[d]);
  const removed = Object.keys(saved).filter(d => !pending[d]);

  async function saveChanges() {
    setSaving(true);

    // Delete removed dates
    for (const dateStr of removed) {
      await supabase.from('availability')
        .delete()
        .eq('staff_id', profile.id)
        .eq('date', dateStr);
    }

    // Upsert added dates
    for (const dateStr of added) {
      await supabase.from('availability').upsert({
        staff_id: profile.id,
        date: dateStr,
        available: false,
        note: 'Requested day off',
      }, { onConflict: 'staff_id,date' });
    }

    // Send ONE grouped notification to managers
    if (added.length > 0 || removed.length > 0) {
      const { data: managers } = await supabase.from('profiles').select('id').in('role', ['manager','admin']);
      if (managers?.length) {
        const parts = [];
        if (added.length > 0) {
          const dates = added.sort().map(d => format(new Date(d + 'T12:00:00'), 'EEE d MMM')).join(', ');
          parts.push(`requested off: ${dates}`);
        }
        if (removed.length > 0) {
          const dates = removed.sort().map(d => format(new Date(d + 'T12:00:00'), 'EEE d MMM')).join(', ');
          parts.push(`now available: ${dates}`);
        }
        const message = `${profile.full_name} updated availability — ${parts.join(' · ')}`;
        await Promise.all(managers.map(m =>
          supabase.from('notifications').insert({
            user_id: m.id,
            title: 'Availability update',
            message,
          })
        ));
      }
    }

    setSaved({ ...pending });
    setSaving(false);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  function discardChanges() {
    setPending({ ...saved });
  }

  if (loading || !profile) return <div className="spinner" />;

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(days[0]);
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const unavailableCount = Object.keys(pending).length;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Availability</h1>
        {savedMsg && <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>{savedMsg}</span>}
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
        Tap dates to mark unavailable, then tap <strong>Save Changes</strong> to confirm.
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
        {hasChanges && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--warning, #f59e0b)', border: '2px dashed var(--warning, #f59e0b)', display: 'inline-block' }} /> Unsaved
          </span>
        )}
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
            const isPending = !!pending[dateStr];
            const isSavedUnavail = !!saved[dateStr];
            const isPast = new Date(dateStr + 'T12:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
            const isUnsaved = isPending !== isSavedUnavail;
            return (
              <div
                key={dateStr}
                onClick={() => !isPast && toggleDate(dateStr)}
                className={`cal-day ${isToday(day) ? 'today' : ''}`}
                style={{
                  background: isPending ? 'var(--danger)' : undefined,
                  color: isPending ? '#fff' : isPast ? 'var(--text-dim)' : undefined,
                  opacity: isPast ? 0.4 : 1,
                  cursor: isPast ? 'default' : 'pointer',
                  fontWeight: isPending ? 700 : undefined,
                  outline: isUnsaved ? '2px dashed var(--warning, #f59e0b)' : undefined,
                  outlineOffset: '-2px',
                }}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save / Discard buttons — only shown when there are changes */}
      {hasChanges && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
          <button className="btn btn-ghost btn-full" onClick={discardChanges}>
            Discard
          </button>
          <button className="btn btn-primary btn-full" onClick={saveChanges} disabled={saving}>
            {saving ? 'Saving…' : `Save Changes ${added.length + removed.length > 0 ? `(${added.length + removed.length})` : ''}`}
          </button>
        </div>
      )}

      {/* Summary */}
      {unavailableCount > 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
            Unavailable this month ({unavailableCount} day{unavailableCount !== 1 ? 's' : ''})
          </div>
          {Object.keys(pending).sort().map(dateStr => {
            const isUnsaved = !saved[dateStr];
            return (
              <div key={dateStr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.88rem' }}>
                  {format(new Date(dateStr + 'T12:00:00'), 'EEEE, d MMMM')}
                  {isUnsaved && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--warning, #f59e0b)', fontWeight: 700 }}>unsaved</span>}
                </span>
                <button
                  onClick={() => toggleDate(dateStr)}
                  style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', padding: '0.2rem 0.4rem' }}
                >
                  Remove
                </button>
              </div>
            );
          })}
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

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from 'date-fns';

export default function ManagerRoster() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newShift, setNewShift] = useState({ staff_id: '', start_time: '09:00', end_time: '17:00', title: '', notes: '', is_recurring: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'manager')) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (!profile) return;
    fetchShifts();
    fetchStaff();
  }, [profile, currentMonth]);

  async function fetchShifts() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('shifts').select('*, profiles(full_name)')
      .gte('date', start).lte('date', end);
    setShifts(data || []);
  }

  async function fetchStaff() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'staff');
    setStaff(data || []);
  }

  async function addShift() {
    setSaving(true);
    const { error } = await supabase.from('shifts').insert({
      ...newShift,
      date: format(selectedDay, 'yyyy-MM-dd'),
      created_by: profile.id,
    });
    if (!error) {
      // Notify the staff member
      await supabase.from('notifications').insert({
        user_id: newShift.staff_id,
        title: 'New shift assigned',
        message: `You have a new shift on ${format(selectedDay, 'EEE d MMM')}: ${newShift.start_time}–${newShift.end_time}`,
      });
      fetchShifts();
      setShowAddModal(false);
      setNewShift({ staff_id: '', start_time: '09:00', end_time: '17:00', title: '', notes: '', is_recurring: false });
    }
    setSaving(false);
  }

  async function deleteShift(id, staffId) {
    if (!confirm('Delete this shift?')) return;
    await supabase.from('shifts').delete().eq('id', id);
    await supabase.from('notifications').insert({
      user_id: staffId,
      title: 'Shift removed',
      message: `A shift on ${format(selectedDay, 'EEE d MMM')} has been removed.`,
    });
    fetchShifts();
  }

  if (loading || !profile) return <div className="spinner" />;

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(days[0]);
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dayShifts = shifts.filter(s => s.date === format(selectedDay, 'yyyy-MM-dd'));

  return (
    <div className="container page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Manager</div>
          <h1>Roster</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Shift</button>
      </div>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{format(currentMonth, 'MMMM yyyy')}</span>
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>›</button>
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
            const hasShift = shifts.some(s => s.date === dateStr);
            const selected = isSameDay(day, selectedDay);
            return (
              <div
                key={dateStr}
                className={`cal-day ${isToday(day) ? 'today' : ''} ${hasShift ? 'has-shift' : ''} ${selected ? 'selected' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day shifts */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>{format(selectedDay, 'EEEE, d MMMM')}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}</span>
        </div>

        {dayShifts.length === 0 ? (
          <div className="empty-state">
            <p>No shifts scheduled.<br />Tap + Shift to add one.</p>
          </div>
        ) : (
          dayShifts.map(shift => (
            <div key={shift.id} className="shift-item">
              <div className="shift-time mono">{shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}</div>
              <div className="shift-info">
                <div className="shift-name">{shift.profiles?.full_name}</div>
                <div className="shift-role">{shift.title || 'Shift'}</div>
              </div>
              <button onClick={() => deleteShift(shift.id, shift.staff_id)} style={{ background: 'none', color: 'var(--danger)', fontSize: '1.2rem', padding: '0.2rem 0.4rem' }}>×</button>
            </div>
          ))
        )}
      </div>

      {/* Add Shift Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Add Shift — {format(selectedDay, 'd MMM')}</h2>

            <div className="form-group">
              <label>Staff Member</label>
              <select value={newShift.staff_id} onChange={e => setNewShift({...newShift, staff_id: e.target.value})}>
                <option value="">Select staff…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="form-group">
                <label>Start</label>
                <input type="time" value={newShift.start_time} onChange={e => setNewShift({...newShift, start_time: e.target.value})} />
              </div>
              <div className="form-group">
                <label>End</label>
                <input type="time" value={newShift.end_time} onChange={e => setNewShift({...newShift, end_time: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label>Shift Title (optional)</label>
              <input type="text" placeholder="e.g. Morning, Floor supervisor…" value={newShift.title} onChange={e => setNewShift({...newShift, title: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea rows={2} placeholder="Any notes for this shift…" value={newShift.notes} onChange={e => setNewShift({...newShift, notes: e.target.value})} style={{ resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <input type="checkbox" id="recurring" style={{ width: 'auto' }} checked={newShift.is_recurring} onChange={e => setNewShift({...newShift, is_recurring: e.target.checked})} />
              <label htmlFor="recurring" style={{ fontSize: '0.9rem', color: 'var(--text)', textTransform: 'none', letterSpacing: 0 }}>Mark as recurring shift</label>
            </div>

            <button className="btn btn-primary btn-full" onClick={addShift} disabled={!newShift.staff_id || saving}>
              {saving ? 'Saving…' : 'Add Shift'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

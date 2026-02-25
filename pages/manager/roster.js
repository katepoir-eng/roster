import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths, addWeeks, startOfDay } from 'date-fns';

export default function ManagerRoster() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [unavailability, setUnavailability] = useState({});
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [duplicateShift, setDuplicateShift] = useState(null); // { ...shift, dupDate, dupStaffId }
  const [newShift, setNewShift] = useState({ staff_id: '', start_time: '08:00', end_time: '17:15', title: '', notes: '', is_recurring: false });
  const [saving, setSaving] = useState(false);
  const [recurringPreview, setRecurringPreview] = useState(null);

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'manager')) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (!profile) return;
    fetchShifts();
    fetchStaff();
    fetchUnavailability();
    fetchUpcoming();
  }, [profile, currentMonth]);

  async function fetchShifts() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('shifts')
      .select('*, staff:profiles!shifts_staff_id_fkey(full_name)')
      .gte('date', start).lte('date', end);
    setShifts(data || []);
  }

  async function fetchStaff() {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setStaff(data || []);
  }

  async function fetchUnavailability() {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await supabase.from('availability')
      .select('date, profiles(full_name)')
      .eq('available', false)
      .gte('date', start).lte('date', end);
    const map = {};
    (data || []).forEach(row => {
      if (!map[row.date]) map[row.date] = [];
      map[row.date].push(row.profiles?.full_name || 'Unknown');
    });
    setUnavailability(map);
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

  async function addShift() {
    setSaving(true);
    const { error } = await supabase.from('shifts').insert({
      ...newShift,
      date: format(selectedDay, 'yyyy-MM-dd'),
      created_by: profile.id,
    });
    if (!error) {
      supabase.from('notifications').insert({
        user_id: newShift.staff_id,
        title: 'New shift assigned',
        message: `You have a new shift on ${format(selectedDay, 'EEE d MMM')}: ${newShift.start_time}–${newShift.end_time}`,
      }).then(() => {});
      fetchShifts(); fetchUpcoming();
      setShowAddModal(false);
      setNewShift({ staff_id: '', start_time: '08:00', end_time: '17:15', title: '', notes: '', is_recurring: false });
    }
    setSaving(false);
  }

  async function saveEditShift() {
    setSaving(true);
    const { error } = await supabase.from('shifts').update({
      staff_id: editShift.staff_id,
      start_time: editShift.start_time,
      end_time: editShift.end_time,
      title: editShift.title,
      notes: editShift.notes,
      is_recurring: editShift.is_recurring,
    }).eq('id', editShift.id);
    if (!error) {
      supabase.from('notifications').insert({
        user_id: editShift.staff_id,
        title: 'Shift updated',
        message: `Your shift on ${format(selectedDay, 'EEE d MMM')} has been updated: ${editShift.start_time}–${editShift.end_time}`,
      }).then(() => {});
      fetchShifts(); fetchUpcoming();
      setEditShift(null);
    }
    setSaving(false);
  }

  async function saveDuplicate() {
    if (!duplicateShift.dupDate || !duplicateShift.dupStaffId) return;
    setSaving(true);
    const { error } = await supabase.from('shifts').insert({
      staff_id: duplicateShift.dupStaffId,
      date: duplicateShift.dupDate,
      start_time: duplicateShift.start_time,
      end_time: duplicateShift.end_time,
      title: duplicateShift.title,
      notes: duplicateShift.notes,
      is_recurring: duplicateShift.is_recurring,
      created_by: profile.id,
    });
    if (!error) {
      supabase.from('notifications').insert({
        user_id: duplicateShift.dupStaffId,
        title: 'New shift assigned',
        message: `You have a new shift on ${format(new Date(duplicateShift.dupDate + 'T12:00:00'), 'EEE d MMM')}: ${duplicateShift.start_time.slice(0,5)}–${duplicateShift.end_time.slice(0,5)}`,
      }).then(() => {});
      fetchShifts(); fetchUpcoming();
      setDuplicateShift(null);
    }
    setSaving(false);
  }

  async function deleteShift(id, staffId) {
    if (!confirm('Delete this shift?')) return;
    await supabase.from('shifts').delete().eq('id', id);
    supabase.from('notifications').insert({
      user_id: staffId,
      title: 'Shift removed',
      message: `A shift on ${format(selectedDay, 'EEE d MMM')} has been removed.`,
    }).then(() => {});
    fetchShifts(); fetchUpcoming();
  }

  async function previewRecurringShifts() {
    const lastMonth = subMonths(currentMonth, 1);
    const lastStart = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
    const lastEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
    const { data: lastMonthShifts } = await supabase.from('shifts')
      .select('*, staff:profiles!shifts_staff_id_fkey(full_name)')
      .gte('date', lastStart).lte('date', lastEnd)
      .eq('is_recurring', true);
    if (!lastMonthShifts || lastMonthShifts.length === 0) {
      alert(`No recurring shifts found in ${format(lastMonth, 'MMMM yyyy')}.`); return;
    }
    const currentDays = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    const daysByWeekday = {};
    currentDays.forEach(day => {
      const dow = getDay(day);
      if (!daysByWeekday[dow]) daysByWeekday[dow] = [];
      daysByWeekday[dow].push(day);
    });
    const seen = new Set();
    const uniqueShifts = [];
    lastMonthShifts.forEach(shift => {
      const dow = getDay(new Date(shift.date + 'T12:00:00'));
      const key = `${shift.staff_id}-${dow}`;
      if (!seen.has(key)) { seen.add(key); uniqueShifts.push({ ...shift, dow }); }
    });
    const preview = [];
    uniqueShifts.forEach(shift => {
      (daysByWeekday[shift.dow] || []).forEach(day => {
        const newDate = format(day, 'yyyy-MM-dd');
        if (!shifts.some(s => s.staff_id === shift.staff_id && s.date === newDate)) {
          preview.push({
            staff_id: shift.staff_id, staff_name: shift.staff?.full_name,
            date: newDate, start_time: shift.start_time, end_time: shift.end_time,
            title: shift.title, notes: shift.notes, is_recurring: true,
          });
        }
      });
    });
    if (preview.length === 0) {
      alert(`All recurring shifts from ${format(lastMonth, 'MMMM')} already exist in ${format(currentMonth, 'MMMM yyyy')}.`); return;
    }
    preview.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    setRecurringPreview({ shifts: preview, copying: false });
  }

  async function confirmCopyRecurring() {
    setRecurringPreview(p => ({ ...p, copying: true }));
    const { error } = await supabase.from('shifts').insert(
      recurringPreview.shifts.map(s => ({
        staff_id: s.staff_id, date: s.date, start_time: s.start_time,
        end_time: s.end_time, title: s.title, notes: s.notes,
        is_recurring: true, created_by: profile.id,
      }))
    );
    if (!error) { fetchShifts(); fetchUpcoming(); setRecurringPreview(null); }
    else { alert('Error copying shifts. Please try again.'); setRecurringPreview(p => ({ ...p, copying: false })); }
  }

  if (loading || !profile) return <div className="spinner" />;

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(days[0]);
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dayShifts = shifts.filter(s => s.date === format(selectedDay, 'yyyy-MM-dd'));
  const dayUnavailable = unavailability[format(selectedDay, 'yyyy-MM-dd')] || [];
  const lastMonthName = format(subMonths(currentMonth, 1), 'MMMM');
  const upcomingByDate = {};
  upcomingShifts.forEach(s => {
    if (!upcomingByDate[s.date]) upcomingByDate[s.date] = [];
    upcomingByDate[s.date].push(s);
  });

  return (
    <div className="container page-content">
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

      {/* Recurring shifts banner */}
      <div style={{ marginBottom: '0.8rem' }}>
        <button className="btn btn-ghost btn-full" onClick={previewRecurringShifts}
          style={{ fontSize: '0.85rem', color: 'var(--accent)', borderColor: 'var(--accent-dim)' }}>
          🔁 Copy recurring shifts from {lastMonthName}
        </button>
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
            const hasUnavail = !!unavailability[dateStr];
            const selected = isSameDay(day, selectedDay);
            return (
              <div key={dateStr}
                className={`cal-day ${isToday(day) ? 'today' : ''} ${hasShift ? 'has-shift' : ''} ${selected ? 'selected' : ''}`}
                onClick={() => setSelectedDay(day)} style={{ position: 'relative' }}>
                {format(day, 'd')}
                {hasUnavail && (
                  <span style={{ position: 'absolute', top: 1, right: 2, fontSize: '0.55rem', color: 'var(--danger)', fontWeight: 900, lineHeight: 1 }}>✕</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>{format(selectedDay, 'EEEE, d MMMM')}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}</span>
        </div>

        {dayUnavailable.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '0.5rem 0.8rem', marginBottom: '0.6rem', fontSize: '0.82rem', color: 'var(--danger)' }}>
            ✕ Unavailable: {dayUnavailable.join(', ')}
          </div>
        )}

        {dayShifts.length === 0 ? (
          <div className="empty-state"><p>No shifts scheduled.<br />Tap + Shift to add one.</p></div>
        ) : (
          dayShifts.map(shift => (
            <div key={shift.id} className="shift-item">
              <div className="shift-time mono">{shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}</div>
              <div className="shift-info">
                <div className="shift-name">
                  {shift.staff?.full_name}
                  {shift.is_recurring && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--accent)' }}>🔁</span>}
                </div>
                <div className="shift-role">{shift.title || 'Shift'}</div>
              </div>
              {/* Duplicate button */}
              <button
                onClick={() => setDuplicateShift({ ...shift, start_time: shift.start_time.slice(0,5), end_time: shift.end_time.slice(0,5), dupDate: '', dupStaffId: shift.staff_id })}
                title="Duplicate shift"
                style={{ background: 'none', color: 'var(--text-dim)', fontSize: '0.85rem', padding: '0.2rem 0.4rem' }}>⧉</button>
              <button onClick={() => setEditShift({ ...shift, start_time: shift.start_time.slice(0,5), end_time: shift.end_time.slice(0,5) })}
                style={{ background: 'none', color: 'var(--accent)', fontSize: '0.85rem', padding: '0.2rem 0.4rem' }}>✏️</button>
              <button onClick={() => deleteShift(shift.id, shift.staff_id)}
                style={{ background: 'none', color: 'var(--danger)', fontSize: '1.2rem', padding: '0.2rem 0.4rem' }}>×</button>
            </div>
          ))
        )}
      </div>

      {/* Upcoming 6 weeks */}
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
            {dayShifts.map(shift => (
              <div key={shift.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.8rem', flexShrink: 0 }}>
                  {shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}
                </span>
                <span style={{ fontWeight: 600, flex: 1 }}>{shift.staff?.full_name}</span>
                {shift.title && <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{shift.title}</span>}
                {shift.is_recurring && <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>🔁</span>}
              </div>
            ))}
          </div>
        ))
      )}

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
              <div className="form-group"><label>Start</label>
                <input type="time" value={newShift.start_time} onChange={e => setNewShift({...newShift, start_time: e.target.value})} /></div>
              <div className="form-group"><label>End</label>
                <input type="time" value={newShift.end_time} onChange={e => setNewShift({...newShift, end_time: e.target.value})} /></div>
            </div>
            <div className="form-group">
              <label>Shift Title (optional)</label>
              <input type="text" placeholder="e.g. Morning, Floor supervisor…" value={newShift.title} onChange={e => setNewShift({...newShift, title: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea rows={2} value={newShift.notes} onChange={e => setNewShift({...newShift, notes: e.target.value})} style={{ resize: 'none' }} />
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

      {/* Edit Shift Modal */}
      {editShift && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditShift(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Edit Shift — {format(selectedDay, 'd MMM')}</h2>
            <div className="form-group">
              <label>Staff Member</label>
              <select value={editShift.staff_id} onChange={e => setEditShift({...editShift, staff_id: e.target.value})}>
                <option value="">Select staff…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="form-group"><label>Start</label>
                <input type="time" value={editShift.start_time} onChange={e => setEditShift({...editShift, start_time: e.target.value})} /></div>
              <div className="form-group"><label>End</label>
                <input type="time" value={editShift.end_time} onChange={e => setEditShift({...editShift, end_time: e.target.value})} /></div>
            </div>
            <div className="form-group">
              <label>Shift Title (optional)</label>
              <input type="text" value={editShift.title || ''} onChange={e => setEditShift({...editShift, title: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea rows={2} value={editShift.notes || ''} onChange={e => setEditShift({...editShift, notes: e.target.value})} style={{ resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <input type="checkbox" id="edit-recurring" style={{ width: 'auto' }} checked={editShift.is_recurring} onChange={e => setEditShift({...editShift, is_recurring: e.target.checked})} />
              <label htmlFor="edit-recurring" style={{ fontSize: '0.9rem', color: 'var(--text)', textTransform: 'none', letterSpacing: 0 }}>Mark as recurring shift</label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setEditShift(null)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={saveEditShift} disabled={!editShift.staff_id || saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Shift Modal */}
      {duplicateShift && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDuplicateShift(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '0.4rem' }}>Duplicate Shift</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.2rem' }}>
              {duplicateShift.start_time}–{duplicateShift.end_time} · {duplicateShift.title || 'Shift'}
            </p>
            <div className="form-group">
              <label>Copy to Date</label>
              <input type="date" value={duplicateShift.dupDate}
                onChange={e => setDuplicateShift({...duplicateShift, dupDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Staff Member</label>
              <select value={duplicateShift.dupStaffId} onChange={e => setDuplicateShift({...duplicateShift, dupStaffId: e.target.value})}>
                <option value="">Select staff…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '0.6rem 0.8rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
              Times and title will be copied as-is. You can edit after saving.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setDuplicateShift(null)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={saveDuplicate}
                disabled={!duplicateShift.dupDate || !duplicateShift.dupStaffId || saving}>
                {saving ? 'Saving…' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Preview Modal */}
      {recurringPreview && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRecurringPreview(null)}>
          <div className="modal-sheet" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '0.4rem' }}>Copy Recurring Shifts</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
              {recurringPreview.shifts.length} shift{recurringPreview.shifts.length !== 1 ? 's' : ''} will be created in {format(currentMonth, 'MMMM yyyy')}:
            </p>
            {recurringPreview.shifts.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.staff_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{s.title || 'Shift'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{format(new Date(s.date + 'T12:00:00'), 'EEE d MMM')}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '1.2rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setRecurringPreview(null)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={confirmCopyRecurring} disabled={recurringPreview.copying}>
                {recurringPreview.copying ? 'Copying…' : 'Confirm & Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

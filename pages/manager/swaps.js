import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format } from 'date-fns';

export default function ManagerSwaps() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [swaps, setSwaps] = useState([]);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'manager')) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) fetchSwaps();
  }, [profile, filter]);

  async function fetchSwaps() {
    const { data } = await supabase.from('swap_requests')
      .select('*, requester:requester_id(full_name), shift:shift_id(date, start_time, end_time, title), target:target_staff_id(full_name)')
      .eq('status', filter)
      .order('created_at', { ascending: false });
    setSwaps(data || []);
  }

  async function handleSwap(id, requesterId, action) {
    await supabase.from('swap_requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('notifications').insert({
      user_id: requesterId,
      title: action === 'approved' ? 'Swap approved ✓' : 'Swap declined',
      message: `Your shift swap request has been ${action} by the manager.`,
    });
    fetchSwaps();
  }

  if (loading || !profile) return <div className="spinner" />;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Swap Requests</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['pending', 'approved', 'declined'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      {swaps.length === 0 ? (
        <div className="empty-state"><p>No {filter} swap requests.</p></div>
      ) : (
        swaps.map(swap => (
          <div key={swap.id} className="card" style={{ marginBottom: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{swap.requester?.full_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {swap.shift?.date ? format(new Date(swap.shift.date), 'EEE d MMM') : '—'} · {swap.shift?.start_time?.slice(0,5)}–{swap.shift?.end_time?.slice(0,5)}
                </div>
                {swap.target && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Swap with: {swap.target.full_name}</div>}
                {swap.note && <div style={{ fontSize: '0.82rem', marginTop: '0.3rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>"{swap.note}"</div>}
              </div>
              <span className={`badge badge-${swap.status}`}>{swap.status}</span>
            </div>
            {swap.status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-success" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleSwap(swap.id, swap.requester_id, 'approved')}>Approve</button>
                <button className="btn btn-danger" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleSwap(swap.id, swap.requester_id, 'declined')}>Decline</button>
              </div>
            )}
          </div>
        ))
      )}

      <BottomNav />
    </div>
  );
}

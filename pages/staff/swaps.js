import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import { format, parseISO } from 'date-fns';

export default function StaffSwaps() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [swaps, setSwaps] = useState([]);

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) fetchSwaps();
  }, [profile]);

  async function fetchSwaps() {
    const { data } = await supabase.from('swap_requests')
      .select('*, shift:shift_id(date, start_time, end_time, title), target:target_staff_id(full_name)')
      .eq('requester_id', profile.id)
      .order('created_at', { ascending: false });
    setSwaps(data || []);
  }

  if (loading || !profile) return <div className="spinner" />;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>My Swap Requests</h1>
      </div>

      {swaps.length === 0 ? (
        <div className="empty-state">
          <p>No swap requests yet.<br />Request a swap from your shifts page.</p>
        </div>
      ) : (
        swaps.map(swap => (
          <div key={swap.id} className="card" style={{ marginBottom: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>
                  {swap.shift?.date ? format(parseISO(swap.shift.date), 'EEE d MMMM') : '—'}
                </div>
                <div className="mono" style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
                  {swap.shift?.start_time?.slice(0,5)}–{swap.shift?.end_time?.slice(0,5)}
                </div>
                {swap.target && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>With: {swap.target.full_name}</div>}
                {swap.note && <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '0.3rem', fontStyle: 'italic' }}>"{swap.note}"</div>}
              </div>
              <span className={`badge badge-${swap.status}`}>{swap.status}</span>
            </div>
          </div>
        ))
      )}

      <BottomNav />
    </div>
  );
}

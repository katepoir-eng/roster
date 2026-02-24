import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import BottomNav from '../components/BottomNav';
import { format, parseISO } from 'date-fns';

export default function Notifications() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) fetchAndMarkRead();
  }, [profile]);

  async function fetchAndMarkRead() {
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50);
    setNotifications(data || []);
    // Mark all as read
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
  }

  if (loading || !profile) return <div className="spinner" />;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Notifications</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state"><p>You're all caught up! 🎉</p></div>
      ) : (
        notifications.map(notif => (
          <div key={notif.id} className="card" style={{ marginBottom: '0.6rem', borderColor: notif.read ? 'var(--border)' : 'var(--accent)', opacity: notif.read ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{notif.title}</div>
              {!notif.read && <span className="notif-dot" style={{ marginTop: 6 }} />}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{notif.message}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
              {format(parseISO(notif.created_at), 'EEE d MMM · h:mm a')}
            </div>
          </div>
        ))
      )}

      <BottomNav />
    </div>
  );
}

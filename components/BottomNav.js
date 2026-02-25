import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const router = useRouter();
  const { profile, realProfile, staffViewMode, setStaffViewMode } = useAuth();
  const [unread, setUnread] = useState(0);
  const [unreadThreads, setUnreadThreads] = useState(0);

  useEffect(() => {
    if (!profile) return;
    supabase.from('notifications').select('id', { count: 'exact' })
      .eq('user_id', profile.id).eq('read', false)
      .then(({ count }) => setUnread(count || 0));

    const lastVisit = localStorage.getItem('noticeboard_last_visit') || '1970-01-01';
    supabase.from('threads').select('id', { count: 'exact' })
      .gt('created_at', lastVisit).neq('author_id', profile.id)
      .then(({ count: tc }) => {
        supabase.from('thread_replies').select('id', { count: 'exact' })
          .gt('created_at', lastVisit).neq('author_id', profile.id)
          .then(({ count: rc }) => setUnreadThreads((tc || 0) + (rc || 0)));
      });
  }, [profile]);

  const isActive = (path) => router.pathname === path;
  const totalBadge = unread + unreadThreads;

  // Staff view mode banner + staff nav
  if (staffViewMode && realProfile?.role === 'manager') {
    return (
      <>
        <div
          onClick={() => { setStaffViewMode(false); router.push('/manager/roster'); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
            background: 'var(--accent)', color: '#fff',
            padding: '0.6rem 1rem', textAlign: 'center',
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          👁 Staff view mode — tap to exit
        </div>
        <nav className="bottom-nav">
          <Link href="/staff/shifts" className={isActive('/staff/shifts') ? 'active' : ''}>
            <CalIcon /> My Shifts
          </Link>
          <Link href="/staff/availability" className={isActive('/staff/availability') ? 'active' : ''}>
            <CheckIcon /> Availability
          </Link>
          <Link href="/noticeboard" className={isActive('/noticeboard') ? 'active' : ''}>
            <ChatIcon /> Board {unreadThreads > 0 && <span className="notif-dot" />}
          </Link>
          <Link href="/me" className={isActive('/me') ? 'active' : ''}>
            <MeIcon /> Me {totalBadge > 0 && <span className="notif-dot" />}
          </Link>
        </nav>
      </>
    );
  }

  if (profile?.role === 'manager') {
    return (
      <nav className="bottom-nav">
        <Link href="/manager/roster" className={isActive('/manager/roster') ? 'active' : ''}>
          <CalIcon /> Roster
        </Link>
        <Link href="/manager/staff" className={isActive('/manager/staff') ? 'active' : ''}>
          <PeopleIcon /> Staff
        </Link>
        <Link href="/staff/shifts" className={isActive('/staff/shifts') ? 'active' : ''}>
          <ShiftIcon /> My Shifts
        </Link>
        <Link href="/noticeboard" className={isActive('/noticeboard') ? 'active' : ''}>
          <ChatIcon /> Board {unreadThreads > 0 && <span className="notif-dot" />}
        </Link>
        <Link href="/me" className={isActive('/me') ? 'active' : ''}>
          <MeIcon /> Me {totalBadge > 0 && <span className="notif-dot" />}
        </Link>
      </nav>
    );
  }

  return (
    <nav className="bottom-nav">
      <Link href="/staff/shifts" className={isActive('/staff/shifts') ? 'active' : ''}>
        <CalIcon /> My Shifts
      </Link>
      <Link href="/staff/availability" className={isActive('/staff/availability') ? 'active' : ''}>
        <CheckIcon /> Availability
      </Link>
      <Link href="/noticeboard" className={isActive('/noticeboard') ? 'active' : ''}>
        <ChatIcon /> Board {unreadThreads > 0 && <span className="notif-dot" />}
      </Link>
      <Link href="/me" className={isActive('/me') ? 'active' : ''}>
        <MeIcon /> Me {totalBadge > 0 && <span className="notif-dot" />}
      </Link>
    </nav>
  );
}

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ShiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const MeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

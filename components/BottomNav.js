import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const router = useRouter();
  const { profile } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    supabase.from('notifications').select('id', { count: 'exact' })
      .eq('user_id', profile.id).eq('read', false)
      .then(({ count }) => setUnread(count || 0));
  }, [profile]);

  const isActive = (path) => router.pathname === path;

  if (profile?.role === 'manager') {
    return (
      <nav className="bottom-nav">
        <Link href="/manager/roster" className={isActive('/manager/roster') ? 'active' : ''}>
          <CalIcon /> Roster
        </Link>
        <Link href="/manager/staff" className={isActive('/manager/staff') ? 'active' : ''}>
          <PeopleIcon /> Staff
        </Link>
        <Link href="/manager/swaps" className={isActive('/manager/swaps') ? 'active' : ''}>
          <SwapIcon /> Swaps
        </Link>
        <Link href="/notifications" className={isActive('/notifications') ? 'active' : ''}>
          <BellIcon /> Alerts {unread > 0 && <span className="notif-dot" />}
        </Link>
        <Link href="/profile" className={isActive('/profile') ? 'active' : ''}>
          <UserIcon /> Me
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
      <Link href="/staff/swaps" className={isActive('/staff/swaps') ? 'active' : ''}>
        <SwapIcon /> Swaps
      </Link>
      <Link href="/notifications" className={isActive('/notifications') ? 'active' : ''}>
        <BellIcon /> Alerts {unread > 0 && <span className="notif-dot" />}
      </Link>
      <Link href="/profile" className={isActive('/profile') ? 'active' : ''}>
        <UserIcon /> Me
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
const SwapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 16V4m0 0L3 8m4-4l4 4" /><path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

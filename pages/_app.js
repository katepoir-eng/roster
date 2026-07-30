import Head from 'next/head';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { countUnread, applyAppBadge, UNREAD_EVENT } from '../lib/unread';
import MarketBanner from '../components/MarketBanner';
import '../styles/globals.css';

// Puts a badge on the installed PWA home screen icon whenever there is
// something new for this user (unread alerts or unseen noticeboard posts),
// and clears it again once they have caught up.
function AppBadgeManager() {
  const { profile } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function refreshBadge() {
      if (!profile) {
        await applyAppBadge(0);
        return;
      }
      const counts = await countUnread(profile);
      if (cancelled) return;
      await applyAppBadge(counts.total);
    }

    refreshBadge();

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshBadge();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshBadge);
    window.addEventListener(UNREAD_EVENT, refreshBadge);
    const timer = setInterval(refreshBadge, 60000);

    const channels = [];
    if (profile) {
      channels.push(
        supabase
          .channel('badge-alerts-' + profile.id)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + profile.id },
            refreshBadge
          )
          .subscribe()
      );
      channels.push(
        supabase
          .channel('badge-board-' + profile.id)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, refreshBadge)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'thread_replies' }, refreshBadge)
          .subscribe()
      );
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshBadge);
      window.removeEventListener(UNREAD_EVENT, refreshBadge);
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [profile]);

  return null;
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Roster" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <title>RosterApp</title>
      </Head>
      <AppBadgeManager />
      <MarketBanner />
      <Component {...pageProps} />
    </AuthProvider>
  );
}

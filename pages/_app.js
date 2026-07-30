import Head from 'next/head';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import MarketBanner from '../components/MarketBanner';
import '../styles/globals.css';

// Sets a badge on the installed PWA home-screen icon when there are
// unread notifications, and clears it when there are none.
function AppBadgeManager() {
  const { profile } = useAuth();

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!('setAppBadge' in navigator)) return;

    let cancelled = false;

    async function refreshBadge() {
      if (!profile) {
        try { await navigator.clearAppBadge?.(); } catch (e) {}
        return;
      }
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      if (cancelled) return;
      try {
        if (count && count > 0) await navigator.setAppBadge(count);
        else await navigator.clearAppBadge?.();
      } catch (e) {}
    }

    refreshBadge();

    const onVisible = () => { if (document.visibilityState === 'visible') refreshBadge(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshBadge);

    let channel;
    if (profile) {
      channel = supabase
        .channel('badge-notifications-' + profile.id)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + profile.id },
          refreshBadge
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshBadge);
      if (channel) supabase.removeChannel(channel);
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

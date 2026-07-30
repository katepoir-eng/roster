import { supabase } from './supabase';

// Everything that should light up a notification dot for this user:
// unread alerts, plus noticeboard posts and replies they have not seen yet.
// Duncan's database holds a single market's board, so no market filter is
// needed here - the market column only exists on Cedar's copy.

const LAST_VISIT_KEY = 'noticeboard_last_visit';
const EPOCH = '1970-01-01T00:00:00.000Z';

export const UNREAD_EVENT = 'roster:unread-changed';

export function lastBoardVisit() {
  try {
    return localStorage.getItem(LAST_VISIT_KEY) || EPOCH;
  } catch (e) {
    return EPOCH;
  }
}

// Tell every mounted component (nav bar, badge manager) to recount.
export function announceUnreadChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(UNREAD_EVENT));
}

// Call when the user opens the noticeboard, so the dot clears.
export function markBoardSeen() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  } catch (e) {}
  announceUnreadChanged();
}

// Counts come back on a normal GET rather than a HEAD request - the HEAD
// variant is rejected at the edge, which silently zeroed every count.
export async function countUnread(profile) {
  const empty = { alerts: 0, board: 0, total: 0 };
  if (!profile) return empty;

  const since = lastBoardVisit();

  const results = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', profile.id)
      .eq('read', false),
    supabase
      .from('threads')
      .select('id', { count: 'exact' })
      .gt('created_at', since)
      .neq('author_id', profile.id),
    supabase
      .from('thread_replies')
      .select('id', { count: 'exact' })
      .gt('created_at', since)
      .neq('author_id', profile.id),
  ]);

  const alerts = results[0].count || 0;
  const board = (results[1].count || 0) + (results[2].count || 0);

  return { alerts: alerts, board: board, total: alerts + board };
}

/* ---- home screen icon badge ---------------------------------------- */

export function badgeSupported() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// iOS only paints the home screen badge once notifications are allowed,
// and the prompt has to come from a tap, so this is called from a button.
export async function askForNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return Notification.permission;
  }
}

export async function applyAppBadge(total) {
  if (!badgeSupported()) return;
  try {
    if (total > 0) await navigator.setAppBadge(total);
    else if (navigator.clearAppBadge) await navigator.clearAppBadge();
  } catch (e) {}
}

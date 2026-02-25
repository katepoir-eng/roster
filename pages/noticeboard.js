import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import BottomNav from '../components/BottomNav';
import { format } from 'date-fns';

export default function Noticeboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [replies, setReplies] = useState({});
  const [replyText, setReplyText] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (!profile) return;
    fetchThreads();
    // Mark noticeboard as visited
    localStorage.setItem('noticeboard_last_visit', new Date().toISOString());
  }, [profile]);

  async function fetchThreads() {
    const { data } = await supabase
      .from('threads')
      .select('*, author:profiles!threads_author_id_fkey(full_name, role)')
      .order('created_at', { ascending: false });
    setThreads(data || []);
  }

  async function fetchReplies(threadId) {
    const { data } = await supabase
      .from('thread_replies')
      .select('*, author:profiles!thread_replies_author_id_fkey(full_name, role)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    setReplies(r => ({ ...r, [threadId]: data || [] }));
  }

  function toggleExpand(threadId) {
    const isExpanding = !expanded[threadId];
    setExpanded(e => ({ ...e, [threadId]: isExpanding }));
    if (isExpanding && !replies[threadId]) fetchReplies(threadId);
  }

  async function postThread() {
    if (!newMessage.trim()) return;
    setPosting(true);
    await supabase.from('threads').insert({
      author_id: profile.id,
      message: newMessage.trim(),
    });
    setNewMessage('');
    setShowNewThread(false);
    fetchThreads();
    setPosting(false);
  }

  async function postReply(threadId) {
    const text = replyText[threadId]?.trim();
    if (!text) return;
    await supabase.from('thread_replies').insert({
      thread_id: threadId,
      author_id: profile.id,
      message: text,
    });
    setReplyText(r => ({ ...r, [threadId]: '' }));
    fetchReplies(threadId);
    // Refresh thread list to update latest activity
    fetchThreads();
  }

  async function deleteThread(id) {
    if (!confirm('Delete this thread and all replies?')) return;
    await supabase.from('threads').delete().eq('id', id);
    fetchThreads();
  }

  async function deleteReply(replyId, threadId) {
    if (!confirm('Delete this reply?')) return;
    await supabase.from('thread_replies').delete().eq('id', replyId);
    fetchReplies(threadId);
  }

  if (loading || !profile) return <div className="spinner" />;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Noticeboard</h1>
        <button className="btn btn-primary" onClick={() => setShowNewThread(true)}>+ Post</button>
      </div>

      {threads.length === 0 && (
        <div className="empty-state">
          <p>No posts yet.<br />Tap + Post to start a thread.</p>
        </div>
      )}

      {threads.map(thread => {
        const isOpen = expanded[thread.id];
        const threadReplies = replies[thread.id] || [];
        const isAuthor = thread.author_id === profile.id;
        const isManager = profile.role === 'manager';

        return (
          <div key={thread.id} className="card" style={{ marginBottom: '0.8rem', padding: 0, overflow: 'hidden' }}>
            {/* Thread header — always visible */}
            <div
              onClick={() => toggleExpand(thread.id)}
              style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{thread.author?.full_name}</span>
                  {thread.author?.role === 'manager' && (
                    <span style={{ fontSize: '0.7rem', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '0.3rem', padding: '0.1rem 0.4rem', fontWeight: 700 }}>MGR</span>
                  )}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{format(new Date(thread.created_at), 'd MMM yyyy')}</span>
                </div>
                <p style={{
                  fontSize: '0.88rem', color: 'var(--text)',
                  overflow: isOpen ? 'visible' : 'hidden',
                  display: isOpen ? 'block' : '-webkit-box',
                  WebkitLineClamp: isOpen ? 'unset' : 2,
                  WebkitBoxOrient: 'vertical',
                  margin: 0,
                }}>
                  {thread.message}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                  {isOpen ? '▲ Hide' : '▼ Expand'}
                </span>
              </div>
            </div>

            {/* Expanded: replies + reply box */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {threadReplies.length > 0 && (
                  <div style={{ padding: '0.5rem 1rem' }}>
                    {threadReplies.map(reply => (
                      <div key={reply.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{reply.author?.full_name}</span>
                            {reply.author?.role === 'manager' && (
                              <span style={{ fontSize: '0.65rem', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '0.3rem', padding: '0.1rem 0.3rem', fontWeight: 700 }}>MGR</span>
                            )}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{format(new Date(reply.created_at), 'd MMM, h:mm a')}</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', margin: 0 }}>{reply.message}</p>
                        </div>
                        {(reply.author_id === profile.id || isManager) && (
                          <button onClick={() => deleteReply(reply.id, thread.id)} style={{ background: 'none', color: 'var(--danger)', fontSize: '1rem', padding: '0 0.3rem', flexShrink: 0 }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Write a reply…"
                    value={replyText[thread.id] || ''}
                    onChange={e => setReplyText(r => ({ ...r, [thread.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && postReply(thread.id)}
                    style={{ flex: 1, fontSize: '0.88rem' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => postReply(thread.id)}
                    disabled={!replyText[thread.id]?.trim()}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    Reply
                  </button>
                </div>

                {/* Delete thread — author or manager */}
                {(isAuthor || isManager) && (
                  <div style={{ padding: '0 1rem 0.75rem', textAlign: 'right' }}>
                    <button onClick={() => deleteThread(thread.id)} style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none' }}>
                      Delete thread
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* New Thread Modal */}
      {showNewThread && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewThread(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>New Post</h2>
            <div className="form-group">
              <label>Message</label>
              <textarea
                rows={4}
                placeholder="Write your message to the team…"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                style={{ resize: 'none' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setShowNewThread(false)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={postThread} disabled={!newMessage.trim() || posting}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { markBoardSeen } from '../lib/unread';
import BottomNav from '../components/BottomNav';
import { format } from 'date-fns';

const INTEREST_OPTIONS = [
  { value: 'happy', emoji: '😊🔄', label: 'Happy' },
  { value: 'good', emoji: '👍', label: 'Good' },
  { value: 'change_please', emoji: '😕🔄', label: 'Change please' },
];

export default function Noticeboard() {
  const { profile, realProfile, loading } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState([]);
  const [teamStatus, setTeamStatus] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [replies, setReplies] = useState({});
  const [replyText, setReplyText] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [posting, setPosting] = useState(false);
  const [allProfiles, setAllProfiles] = useState([]);
  // @ mention state
  const [mentionQuery, setMentionQuery] = useState(''); // current @word being typed
  const [mentionTarget, setMentionTarget] = useState(null); // 'new' | thread_id
  const [mentionField, setMentionField] = useState(''); // which textarea
  const newMsgRef = useRef(null);
  const replyRefs = useRef({});

  useEffect(() => {
    if (!loading && !profile) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (!profile) return;
    fetchThreads();
    fetchTeamStatus();
    fetchAllProfiles();
    markBoardSeen();
  }, [profile]);

  async function fetchThreads() {
    const { data } = await supabase
      .from('threads')
      .select('*, author:profiles!threads_author_id_fkey(full_name, role)')
      .order('created_at', { ascending: false });
    setThreads(data || []);
  }

  async function fetchTeamStatus() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, interest_level')
      .eq('role', 'staff')
      .order('full_name');
    setTeamStatus(data || []);
  }

  async function fetchAllProfiles() {
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
    setAllProfiles(data || []);
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

  // Handle @ mention detection in any textarea
  function handleTextChange(val, field, threadId = null) {
    if (field === 'new') setNewMessage(val);
    else setReplyText(r => ({ ...r, [threadId]: val }));

    // Detect @mention
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1) {
      const afterAt = val.slice(atIndex + 1);
      if (!afterAt.includes(' ') || afterAt === '') {
        setMentionQuery(afterAt.toLowerCase());
        setMentionTarget(threadId || 'new');
        setMentionField(field);
        return;
      }
    }
    setMentionQuery('');
    setMentionTarget(null);
  }

  function getMentionSuggestions() {
    const allOption = { id: 'all', full_name: 'all' };
    const filtered = [allOption, ...allProfiles].filter(p =>
      p.id !== profile.id &&
      p.full_name.toLowerCase().includes(mentionQuery)
    );
    return filtered.slice(0, 5);
  }

  function insertMention(selectedProfile, threadId) {
    const mention = `@${selectedProfile.full_name} `;
    if (mentionField === 'new') {
      const atIndex = newMessage.lastIndexOf('@');
      const newVal = newMessage.slice(0, atIndex) + mention;
      setNewMessage(newVal);
    } else {
      const current = replyText[threadId] || '';
      const atIndex = current.lastIndexOf('@');
      const newVal = current.slice(0, atIndex) + mention;
      setReplyText(r => ({ ...r, [threadId]: newVal }));
    }
    setMentionQuery('');
    setMentionTarget(null);
  }

  async function postThread() {
    if (!newMessage.trim()) return;
    setPosting(true);
    await supabase.from('threads').insert({
      author_id: realProfile?.id || profile.id,
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
      author_id: realProfile?.id || profile.id,
      message: text,
    });
    setReplyText(r => ({ ...r, [threadId]: '' }));
    fetchReplies(threadId);
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

  const isReallyManager = ['manager','admin'].includes(realProfile?.role);

  // Render message text with highlighted @mentions
  function renderMessage(text) {
    const parts = text.split(/(@\w[\w\s]*)/g);
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} style={{ color: 'var(--accent)', fontWeight: 700 }}>{part}</span>
        : part
    );
  }

  if (loading || !profile) return <div className="spinner" />;

  const suggestions = mentionQuery !== null && mentionTarget !== null ? getMentionSuggestions() : [];

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Noticeboard</h1>
        <button className="btn btn-primary" onClick={() => setShowNewThread(true)}>+ Post</button>
      </div>

      {/* Team Status */}
      {teamStatus.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
            Team Status
          </div>
          {teamStatus.map(member => {
            const opt = INTEREST_OPTIONS.find(o => o.value === member.interest_level);
            return (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{member.full_name}</span>
                {opt ? (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{opt.emoji} {opt.label}</span>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>Not set</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Threads */}
      {threads.length === 0 && (
        <div className="empty-state">
          <p>No posts yet.<br />Tap + Post to start a thread.</p>
        </div>
      )}

      {threads.map(thread => {
        const isOpen = expanded[thread.id];
        const threadReplies = replies[thread.id] || [];
        const isAuthor = thread.author_id === (realProfile?.id || profile.id);
        const canDelete = isAuthor || isReallyManager;
        const showMentions = mentionTarget === thread.id && suggestions.length > 0;

        return (
          <div key={thread.id} className="card" style={{ marginBottom: '0.8rem', padding: 0, overflow: 'visible' }}>
            {/* Thread header */}
            <div
              onClick={() => toggleExpand(thread.id)}
              style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{thread.author?.full_name}</span>
                  {['manager','admin'].includes(thread.author?.role) && (
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
                  {renderMessage(thread.message)}
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                {isOpen ? '▲ Hide' : '▼ Expand'}
              </span>
            </div>

            {/* Expanded */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {threadReplies.length > 0 && (
                  <div style={{ padding: '0.5rem 1rem' }}>
                    {threadReplies.map(reply => {
                      const isReplyAuthor = reply.author_id === (realProfile?.id || profile.id);
                      const canDeleteReply = isReplyAuthor || isReallyManager;
                      return (
                        <div key={reply.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{reply.author?.full_name}</span>
                              {['manager','admin'].includes(reply.author?.role) && (
                                <span style={{ fontSize: '0.65rem', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '0.3rem', padding: '0.1rem 0.3rem', fontWeight: 700 }}>MGR</span>
                              )}
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{format(new Date(reply.created_at), 'd MMM, h:mm a')}</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', margin: 0 }}>{renderMessage(reply.message)}</p>
                          </div>
                          {canDeleteReply && (
                            <button onClick={() => deleteReply(reply.id, thread.id)} style={{ background: 'none', color: 'var(--danger)', fontSize: '1rem', padding: '0 0.3rem', flexShrink: 0 }}>×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply input with @ mention */}
                <div style={{ padding: '0.75rem 1rem', position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Reply… (type @ to mention)"
                      value={replyText[thread.id] || ''}
                      onChange={e => handleTextChange(e.target.value, thread.id, thread.id)}
                      onKeyDown={e => e.key === 'Enter' && !showMentions && postReply(thread.id)}
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
                  {/* @ mention dropdown */}
                  {showMentions && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '1rem', right: '1rem', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '0.5rem', zIndex: 100, overflow: 'hidden' }}>
                      {suggestions.map(s => (
                        <div
                          key={s.id}
                          onClick={() => insertMention(s, thread.id)}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}
                        >
                          {s.id === 'all' ? '👥 @all — mention everyone' : `@${s.full_name}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {canDelete && (
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
          <div className="modal-sheet" style={{ position: 'relative' }}>
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>New Post</h2>
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Message (type @ to mention someone)</label>
              <textarea
                ref={newMsgRef}
                rows={4}
                placeholder="Write your message… @name to mention"
                value={newMessage}
                onChange={e => handleTextChange(e.target.value, 'new')}
                style={{ resize: 'none' }}
                autoFocus
              />
              {/* @ mention dropdown for new thread */}
              {mentionTarget === 'new' && suggestions.length > 0 && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '0.5rem', zIndex: 100, overflow: 'hidden' }}>
                  {suggestions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => insertMention(s, null)}
                      style={{ padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}
                    >
                      {s.id === 'all' ? '👥 @all — mention everyone' : `@${s.full_name}`}
                    </div>
                  ))}
                </div>
              )}
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

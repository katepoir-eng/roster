import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';

const INTEREST_OPTIONS = [
  { value: 'happy', emoji: '😊🔄', label: 'Happy', desc: 'Prefer more shifts' },
  { value: 'good', emoji: '👍', label: 'Good', desc: 'Flexible' },
  { value: 'change_please', emoji: '😕🔄', label: 'Change please', desc: 'Prefer fewer shifts' },
];

export default function ManagerStaff() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'manager')) router.replace('/');
  }, [profile, loading]);

  useEffect(() => {
    if (profile) fetchStaff();
  }, [profile]);

  async function fetchStaff() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'staff').order('full_name');
    setStaff(data || []);
  }

  async function createStaff() {
    setSaving(true);
    setError('');
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: 'staff' } }
    });
    setSaving(false);
    if (error) {
      setError('Could not create account. Use Supabase dashboard > Authentication > Users to add staff manually.');
    } else {
      setSuccess(`Account created for ${form.full_name}. They can now log in.`);
      setForm({ full_name: '', email: '', password: '' });
      setShowModal(false);
      fetchStaff();
    }
  }

  if (loading || !profile) return <div className="spinner" />;

  return (
    <div className="container page-content">
      <div className="page-header">
        <h1>Staff</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      {success && (
        <div style={{ background: '#0a2a14', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1rem', color: 'var(--success)', fontSize: '0.9rem' }}>
          {success}
        </div>
      )}

      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
        💡 <strong>Tip:</strong> You can also add staff directly in Supabase → Authentication → Users.
      </div>

      {staff.length === 0 ? (
        <div className="empty-state">
          <p>No staff added yet.<br />Add your first team member above.</p>
        </div>
      ) : (
        staff.map(member => {
          const opt = INTEREST_OPTIONS.find(o => o.value === member.interest_level);
          return (
            <div key={member.id} className="card" style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--accent-dim)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1rem', flexShrink: 0
                }}>
                  {member.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{member.full_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Staff member</div>
                </div>
                {opt ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem' }}>{opt.emoji}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{opt.label}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>No pref</div>
                )}
              </div>
            </div>
          );
        })
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Add Staff Member</h2>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jane@example.com" />
            </div>
            <div className="form-group">
              <label>Temporary Password</label>
              <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{error}</p>}
            <button className="btn btn-primary btn-full" onClick={createStaff} disabled={!form.full_name || !form.email || !form.password || saving}>
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

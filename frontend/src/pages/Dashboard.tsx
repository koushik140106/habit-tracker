import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { HabitSummary } from '../types';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [habits, setHabits] = useState<HabitSummary[]>([]);
  const [today, setToday] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newHabitName, setNewHabitName] = useState('');
  const [creating, setCreating] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  async function loadHabits() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/habits');
      setHabits(res.data.habits);
      setToday(res.data.today);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHabits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateHabit(e: FormEvent) {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.post('/habits', { name: newHabitName.trim() });
      setNewHabitName('');
      await loadHabits();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleQuickCheckIn(habitId: string) {
    setCheckingInId(habitId);
    setError(null);
    try {
      await api.post(`/habits/${habitId}/checkins`, {});
      await loadHabits();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCheckingInId(null);
    }
  }

  return (
    <div>
      <div className="top-bar">
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Habits</h1>
          {user && (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {user.email} · {user.timezone} · today: {today}
            </p>
          )}
        </div>
        <button className="btn-secondary" onClick={logout}>
          Log out
        </button>
      </div>

      <form onSubmit={handleCreateHabit} className="card row" style={{ marginBottom: 20 }}>
        <input
          placeholder="New habit, e.g. Read 20 pages"
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
        />
        <button className="btn" type="submit" disabled={creating}>
          {creating ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : habits.length === 0 ? (
        <p className="muted">No habits yet — add your first one above.</p>
      ) : (
        <div className="habit-list">
          {habits.map((h) => (
            <div key={h.id} className="card">
              <div className="row-between">
                <div>
                  <Link to={`/habits/${h.id}`} style={{ fontWeight: 700, fontSize: 16 }}>
                    {h.name}
                  </Link>
                  <div className="row" style={{ marginTop: 6 }}>
                    <span className="badge badge-current">🔥 {h.currentStreak} current</span>
                    <span className="badge badge-longest">🏆 {h.longestStreak} longest</span>
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() => handleQuickCheckIn(h.id)}
                  disabled={checkingInId === h.id}
                >
                  {checkingInId === h.id ? '…' : "Check in today"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

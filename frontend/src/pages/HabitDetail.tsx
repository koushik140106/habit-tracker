import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { HabitDetail as HabitDetailType } from '../types';

export default function HabitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<HabitDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backfillDate, setBackfillDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/habits/${id}`);
      setData(res.data);
      if (!backfillDate) setBackfillDate(res.data.today);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCheckIn(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/habits/${id}/checkins`, { date: backfillDate });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCheckIn(checkInId: string) {
    setError(null);
    try {
      await api.delete(`/habits/${id}/checkins/${checkInId}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleDeleteHabit() {
    if (!confirm('Delete this habit and all its check-ins?')) return;
    setDeleting(true);
    try {
      await api.delete(`/habits/${id}`);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
      setDeleting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!data) return <p className="error-text">{error ?? 'Habit not found.'}</p>;

  return (
    <div>
      <Link to="/" className="muted">
        ← Back
      </Link>

      <div className="top-bar" style={{ marginTop: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{data.habit.name}</h1>
          {data.habit.description && <p className="muted">{data.habit.description}</p>}
        </div>
        <button className="btn-danger btn" onClick={handleDeleteHabit} disabled={deleting}>
          Delete
        </button>
      </div>

      <div className="row" style={{ marginBottom: 20 }}>
        <span className="badge badge-current">🔥 {data.currentStreak} current streak</span>
        <span className="badge badge-longest">🏆 {data.longestStreak} longest streak</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Log a check-in</h2>
        <p className="muted" style={{ marginTop: -8 }}>
          Today is {data.today} in your timezone. You can backfill any past date, but not the future.
        </p>
        <form onSubmit={handleCheckIn} className="row">
          <input
            type="date"
            max={data.today}
            value={backfillDate}
            onChange={(e) => setBackfillDate(e.target.value)}
            required
          />
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Log check-in'}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>
          Check-in history ({data.checkIns.length})
        </h2>
        {data.checkIns.length === 0 ? (
          <p className="muted">No check-ins yet.</p>
        ) : (
          <div className="checkin-dot-list">
            {[...data.checkIns]
              .sort((a, b) => (a.localDate < b.localDate ? 1 : -1))
              .map((c) => (
                <button
                  key={c.id}
                  className="checkin-dot"
                  title="Click to delete"
                  onClick={() => handleDeleteCheckIn(c.id)}
                >
                  {c.localDate} ✕
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

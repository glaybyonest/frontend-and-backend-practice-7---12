import { useState } from "react";
import { api } from "../api";

export default function Me({ user, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRefresh() {
    setError("");
    setLoading(true);
    try {
      const me = await api.me();
      if (onRefresh) {
        onRefresh(me);
      }
    } catch (err) {
      setError(err.message || "Failed to load user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Current user</h2>
        {error && <div className="error">{error}</div>}
        {user ? (
          <div>
            <p>
              <strong>ID:</strong> {user.id}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>First name:</strong> {user.first_name}
            </p>
            <p>
              <strong>Last name:</strong> {user.last_name}
            </p>
          </div>
        ) : (
          <p className="muted">No user data loaded.</p>
        )}
        <button type="button" onClick={handleRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh /api/auth/me"}
        </button>
      </div>
    </div>
  );
}

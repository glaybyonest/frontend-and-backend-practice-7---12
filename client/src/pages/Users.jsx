import { useEffect, useState } from "react";
import { api } from "../api";

const ROLES = ["user", "seller", "admin"];

const EMPTY_FORM = {
  email: "",
  first_name: "",
  last_name: "",
  role: "user",
  isBlocked: false
};

function toFormState(user) {
  if (!user) {
    return EMPTY_FORM;
  }

  return {
    email: user.email || "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    role: user.role || "user",
    isBlocked: Boolean(user.isBlocked)
  };
}

export default function Users({ user, onUserChange }) {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    api
      .listUsers()
      .then((data) => {
        if (mounted) {
          setUsers(data || []);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load users");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  function handleChange(event) {
    const { name, type, value, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleSelectUser(id) {
    setError("");
    setMessage("");

    try {
      const currentUser = await api.getUser(id);
      setSelectedId(id);
      setForm(toFormState(currentUser));
    } catch (err) {
      setError(err.message || "Failed to load user");
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!selectedId) {
      setError("Select a user first");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = await api.updateUser(selectedId, {
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role,
        isBlocked: form.isBlocked
      });

      setUsers((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setForm(toFormState(updated));
      setMessage("User updated");

      if (user && updated.id === user.id && onUserChange) {
        onUserChange(updated);
      }
    } catch (err) {
      setError(err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlock(id) {
    setError("");
    setMessage("");

    try {
      const updated = await api.blockUser(id);
      setUsers((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );

      if (selectedId === updated.id) {
        setForm((prev) => ({
          ...prev,
          isBlocked: true
        }));
      }

      setMessage("User blocked");

      if (user && updated.id === user.id && onUserChange) {
        onUserChange(updated);
      }
    } catch (err) {
      setError(err.message || "Failed to block user");
    }
  }

  return (
    <div className="container">
      <div className="grid">
        <div className="card">
          <h2>Users</h2>
          <p className="muted">
            Admins can view, edit roles and block accounts.
          </p>
          {loading && <p>Loading...</p>}
          {error && <div className="error">{error}</div>}
          {message && <p className="success">{message}</p>}
          <div className="list">
            {users.map((item) => (
              <div
                className={`card ${selectedId === item.id ? "card--selected" : ""}`}
                key={item.id}
              >
                <h3>{item.email}</h3>
                <p className="muted">
                  {item.first_name} {item.last_name}
                </p>
                <p>
                  <strong>Role:</strong> {item.role}
                </p>
                <p>
                  <strong>Status:</strong> {item.isBlocked ? "Blocked" : "Active"}
                </p>
                <div className="inline">
                  <button type="button" onClick={() => handleSelectUser(item.id)}>
                    Edit
                  </button>
                  {!item.isBlocked && (
                    <button
                      className="danger"
                      type="button"
                      onClick={() => handleBlock(item.id)}
                    >
                      Block
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!loading && users.length === 0 && (
              <p className="muted">No users found.</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Edit user</h2>
          {selectedId ? (
            <form onSubmit={handleSave}>
              <div>
                <label htmlFor="user-email">Email</label>
                <input
                  id="user-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="user-first-name">First name</label>
                <input
                  id="user-first-name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="user-last-name">Last name</label>
                <input
                  id="user-last-name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="user-role">Role</label>
                <select
                  id="user-role"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <label className="checkbox">
                <input
                  name="isBlocked"
                  type="checkbox"
                  checked={form.isBlocked}
                  onChange={handleChange}
                />
                Blocked
              </label>
              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save user"}
              </button>
            </form>
          ) : (
            <p className="muted">Choose a user from the list to edit.</p>
          )}
        </div>
      </div>
    </div>
  );
}

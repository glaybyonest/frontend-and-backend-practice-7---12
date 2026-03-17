import { NavLink } from "react-router-dom";

export default function Nav({ user, onLogout }) {
  const isAdmin = user && user.role === "admin";

  return (
    <nav className="nav">
      <div className="nav__brand">Practices 7-12</div>
      <div className="nav__links">
        {user && (
          <NavLink className="nav__link" to="/products">
            Products
          </NavLink>
        )}
        {user && (
          <NavLink className="nav__link" to="/me">
            Me
          </NavLink>
        )}
        {isAdmin && (
          <NavLink className="nav__link" to="/users">
            Users
          </NavLink>
        )}
      </div>
      <div className="nav__actions">
        {user ? (
          <>
            <span className="muted">
              {user.email} ({user.role})
            </span>
            <button className="secondary" onClick={onLogout} type="button">
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink className="nav__link" to="/login">
              Login
            </NavLink>
            <NavLink className="nav__link" to="/register">
              Register
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}

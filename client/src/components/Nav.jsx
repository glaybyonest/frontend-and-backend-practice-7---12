import { NavLink } from "react-router-dom";

export default function Nav({ user, onLogout }) {
  return (
    <nav className="nav">
      <div className="nav__brand">Practices 7-10</div>
      <div className="nav__links">
        <NavLink className="nav__link" to="/products">
          Products
        </NavLink>
        {user && (
          <NavLink className="nav__link" to="/me">
            Me
          </NavLink>
        )}
      </div>
      <div className="nav__actions">
        {user ? (
          <>
            <span className="muted">{user.email}</span>
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

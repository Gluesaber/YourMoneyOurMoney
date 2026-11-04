import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <nav className="navbar navbar-expand bg-body-tertiary border-bottom">
        <div className="container">
          <Link className="navbar-brand fw-semibold" to="/">
            YourMoneyOurMoney
          </Link>
          {user && (
            <div className="d-flex align-items-center gap-3">
              <span className="text-body-secondary small">{user.username}</span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </nav>
      <main className="container py-4">
        <Outlet />
      </main>
    </>
  );
}

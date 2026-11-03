import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function Layout() {
  const { user, logout } = useAuth();

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
                onClick={() => void logout()}
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

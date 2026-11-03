import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { homePathFor, useAuth, type Role } from "./AuthContext.js";

// Integration point 10. Frontend convenience only; the server enforces every permission itself.
// Logged out → /login. Wrong role → that role's own home page.
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5" role="status" aria-label="Loading">
        <div className="spinner-border" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.role !== role) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <>{children}</>;
}

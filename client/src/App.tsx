import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, homePathFor, useAuth } from "./auth/AuthContext.js";
import { RequireRole } from "./auth/RequireRole.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { AdminUsersPage } from "./pages/AdminUsersPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

// Shared file: route table only. Each track adds its pages here.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StartRedirect />} />
        <Route path="login" element={<LoginPage />} />

        {/* Track B (USER) */}
        <Route
          path="dashboard"
          element={
            <RequireRole role="USER">
              <DashboardPage />
            </RequireRole>
          }
        />

        {/* Track A (ADMIN) */}
        <Route
          path="admin/users"
          element={
            <RequireRole role="ADMIN">
              <AdminUsersPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

// "/" sends each visitor to the right place: login, or their role's home page.
function StartRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}

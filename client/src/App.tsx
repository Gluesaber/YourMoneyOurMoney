import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, homePathFor, useAuth } from "./auth/AuthContext.js";
import { RequireRole } from "./auth/RequireRole.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { OpeningBalancePage } from "./pages/OpeningBalancePage.js";
import { TransactionFormPage } from "./pages/TransactionFormPage.js";
import { TransactionsPage } from "./pages/TransactionsPage.js";
import { TransactionDetailPage } from "./pages/TransactionDetailPage.js";
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
        <Route path="dashboard" element={<UserOnly page={<DashboardPage />} />} />
        <Route path="accounts/:id/opening-balance" element={<UserOnly page={<OpeningBalancePage />} />} />
        <Route path="transactions" element={<UserOnly page={<TransactionsPage />} />} />
        <Route path="transactions/new" element={<UserOnly page={<TransactionFormPage />} />} />
        <Route path="transactions/:id" element={<UserOnly page={<TransactionDetailPage />} />} />

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

function UserOnly({ page }: { page: ReactNode }) {
  return <RequireRole role="USER">{page}</RequireRole>;
}

// "/" sends each visitor to the right place: login, or their role's home page.
function StartRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}

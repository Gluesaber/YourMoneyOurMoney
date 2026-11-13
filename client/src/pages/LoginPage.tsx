import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ApiError } from "../api/client.js";
import { homePathFor, useAuth } from "../auth/AuthContext.js";
import { ErrorAlert, Loading } from "../components/Feedback.js";

interface ValidationDetails {
  fieldErrors?: {
    username?: string[];
    password?: string[];
  };
}

// F-01 §5 Login page — docs/sprints/sprint-1/F-01-auth.md.
export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (loading) return <Loading />;
  if (user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const fieldErrors =
    error instanceof ApiError && error.code === "VALIDATION_ERROR"
      ? (error.details as ValidationDetails | undefined)?.fieldErrors
      : undefined;
  const usernameInvalid = Boolean(fieldErrors?.username?.length);
  const passwordInvalid = Boolean(fieldErrors?.password?.length);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto" style={{ maxWidth: 400 }}>
      <h1 className="h3 mb-2">Log in</h1>
      <p className="text-muted mb-3">Sign in to YourMoneyOurMoney to manage your balances.</p>
      <ErrorAlert error={error} />
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="mb-3">
          <label htmlFor="login-username" className="form-label">
            Username
          </label>
          <input
            id="login-username"
            type="text"
            className={`form-control ${usernameInvalid ? "is-invalid" : ""}`}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={usernameInvalid}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="login-password" className="form-label">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            className={`form-control ${passwordInvalid ? "is-invalid" : ""}`}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordInvalid}
          />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
          Log in
        </button>
      </form>
    </section>
  );
}

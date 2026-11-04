import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../src/App.js";
import { AuthProvider } from "../src/auth/AuthContext.js";
import { mockApi, type ApiRoutes } from "./renderApp.js";

// F-01 §5 & §7 (T-AUTH-UI-01) — Login form, navbar logout, and 401 session clearing.
afterEach(() => vi.unstubAllGlobals());

const EMPTY_SUMMARY = {
  cash: [],
  loansTaken: [],
  loansGiven: [],
  totals: { income: 0, expense: 0 },
  income: [],
  expense: [],
};

const UNAUTH_REPLY = {
  status: 401,
  body: { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
};

function renderWithAuthProvider(initialPath: string, routes: ApiRoutes) {
  const calls = mockApi(routes);
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
  return calls;
}

describe("T-AUTH-UI-01: LoginPage, AuthProvider logout, and 401 session clearing", () => {
  it("submits valid USER credentials, lands on /dashboard, and shows username in navbar (AC-AUTH-01)", async () => {
    const calls = renderWithAuthProvider("/login", {
      "GET /api/auth/me": UNAUTH_REPLY,
      "POST /api/auth/login": {
        body: { id: 1, username: "alice", role: "USER" },
      },
      "GET /api/summary": { body: EMPTY_SUMMARY },
    });
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "demo-password-123");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/auth/login")?.body).toEqual({
      username: "alice",
      password: "demo-password-123",
    });
    await screen.findByText("Money you owe");
  });

  it("submits valid ADMIN credentials and lands on /admin/users (AC-AUTH-01)", async () => {
    renderWithAuthProvider("/login", {
      "GET /api/auth/me": UNAUTH_REPLY,
      "POST /api/auth/login": {
        body: { id: 3, username: "admin", role: "ADMIN" },
      },
      "GET /api/admin/users": {
        body: {
          users: [{ id: 3, username: "admin", role: "ADMIN", isEnabled: true }],
        },
      },
    });
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "demo-password-123");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    await screen.findByRole("table");
  });

  it("shows server error alert and preserves typed username on 401 INVALID_CREDENTIALS and 403 ACCOUNT_DISABLED (AC-AUTH-02, AC-AUTH-03)", async () => {
    let attempt = 0;
    renderWithAuthProvider("/login", {
      "GET /api/auth/me": UNAUTH_REPLY,
      "POST /api/auth/login": () => {
        attempt += 1;
        if (attempt === 1) {
          return {
            status: 401,
            body: {
              error: {
                code: "INVALID_CREDENTIALS",
                message: "Invalid username or password.",
              },
            },
          };
        }
        return {
          status: 403,
          body: {
            error: {
              code: "ACCOUNT_DISABLED",
              message: "This account has been disabled.",
            },
          },
        };
      },
    });
    const user = userEvent.setup();

    const usernameInput = await screen.findByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    await user.type(usernameInput, "alice");
    await user.type(passwordInput, "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(usernameInput).toHaveValue("alice");

    // Second attempt: disabled account (403 ACCOUNT_DISABLED)
    await user.clear(passwordInput);
    await user.type(passwordInput, "demo-password-123");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This account has been disabled.");
    expect(usernameInput).toHaveValue("alice");
  });

  it("marks fields invalid when 400 VALIDATION_ERROR returns fieldErrors (AC-AUTH-02)", async () => {
    renderWithAuthProvider("/login", {
      "GET /api/auth/me": UNAUTH_REPLY,
      "POST /api/auth/login": {
        status: 400,
        body: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Username and password are required.",
            details: {
              formErrors: [],
              fieldErrors: {
                username: ["String must contain at least 1 character(s)"],
                password: ["String must contain at least 1 character(s)"],
              },
            },
          },
        },
      },
    });
    const user = userEvent.setup();

    const usernameInput = await screen.findByLabelText("Username");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username and password are required.");
    expect(usernameInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("disables the submit button while POST /api/auth/login is in flight", async () => {
    let resolveLogin!: (res: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string, init: RequestInit = {}) => {
        const method = (init.method ?? "GET").toUpperCase();
        if (method === "GET" && path === "/api/auth/me") {
          return Promise.resolve(
            new Response(JSON.stringify(UNAUTH_REPLY.body), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (method === "POST" && path === "/api/auth/login") {
          return new Promise<Response>((resolve) => {
            resolveLogin = resolve;
          });
        }
        if (method === "GET" && path === "/api/summary") {
          return Promise.resolve(
            new Response(JSON.stringify(EMPTY_SUMMARY), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected ${method} ${path}`));
      }),
    );

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    );

    await screen.findByRole("heading", { level: 1, name: "Log in" });
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "demo-password-123");

    const submitBtn = screen.getByRole("button", { name: "Log in" });
    await user.click(submitBtn);

    expect(submitBtn).toBeDisabled();

    resolveLogin(
      new Response(JSON.stringify({ id: 1, username: "alice", role: "USER" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    await screen.findByText("Money you owe");
  });

  it("redirects an already-authenticated user away from /login to their home page", async () => {
    renderWithAuthProvider("/login", {
      "GET /api/auth/me": {
        body: { id: 1, username: "alice", role: "USER" },
      },
      "GET /api/summary": { body: EMPTY_SUMMARY },
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    await screen.findByText("Money you owe");
  });

  it("clears user and redirects to /login on normal logout (204) and even when POST /api/auth/logout fails with 401 (AC-AUTH-04)", async () => {
    // Case 1: 204 No Content
    const calls204 = renderWithAuthProvider("/dashboard", {
      "GET /api/auth/me": {
        body: { id: 1, username: "alice", role: "USER" },
      },
      "GET /api/summary": { body: EMPTY_SUMMARY },
      "POST /api/auth/logout": { status: 204 },
    });
    const user = userEvent.setup();

    await screen.findByText("Money you owe");
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    expect(calls204.some((c) => c.method === "POST" && c.path === "/api/auth/logout")).toBe(true);
  });

  it("still clears user and redirects to /login when POST /api/auth/logout returns 401 UNAUTHENTICATED (AC-AUTH-04)", async () => {
    renderWithAuthProvider("/dashboard", {
      "GET /api/auth/me": {
        body: { id: 1, username: "alice", role: "USER" },
      },
      "GET /api/summary": { body: EMPTY_SUMMARY },
      "POST /api/auth/logout": UNAUTH_REPLY,
    });
    const user = userEvent.setup();

    await screen.findByText("Money you owe");
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("clears user and redirects to /login when any protected API call returns 401 UNAUTHENTICATED (AC-AUTH-06)", async () => {
    // Initial GET /api/auth/me succeeds, but subsequent GET /api/summary returns 401 (e.g. session expired or account disabled mid-session)
    renderWithAuthProvider("/dashboard", {
      "GET /api/auth/me": {
        body: { id: 1, username: "alice", role: "USER" },
      },
      "GET /api/summary": UNAUTH_REPLY,
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });
});

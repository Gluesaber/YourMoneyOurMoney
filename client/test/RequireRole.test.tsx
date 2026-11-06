import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext, type AuthState, type CurrentUser } from "../src/auth/AuthContext.js";
import { AppRoutes } from "../src/App.js";
import { mockApi } from "./renderApp.js";

// The real DashboardPage loads GET /api/summary (S1-14) and AdminUsersPage loads GET /api/admin/users (S1-08);
// give them empty answers so guard tests stay offline.
beforeEach(() => {
  mockApi({
    "GET /api/summary": {
      body: {
        cash: [],
        loansTaken: [],
        loansGiven: [],
        totals: { income: 0, expense: 0 },
        income: [],
        expense: [],
      },
    },
    "GET /api/admin/users": {
      body: { users: [] },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string, user: CurrentUser | null, loading = false) {
  const auth: AuthState = { user, loading, login: vi.fn(), logout: vi.fn() };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const alice: CurrentUser = { id: 1, username: "alice", role: "USER" };
const admin: CurrentUser = { id: 3, username: "admin", role: "ADMIN" };

describe("route guards (RequireRole)", () => {
  it("sends a logged-out visitor to the login page", () => {
    renderAt("/dashboard", null);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows a USER page to a USER", async () => {
    renderAt("/dashboard", alice);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    await screen.findByText("Money you owe"); // let the dashboard finish loading
  });

  it("sends an ADMIN away from a USER page to the admin home", async () => {
    renderAt("/dashboard", admin);
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    await screen.findByRole("table"); // let AdminUsersPage finish loading
  });

  it("sends a USER away from an ADMIN page to the dashboard", async () => {
    renderAt("/admin/users", alice);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    await screen.findByText("Money you owe"); // let the dashboard finish loading
  });

  it("shows a spinner, not a redirect, while the session is still loading", () => {
    renderAt("/dashboard", null, true);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("sends '/' to the role's home page", async () => {
    renderAt("/", admin);
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    await screen.findByRole("table"); // let AdminUsersPage finish loading
  });
});

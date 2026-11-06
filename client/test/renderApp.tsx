import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext, type AuthState, type CurrentUser } from "../src/auth/AuthContext.js";
import { AppRoutes } from "../src/App.js";

export const alice: CurrentUser = { id: 1, username: "alice", role: "USER" };

type Reply = { status?: number; body?: unknown };
// Keys are "METHOD /path" (query string included when present), e.g. "GET /api/summary".
export type ApiRoutes = Record<string, Reply | ((body: unknown) => Reply)>;

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

// Replaces fetch with a fake API: unknown requests fail the test with a clear message.
export function mockApi(routes: ApiRoutes): ApiCall[] {
  const calls: ApiCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, path, body });
      const route = routes[`${method} ${path}`];
      if (!route) throw new Error(`mockApi: no reply for ${method} ${path}`);
      const reply = typeof route === "function" ? route(body) : route;
      const status = reply.status ?? 200;
      return new Response(status === 204 ? null : JSON.stringify(reply.body ?? {}), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

// Renders the real route table at `path` as a logged-in user (auth itself is Track A's and not under test).
export function renderAt(path: string, user: CurrentUser | null = alice) {
  const auth: AuthState = { user, loading: false, login: vi.fn(), logout: vi.fn() };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

// Seeded accounts for alice, as GET /api/accounts returns them (F-03 §3 order).
export const SEEDED_ACCOUNTS = [
  { id: 1, name: "Bank", type: "CASH", subtype: "BANK", openingBalance: 0, openingDate: null, balance: 0 },
  {
    id: 2,
    name: "Credit Card",
    type: "LOAN_TAKEN",
    subtype: "CREDIT_CARD",
    openingBalance: 0,
    openingDate: null,
    balance: 0,
  },
  {
    id: 4,
    name: "Interest",
    type: "INCOME",
    subtype: null,
    openingBalance: 0,
    openingDate: null,
    balance: 0,
  },
  { id: 3, name: "Salary", type: "INCOME", subtype: null, openingBalance: 0, openingDate: null, balance: 0 },
  { id: 5, name: "Dining", type: "EXPENSE", subtype: null, openingBalance: 0, openingDate: null, balance: 0 },
  {
    id: 7,
    name: "Electricity",
    type: "EXPENSE",
    subtype: null,
    openingBalance: 0,
    openingDate: null,
    balance: 0,
  },
  {
    id: 6,
    name: "Groceries",
    type: "EXPENSE",
    subtype: null,
    openingBalance: 0,
    openingDate: null,
    balance: 0,
  },
  {
    id: 8,
    name: "Telecom",
    type: "EXPENSE",
    subtype: null,
    openingBalance: 0,
    openingDate: null,
    balance: 0,
  },
];

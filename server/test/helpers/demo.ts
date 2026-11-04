import type { SuperAgentTest } from "./auth.js";
import { accountOf } from "./accounts.js";

// The Sprint 1 demo journey (system-sds.md §4.3, F-04 §1.1), run through the API as `username`.
// `steps` limits how far it goes: 1 = opening balance only … 4 = everything.
export async function runDemoJourney(agent: SuperAgentTest, username = "alice", steps = 4): Promise<void> {
  const id = async (name: string) => (await accountOf(username, name)).id;
  const [bank, card, salary, dining, groceries] = await Promise.all(
    ["Bank", "Credit Card", "Salary", "Dining", "Groceries"].map(id),
  );

  const requests = [
    () =>
      agent
        .put(`/api/accounts/${bank}/opening-balance`)
        .send({ openingBalance: 1_000_000, openingDate: "2026-11-01" }),
    () =>
      agent.post("/api/transactions").send({
        kind: "RECEIVE",
        sourceAccountId: bank,
        date: "2026-11-02",
        totalAmount: 3_000_000,
        lines: [{ accountId: salary, amount: 3_000_000 }],
      }),
    () =>
      agent.post("/api/transactions").send({
        kind: "PAYMENT",
        sourceAccountId: card,
        date: "2026-11-03",
        totalAmount: 150_000,
        lines: [
          { accountId: dining, amount: 90_000 },
          { accountId: groceries, amount: 60_000 },
        ],
      }),
    () =>
      agent.post("/api/transactions").send({
        kind: "PAYMENT",
        sourceAccountId: bank,
        date: "2026-11-04",
        totalAmount: 150_000,
        lines: [{ accountId: card, amount: 150_000 }],
      }),
  ];

  for (const send of requests.slice(0, steps)) {
    const res = await send();
    if (res.status >= 300) throw new Error(`demo step failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

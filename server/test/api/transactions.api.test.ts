import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

// F-04 Record a transaction — docs/sprints/sprint-1/F-04-transactions.md §7.
const prisma = getPrisma();

let ids: Record<"bank" | "card" | "salary" | "dining" | "groceries", number>;

beforeEach(async () => {
  await resetDb();
  ids = {
    bank: (await accountOf("alice", "Bank")).id,
    card: (await accountOf("alice", "Credit Card")).id,
    salary: (await accountOf("alice", "Salary")).id,
    dining: (await accountOf("alice", "Dining")).id,
    groceries: (await accountOf("alice", "Groceries")).id,
  };
});

// F-04 §1.1 demo transactions.
function demo1() {
  return {
    kind: "RECEIVE",
    sourceAccountId: ids.bank,
    date: "2026-11-03",
    totalAmount: 3_000_000,
    lines: [{ accountId: ids.salary, amount: 3_000_000 }],
  };
}
function demo2() {
  return {
    kind: "PAYMENT",
    sourceAccountId: ids.card,
    date: "2026-11-03",
    totalAmount: 150_000,
    note: "Dinner and groceries",
    lines: [
      { accountId: ids.dining, amount: 90_000 },
      { accountId: ids.groceries, amount: 60_000 },
    ],
  };
}
function demo3() {
  return {
    kind: "PAYMENT",
    sourceAccountId: ids.bank,
    date: "2026-11-04",
    totalAmount: 150_000,
    lines: [{ accountId: ids.card, amount: 150_000 }],
  };
}

async function counts() {
  return { transactions: await prisma.transaction.count(), lines: await prisma.transactionLine.count() };
}

// Posts a body that must be rejected and checks nothing was stored (BR-13).
async function expectRejected(body: unknown, status: number, code: string) {
  const before = await counts();
  const res = await (await agentAs("alice")).post("/api/transactions").send(body as object);
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
  expect(await counts()).toEqual(before);
  return res;
}

describe("POST /api/transactions — accepted", () => {
  it("T-TX-API-01: demo #1 RECEIVE into Bank from Salary → 201 with the stored transaction", async () => {
    const res = await (await agentAs("alice")).post("/api/transactions").send(demo1());
    expect(res.status).toBe(201);
    expect(res.body.transaction).toEqual({
      id: expect.any(Number),
      kind: "RECEIVE",
      date: "2026-11-03",
      totalAmount: 3_000_000,
      note: null,
      isFavorite: false,
      source: { id: ids.bank, name: "Bank" },
      lines: [{ accountId: ids.salary, name: "Salary", amount: 3_000_000 }],
    });

    const stored = await prisma.transaction.findUniqueOrThrow({
      where: { id: res.body.transaction.id },
      include: { lines: true },
    });
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });
    expect(stored.userId).toBe(alice.id);
    expect(stored.lines).toHaveLength(1);
    expect(stored.lines[0].userId).toBe(alice.id);
    expect(await counts()).toEqual({ transactions: 1, lines: 1 });
  });

  it("T-TX-API-02: demo #2 card purchase split Dining + Groceries keeps both lines in order", async () => {
    const res = await (await agentAs("alice")).post("/api/transactions").send(demo2());
    expect(res.status).toBe(201);
    expect(res.body.transaction.note).toBe("Dinner and groceries");
    expect(res.body.transaction.lines).toEqual([
      { accountId: ids.dining, name: "Dining", amount: 90_000 },
      { accountId: ids.groceries, name: "Groceries", amount: 60_000 },
    ]);
  });

  it("T-TX-API-03: demo #3 repayment from Bank to Credit Card → 201", async () => {
    const res = await (await agentAs("alice")).post("/api/transactions").send(demo3());
    expect(res.status).toBe(201);
    expect(res.body.transaction.source).toEqual({ id: ids.bank, name: "Bank" });
  });

  it("trims the note and stores an empty note as null", async () => {
    const agent = await agentAs("alice");
    const padded = await agent.post("/api/transactions").send({ ...demo1(), note: "  salary  " });
    expect(padded.body.transaction.note).toBe("salary");
    const blank = await agent.post("/api/transactions").send({ ...demo1(), note: "   " });
    expect(blank.body.transaction.note).toBeNull();
  });

  it("applies the 200-character note limit after trimming", async () => {
    const text = "x".repeat(199);
    const res = await (
      await agentAs("alice")
    )
      .post("/api/transactions")
      .send({ ...demo1(), note: `  ${text}  ` });
    expect(res.status).toBe(201);
    expect(res.body.transaction.note).toBe(text);
  });

  it("accepts the first and last allowed dates (2000-01-01, 2099-12-31)", async () => {
    const agent = await agentAs("alice");
    await agent
      .post("/api/transactions")
      .send({ ...demo1(), date: "2000-01-01" })
      .expect(201);
    await agent
      .post("/api/transactions")
      .send({ ...demo1(), date: "2099-12-31" })
      .expect(201);
  });

  it("after the demo transactions, GET /api/accounts shows the demo balances", async () => {
    const agent = await agentAs("alice");
    await agent
      .put(`/api/accounts/${ids.bank}/opening-balance`)
      .send({ openingBalance: 1_000_000, openingDate: "2026-11-01" })
      .expect(200);
    for (const body of [demo1(), demo2(), demo3()])
      await agent.post("/api/transactions").send(body).expect(201);

    const res = await agent.get("/api/accounts");
    const balance = Object.fromEntries(
      res.body.accounts.map((a: { name: string; balance: number }) => [a.name, a.balance]),
    );
    expect(balance).toMatchObject({
      Bank: 3_850_000,
      "Credit Card": 0,
      Salary: 3_000_000,
      Dining: 90_000,
      Groceries: 60_000,
    });
  });
});

describe("POST /api/transactions — rejected, nothing stored", () => {
  it("T-TX-API-04: lines that do not add up to the total → ALLOCATION_MISMATCH with the difference", async () => {
    const res = await expectRejected({ ...demo2(), totalAmount: 150_001 }, 400, "ALLOCATION_MISMATCH");
    expect(res.body.error.details).toEqual({ totalAmount: 150_001, linesTotal: 150_000, difference: -1 });
  });

  // Each case is a function because account ids are only known after beforeEach runs.
  it.each<[string, () => Record<string, unknown>]>([
    ["a total of 0", () => ({ totalAmount: 0 })],
    ["a negative total", () => ({ totalAmount: -1 })],
    ["a decimal total", () => ({ totalAmount: 1.5 })],
    ["a line amount of 0", () => ({ lines: [{ accountId: ids.dining, amount: 0 }] })],
    ["no lines", () => ({ lines: [] })],
    ["21 lines", () => ({ lines: Array.from({ length: 21 }, () => ({ accountId: ids.dining, amount: 1 })) })],
    ["a date that does not exist", () => ({ date: "2026-02-30" })],
    ["a date before 2000", () => ({ date: "1999-12-31" })],
    ["a date after 2099", () => ({ date: "2100-01-01" })],
    ["a note of 201 characters", () => ({ note: "x".repeat(201) })],
    ["an unknown kind", () => ({ kind: "TRANSFER" })],
    ["a missing source", () => ({ sourceAccountId: undefined })],
  ])("T-TX-API-05: %s → VALIDATION_ERROR", async (_case, change) => {
    await expectRejected({ ...demo2(), ...change() }, 400, "VALIDATION_ERROR");
  });

  it("T-TX-API-06: a source of the wrong type for the form → INVALID_ACCOUNT_TYPE", async () => {
    await expectRejected({ ...demo1(), sourceAccountId: ids.card }, 400, "INVALID_ACCOUNT_TYPE"); // RECEIVE into card
    await expectRejected(
      { ...demo2(), sourceAccountId: ids.dining, lines: [{ accountId: ids.groceries, amount: 150_000 }] },
      400,
      "INVALID_ACCOUNT_TYPE",
    );
  });

  it("T-TX-API-07: a line of the wrong type for the form → INVALID_ACCOUNT_TYPE naming the line", async () => {
    const payToSalary = await expectRejected(
      { ...demo3(), lines: [{ accountId: ids.salary, amount: 150_000 }] },
      400,
      "INVALID_ACCOUNT_TYPE",
    );
    expect(payToSalary.body.error.details).toEqual({ field: "lines", lineIndex: 0, type: "INCOME" });
    await expectRejected(
      { ...demo1(), lines: [{ accountId: ids.dining, amount: 3_000_000 }] },
      400,
      "INVALID_ACCOUNT_TYPE",
    );
  });

  it("T-TX-API-08: the source account also used as a line → VALIDATION_ERROR", async () => {
    await expectRejected(
      { ...demo3(), lines: [{ accountId: ids.bank, amount: 150_000 }] },
      400,
      "VALIDATION_ERROR",
    );
  });

  it("T-TX-API-09: another user's source or line account, or a missing account → 404", async () => {
    const bobBank = (await accountOf("bob", "Bank")).id;
    const bobDining = (await accountOf("bob", "Dining")).id;
    await expectRejected({ ...demo3(), sourceAccountId: bobBank }, 404, "NOT_FOUND");
    await expectRejected(
      { ...demo2(), lines: [{ accountId: bobDining, amount: 150_000 }] },
      404,
      "NOT_FOUND",
    );
    await expectRejected({ ...demo3(), sourceAccountId: 999_999 }, 404, "NOT_FOUND");
  });
});

describe("POST /api/transactions — access", () => {
  it("T-TX-API-10: anonymous → 401, ADMIN → 403", async () => {
    const anon = await request(createApp()).post("/api/transactions").send(demo1());
    expect(anon.status).toBe(401);
    const admin = await (await agentAs("admin")).post("/api/transactions").send(demo1());
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe("FORBIDDEN");
    expect(await counts()).toEqual({ transactions: 0, lines: 0 });
  });
});

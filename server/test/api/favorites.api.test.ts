import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-10 Favorite & duplicate transactions — docs/sprints/sprint-2/F-10-favorites-duplicate.md §7.
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

describe("PATCH /api/transactions/:id/favorite & ?favorite=true (F-10)", () => {
  it("T-FAV-API-01: star and unstar are idempotent, reflected in ?favorite=true, and change no balances or totals", async () => {
    const alice = await agentAs("alice");
    await runDemoJourney(alice);

    const listRes = await alice.get("/api/transactions?sort=date_asc").expect(200);
    // Demo transaction #2 (2026-11-03 card purchase)
    const demo2 = listRes.body.transactions[1] as { id: number; date: string; isFavorite: boolean };
    expect(demo2.date).toBe("2026-11-03");
    expect(demo2.isFavorite).toBe(false);

    const summaryBefore = (await alice.get("/api/summary").expect(200)).body;

    // 1. Star demo #2
    const starRes = await alice.patch(`/api/transactions/${demo2.id}/favorite`).send({ isFavorite: true });
    expect(starRes.status).toBe(200);
    expect(starRes.body.transaction).toMatchObject({ id: demo2.id, isFavorite: true });

    // 2. Appears in ?favorite=true; summary unchanged (BR-13)
    const favs = await alice.get("/api/transactions?favorite=true").expect(200);
    expect(favs.body.transactions).toHaveLength(1);
    expect(favs.body.transactions[0].id).toBe(demo2.id);
    expect((await alice.get("/api/summary").expect(200)).body).toEqual(summaryBefore);

    // 3. Starring again is idempotent (200)
    const starAgain = await alice.patch(`/api/transactions/${demo2.id}/favorite`).send({ isFavorite: true });
    expect(starAgain.status).toBe(200);
    expect(starAgain.body.transaction.isFavorite).toBe(true);

    // 4. Unstar removes it from ?favorite=true
    const unstarRes = await alice.patch(`/api/transactions/${demo2.id}/favorite`).send({ isFavorite: false });
    expect(unstarRes.status).toBe(200);
    expect(unstarRes.body.transaction.isFavorite).toBe(false);
    expect((await alice.get("/api/transactions?favorite=true").expect(200)).body.transactions).toHaveLength(
      0,
    );
  });

  it("T-FAV-API-02: rejects bob's tx, missing id, non-numeric id with 404; invalid bodies with 400; ADMIN 403; anon 401", async () => {
    const alice = await agentAs("alice");
    const bob = await agentAs("bob");
    const bobTx = await bob
      .post("/api/transactions")
      .send({
        kind: "RECEIVE",
        sourceAccountId: (await accountOf("bob", "Bank")).id,
        date: "2026-11-02",
        totalAmount: 10_000,
        lines: [{ accountId: (await accountOf("bob", "Salary")).id, amount: 10_000 }],
      })
      .expect(201);
    const bobTxId = bobTx.body.transaction.id as number;

    const aliceTx = await alice
      .post("/api/transactions")
      .send({
        kind: "RECEIVE",
        sourceAccountId: (await accountOf("alice", "Bank")).id,
        date: "2026-11-02",
        totalAmount: 10_000,
        lines: [{ accountId: (await accountOf("alice", "Salary")).id, amount: 10_000 }],
      })
      .expect(201);
    const aliceTxId = aliceTx.body.transaction.id as number;

    for (const id of [String(bobTxId), "999999", "abc"]) {
      const miss = await alice.patch(`/api/transactions/${id}/favorite`).send({ isFavorite: true });
      expect(miss.status, `id=${id}`).toBe(404);
      expect(miss.body.error.code).toBe("NOT_FOUND");
    }
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: bobTxId } })).isFavorite).toBe(false);

    for (const badBody of [{ isFavorite: "yes" }, {}, { isFavorite: true, totalAmount: 1 }]) {
      const bad = await alice.patch(`/api/transactions/${aliceTxId}/favorite`).send(badBody);
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    }

    const adminRes = await (
      await agentAs("admin")
    )
      .patch(`/api/transactions/${aliceTxId}/favorite`)
      .send({ isFavorite: true });
    expect(adminRes.status).toBe(403);

    const anonRes = await request(createApp())
      .patch(`/api/transactions/${aliceTxId}/favorite`)
      .send({ isFavorite: true });
    expect(anonRes.status).toBe(401);
  });

  it("T-FAV-API-03: ?favorite=true combines with F-09 filters and invalid favorite values return 400", async () => {
    const alice = await agentAs("alice");
    await runDemoJourney(alice);
    const listRes = await alice.get("/api/transactions?sort=date_asc").expect(200);
    const demo2 = listRes.body.transactions[1] as { id: number }; // PAYMENT

    await alice.patch(`/api/transactions/${demo2.id}/favorite`).send({ isFavorite: true }).expect(200);

    const receiveFavs = await alice.get("/api/transactions?favorite=true&kind=RECEIVE").expect(200);
    expect(receiveFavs.body.transactions).toHaveLength(0);

    const paymentFavs = await alice.get("/api/transactions?favorite=true&kind=PAYMENT").expect(200);
    expect(paymentFavs.body.transactions).toHaveLength(1);
    expect(paymentFavs.body.transactions[0].id).toBe(demo2.id);

    for (const badParam of ["favorite=yes", "favorite=false", "favorite="]) {
      const bad = await alice.get(`/api/transactions?${badParam}`);
      expect(bad.status, badParam).toBe(400);
      expect(bad.body.error.code, badParam).toBe("VALIDATION_ERROR");
    }
  });
});

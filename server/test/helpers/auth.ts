import request from "supertest";
import { createApp } from "../../src/app.js";

export type SuperAgentTest = ReturnType<typeof request.agent>;

// Integration point 7. Returns a Supertest agent that already has a session for the given seeded
// user, through the test-only POST /api/test/login-as. It does not use the real login (S1-05).
export async function agentAs(username: string): Promise<SuperAgentTest> {
  const agent = request.agent(createApp());
  await agent.post("/api/test/login-as").send({ username }).expect(204);
  return agent;
}

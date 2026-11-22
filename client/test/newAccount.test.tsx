import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { mockApi, renderAt } from "./renderApp.js";

// F-06 §5 New account form — docs/sprints/sprint-2/F-06-account-management.md.
afterEach(() => vi.unstubAllGlobals());

describe("NewAccountPage", () => {
  it("T-ACC-UI-04: subtype is offered only for types that have one, and a 409 shows the server's message", async () => {
    const calls = mockApi({
      "POST /api/accounts": {
        status: 409,
        body: { error: { code: "ACCOUNT_NAME_TAKEN", message: "You already have an account named Bank." } },
      },
    });
    const user = userEvent.setup();
    renderAt("/accounts/new");

    expect(await screen.findByRole("heading", { level: 1, name: "New account" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Type"), "CASH");
    expect(screen.getByLabelText("Subtype")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Type"), "EXPENSE");
    expect(screen.queryByLabelText("Subtype")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Type"), "CASH");
    await user.selectOptions(screen.getByLabelText("Subtype"), "BANK");
    await user.type(screen.getByLabelText("Name"), "Bank");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You already have an account named Bank.");
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      name: "Bank",
      type: "CASH",
      subtype: "BANK",
    });
    expect(screen.getByLabelText("Name")).toHaveValue("Bank");
  });
});

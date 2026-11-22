import { Link } from "react-router-dom";
import { getAccounts, getSummary, type Account } from "../api/finance.js";
import { Amount, ErrorAlert, Loading, useLoad } from "../components/Feedback.js";

// F-08 §5 Loans page — docs/sprints/sprint-2/F-08-loans.md.
export function LoansPage() {
  const { data, error } = useLoad(() => Promise.all([getSummary(), getAccounts()]));

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const [summary, accounts] = data;
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Loans</h1>
        <div className="d-flex gap-2">
          <Link className="btn btn-primary" to="/accounts/new?type=LOAN_GIVEN">
            Add a loan account
          </Link>
          <Link className="btn btn-outline-secondary" to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>

      <LoanSection
        title="Money you lent"
        kind="GIVEN"
        emptyType="LOAN_GIVEN"
        emptyText="No money lent yet."
        rows={summary.loansGiven}
        accountsById={accountsById}
      />

      <LoanSection
        title="Money you owe"
        kind="TAKEN"
        emptyType="LOAN_TAKEN"
        emptyText="No loan or credit card debt accounts."
        rows={summary.loansTaken}
        accountsById={accountsById}
      />
    </section>
  );
}

function LoanSection(props: {
  title: string;
  kind: "GIVEN" | "TAKEN";
  emptyType: "LOAN_GIVEN" | "LOAN_TAKEN";
  emptyText: string;
  rows: { accountId: number; name: string; outstanding: number }[];
  accountsById: Map<number, Account>;
}) {
  return (
    <div className="mb-4">
      <h2 className="h5">{props.title}</h2>
      {props.rows.length === 0 ? (
        <p className="text-body-secondary">
          {props.emptyText} <Link to={`/accounts/new?type=${props.emptyType}`}>Add a loan account</Link>
        </p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col" className="text-end">
                  Outstanding
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((r) => {
                const account = props.accountsById.get(r.accountId);
                const archived = Boolean(account?.archived);
                const isCard = account?.subtype === "CREDIT_CARD";
                return (
                  <tr key={r.accountId} className={archived ? "text-body-secondary" : undefined}>
                    <th scope="row">
                      {r.name}
                      {isCard && <span className="badge text-bg-secondary ms-2">Credit card</span>}
                      {archived && <span className="badge text-bg-secondary ms-2">Archived</span>}
                      {r.outstanding < 0 && (
                        <span className="badge text-bg-warning ms-2">
                          {props.kind === "TAKEN" ? "owes you · you overpaid" : "you overpaid"}
                        </span>
                      )}
                    </th>
                    <td className="text-end">
                      <Amount satang={r.outstanding} />
                    </td>
                    <td>
                      {!archived && (
                        <div className="d-flex flex-wrap gap-2">
                          {props.kind === "GIVEN" ? (
                            <>
                              <Link
                                className="btn btn-sm btn-outline-primary"
                                to={`/loans/${r.accountId}/lend`}
                              >
                                Lend more
                              </Link>
                              <Link
                                className="btn btn-sm btn-outline-secondary"
                                to={`/loans/${r.accountId}/repaid`}
                              >
                                Get repaid
                              </Link>
                            </>
                          ) : (
                            <>
                              <Link
                                className="btn btn-sm btn-outline-primary"
                                to={`/loans/${r.accountId}/borrow`}
                              >
                                Borrow more
                              </Link>
                              <Link
                                className="btn btn-sm btn-outline-secondary"
                                to={`/loans/${r.accountId}/repay`}
                              >
                                Repay
                              </Link>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth, type Role } from "../auth/AuthContext.js";
import { ErrorAlert, Loading } from "../components/Feedback.js";

export interface AdminUser {
  id: number;
  username: string;
  role: Role;
  isEnabled: boolean;
}

// F-02 §5 Admin users page — docs/sprints/sprint-1/F-02-admin.md.
export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>();
  const [error, setError] = useState<unknown>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    api<{ users: AdminUser[] }>("/api/admin/users")
      .then((res) => {
        if (current) setUsers(res.users);
      })
      .catch((err) => {
        if (current) setError(err);
      });
    return () => {
      current = false;
    };
  }, []);

  async function toggleUser(target: AdminUser) {
    setPendingId(target.id);
    setError(null);
    try {
      const res = await api<{ user: AdminUser }>(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: !target.isEnabled }),
      });
      setUsers((prev) => prev?.map((u) => (u.id === res.user.id ? res.user : u)));
    } catch (err) {
      setError(err);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section>
      <h1 className="h3 mb-3">Users</h1>
      <ErrorAlert error={error} />
      {!users && !error && <Loading />}
      {users && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-end">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isPending = pendingId === u.id;
                return (
                  <tr key={u.id}>
                    <td className="fw-medium">{u.username}</td>
                    <td>{u.role}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.isEnabled
                            ? "bg-success-subtle text-success-emphasis"
                            : "bg-secondary-subtle text-secondary-emphasis"
                        }`}
                      >
                        {u.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className={`btn btn-sm ${u.isEnabled ? "btn-outline-danger" : "btn-outline-success"}`}
                        disabled={(isSelf && u.isEnabled) || isPending}
                        onClick={() => void toggleUser(u)}
                      >
                        {u.isEnabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

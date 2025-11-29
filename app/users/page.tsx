"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, canManageUsers, type Role } from "@/lib/permissions";

type User = {
  id: string;
  email: string;
  role: Role;
  created_at: string;
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const role = await getUserRole();
      setUserRole(role);
      if (!canManageUsers(role)) {
        router.push("/");
        return;
      }
      await loadUsers();
    };
    void checkAccess();
  }, [router]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/list-users");
      const data = await res.json();
      
      if (!res.ok) {
        console.error("API error:", data);
        throw new Error(data.error || `Failed to load users: ${res.status} ${res.statusText}`);
      }
      
      setUsers(data.users || []);
    } catch (err: any) {
      console.error("Error loading users:", err);
      setError(err.message ?? "Failed to load users. Make sure SUPABASE_SERVICE_ROLE_KEY is set in environment variables.");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      alert("Email is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");
      alert("Invitation sent successfully!");
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteRole("viewer");
      await loadUsers();
    } catch (err: any) {
      setError(err.message ?? "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    if (!confirm(`Change user role to ${newRole}?`)) return;

    try {
      const res = await fetch("/api/update-user-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      await loadUsers();
    } catch (err: any) {
      alert(err.message ?? "Failed to update role");
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (
      !confirm(
        `Are you sure you want to delete user ${userEmail}? This action cannot be undone.`
      )
    )
      return;

    try {
      const res = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      await loadUsers();
    } catch (err: any) {
      alert(err.message ?? "Failed to delete user");
    }
  };

  if (userRole === null || loading) {
    return (
      <div className="space-y-6">
        <p className="py-6 text-center text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!canManageUsers(userRole)) {
    return (
      <div className="space-y-6">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          You don't have permission to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage users and their roles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
        >
          {showInviteForm ? "Cancel" : "Invite User"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {showInviteForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Invite New User</h2>
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="viewer">Viewer</option>
                <option value="contributor">Contributor</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send Invitation"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleUpdateRole(user.id, e.target.value as Role)
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="contributor">Contributor</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



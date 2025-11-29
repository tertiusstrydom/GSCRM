"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Company, Contact } from "@/lib/types";

type FormState = {
  id?: string;
  name: string;
  website: string;
  industry: string;
  employee_count: string;
  notes: string;
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>({
    name: "",
    website: "",
    industry: "",
    employee_count: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setCompanies(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      website: "",
      industry: "",
      employee_count: "",
      notes: ""
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Company name is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseClient();

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in");
      }

      const payload: any = {
        name: form.name.trim(),
        website: form.website.trim() || null,
        industry: form.industry.trim() || null,
        notes: form.notes.trim() || null,
        user_id: user.id
      };

      if (form.employee_count.trim()) {
        const count = parseInt(form.employee_count, 10);
        if (!isNaN(count) && count > 0) {
          payload.employee_count = count;
        }
      }

      if (form.id) {
        const { error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(payload);
        if (error) throw error;
      }

      resetForm();
      void loadCompanies();
    } catch (err: any) {
      setError(err.message ?? "Failed to save company");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (company: Company) => {
    setForm({
      id: company.id,
      name: company.name,
      website: company.website ?? "",
      industry: company.industry ?? "",
      employee_count: company.employee_count?.toString() ?? "",
      notes: company.notes ?? ""
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;

    const supabase = createSupabaseClient();
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      void loadCompanies();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your companies and their details.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
        >
          New company
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Loading companies...
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {search ? "No companies found." : "No companies yet."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Industry
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Employees
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((company) => (
                    <tr key={company.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/companies/${company.id}`}
                          className="font-medium text-slate-900 hover:text-primary"
                        >
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {company.industry || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {company.employee_count
                          ? company.employee_count.toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(company)}
                            className="text-xs text-slate-600 hover:text-primary"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(company.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {form.id ? "Edit Company" : "New Company"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Website
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Industry
              </label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Employee Count
              </label>
              <input
                type="number"
                min="1"
                value={form.employee_count}
                onChange={(e) =>
                  setForm({ ...form, employee_count: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-60"
              >
                {submitting ? "Saving..." : form.id ? "Update" : "Create"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}


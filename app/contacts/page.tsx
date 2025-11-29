"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Company } from "@/lib/types";

type FormState = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  company_id: string;
  notes: string;
};

type ContactWithCompany = Contact & {
  companies?: { name: string } | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    company: "",
    company_id: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.companies?.name ?? c.company ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const supabase = createSupabaseClient();
      
      const [contactsRes, companiesRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("*, companies(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("*")
          .order("name", { ascending: true })
      ]);

      if (contactsRes.error) {
        setError(contactsRes.error.message);
      } else {
        setContacts((contactsRes.data ?? []) as ContactWithCompany[]);
      }

      if (companiesRes.error) {
        setError(companiesRes.error.message);
      } else {
        setCompanies(companiesRes.data ?? []);
      }

      setLoading(false);
    };

    void loadData();
  }, []);

  const resetForm = () =>
    setForm({ id: undefined, name: "", email: "", phone: "", company: "", company_id: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Name is required");
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      alert("Please enter a valid email");
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
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        company_id: form.company_id || null,
        notes: form.notes || null,
        user_id: user.id
      };

      if (form.id) {
        const { error } = await supabase
          .from("contacts")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
      resetForm();
      // Reload data
      setLoading(true);
      const supabaseReload = createSupabaseClient();
      const [contactsRes, companiesRes] = await Promise.all([
        supabaseReload
          .from("contacts")
          .select("*, companies(name)")
          .order("created_at", { ascending: false }),
        supabaseReload
          .from("companies")
          .select("*")
          .order("name", { ascending: true })
      ]);
      if (contactsRes.data) setContacts(contactsRes.data as ContactWithCompany[]);
      if (companiesRes.data) setCompanies(companiesRes.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to save contact");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (contact: ContactWithCompany) => {
    setForm({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      company: contact.company ?? "",
      company_id: contact.company_id ?? "",
      notes: contact.notes ?? ""
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      // Reload data
      setLoading(true);
      const supabaseReload = createSupabaseClient();
      const [contactsRes, companiesRes] = await Promise.all([
        supabaseReload
          .from("contacts")
          .select("*, companies(name)")
          .order("created_at", { ascending: false }),
        supabaseReload
          .from("companies")
          .select("*")
          .order("name", { ascending: true })
      ]);
      if (contactsRes.data) setContacts(contactsRes.data as ContactWithCompany[]);
      if (companiesRes.data) setCompanies(companiesRes.data);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your contacts and their details.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
        >
          New contact
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Search by name or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Company
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-sm text-slate-500"
                    >
                      Loading contacts…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-sm text-slate-500"
                    >
                      No contacts found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((contact) => (
                    <tr key={contact.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {contact.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {contact.companies?.name || contact.company || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {contact.email || "—"}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(contact)}
                          className="text-xs font-medium text-slate-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(contact.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
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

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {form.id ? "Edit contact" : "Add new contact"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Company
                </label>
                <select
                  value={form.company_id}
                  onChange={(e) =>
                    setForm({ ...form, company_id: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">Select a company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Or enter company name manually"
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value, company_id: "" })
                  }
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-60"
              >
                {submitting
                  ? form.id
                    ? "Saving…"
                    : "Creating…"
                  : form.id
                  ? "Save changes"
                  : "Create contact"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}




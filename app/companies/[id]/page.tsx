"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import type { Company, Contact } from "@/lib/types";

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = createSupabaseClient();

      const [companyRes, contactsRes] = await Promise.all([
        supabase.from("companies").select("*").eq("id", id).single(),
        supabase
          .from("contacts")
          .select("*")
          .eq("company_id", id)
          .order("created_at", { ascending: false })
      ]);

      if (companyRes.error) {
        setError(companyRes.error.message);
        setLoading(false);
        return;
      }

      if (contactsRes.error) {
        setError(contactsRes.error.message);
      }

      setCompany(companyRes.data);
      setContacts(contactsRes.data ?? []);
      setLoading(false);
    };

    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="py-6 text-center text-sm text-slate-500">
          Loading company details...
        </p>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 text-sm text-slate-600 hover:text-primary"
          >
            ← Back to companies
          </button>
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error || "Company not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm text-slate-600 hover:text-primary"
        >
          ← Back to companies
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {company.name}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Company Details
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-slate-500">Name</dt>
              <dd className="mt-1 text-sm text-slate-900">{company.name}</dd>
            </div>
            {company.website && (
              <div>
                <dt className="text-xs font-medium text-slate-500">Website</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.website}
                  </a>
                </dd>
              </div>
            )}
            {company.industry && (
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Industry
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {company.industry}
                </dd>
              </div>
            )}
            {company.employee_count && (
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Employee Count
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {company.employee_count.toLocaleString()}
                </dd>
              </div>
            )}
            {company.notes && (
              <div>
                <dt className="text-xs font-medium text-slate-500">Notes</dt>
                <dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">
                  {company.notes}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-slate-500">
                Created At
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {company.created_at
                  ? new Date(company.created_at).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Related Contacts ({contacts.length})
          </h2>
          {contacts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No contacts associated with this company.
            </p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <a
                    href={`/contacts/${contact.id}`}
                    className="block rounded-md px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">
                      {contact.name}
                    </p>
                    {contact.email && (
                      <p className="text-xs text-slate-500">{contact.email}</p>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}


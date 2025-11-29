"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import type { Company, Contact, Tag } from "@/lib/types";
import { TagBadge } from "@/components/TagBadge";
import { LifecycleStageBadge } from "@/components/LifecycleStageBadge";

type CompanyWithTags = Company & {
  tags?: Tag[];
};

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [company, setCompany] = useState<CompanyWithTags | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = createSupabaseClient();

      const [companyRes, contactsRes] = await Promise.all([
        supabase
          .from("companies")
          .select("*, company_tags(tags(*))")
          .eq("id", id)
          .single(),
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

      const companyData = companyRes.data ? {
        ...companyRes.data,
        tags: (companyRes.data as any).company_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
      } : null;

      setCompany(companyData as CompanyWithTags | null);
      setContacts(contactsRes.data ?? []);
      setLoading(false);
    };

    void load();
  }, [id]);

  const formatRevenue = (revenue: number | null) => {
    if (!revenue) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(revenue);
  };

  const formatCompanySize = (size: number | null) => {
    if (!size) return "—";
    if (size < 1000) return size.toLocaleString();
    if (size < 1000000) return `${(size / 1000).toFixed(1)}K`;
    return `${(size / 1000000).toFixed(1)}M`;
  };

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
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Company Information
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-slate-900">{company.name}</dd>
              </div>
              {company.website && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">Website</dt>
                  <dd className="mt-1 text-slate-900">
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
              {company.linkedin_url && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">LinkedIn</dt>
                  <dd className="mt-1 text-slate-900">
                    <a
                      href={company.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View Company Page
                    </a>
                  </dd>
                </div>
              )}
              {company.phone_number && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">Phone</dt>
                  <dd className="mt-1 text-slate-900">{company.phone_number}</dd>
                </div>
              )}
              {company.industry && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Industry
                  </dt>
                  <dd className="mt-1 text-slate-900">
                    {company.industry}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Business Metrics
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Annual Revenue
                </dt>
                <dd className="mt-1 text-slate-900">
                  {formatRevenue(company.annual_revenue)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Company Size
                </dt>
                <dd className="mt-1 text-slate-900">
                  {formatCompanySize(company.company_size)}
                </dd>
              </div>
              {company.employee_count && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Employee Count
                  </dt>
                  <dd className="mt-1 text-slate-900">
                    {company.employee_count.toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Sales Information
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Lifecycle Stage
                </dt>
                <dd className="mt-1">
                  <LifecycleStageBadge stage={company.lifecycle_stage} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Lead Source
                </dt>
                <dd className="mt-1 text-slate-900">
                  {company.lead_source
                    ? company.lead_source
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Owner</dt>
                <dd className="mt-1 text-slate-900">
                  {company.owner || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Last Contact Date
                </dt>
                <dd className="mt-1 text-slate-900">
                  {company.last_contact_date
                    ? new Date(company.last_contact_date).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {company.tags && company.tags.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {company.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} size="md" />
                ))}
              </div>
            </div>
          )}

          {company.notes && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </h2>
              <div className="whitespace-pre-wrap text-sm text-slate-900">
                {company.notes}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Metadata
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Created At
                </dt>
                <dd className="mt-1 text-slate-900">
                  {company.created_at
                    ? new Date(company.created_at).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
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
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="block rounded-md px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">
                      {contact.name}
                    </p>
                    {contact.email && (
                      <p className="text-xs text-slate-500">{contact.email}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

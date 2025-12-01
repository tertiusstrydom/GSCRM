"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Company, Tag, LifecycleStage, LeadSource } from "@/lib/types";
import { getUserRole, canCreate, canEdit, canDelete, type Role } from "@/lib/permissions";
import { TagSelector } from "@/components/TagSelector";
import { TagBadge } from "@/components/TagBadge";
import { LifecycleStageBadge } from "@/components/LifecycleStageBadge";
import { ExportModal, type ExportField } from "@/components/ExportModal";
import {
  exportCompaniesToCSV,
  generateExportFilename,
  downloadCSVWithMetadata
} from "@/lib/export-utils";
import { triggerWebhooks } from "@/lib/webhook-service";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { useDebounce } from "@/hooks/useDebounce";
import {
  findDuplicateCompaniesByName,
  findDuplicateCompaniesByWebsite,
  findSimilarCompanies,
  normalizeName,
  normalizeWebsite
} from "@/lib/duplicate-utils";
import type { Company as CompanyType } from "@/lib/types";

type FormState = {
  id?: string;
  name: string;
  website: string;
  industry: string;
  employee_count: string;
  notes: string;
  linkedin_url: string;
  phone_number: string;
  annual_revenue: string;
  company_size: string;
  country: string;
  state: string;
  lifecycle_stage: LifecycleStage | "";
  lead_source: LeadSource | "";
  last_contact_date: string;
  owner: string;
  tagIds: string[];
};

type CompanyWithTags = Company & {
  tags?: Tag[];
};

const lifecycleStages: LifecycleStage[] = [
  "lead",
  "marketing_qualified",
  "sales_qualified",
  "opportunity",
  "customer",
  "evangelist",
  "other"
];

const leadSources: LeadSource[] = [
  "website",
  "referral",
  "social_media",
  "cold_outreach",
  "event",
  "partner",
  "other"
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithTags[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("");
  const [form, setForm] = useState<FormState>({
    name: "",
    website: "",
    industry: "",
    employee_count: "",
    notes: "",
    linkedin_url: "",
    phone_number: "",
    annual_revenue: "",
    company_size: "",
    country: "",
    state: "",
    lifecycle_stage: "",
    lead_source: "",
    last_contact_date: "",
    owner: "",
    tagIds: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [duplicateCompany, setDuplicateCompany] = useState<CompanyType | null>(null);
  const [similarCompanies, setSimilarCompanies] = useState<Array<{ company: CompanyType; similarity: number }>>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [ignoreDuplicate, setIgnoreDuplicate] = useState(false);
  const debouncedName = useDebounce(form.name, 500);
  const debouncedWebsite = useDebounce(form.website, 500);

  useEffect(() => {
    const loadRole = async () => {
      const role = await getUserRole();
      setUserRole(role);
    };
    void loadRole();
  }, []);

  // Check for duplicate companies by name
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!debouncedName || ignoreDuplicate || debouncedName.trim().length < 3) {
        setDuplicateCompany(null);
        setSimilarCompanies([]);
        return;
      }

      setCheckingDuplicate(true);
      const nameDups = await findDuplicateCompaniesByName(debouncedName, form.id);
      const websiteDups = form.website
        ? await findDuplicateCompaniesByWebsite(form.website, form.id)
        : [];
      const similar = await findSimilarCompanies(debouncedName, 0.8, form.id);
      setCheckingDuplicate(false);

      if (nameDups.length > 0) {
        setDuplicateCompany(nameDups[0]);
      } else if (websiteDups.length > 0) {
        setDuplicateCompany(websiteDups[0]);
      } else {
        setDuplicateCompany(null);
      }

      setSimilarCompanies(similar.slice(0, 3)); // Show top 3 similar
    };

    void checkDuplicate();
  }, [debouncedName, debouncedWebsite, form.id, form.website, ignoreDuplicate]);

  // Reset ignore flag when name/website changes
  useEffect(() => {
    setIgnoreDuplicate(false);
  }, [form.name, form.website]);

  const filtered = useMemo(() => {
    let result = companies;
    
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.industry ?? "").toLowerCase().includes(q)
      );
    }
    
    // Tag filter
    if (selectedTagFilter) {
      result = result.filter((c) =>
        c.tags?.some((tag) => tag.id === selectedTagFilter)
      );
    }
    
    return result;
  }, [companies, search, selectedTagFilter]);

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseClient();
    const [companiesRes, tagsRes] = await Promise.all([
      supabase
        .from("companies")
        .select("*, company_tags(tags(*))")
        .order("created_at", { ascending: false }),
      supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true })
    ]);

    if (companiesRes.error) {
      setError(companiesRes.error.message);
    } else {
      const companiesData = (companiesRes.data ?? []).map((company: any) => ({
        ...company,
        tags: company.company_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
      }));
      setCompanies(companiesData as CompanyWithTags[]);
    }

    if (tagsRes.error) {
      console.error("Tags error:", tagsRes.error);
    } else {
      setTags(tagsRes.data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  const resetForm = () => {
    setForm({
      id: undefined,
      name: "",
      website: "",
      industry: "",
      employee_count: "",
      notes: "",
      linkedin_url: "",
      phone_number: "",
      annual_revenue: "",
      company_size: "",
      country: "",
      state: "",
      lifecycle_stage: "",
      lead_source: "",
      last_contact_date: "",
      owner: "",
      tagIds: []
    });
    setDuplicateCompany(null);
    setSimilarCompanies([]);
    setIgnoreDuplicate(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Company name is required");
      return;
    }

    // Final duplicate check before submission
    if (!ignoreDuplicate) {
      const nameDups = await findDuplicateCompaniesByName(form.name, form.id);
      const websiteDups = form.website
        ? await findDuplicateCompaniesByWebsite(form.website, form.id)
        : [];
      
      if (nameDups.length > 0) {
        setDuplicateCompany(nameDups[0]);
        alert("A company with this name already exists. Please review the duplicate warning or click 'Create anyway' to proceed.");
        return;
      }
      if (websiteDups.length > 0) {
        setDuplicateCompany(websiteDups[0]);
        alert("A company with this website already exists. Please review the duplicate warning or click 'Create anyway' to proceed.");
        return;
      }
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
        linkedin_url: form.linkedin_url.trim() || null,
        phone_number: form.phone_number.trim() || null,
        country: form.country.trim() || null,
        state: form.state.trim() || null,
        lifecycle_stage: form.lifecycle_stage || null,
        lead_source: form.lead_source || null,
        last_contact_date: form.last_contact_date || null,
        owner: form.owner.trim() || null,
        user_id: user.id
      };

      if (form.employee_count.trim()) {
        const count = parseInt(form.employee_count, 10);
        if (!isNaN(count) && count > 0) {
          payload.employee_count = count;
        }
      }

      if (form.company_size.trim()) {
        const size = parseInt(form.company_size, 10);
        if (!isNaN(size) && size > 0) {
          payload.company_size = size;
        }
      }

      if (form.annual_revenue.trim()) {
        const revenue = parseFloat(form.annual_revenue);
        if (!isNaN(revenue) && revenue > 0) {
          payload.annual_revenue = revenue;
        }
      }

      let companyId: string;
      let previousData: any = null;
      
      if (form.id) {
        // Get previous data for update webhook
        const { data: oldData } = await supabase
          .from("companies")
          .select("*")
          .eq("id", form.id)
          .single();
        previousData = oldData;
        
        const { error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
        companyId = form.id;
        
        // Track changed fields
        const changedFields = Object.keys(payload).filter(
          (key) => JSON.stringify(oldData?.[key]) !== JSON.stringify(payload[key])
        );
        
        // Trigger webhook for update (non-blocking)
        try {
          const updatedCompany = { ...oldData, ...payload };
          await triggerWebhooks(
            "updated",
            "company",
            companyId,
            updatedCompany,
            oldData,
            changedFields
          );
          
          // Check if lifecycle_stage changed for status_changed webhook
          if (oldData?.lifecycle_stage !== payload.lifecycle_stage) {
            await triggerWebhooks(
              "status_changed",
              "company",
              companyId,
              updatedCompany,
              oldData
            );
          }
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      } else {
        const { data, error } = await supabase
          .from("companies")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        companyId = data.id;
        
        // Trigger webhook for create (non-blocking)
        try {
          await triggerWebhooks("created", "company", companyId, data);
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      }

      // Update tags
      const { error: tagsError } = await supabase
        .from("company_tags")
        .delete()
        .eq("company_id", companyId);
      if (tagsError) throw tagsError;

      if (form.tagIds.length > 0) {
        const tagInserts = form.tagIds.map((tagId) => ({
          company_id: companyId,
          tag_id: tagId
        }));
        const { error: insertTagsError } = await supabase
          .from("company_tags")
          .insert(tagInserts);
        if (insertTagsError) throw insertTagsError;
      }

      resetForm();
      void loadCompanies();
    } catch (err: any) {
      setError(err.message ?? "Failed to save company");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (company: CompanyWithTags) => {
    setForm({
      id: company.id,
      name: company.name,
      website: company.website ?? "",
      industry: company.industry ?? "",
      employee_count: company.employee_count?.toString() ?? "",
      notes: company.notes ?? "",
      linkedin_url: company.linkedin_url ?? "",
      phone_number: company.phone_number ?? "",
      annual_revenue: company.annual_revenue?.toString() ?? "",
      company_size: company.company_size?.toString() ?? "",
      country: company.country ?? "",
      state: company.state ?? "",
      lifecycle_stage: company.lifecycle_stage ?? "",
      lead_source: company.lead_source ?? "",
      last_contact_date: company.last_contact_date ?? "",
      owner: company.owner ?? "",
      tagIds: company.tags?.map((t) => t.id) || []
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;

    const supabase = createSupabaseClient();
    
    // Get company data before deletion for webhook
    const companyData = companies.find((c) => c.id === id);
    
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      // Trigger webhook for delete (non-blocking)
      if (companyData) {
        try {
          await triggerWebhooks("deleted", "company", id, companyData);
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      }
      void loadCompanies();
    }
  };

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

  const exportFields: ExportField[] = [
    { key: "name", label: "Name", essential: true },
    { key: "website", label: "Website" },
    { key: "industry", label: "Industry" },
    { key: "employee_count", label: "Employee Count" },
    { key: "phone_number", label: "Phone Number" },
    { key: "linkedin_url", label: "LinkedIn URL" },
    { key: "annual_revenue", label: "Annual Revenue" },
    { key: "company_size", label: "Company Size" },
    { key: "lifecycle_stage", label: "Lifecycle Stage" },
    { key: "lead_source", label: "Lead Source" },
    { key: "last_contact_date", label: "Last Contact Date" },
    { key: "notes", label: "Notes" },
    { key: "owner", label: "Owner" },
    { key: "tags", label: "Tags" },
    { key: "created_at", label: "Created At" }
  ];

  const handleExport = async (selectedFields: string[], exportAll: boolean) => {
    setIsExporting(true);
    try {
      const dataToExport = exportAll ? companies : filtered;
      const csvContent = exportCompaniesToCSV(dataToExport, selectedFields);
      const filename = generateExportFilename("companies");
      
      const {
        data: { user }
      } = await createSupabaseClient().auth.getUser();
      downloadCSVWithMetadata(
        csvContent,
        filename,
        dataToExport.length,
        user?.email || undefined
      );

      setIsExportModalOpen(false);
      setTimeout(() => {
        alert(`Successfully exported ${dataToExport.length} companies to ${filename}`);
      }, 100);
    } catch (error: any) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export CSV
          </button>
          <Link
            href="/import?type=companies"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            📥 Import CSV
          </Link>
          {userRole && canCreate(userRole) && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
            >
              New company
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
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
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Industry
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Stage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Tags
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
                        {company.linkedin_url && (
                          <a
                            href={company.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-slate-400 hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🔗
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {company.industry || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <LifecycleStageBadge stage={company.lifecycle_stage} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatRevenue(company.annual_revenue)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {company.tags && company.tags.length > 0 ? (
                            company.tags.map((tag) => (
                              <TagBadge key={tag.id} tag={tag} size="sm" />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {userRole && canEdit(userRole) && (
                            <button
                              type="button"
                              onClick={() => handleEdit(company)}
                              className="text-xs text-slate-600 hover:text-primary"
                            >
                              Edit
                            </button>
                          )}
                          {userRole && canDelete(userRole) && (
                            <button
                              type="button"
                              onClick={() => handleDelete(company.id)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {userRole && (canCreate(userRole) || canEdit(userRole)) && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">
              {form.id ? "Edit Company" : "New Company"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
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

              {duplicateCompany && !ignoreDuplicate && (
                <DuplicateWarning
                  show={true}
                  checking={checkingDuplicate}
                  message={`A company with this ${normalizeName(duplicateCompany.name) === normalizeName(form.name) ? "name" : "website"} already exists: ${duplicateCompany.name}`}
                  duplicateRecord={{
                    id: duplicateCompany.id,
                    name: duplicateCompany.name,
                    entityType: "company"
                  }}
                  onProceed={() => setIgnoreDuplicate(true)}
                  onDismiss={() => setDuplicateCompany(null)}
                />
              )}

              {similarCompanies.length > 0 && !duplicateCompany && !ignoreDuplicate && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-blue-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-blue-800">
                        Similar companies found
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <ul className="list-disc list-inside space-y-1">
                          {similarCompanies.map(({ company, similarity }) => (
                            <li key={company.id}>
                              <Link
                                href={`/companies/${company.id}`}
                                className="underline hover:text-blue-900"
                              >
                                {company.name}
                              </Link>{" "}
                              ({Math.round(similarity * 100)}% similar)
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Website
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://example.com"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/company/..."
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Country
                  </label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="e.g., United States, Canada"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="e.g., California, Ontario"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    placeholder="e.g., Technology, Healthcare"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={form.phone_number}
                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Annual Revenue ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={form.annual_revenue}
                    onChange={(e) => setForm({ ...form, annual_revenue: e.target.value })}
                    placeholder="1000000"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Company Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.company_size}
                    onChange={(e) => setForm({ ...form, company_size: e.target.value })}
                    placeholder="50"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
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
                  placeholder="50"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Lifecycle Stage
                  </label>
                  <select
                    value={form.lifecycle_stage}
                    onChange={(e) =>
                      setForm({ ...form, lifecycle_stage: e.target.value as LifecycleStage | "" })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select stage</option>
                    {lifecycleStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Lead Source
                  </label>
                  <select
                    value={form.lead_source}
                    onChange={(e) =>
                      setForm({ ...form, lead_source: e.target.value as LeadSource | "" })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select source</option>
                    {leadSources.map((source) => (
                      <option key={source} value={source}>
                        {source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Last Contact Date
                  </label>
                  <input
                    type="date"
                    value={form.last_contact_date}
                    onChange={(e) => setForm({ ...form, last_contact_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Owner
                  </label>
                  <input
                    type="text"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    placeholder="Who owns this company?"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tags
                </label>
                <TagSelector
                  selectedTagIds={form.tagIds}
                  onChange={(tagIds) => setForm({ ...form, tagIds })}
                  placeholder="Select tags..."
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
                  placeholder="Additional notes about this company..."
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
        )}
      </section>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        entityName="companies"
        fields={exportFields}
        totalCount={companies.length}
        filteredCount={filtered.length !== companies.length ? filtered.length : null}
        isLoading={isExporting}
      />
    </div>
  );
}

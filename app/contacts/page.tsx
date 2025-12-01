"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Company, Tag, LifecycleStage, LeadSource } from "@/lib/types";
import { getUserRole, canCreate, canEdit, canDelete, type Role } from "@/lib/permissions";
import { TagSelector } from "@/components/TagSelector";
import { TagBadge } from "@/components/TagBadge";
import { LifecycleStageBadge } from "@/components/LifecycleStageBadge";
import { ExportModal, type ExportField } from "@/components/ExportModal";
import {
  exportContactsToCSV,
  generateExportFilename,
  downloadCSVWithMetadata
} from "@/lib/export-utils";
import { triggerWebhooks } from "@/lib/webhook-service";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { useDebounce } from "@/hooks/useDebounce";
import {
  findDuplicateContactsByEmail,
  normalizeEmail
} from "@/lib/duplicate-utils";
import type { Contact as ContactType } from "@/lib/types";
import { getContactFullName, splitFullName } from "@/lib/contact-utils";

type FormState = {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  phone_number: string;
  company: string;
  company_id: string;
  job_title: string;
  company_website: string;
  company_headcount: string;
  notes: string;
  linkedin_url: string;
  lifecycle_stage: LifecycleStage | "";
  lead_source: LeadSource | "";
  last_contact_date: string;
  owner: string;
  tagIds: string[];
};

type ContactWithCompany = Contact & {
  companies?: { name: string } | null;
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("");
  const [form, setForm] = useState<FormState>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    phone_number: "",
    company: "",
    company_id: "",
    notes: "",
    linkedin_url: "",
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
  const [duplicateContact, setDuplicateContact] = useState<ContactType | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [ignoreDuplicate, setIgnoreDuplicate] = useState(false);
  const debouncedEmail = useDebounce(form.email, 500);

  useEffect(() => {
    const loadRole = async () => {
      const role = await getUserRole();
      setUserRole(role);
    };
    void loadRole();
  }, []);

  // Check for duplicate contacts by email
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!debouncedEmail || ignoreDuplicate || !debouncedEmail.includes("@")) {
        setDuplicateContact(null);
        return;
      }

      setCheckingDuplicate(true);
      const duplicates = await findDuplicateContactsByEmail(debouncedEmail, form.id);
      setCheckingDuplicate(false);

      if (duplicates.length > 0) {
        setDuplicateContact(duplicates[0]);
      } else {
        setDuplicateContact(null);
      }
    };

    void checkDuplicate();
  }, [debouncedEmail, form.id, ignoreDuplicate]);

  // Reset ignore flag when email changes
  useEffect(() => {
    setIgnoreDuplicate(false);
  }, [form.email]);

  const filtered = useMemo(() => {
    let result = contacts;
    
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          (c.first_name?.toLowerCase() || "").includes(q) ||
          (c.last_name?.toLowerCase() || "").includes(q) ||
          getContactFullName(c).toLowerCase().includes(q) ||
          (c.companies?.name ?? c.company ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      );
    }
    
    // Tag filter
    if (selectedTagFilter) {
      result = result.filter((c) =>
        c.tags?.some((tag) => tag.id === selectedTagFilter)
      );
    }
    
    return result;
  }, [contacts, search, selectedTagFilter]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const supabase = createSupabaseClient();
      
      const [contactsRes, companiesRes, tagsRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("*, companies(name), contact_tags(tags(*))")
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("tags")
          .select("*")
          .order("name", { ascending: true })
      ]);

      if (contactsRes.error) {
        console.error("Contacts error:", contactsRes.error);
        setError(contactsRes.error.message || "Failed to load contacts");
      } else {
        const contactsData = (contactsRes.data ?? []).map((contact: any) => ({
          ...contact,
          tags: contact.contact_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
        }));
        setContacts(contactsData as ContactWithCompany[]);
      }

      if (companiesRes.error) {
        console.error("Companies error:", companiesRes.error);
        setError(companiesRes.error.message || "Failed to load companies");
      } else {
        setCompanies(companiesRes.data ?? []);
      }

      if (tagsRes.error) {
        console.error("Tags error:", tagsRes.error);
      } else {
        setTags(tagsRes.data ?? []);
      }

      setLoading(false);
    };

    void loadData();
  }, []);

  const resetForm = () => {
    setForm({
      id: undefined,
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      phone_number: "",
      company: "",
      company_id: "",
      job_title: "",
      company_website: "",
      company_headcount: "",
      notes: "",
      linkedin_url: "",
      lifecycle_stage: "",
      lead_source: "",
      last_contact_date: "",
      owner: "",
      tagIds: []
    });
    setDuplicateContact(null);
    setIgnoreDuplicate(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) {
      alert("First name is required");
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      alert("Please enter a valid email");
      return;
    }

    // Final duplicate check before submission
    if (form.email && !ignoreDuplicate) {
      const duplicates = await findDuplicateContactsByEmail(form.email, form.id);
      if (duplicates.length > 0) {
        setDuplicateContact(duplicates[0]);
        alert("A contact with this email already exists. Please review the duplicate warning or click 'Create anyway' to proceed.");
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
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        email: form.email || null,
        phone: form.phone || null,
        phone_number: form.phone_number || null,
        company: form.company || null,
        company_id: form.company_id || null,
        notes: form.notes || null,
        linkedin_url: form.linkedin_url || null,
        lifecycle_stage: form.lifecycle_stage || null,
        lead_source: form.lead_source || null,
        last_contact_date: form.last_contact_date || null,
        owner: form.owner || null,
        user_id: user.id
      };

      let contactId: string;
      let previousData: any = null;
      
      if (form.id) {
        // Get previous data for update webhook
        const { data: oldData } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", form.id)
          .single();
        previousData = oldData;
        
        const { error } = await supabase
          .from("contacts")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
        contactId = form.id;
        
        // Track changed fields
        const changedFields = Object.keys(payload).filter(
          (key) => JSON.stringify(oldData?.[key]) !== JSON.stringify(payload[key])
        );
        
        // Trigger webhook for update (non-blocking)
        try {
          const updatedContact = { ...oldData, ...payload };
          await triggerWebhooks(
            "updated",
            "contact",
            contactId,
            updatedContact,
            oldData,
            changedFields
          );
          
          // Check if lifecycle_stage changed for status_changed webhook
          if (oldData?.lifecycle_stage !== payload.lifecycle_stage) {
            await triggerWebhooks(
              "status_changed",
              "contact",
              contactId,
              updatedContact,
              oldData
            );
          }
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        contactId = data.id;
        
        // Trigger webhook for create (non-blocking)
        try {
          await triggerWebhooks("created", "contact", contactId, data);
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      }

      // Update tags
      const { error: tagsError } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId);
      if (tagsError) throw tagsError;

      // Track tag changes for webhooks
      const oldTagIds = form.id
        ? (contacts.find((c) => c.id === form.id)?.tags?.map((t) => t.id) || [])
        : [];
      const newTagIds = form.tagIds || [];
      const addedTags = newTagIds.filter((id) => !oldTagIds.includes(id));
      const removedTags = oldTagIds.filter((id) => !newTagIds.includes(id));

      if (form.tagIds.length > 0) {
        const tagInserts = form.tagIds.map((tagId) => ({
          contact_id: contactId,
          tag_id: tagId
        }));
        const { error: insertTagsError } = await supabase
          .from("contact_tags")
          .insert(tagInserts);
        if (insertTagsError) throw insertTagsError;
      }

      // Trigger tag webhooks (non-blocking)
      if (form.id) {
        try {
          const contactData = contacts.find((c) => c.id === form.id);
          if (contactData) {
            for (const tagId of addedTags) {
              await triggerWebhooks("tag_added", "contact", contactId, {
                ...contactData,
                tag_id: tagId
              });
            }
            for (const tagId of removedTags) {
              await triggerWebhooks("tag_removed", "contact", contactId, {
                ...contactData,
                tag_id: tagId
              });
            }
          }
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      }

      resetForm();
      // Reload data
      setLoading(true);
      const supabaseReload = createSupabaseClient();
      const [contactsRes, companiesRes, tagsRes] = await Promise.all([
        supabaseReload
          .from("contacts")
          .select("*, companies(name), contact_tags(tags(*))")
          .order("created_at", { ascending: false }),
        supabaseReload
          .from("companies")
          .select("*")
          .order("name", { ascending: true }),
        supabaseReload
          .from("tags")
          .select("*")
          .order("name", { ascending: true })
      ]);
      
      if (contactsRes.data) {
        const contactsData = (contactsRes.data ?? []).map((contact: any) => ({
          ...contact,
          tags: contact.contact_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
        }));
        setContacts(contactsData as ContactWithCompany[]);
      }
      if (companiesRes.data) setCompanies(companiesRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
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
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      phone_number: contact.phone_number ?? "",
      company: contact.company ?? "",
      company_id: contact.company_id ?? "",
      job_title: contact.job_title ?? "",
      company_website: contact.company_website ?? "",
      company_headcount: contact.company_headcount?.toString() ?? "",
      notes: contact.notes ?? "",
      linkedin_url: contact.linkedin_url ?? "",
      lifecycle_stage: contact.lifecycle_stage ?? "",
      lead_source: contact.lead_source ?? "",
      last_contact_date: contact.last_contact_date ?? "",
      owner: contact.owner ?? "",
      tagIds: contact.tags?.map((t) => t.id) || []
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    const supabase = createSupabaseClient();
    
    // Get contact data before deletion for webhook
    const contactData = contacts.find((c) => c.id === id);
    
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      // Trigger webhook for delete (non-blocking)
      if (contactData) {
        try {
          await triggerWebhooks("deleted", "contact", id, contactData);
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      }
      
      // Reload data
      setLoading(true);
      const supabaseReload = createSupabaseClient();
      const [contactsRes, companiesRes, tagsRes] = await Promise.all([
        supabaseReload
          .from("contacts")
          .select("*, companies(name), contact_tags(tags(*))")
          .order("created_at", { ascending: false }),
        supabaseReload
          .from("companies")
          .select("*")
          .order("name", { ascending: true }),
        supabaseReload
          .from("tags")
          .select("*")
          .order("name", { ascending: true })
      ]);
      if (contactsRes.data) {
        const contactsData = (contactsRes.data ?? []).map((contact: any) => ({
          ...contact,
          tags: contact.contact_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
        }));
        setContacts(contactsData as ContactWithCompany[]);
      }
      if (companiesRes.data) setCompanies(companiesRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
      setLoading(false);
    }
  };

  const exportFields: ExportField[] = [
    { key: "name", label: "Name", essential: true },
    { key: "email", label: "Email", essential: true },
    { key: "phone_number", label: "Phone Number" },
    { key: "companies.name", label: "Company Name" },
    { key: "company", label: "Company" },
    { key: "linkedin_url", label: "LinkedIn URL" },
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
      const dataToExport = exportAll ? contacts : filtered;
      const csvContent = exportContactsToCSV(dataToExport, selectedFields);
      const filename = generateExportFilename("contacts");
      
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
      // Show success message
      setTimeout(() => {
        alert(`Successfully exported ${dataToExport.length} contacts to ${filename}`);
      }, 100);
    } catch (error: any) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
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
            href="/import?type=contacts"
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
              New contact
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
              placeholder="Search by name, company, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    Stage
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tags
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
                      colSpan={5}
                      className="px-3 py-4 text-center text-sm text-slate-500"
                    >
                      Loading contacts…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
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
                          {getContactFullName(contact)}
                          {contact.job_title && (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {contact.job_title}
                            </span>
                          )}
                        </Link>
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-slate-400 hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🔗
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {contact.companies?.name || contact.company || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <LifecycleStageBadge stage={contact.lifecycle_stage} size="sm" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map((tag) => (
                              <TagBadge key={tag.id} tag={tag} size="sm" />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        {userRole && canEdit(userRole) && (
                          <button
                            type="button"
                            onClick={() => handleEdit(contact)}
                            className="text-xs font-medium text-slate-700 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                        {userRole && canDelete(userRole) && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(contact.id)}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {userRole && (canCreate(userRole) || canEdit(userRole)) && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {form.id ? "Edit contact" : "Add new contact"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    placeholder="John"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    placeholder="Doe"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {duplicateContact && !ignoreDuplicate && (
                <DuplicateWarning
                  show={true}
                  checking={checkingDuplicate}
                  message={`A contact with this email already exists: ${getContactFullName(duplicateContact)}`}
                  duplicateRecord={{
                    id: duplicateContact.id,
                    name: getContactFullName(duplicateContact),
                    entityType: "contact",
                    companyName: (duplicateContact as ContactWithCompany).companies?.name || duplicateContact.company || undefined
                  }}
                  onProceed={() => setIgnoreDuplicate(true)}
                  onDismiss={() => setDuplicateContact(null)}
                />
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Company
                  </label>
                  <select
                    value={form.company_id}
                    onChange={(e) =>
                      setForm({ ...form, company_id: e.target.value, company: "" })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                    placeholder="e.g., VP of Sales, Marketing Manager"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Company Website
                  </label>
                  <input
                    type="url"
                    value={form.company_website}
                    onChange={(e) => {
                      let value = e.target.value.trim();
                      if (value && !value.startsWith("http://") && !value.startsWith("https://")) {
                        value = `https://${value}`;
                      }
                      setForm({ ...form, company_website: value });
                    }}
                    placeholder="https://company.com"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Company Headcount
                  </label>
                  <input
                    type="number"
                    value={form.company_headcount}
                    onChange={(e) => setForm({ ...form, company_headcount: e.target.value })}
                    placeholder="e.g., 50, 500, 1000"
                    min="0"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
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
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Last Contact Date
                  </label>
                  <input
                    type="date"
                    value={form.last_contact_date}
                    onChange={(e) => setForm({ ...form, last_contact_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Owner
                </label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  placeholder="Who owns this contact?"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
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
                  placeholder="Additional notes about this contact..."
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
        )}
      </section>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        entityName="contacts"
        fields={exportFields}
        totalCount={contacts.length}
        filteredCount={filtered.length !== contacts.length ? filtered.length : null}
        isLoading={isExporting}
      />
    </div>
  );
}

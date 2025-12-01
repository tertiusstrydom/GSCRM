"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import {
  exportContactsToCSV,
  exportCompaniesToCSV,
  exportDealsToCSV,
  exportTasksToCSV,
  exportActivitiesToCSV,
  generateExportFilename,
  downloadCSVWithMetadata
} from "@/lib/export-utils";

export default function ExportPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    contacts: 0,
    companies: 0,
    deals: 0,
    tasks: 0,
    activities: 0
  });

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    const supabase = createSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const [contactsRes, companiesRes, dealsRes, tasksRes, activitiesRes] =
        await Promise.all([
          supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("companies")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("deals")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("activities")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
        ]);

      setCounts({
        contacts: contactsRes.count || 0,
        companies: companiesRes.count || 0,
        deals: dealsRes.count || 0,
        tasks: tasksRes.count || 0,
        activities: activitiesRes.count || 0
      });
    } catch (error: any) {
      console.error("Error loading counts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportEntity = async (entityType: string) => {
    setExporting(entityType);
    const supabase = createSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to export");
      setExporting(null);
      return;
    }

    try {
      let data: any[] = [];
      let csvContent = "";
      let filename = "";

      switch (entityType) {
        case "contacts":
          const contactsRes = await supabase
            .from("contacts")
            .select(`
              *,
              companies(name),
              contact_tags(tags(name))
            `)
            .eq("user_id", user.id);

          if (contactsRes.data) {
            data = contactsRes.data.map((c: any) => ({
              ...c,
              tags: c.contact_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
            }));
            csvContent = exportContactsToCSV(
              data,
              [
                "name",
                "email",
                "phone_number",
                "companies.name",
                "company",
                "linkedin_url",
                "lifecycle_stage",
                "lead_source",
                "last_contact_date",
                "notes",
                "owner",
                "tags",
                "created_at"
              ]
            );
            filename = generateExportFilename("contacts");
          }
          break;

        case "companies":
          const companiesRes = await supabase
            .from("companies")
            .select(`
              *,
              company_tags(tags(name))
            `)
            .eq("user_id", user.id);

          if (companiesRes.data) {
            data = companiesRes.data.map((c: any) => ({
              ...c,
              tags: c.company_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
            }));
            csvContent = exportCompaniesToCSV(
              data,
              [
                "name",
                "website",
                "industry",
                "employee_count",
                "phone_number",
                "linkedin_url",
                "annual_revenue",
                "company_size",
                "lifecycle_stage",
                "lead_source",
                "last_contact_date",
                "notes",
                "owner",
                "tags",
                "created_at"
              ]
            );
            filename = generateExportFilename("companies");
          }
          break;

        case "deals":
          const dealsRes = await supabase
            .from("deals")
            .select(`
              *,
              contacts(name),
              companies(name)
            `)
            .eq("user_id", user.id);

          if (dealsRes.data) {
            data = dealsRes.data;
            csvContent = exportDealsToCSV(
              data,
              [
                "title",
                "contacts.name",
                "companies.name",
                "amount",
                "stage",
                "probability",
                "expected_close_date",
                "actual_close_date",
                "description",
                "owner",
                "created_at"
              ]
            );
            filename = generateExportFilename("deals");
          }
          break;

        case "tasks":
          const tasksRes = await supabase
            .from("tasks")
            .select(`
              *,
              contacts(name),
              companies(name),
              deals(title)
            `)
            .eq("user_id", user.id);

          if (tasksRes.data) {
            data = tasksRes.data;
            csvContent = exportTasksToCSV(
              data,
              [
                "title",
                "description",
                "due_date",
                "completed",
                "completed_at",
                "priority",
                "contacts.name",
                "companies.name",
                "deals.title",
                "owner",
                "created_at"
              ]
            );
            filename = generateExportFilename("tasks");
          }
          break;

        case "activities":
          const activitiesRes = await supabase
            .from("activities")
            .select(`
              *,
              contacts(name),
              companies(name),
              deals(title)
            `)
            .eq("user_id", user.id);

          if (activitiesRes.data) {
            data = activitiesRes.data;
            csvContent = exportActivitiesToCSV(
              data,
              [
                "type",
                "title",
                "description",
                "activity_date",
                "duration_minutes",
                "outcome",
                "contacts.name",
                "companies.name",
                "deals.title",
                "owner",
                "created_at"
              ]
            );
            filename = generateExportFilename("activities");
          }
          break;
      }

      if (csvContent && data.length > 0) {
        downloadCSVWithMetadata(
          csvContent,
          filename,
          data.length,
          user?.email || undefined
        );
        setTimeout(() => {
          alert(`Successfully exported ${data.length} ${entityType} to ${filename}`);
        }, 100);
      }
    } catch (error: any) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    if (
      !confirm(
        "This will export all your CRM data. Multiple CSV files will be downloaded. Continue?"
      )
    ) {
      return;
    }

    const entities = ["contacts", "companies", "deals", "tasks", "activities"];
    for (const entity of entities) {
      if (counts[entity as keyof typeof counts] > 0) {
        await handleExportEntity(entity);
        // Small delay between exports
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };

  const totalRecords =
    counts.contacts +
    counts.companies +
    counts.deals +
    counts.tasks +
    counts.activities;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export Data</h1>
        <p className="mt-1 text-sm text-slate-600">
          Export your CRM data to CSV files for backup, reporting, or analysis.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-slate-500">Loading data summary...</p>
        </div>
      ) : (
        <>
          {/* Data Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Data Summary
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                  Contacts
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {counts.contacts}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                  Companies
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {counts.companies}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                  Deals
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {counts.deals}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                  Tasks
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {counts.tasks}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                  Activities
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {counts.activities}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-900">
                Total Records: {totalRecords}
              </p>
            </div>
          </div>

          {/* Export Options */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Export Options
            </h2>

            {/* Export All */}
            <div className="mb-6 rounded-lg border-2 border-primary bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Export Everything</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Download all {totalRecords} records across all entities as separate CSV files
                  </p>
                </div>
                <button
                  onClick={handleExportAll}
                  disabled={exporting !== null || totalRecords === 0}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
                >
                  {exporting === "all" ? "Exporting..." : "Export All"}
                </button>
              </div>
            </div>

            {/* Individual Exports */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Export Individual Entities
              </h3>
              {[
                { key: "contacts", label: "Contacts", count: counts.contacts },
                { key: "companies", label: "Companies", count: counts.companies },
                { key: "deals", label: "Deals", count: counts.deals },
                { key: "tasks", label: "Tasks", count: counts.tasks },
                { key: "activities", label: "Activities", count: counts.activities }
              ].map((entity) => (
                <div
                  key={entity.key}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">{entity.label}</p>
                    <p className="text-sm text-slate-600">
                      {entity.count} {entity.count === 1 ? "record" : "records"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportEntity(entity.key)}
                    disabled={exporting !== null || entity.count === 0}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    {exporting === entity.key ? (
                      "Exporting..."
                    ) : (
                      <>
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
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}



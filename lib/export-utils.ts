// CSV Export Utilities

import type {
  Contact,
  Company,
  Deal,
  Task,
  Activity,
  LifecycleStage,
  LeadSource,
  DealStage
} from "@/lib/types";
import { downloadCSV } from "./csv-utils";
import { getContactFullName } from "./contact-utils";

// Format date to YYYY-MM-DD
export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toISOString().split("T")[0];
  } catch {
    return date;
  }
}

// Format currency as number (without $ symbol)
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return String(amount);
}

// Format boolean as Yes/No
export function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value ? "Yes" : "No";
}

// Generate filename with timestamp
export function generateExportFilename(
  entityType: string,
  includeTimestamp: boolean = true
): string {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "-");
  const timeStr = date
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-")
    .slice(0, 5);

  if (includeTimestamp) {
    return `${entityType}_${dateStr}_${timeStr}.csv`;
  }
  return `${entityType}_${dateStr}.csv`;
}

// Escape CSV field (handles commas, quotes, newlines)
export function escapeCSVField(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Format lifecycle stage for export
export function formatLifecycleStage(stage: LifecycleStage | null | undefined): string {
  if (!stage) return "";
  const labels: Record<LifecycleStage, string> = {
    lead: "Lead",
    marketing_qualified: "Marketing Qualified",
    sales_qualified: "Sales Qualified",
    opportunity: "Opportunity",
    customer: "Customer",
    evangelist: "Evangelist",
    other: "Other"
  };
  return labels[stage] || stage;
}

// Format lead source for export
export function formatLeadSource(source: LeadSource | null | undefined): string {
  if (!source) return "";
  const labels: Record<LeadSource, string> = {
    website: "Website",
    referral: "Referral",
    social_media: "Social Media",
    cold_outreach: "Cold Outreach",
    event: "Event",
    partner: "Partner",
    other: "Other"
  };
  return labels[source] || source;
}

// Format deal stage for export
export function formatDealStage(stage: DealStage | null | undefined): string {
  if (!stage) return "";
  const labels: Record<DealStage, string> = {
    lead: "Lead",
    qualified: "Qualified",
    proposal: "Proposal",
    negotiation: "Negotiation",
    closed_won: "Closed Won",
    closed_lost: "Closed Lost"
  };
  return labels[stage] || stage;
}

// Format activity type for export
export function formatActivityType(type: string | null | undefined): string {
  if (!type) return "";
  const labels: Record<string, string> = {
    note: "Note",
    call: "Call",
    email: "Email",
    meeting: "Meeting",
    task_completed: "Task Completed",
    other: "Other"
  };
  return labels[type] || type;
}

// Format activity outcome for export
export function formatActivityOutcome(outcome: string | null | undefined): string {
  if (!outcome) return "";
  const labels: Record<string, string> = {
    successful: "Successful",
    no_answer: "No Answer",
    follow_up_needed: "Follow Up Needed",
    not_interested: "Not Interested"
  };
  return labels[outcome] || outcome;
}

// Convert data array to CSV string
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  fields: Array<{ key: keyof T | string; label: string; formatter?: (value: any) => string }>
): string {
  if (data.length === 0) {
    return fields.map((f) => f.label).join(",") + "\n";
  }

  // Headers
  const headers = fields.map((f) => escapeCSVField(f.label));
  const rows: string[] = [headers.join(",")];

  // Data rows
  for (const item of data) {
    const row: string[] = [];
    for (const field of fields) {
      let value: any;
      
      // Handle nested properties (e.g., "companies.name")
      if (typeof field.key === "string" && field.key.includes(".")) {
        const keys = field.key.split(".");
        value = keys.reduce((obj: any, key) => obj?.[key], item);
      } else {
        value = item[field.key];
      }

      // Apply formatter if provided
      if (field.formatter) {
        value = field.formatter(value);
      } else {
        // Default formatting
        if (value === null || value === undefined) {
          value = "";
        } else if (typeof value === "boolean") {
          value = formatBoolean(value);
        } else if (typeof value === "object" && value !== null) {
          // Handle nested objects (try to get name/title)
          value = value.name || value.title || value.email || JSON.stringify(value);
        }
      }

      row.push(escapeCSVField(value));
    }
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

// Export contacts to CSV
export function exportContactsToCSV(
  contacts: (Contact & { companies?: { name: string } | null; tags?: Array<{ name: string }> })[],
  selectedFields: string[]
): string {
  const allFields = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "name", label: "Full Name", formatter: (contact: Contact) => getContactFullName(contact) },
    { key: "email", label: "Email" },
    { key: "phone_number", label: "Phone Number" },
    { key: "companies.name", label: "Company Name" },
    { key: "company", label: "Company" },
    { key: "job_title", label: "Job Title" },
    { key: "company_website", label: "Company Website" },
    { key: "company_headcount", label: "Company Headcount" },
    { key: "linkedin_url", label: "LinkedIn URL" },
    {
      key: "lifecycle_stage",
      label: "Lifecycle Stage",
      formatter: formatLifecycleStage
    },
    {
      key: "lead_source",
      label: "Lead Source",
      formatter: formatLeadSource
    },
    { key: "last_contact_date", label: "Last Contact Date", formatter: formatDate },
    { key: "notes", label: "Notes" },
    { key: "owner", label: "Owner" },
    {
      key: "tags",
      label: "Tags",
      formatter: (tags: Array<{ name: string }> | undefined) => {
        if (!tags || tags.length === 0) return "";
        return tags.map((t) => t.name).join("; ");
      }
    },
    { key: "created_at", label: "Created At", formatter: formatDate }
  ];

  const fieldsToExport = allFields.filter((f) => selectedFields.includes(f.key as string));
  return convertToCSV(contacts, fieldsToExport);
}

// Export companies to CSV
export function exportCompaniesToCSV(
  companies: (Company & { tags?: Array<{ name: string }> })[],
  selectedFields: string[]
): string {
  const allFields = [
    { key: "name", label: "Name" },
    { key: "website", label: "Website" },
    { key: "industry", label: "Industry" },
    { key: "employee_count", label: "Employee Count" },
    { key: "phone_number", label: "Phone Number" },
    { key: "linkedin_url", label: "LinkedIn URL" },
    { key: "annual_revenue", label: "Annual Revenue", formatter: formatCurrency },
    { key: "company_size", label: "Company Size" },
    {
      key: "lifecycle_stage",
      label: "Lifecycle Stage",
      formatter: formatLifecycleStage
    },
    {
      key: "lead_source",
      label: "Lead Source",
      formatter: formatLeadSource
    },
    { key: "last_contact_date", label: "Last Contact Date", formatter: formatDate },
    { key: "notes", label: "Notes" },
    { key: "owner", label: "Owner" },
    {
      key: "tags",
      label: "Tags",
      formatter: (tags: Array<{ name: string }> | undefined) => {
        if (!tags || tags.length === 0) return "";
        return tags.map((t) => t.name).join("; ");
      }
    },
    { key: "created_at", label: "Created At", formatter: formatDate }
  ];

  const fieldsToExport = allFields.filter((f) => selectedFields.includes(f.key as string));
  return convertToCSV(companies, fieldsToExport);
}

// Export deals to CSV
export function exportDealsToCSV(
  deals: (Deal & {
    contacts?: Contact | null;
    companies?: { name: string } | null;
  })[],
  selectedFields: string[]
): string {
  const allFields = [
    { key: "title", label: "Title" },
    { key: "contacts.first_name", label: "Contact First Name" },
    { key: "contacts.last_name", label: "Contact Last Name" },
    { key: "contacts.name", label: "Contact Full Name", formatter: (deal: Deal & { contacts?: Contact | null }) => deal.contacts ? getContactFullName(deal.contacts) : "" },
    { key: "companies.name", label: "Company Name" },
    { key: "amount", label: "Amount", formatter: formatCurrency },
    {
      key: "stage",
      label: "Stage",
      formatter: formatDealStage
    },
    { key: "probability", label: "Probability (%)" },
    { key: "expected_close_date", label: "Expected Close Date", formatter: formatDate },
    { key: "actual_close_date", label: "Actual Close Date", formatter: formatDate },
    { key: "description", label: "Description" },
    { key: "owner", label: "Owner" },
    { key: "created_at", label: "Created At", formatter: formatDate }
  ];

  const fieldsToExport = allFields.filter((f) => selectedFields.includes(f.key as string));
  return convertToCSV(deals, fieldsToExport);
}

// Export tasks to CSV
export function exportTasksToCSV(
  tasks: (Task & {
    contacts?: Contact | null;
    companies?: { name: string } | null;
    deals?: { title: string } | null;
  })[],
  selectedFields: string[]
): string {
  const allFields = [
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    { key: "due_date", label: "Due Date", formatter: formatDate },
    { key: "completed", label: "Completed", formatter: formatBoolean },
    { key: "completed_at", label: "Completed At", formatter: formatDate },
    { key: "priority", label: "Priority" },
    { key: "contacts.first_name", label: "Contact First Name" },
    { key: "contacts.last_name", label: "Contact Last Name" },
    { key: "contacts.name", label: "Contact Full Name", formatter: (task: Task & { contacts?: Contact | null }) => task.contacts ? getContactFullName(task.contacts) : "" },
    { key: "companies.name", label: "Company Name" },
    { key: "deals.title", label: "Deal Title" },
    { key: "owner", label: "Owner" },
    { key: "created_at", label: "Created At", formatter: formatDate }
  ];

  const fieldsToExport = allFields.filter((f) => selectedFields.includes(f.key as string));
  return convertToCSV(tasks, fieldsToExport);
}

// Export activities to CSV
export function exportActivitiesToCSV(
  activities: (Activity & {
    contacts?: Contact | null;
    companies?: { name: string } | null;
    deals?: { title: string } | null;
  })[],
  selectedFields: string[]
): string {
  const allFields = [
    { key: "type", label: "Type", formatter: formatActivityType },
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    { key: "activity_date", label: "Activity Date", formatter: formatDate },
    { key: "duration_minutes", label: "Duration (Minutes)" },
    {
      key: "outcome",
      label: "Outcome",
      formatter: formatActivityOutcome
    },
    { key: "contacts.first_name", label: "Contact First Name" },
    { key: "contacts.last_name", label: "Contact Last Name" },
    { key: "contacts.name", label: "Contact Full Name", formatter: (activity: Activity & { contacts?: Contact | null }) => activity.contacts ? getContactFullName(activity.contacts) : "" },
    { key: "companies.name", label: "Company Name" },
    { key: "deals.title", label: "Deal Title" },
    { key: "owner", label: "Owner" },
    { key: "created_at", label: "Created At", formatter: formatDate }
  ];

  const fieldsToExport = allFields.filter((f) => selectedFields.includes(f.key as string));
  return convertToCSV(activities, fieldsToExport);
}

// Download CSV with metadata
export function downloadCSVWithMetadata(
  csvContent: string,
  filename: string,
  recordCount: number,
  exportedBy?: string
) {
  const exportDate = new Date().toISOString();
  const metadataRow = `# Exported on: ${exportDate}\n# Records: ${recordCount}\n${exportedBy ? `# Exported by: ${exportedBy}\n` : ""}#\n`;
  const finalContent = metadataRow + csvContent;
  downloadCSV(finalContent, filename);
}



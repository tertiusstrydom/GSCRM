// CSV Import Utilities

export type CSVRow = Record<string, string>;

export type ContactField =
  | "first_name"
  | "last_name"
  | "name" // Legacy support - will be split into first_name/last_name
  | "email"
  | "phone_number"
  | "company"
  | "job_title"
  | "company_website"
  | "company_headcount"
  | "country"
  | "state"
  | "linkedin_url"
  | "lifecycle_stage"
  | "lead_source"
  | "notes"
  | "owner";

export type CompanyField =
  | "name"
  | "website"
  | "industry"
  | "employee_count"
  | "phone_number"
  | "linkedin_url"
  | "annual_revenue"
  | "company_size"
  | "country"
  | "state"
  | "lifecycle_stage"
  | "lead_source"
  | "notes"
  | "owner";

export const CONTACT_FIELDS: {
  field: ContactField;
  label: string;
  required: boolean;
  description?: string;
}[] = [
  { field: "first_name", label: "First Name", required: true },
  { field: "last_name", label: "Last Name", required: false },
  { field: "name", label: "Name (Legacy - will be split)", required: false },
  { field: "email", label: "Email", required: false },
  { field: "phone_number", label: "Phone Number", required: false },
  { field: "company", label: "Company", required: false },
  { field: "job_title", label: "Job Title", required: false },
  { field: "company_website", label: "Company Website", required: false },
  { field: "company_headcount", label: "Company Headcount", required: false },
  { field: "country", label: "Country", required: false },
  { field: "state", label: "State/Province", required: false },
  { field: "linkedin_url", label: "LinkedIn URL", required: false },
  {
    field: "lifecycle_stage",
    label: "Lifecycle Stage",
    required: false,
    description: "lead, marketing_qualified, sales_qualified, opportunity, customer, evangelist, other"
  },
  {
    field: "lead_source",
    label: "Lead Source",
    required: false,
    description: "website, referral, social_media, cold_outreach, event, partner, other"
  },
  { field: "notes", label: "Notes", required: false },
  { field: "owner", label: "Owner", required: false }
];

export const COMPANY_FIELDS: {
  field: CompanyField;
  label: string;
  required: boolean;
  description?: string;
}[] = [
  { field: "name", label: "Name", required: true },
  { field: "website", label: "Website", required: false },
  { field: "industry", label: "Industry", required: false },
  { field: "employee_count", label: "Employee Count", required: false },
  { field: "phone_number", label: "Phone Number", required: false },
  { field: "linkedin_url", label: "LinkedIn URL", required: false },
  { field: "annual_revenue", label: "Annual Revenue", required: false },
  { field: "company_size", label: "Company Size", required: false },
  { field: "country", label: "Country", required: false },
  { field: "state", label: "State/Province", required: false },
  {
    field: "lifecycle_stage",
    label: "Lifecycle Stage",
    required: false,
    description: "lead, marketing_qualified, sales_qualified, opportunity, customer, evangelist, other"
  },
  {
    field: "lead_source",
    label: "Lead Source",
    required: false,
    description: "website, referral, social_media, cold_outreach, event, partner, other"
  },
  { field: "notes", label: "Notes", required: false },
  { field: "owner", label: "Owner", required: false }
];

// Auto-detect field mapping from CSV headers
export function autoMapFields(
  csvHeaders: string[],
  availableFields: Array<{ field: string; label: string }>
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();

  csvHeaders.forEach((header) => {
    const normalizedHeader = header.trim().toLowerCase().replace(/[\s_-]/g, "");

    // Try exact match first
    for (const field of availableFields) {
      const normalizedField = field.field.toLowerCase().replace(/[\s_-]/g, "");
      const normalizedLabel = field.label.toLowerCase().replace(/[\s_-]/g, "");

      if (
        !usedFields.has(field.field) &&
        (normalizedHeader === normalizedField ||
          normalizedHeader === normalizedLabel ||
          normalizedHeader.includes(normalizedField) ||
          normalizedField.includes(normalizedHeader))
      ) {
        mapping[header] = field.field;
        usedFields.add(field.field);
        return;
      }
    }

    // Common aliases - case-insensitive matching
    const aliases: Record<string, string> = {
      email: "email",
      emailaddress: "email",
      phone: "phone_number",
      phonenumber: "phone_number",
      phone_number: "phone_number",
      mobile: "phone_number",
      firstname: "first_name",
      first_name: "first_name",
      first: "first_name",
      fname: "first_name",
      lastname: "last_name",
      last_name: "last_name",
      last: "last_name",
      lname: "last_name",
      name: "name", // Legacy support
      fullname: "name", // Legacy support
      companyname: "company",
      company_name: "company",
      company: "company",
      jobtitle: "job_title",
      job_title: "job_title",
      title: "job_title",
      position: "job_title",
      companywebsite: "company_website",
      company_website: "company_website",
      website: "company_website",
      url: "company_website",
      companyurl: "company_website",
      company_headcount: "company_headcount",
      headcount: "company_headcount",
      employees: "company_headcount",
      companysize: "company_headcount",
      company_size: "company_headcount",
      numofemployees: "company_headcount",
      employee_count: "company_headcount",
      country: "country",
      state: "state",
      province: "state",
      region: "state",
      linkedin: "linkedin_url",
      linkedinurl: "linkedin_url",
      linkedin_url: "linkedin_url",
      industry: "industry",
      revenue: "annual_revenue",
      annualrevenue: "annual_revenue",
      annual_revenue: "annual_revenue",
      size: "company_size",
      companysize_company: "company_size"
    };

    if (aliases[normalizedHeader]) {
      const field = aliases[normalizedHeader];
      if (!usedFields.has(field)) {
        mapping[header] = field;
        usedFields.add(field);
      }
    }
  });

  return mapping;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// Validate URL format
export function isValidUrl(url: string): boolean {
  if (!url) return true; // Optional field
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Generate sample CSV content
export function generateSampleCSV(
  fields: Array<{ field: string; label: string; description?: string }>,
  rows: number = 3
): string {
  const headers = fields.map((f) => f.label);
  const csvRows: string[] = [headers.join(",")];

  for (let i = 0; i < rows; i++) {
    const row: string[] = [];
    fields.forEach((field) => {
      switch (field.field) {
        case "name":
          row.push(`Sample ${field.label} ${i + 1}`);
          break;
        case "email":
          row.push(`contact${i + 1}@example.com`);
          break;
        case "phone_number":
          row.push(`+1-555-000-${String(i + 1).padStart(4, "0")}`);
          break;
        case "company":
          row.push(`Example Company ${i + 1}`);
          break;
        case "website":
          row.push(`https://company${i + 1}.example.com`);
          break;
        case "linkedin_url":
          row.push(`https://linkedin.com/company/example-${i + 1}`);
          break;
        case "industry":
          row.push(i === 0 ? "Technology" : i === 1 ? "Healthcare" : "Finance");
          break;
        case "employee_count":
          row.push(String((i + 1) * 50));
          break;
        case "annual_revenue":
          row.push(String((i + 1) * 1000000));
          break;
        case "company_size":
          row.push(String((i + 1) * 100));
          break;
        case "lifecycle_stage":
          row.push(i === 0 ? "lead" : i === 1 ? "qualified" : "customer");
          break;
        case "lead_source":
          row.push(i === 0 ? "website" : i === 1 ? "referral" : "event");
          break;
        case "notes":
          row.push(`Sample notes for row ${i + 1}`);
          break;
        case "owner":
          row.push(`Owner ${i + 1}`);
          break;
        default:
          row.push("");
      }
    });
    csvRows.push(row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","));
  }

  return csvRows.join("\n");
}

// Download CSV file
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


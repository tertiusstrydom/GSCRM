import { createSupabaseClient } from "./supabase";
import type { Contact, Company } from "./types";

// Normalize strings for comparison
export function normalizeEmail(email: string | null): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export function normalizeName(name: string | null): string {
  if (!name) return "";
  return name.trim().toLowerCase();
}

export function normalizeWebsite(website: string | null): string {
  if (!website) return "";
  // Remove protocol, www, trailing slash, and convert to lowercase
  return website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export function normalizePhone(phone: string | null): string {
  if (!phone) return "";
  // Remove spaces, dashes, parentheses, and other formatting
  return phone.replace(/[\s\-\(\)\.]/g, "").trim();
}

// Common company name suffixes to ignore for fuzzy matching
const COMPANY_SUFFIXES = [
  "inc",
  "llc",
  "corp",
  "corporation",
  "ltd",
  "limited",
  "co",
  "company",
  "group",
  "holdings",
  "solutions",
  "systems",
  "services",
  "technologies",
  "tech"
];

export function normalizeCompanyName(name: string): string {
  const normalized = normalizeName(name);
  // Remove common suffixes
  for (const suffix of COMPANY_SUFFIXES) {
    const regex = new RegExp(`\\s+${suffix}\\.?$`, "i");
    if (regex.test(normalized)) {
      return normalized.replace(regex, "").trim();
    }
  }
  return normalized;
}

// Calculate Levenshtein distance (simple string similarity)
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

// Calculate similarity score (0-1, where 1 is identical)
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeCompanyName(str1);
  const normalized2 = normalizeCompanyName(str2);
  
  if (normalized1 === normalized2) return 1.0;
  
  const maxLen = Math.max(normalized1.length, normalized2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - distance / maxLen;
}

// Check if two names are similar (above threshold)
export function isSimilarName(name1: string, name2: string, threshold: number = 0.8): boolean {
  return calculateSimilarity(name1, name2) >= threshold;
}

// Find duplicate contacts by email
export async function findDuplicateContactsByEmail(
  email: string,
  excludeId?: string
): Promise<Contact[]> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("is_merged", false)
    .ilike("email", normalizedEmail);

  if (error) {
    console.error("Error finding duplicate contacts:", error);
    return [];
  }

  // Filter exact matches and exclude current record
  return (data || []).filter(
    (contact) => normalizeEmail(contact.email) === normalizedEmail && contact.id !== excludeId
  );
}

// Find duplicate companies by name
export async function findDuplicateCompaniesByName(
  name: string,
  excludeId?: string
): Promise<Company[]> {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_merged", false)
    .ilike("name", normalizedName);

  if (error) {
    console.error("Error finding duplicate companies:", error);
    return [];
  }

  // Filter exact matches and exclude current record
  return (data || []).filter(
    (company) => normalizeName(company.name) === normalizedName && company.id !== excludeId
  );
}

// Find duplicate companies by website
export async function findDuplicateCompaniesByWebsite(
  website: string,
  excludeId?: string
): Promise<Company[]> {
  const normalizedWebsite = normalizeWebsite(website);
  if (!normalizedWebsite) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_merged", false)
    .not("website", "is", null);

  if (error) {
    console.error("Error finding duplicate companies by website:", error);
    return [];
  }

  // Filter by normalized website and exclude current record
  return (data || []).filter(
    (company) =>
      normalizeWebsite(company.website) === normalizedWebsite && company.id !== excludeId
  );
}

// Find similar companies (fuzzy match)
export async function findSimilarCompanies(
  name: string,
  threshold: number = 0.8,
  excludeId?: string
): Promise<Array<{ company: Company; similarity: number }>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_merged", false);

  if (error) {
    console.error("Error finding similar companies:", error);
    return [];
  }

  const results: Array<{ company: Company; similarity: number }> = [];

  for (const company of data || []) {
    if (company.id === excludeId) continue;
    
    const similarity = calculateSimilarity(name, company.name);
    if (similarity >= threshold) {
      results.push({ company, similarity });
    }
  }

  // Sort by similarity (highest first)
  return results.sort((a, b) => b.similarity - a.similarity);
}

// Group contacts by email for duplicate detection
export async function groupDuplicateContacts(): Promise<Map<string, Contact[]>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("is_merged", false)
    .not("email", "is", null);

  if (error) {
    console.error("Error grouping duplicate contacts:", error);
    return new Map();
  }

  const groups = new Map<string, Contact[]>();

  for (const contact of data || []) {
    if (!contact.email) continue;
    const normalizedEmail = normalizeEmail(contact.email);
    if (!groups.has(normalizedEmail)) {
      groups.set(normalizedEmail, []);
    }
    groups.get(normalizedEmail)!.push(contact);
  }

  // Filter to only groups with duplicates
  const duplicateGroups = new Map<string, Contact[]>();
  for (const [email, contacts] of groups.entries()) {
    if (contacts.length > 1) {
      duplicateGroups.set(email, contacts);
    }
  }

  return duplicateGroups;
}

// Group companies by name for duplicate detection
export async function groupDuplicateCompanies(): Promise<Map<string, Company[]>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_merged", false);

  if (error) {
    console.error("Error grouping duplicate companies:", error);
    return new Map();
  }

  const groups = new Map<string, Company[]>();

  for (const company of data || []) {
    const normalizedName = normalizeName(company.name);
    if (!groups.has(normalizedName)) {
      groups.set(normalizedName, []);
    }
    groups.get(normalizedName)!.push(company);
  }

  // Filter to only groups with duplicates
  const duplicateGroups = new Map<string, Company[]>();
  for (const [name, companies] of groups.entries()) {
    if (companies.length > 1) {
      duplicateGroups.set(name, companies);
    }
  }

  return duplicateGroups;
}

// Find fuzzy matches for companies
export async function findFuzzyCompanyMatches(
  threshold: number = 0.8
): Promise<Array<{ companies: Company[]; similarity: number }>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_merged", false)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error finding fuzzy company matches:", error);
    return [];
  }

  const matches: Array<{ companies: Company[]; similarity: number }> = [];
  const processed = new Set<string>();

  for (let i = 0; i < (data || []).length; i++) {
    const company1 = data![i];
    if (processed.has(company1.id)) continue;

    const similar: Company[] = [company1];
    let maxSimilarity = 1.0;

    for (let j = i + 1; j < (data || []).length; j++) {
      const company2 = data![j];
      if (processed.has(company2.id)) continue;

      const similarity = calculateSimilarity(company1.name, company2.name);
      if (similarity >= threshold) {
        similar.push(company2);
        maxSimilarity = Math.max(maxSimilarity, similarity);
        processed.add(company2.id);
      }
    }

    if (similar.length > 1) {
      matches.push({ companies: similar, similarity: maxSimilarity });
      processed.add(company1.id);
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

import type { Contact } from "./types";

/**
 * Get the full name of a contact from first_name and last_name
 * @param contact - Contact object with first_name and last_name
 * @returns Full name string, e.g., "John Doe" or "John" if no last name
 */
export function getContactFullName(contact: Contact | { first_name: string; last_name?: string | null }): string {
  const firstName = contact.first_name?.trim() || "";
  const lastName = contact.last_name?.trim() || "";
  
  if (!firstName && !lastName) {
    return "Unnamed Contact";
  }
  
  if (!lastName) {
    return firstName;
  }
  
  return `${firstName} ${lastName}`.trim();
}

/**
 * Get the display name for sorting (Last, First format)
 * @param contact - Contact object with first_name and last_name
 * @returns Display name for sorting, e.g., "Doe, John" or "John" if no last name
 */
export function getContactDisplayName(contact: Contact | { first_name: string; last_name?: string | null }): string {
  const firstName = contact.first_name?.trim() || "";
  const lastName = contact.last_name?.trim() || "";
  
  if (!firstName && !lastName) {
    return "Unnamed Contact";
  }
  
  if (!lastName) {
    return firstName;
  }
  
  return `${lastName}, ${firstName}`;
}

/**
 * Split a full name into first_name and last_name
 * @param fullName - Full name string, e.g., "John Doe"
 * @returns Object with first_name and last_name
 */
export function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { first_name: "", last_name: "" };
  }
  
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }
  
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" ")
  };
}


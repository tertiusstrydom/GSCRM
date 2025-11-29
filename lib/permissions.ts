import { createSupabaseClient } from "./supabase";

export type Role = "admin" | "editor" | "contributor" | "viewer";

export async function getUserRole(): Promise<Role> {
  const supabase = createSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return "viewer";

  const role = user.user_metadata?.role || "viewer";
  return role as Role;
}

export function canView(role: Role): boolean {
  return ["admin", "editor", "contributor", "viewer"].includes(role);
}

export function canCreate(role: Role): boolean {
  return ["admin", "editor", "contributor"].includes(role);
}

export function canEdit(role: Role): boolean {
  return ["admin", "editor"].includes(role);
}

export function canDelete(role: Role): boolean {
  return role === "admin";
}

export function canManageUsers(role: Role): boolean {
  return role === "admin";
}


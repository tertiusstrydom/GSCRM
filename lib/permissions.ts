import { createSupabaseClient } from "./supabase";

export type Role = "admin" | "editor" | "contributor" | "viewer";

export async function getUserRole(): Promise<Role> {
  try {
    const supabase = createSupabaseClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();
    
    if (error || !user) return "viewer";

    // Check user_metadata first (newer format)
    const role = user.user_metadata?.role || user.user_metadata?.raw_user_meta_data?.role || "viewer";
    return role as Role;
  } catch (error) {
    console.error("Error getting user role:", error);
    return "viewer";
  }
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



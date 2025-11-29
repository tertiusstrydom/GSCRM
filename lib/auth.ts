import { createSupabaseClient } from "./supabase";

export async function getCurrentUser() {
  const supabase = createSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  return { user, error };
}

export async function signOut() {
  const supabase = createSupabaseClient();
  await supabase.auth.signOut();
}


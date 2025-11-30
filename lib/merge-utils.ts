import { createSupabaseClient } from "./supabase";
import type { Contact, Company } from "./types";

export async function mergeContacts(
  primaryId: string,
  duplicateId: string,
  mergedData: Partial<Contact>
): Promise<void> {
  const supabase = createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("You must be logged in");

  // Update primary contact with merged data
  const { error: updateError } = await supabase
    .from("contacts")
    .update(mergedData)
    .eq("id", primaryId);

  if (updateError) throw updateError;

  // Transfer all relationships from duplicate to primary
  // Update deals
  await supabase
    .from("deals")
    .update({ contact_id: primaryId })
    .eq("contact_id", duplicateId);

  // Update tasks
  await supabase
    .from("tasks")
    .update({ contact_id: primaryId })
    .eq("contact_id", duplicateId);

  // Update activities
  await supabase
    .from("activities")
    .update({ contact_id: primaryId })
    .eq("contact_id", duplicateId);

  // Merge tags
  const { data: duplicateTags } = await supabase
    .from("contact_tags")
    .select("tag_id")
    .eq("contact_id", duplicateId);

  if (duplicateTags) {
    const { data: primaryTags } = await supabase
      .from("contact_tags")
      .select("tag_id")
      .eq("contact_id", primaryId);

    const primaryTagIds = new Set((primaryTags || []).map(t => t.tag_id));
    
    // Add tags that don't already exist on primary
    for (const tag of duplicateTags) {
      if (!primaryTagIds.has(tag.tag_id)) {
        await supabase
          .from("contact_tags")
          .insert({ contact_id: primaryId, tag_id: tag.tag_id });
      }
    }
  }

  // Mark duplicate as merged
  await supabase
    .from("contacts")
    .update({ is_merged: true })
    .eq("id", duplicateId);

  // Create merge record
  await supabase.from("merged_records").insert({
    primary_record_id: primaryId,
    merged_record_id: duplicateId,
    entity_type: "contact",
    merged_by: user.id,
    merge_metadata: { merged_data: mergedData }
  });

  // Create activity log for merge
  await supabase.from("activities").insert({
    type: "note",
    title: "Contact Merged",
    description: `Merged with duplicate contact: ${mergedData.name || "Unknown"}`,
    activity_date: new Date().toISOString(),
    contact_id: primaryId,
    created_by: user.email || user.id
  });
}

export async function mergeCompanies(
  primaryId: string,
  duplicateId: string,
  mergedData: Partial<Company>
): Promise<void> {
  const supabase = createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("You must be logged in");

  // Update primary company with merged data
  const { error: updateError } = await supabase
    .from("companies")
    .update(mergedData)
    .eq("id", primaryId);

  if (updateError) throw updateError;

  // Transfer all contacts from duplicate to primary
  await supabase
    .from("contacts")
    .update({ company_id: primaryId })
    .eq("company_id", duplicateId);

  // Update deals (deals may reference companies indirectly through contacts)
  // Note: If you have a company_id field on deals, update that too

  // Update activities
  await supabase
    .from("activities")
    .update({ company_id: primaryId })
    .eq("company_id", duplicateId);

  // Merge tags
  const { data: duplicateTags } = await supabase
    .from("company_tags")
    .select("tag_id")
    .eq("company_id", duplicateId);

  if (duplicateTags) {
    const { data: primaryTags } = await supabase
      .from("company_tags")
      .select("tag_id")
      .eq("company_id", primaryId);

    const primaryTagIds = new Set((primaryTags || []).map(t => t.tag_id));
    
    // Add tags that don't already exist on primary
    for (const tag of duplicateTags) {
      if (!primaryTagIds.has(tag.tag_id)) {
        await supabase
          .from("company_tags")
          .insert({ company_id: primaryId, tag_id: tag.tag_id });
      }
    }
  }

  // Mark duplicate as merged
  await supabase
    .from("companies")
    .update({ is_merged: true })
    .eq("id", duplicateId);

  // Create merge record
  await supabase.from("merged_records").insert({
    primary_record_id: primaryId,
    merged_record_id: duplicateId,
    entity_type: "company",
    merged_by: user.id,
    merge_metadata: { merged_data: mergedData }
  });

  // Create activity log for merge
  await supabase.from("activities").insert({
    type: "note",
    title: "Company Merged",
    description: `Merged with duplicate company: ${mergedData.name || "Unknown"}`,
    activity_date: new Date().toISOString(),
    company_id: primaryId,
    created_by: user.email || user.id
  });
}

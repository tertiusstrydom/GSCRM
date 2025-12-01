export type Tag = {
  id: string;
  name: string;
  color: string;
  created_at: string | null;
  user_id: string;
};

export type LifecycleStage =
  | "lead"
  | "marketing_qualified"
  | "sales_qualified"
  | "opportunity"
  | "customer"
  | "evangelist"
  | "other";

export type LeadSource =
  | "website"
  | "referral"
  | "social_media"
  | "cold_outreach"
  | "event"
  | "partner"
  | "other";

export type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  notes: string | null;
  created_at: string | null;
  linkedin_url: string | null;
  phone_number: string | null;
  annual_revenue: number | null;
  company_size: number | null;
  lifecycle_stage: LifecycleStage | null;
  lead_source: LeadSource | null;
  last_contact_date: string | null;
  owner: string | null;
  country: string | null;
  state: string | null;
  user_id: string;
  is_merged?: boolean;
};

export type Contact = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_number: string | null;
  company: string | null;
  company_id: string | null;
  job_title: string | null;
  company_website: string | null;
  company_headcount: number | null;
  country: string | null;
  state: string | null;
  notes: string | null;
  created_at: string | null;
  linkedin_url: string | null;
  lifecycle_stage: LifecycleStage | null;
  lead_source: LeadSource | null;
  last_contact_date: string | null;
  owner: string | null;
  user_id: string;
  is_merged?: boolean;
  // Computed property helper (not stored in DB)
  name?: string; // For backward compatibility, computed as first_name + last_name
};

export type MergedRecord = {
  id: string;
  primary_record_id: string;
  merged_record_id: string;
  entity_type: "contact" | "company";
  merged_at: string;
  merged_by: string | null;
  merge_metadata: Record<string, any> | null;
};

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export type Deal = {
  id: string;
  contact_id: string;
  title: string;
  amount: number | null;
  stage: DealStage;
  close_date: string | null;
  notes: string | null;
  created_at: string | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  contact_id: string | null;
  created_at: string | null;
};

export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "task_completed"
  | "other";

export type ActivityOutcome =
  | "successful"
  | "no_answer"
  | "follow_up_needed"
  | "not_interested"
  | null;

export type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  activity_date: string;
  duration_minutes: number | null;
  outcome: ActivityOutcome;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  created_by: string;
  created_at: string;
  user_id: string | null;
};

export type WebhookEventType =
  | "created"
  | "updated"
  | "deleted"
  | "stage_changed"
  | "tag_added"
  | "tag_removed"
  | "status_changed"
  | "field_changed";

export type WebhookEntityType = "contact" | "company" | "deal" | "task" | "activity";

export type Webhook = {
  id: string;
  name: string;
  url: string;
  event_type: WebhookEventType;
  entity_type: WebhookEntityType;
  active: boolean;
  conditions: any;
  headers: Record<string, string> | null;
  created_at: string;
  last_triggered_at: string | null;
  trigger_count: number;
  consecutive_failures: number;
  user_id: string;
};

export type WebhookLog = {
  id: string;
  webhook_id: string;
  triggered_at: string;
  status: "success" | "failed";
  status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  payload: any;
  user_id: string;
};




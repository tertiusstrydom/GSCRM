"use client";

import { useState, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { ActivityType, ActivityOutcome, Contact, Company, Deal } from "@/lib/types";
import { triggerWebhooks } from "@/lib/webhook-service";

type ActivityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialContactId?: string | null;
  initialCompanyId?: string | null;
  initialDealId?: string | null;
  initialType?: ActivityType;
  activityId?: string; // For editing
};

export function ActivityModal({
  isOpen,
  onClose,
  onSuccess,
  initialContactId,
  initialCompanyId,
  initialDealId,
  initialType,
  activityId
}: ActivityModalProps) {
  const [type, setType] = useState<ActivityType>(initialType || "note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [durationMinutes, setDurationMinutes] = useState("");
  const [outcome, setOutcome] = useState<ActivityOutcome>(null);
  const [contactId, setContactId] = useState(initialContactId || "");
  const [companyId, setCompanyId] = useState(initialCompanyId || "");
  const [dealId, setDealId] = useState(initialDealId || "");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseClient();

  useEffect(() => {
    if (isOpen) {
      // Load contacts, companies, and deals for dropdowns
      const loadData = async () => {
        setLoading(true);
        const [contactsRes, companiesRes, dealsRes] = await Promise.all([
          supabase.from("contacts").select("*").order("name"),
          supabase.from("companies").select("*").order("name"),
          supabase.from("deals").select("*").order("created_at", { ascending: false })
        ]);
        if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
        if (companiesRes.data) setCompanies(companiesRes.data as Company[]);
        if (dealsRes.data) setDeals(dealsRes.data as Deal[]);
        setLoading(false);
      };
      void loadData();

      // Load activity if editing
      if (activityId) {
        void loadActivity(activityId);
      } else {
        // Reset form for new activity
        setType(initialType || "note");
        setTitle("");
        setDescription("");
        setActivityDate(() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const hours = String(now.getHours()).padStart(2, "0");
          const minutes = String(now.getMinutes()).padStart(2, "0");
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        });
        setDurationMinutes("");
        setOutcome(null);
        setContactId(initialContactId || "");
        setCompanyId(initialCompanyId || "");
        setDealId(initialDealId || "");
      }
    }
  }, [isOpen, activityId, initialType, initialContactId, initialCompanyId, initialDealId]);

  const loadActivity = async (id: string) => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("activities")
      .select("*")
      .eq("id", id)
      .single();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (data) {
      setType(data.type);
      setTitle(data.title);
      setDescription(data.description || "");
      const date = new Date(data.activity_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setActivityDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      setDurationMinutes(data.duration_minutes?.toString() || "");
      setOutcome(data.outcome);
      setContactId(data.contact_id || "");
      setCompanyId(data.company_id || "");
      setDealId(data.deal_id || "");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in");
      }

      const activityData = {
        type,
        title: title.trim(),
        description: description.trim() || null,
        activity_date: new Date(activityDate).toISOString(),
        duration_minutes:
          (type === "call" || type === "meeting") && durationMinutes
            ? parseInt(durationMinutes, 10)
            : null,
        outcome: (type === "call" || type === "email") ? outcome : null,
        contact_id: contactId || null,
        company_id: companyId || null,
        deal_id: dealId || null,
        created_by: user.email || "",
        user_id: user.id
      };

      if (activityId) {
        // Get previous data for update webhook
        const { data: oldData } = await supabase
          .from("activities")
          .select("*")
          .eq("id", activityId)
          .single();
        
        const { error: err } = await supabase
          .from("activities")
          .update(activityData)
          .eq("id", activityId);
        if (err) throw err;
        
        // Trigger webhook for update (non-blocking)
        try {
          const updatedActivity = { ...oldData, ...activityData };
          await triggerWebhooks(
            "updated",
            "activity",
            activityId,
            updatedActivity,
            oldData
          );
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      } else {
        const { data, error: err } = await supabase
          .from("activities")
          .insert(activityData)
          .select()
          .single();
        if (err) throw err;
        
        // Trigger webhook for create (non-blocking)
        if (data) {
          try {
            await triggerWebhooks("created", "activity", data.id, data);
          } catch (webhookError) {
            console.error("Webhook error:", webhookError);
          }
        }
      }

      // Update last_contact_date for contact or company if this is a call, email, or meeting
      if ((type === "call" || type === "email" || type === "meeting") && contactId) {
        const contactDate = new Date(activityDate).toISOString().split("T")[0];
        await supabase
          .from("contacts")
          .update({ last_contact_date: contactDate })
          .eq("id", contactId);
      }
      if ((type === "call" || type === "email" || type === "meeting") && companyId) {
        const contactDate = new Date(activityDate).toISOString().split("T")[0];
        await supabase
          .from("companies")
          .update({ last_contact_date: contactDate })
          .eq("id", companyId);
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to save activity");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const showDuration = type === "call" || type === "meeting";
  const showOutcome = type === "call" || type === "email";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {activityId ? "Edit Activity" : "Log Activity"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Activity Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="task_completed">Task Completed</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                placeholder="Brief summary of the activity"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {showDuration && (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="30"
                />
              </div>
            )}

            {showOutcome && (
              <div>
                <label className="block text-xs font-medium text-slate-700">Outcome</label>
                <select
                  value={outcome || ""}
                  onChange={(e) =>
                    setOutcome(
                      e.target.value ? (e.target.value as ActivityOutcome) : null
                    )
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">No outcome</option>
                  <option value="successful">Successful</option>
                  <option value="no_answer">No Answer</option>
                  <option value="follow_up_needed">Follow Up Needed</option>
                  <option value="not_interested">Not Interested</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                placeholder="Full details of the activity..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Contact</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">None</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Company</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">None</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Deal</label>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">None</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-60"
              >
                {submitting ? "Saving..." : activityId ? "Save Changes" : "Log Activity"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

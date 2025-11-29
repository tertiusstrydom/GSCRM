"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Deal, DealStage } from "@/lib/types";

const STAGES: { id: DealStage; label: string }[] = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed won" },
  { id: "closed_lost", label: "Closed lost" }
];

type FormState = {
  id?: string;
  title: string;
  amount: string;
  stage: DealStage;
  contact_id: string;
  close_date: string;
  notes: string;
};

export default function DealsPage() {
  const supabase = createSupabaseClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: "",
    amount: "",
    stage: "lead",
    contact_id: "",
    close_date: "",
    notes: ""
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dealsByStage = useMemo(() => {
    const result: Record<DealStage, Deal[]> = {
      lead: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      closed_won: [],
      closed_lost: []
    };
    for (const deal of deals) {
      result[deal.stage].push(deal);
    }
    return result;
  }, [deals]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [dealsRes, contactsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("contacts").select("*").order("name")
    ]);
    if (dealsRes.error) setError(dealsRes.error.message);
    else setDeals((dealsRes.data ?? []) as Deal[]);
    if (contactsRes.error) {
      setError((prev) => prev ?? contactsRes.error.message);
    } else {
      setContacts((contactsRes.data ?? []) as Contact[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const resetForm = () =>
    setForm({
      id: undefined,
      title: "",
      amount: "",
      stage: "lead",
      contact_id: "",
      close_date: "",
      notes: ""
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert("Title is required");
      return;
    }
    const amountNumber = form.amount ? Number(form.amount) : 0;
    if (Number.isNaN(amountNumber) || amountNumber < 0) {
      alert("Amount must be a non-negative number");
      return;
    }
    if (!form.contact_id) {
      alert("Please select a contact");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("deals")
          .update({
            title: form.title.trim(),
            amount: amountNumber,
            stage: form.stage,
            contact_id: form.contact_id,
            close_date: form.close_date || null,
            notes: form.notes || null
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deals").insert({
          title: form.title.trim(),
          amount: amountNumber,
          stage: form.stage,
          contact_id: form.contact_id,
          close_date: form.close_date || null,
          notes: form.notes || null
        });
        if (error) throw error;
      }
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message ?? "Failed to save deal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (deal: Deal) => {
    setForm({
      id: deal.id,
      title: deal.title,
      amount: deal.amount?.toString() ?? "",
      stage: deal.stage,
      contact_id: deal.contact_id,
      close_date: deal.close_date ?? "",
      notes: deal.notes ?? ""
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this deal?")) return;
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      await loadData();
    }
  };

  const handleDrop = async (stage: DealStage) => {
    if (!draggingId) return;
    const updated = deals.find((d) => d.id === draggingId);
    if (!updated || updated.stage === stage) {
      setDraggingId(null);
      return;
    }
    setDeals((prev) =>
      prev.map((d) => (d.id === draggingId ? { ...d, stage } : d))
    );
    setDraggingId(null);
    const { error } = await supabase
      .from("deals")
      .update({ stage })
      .eq("id", updated.id);
    if (error) {
      alert(error.message);
      await loadData();
    }
  };

  const contactName = (contactId: string) =>
    contacts.find((c) => c.id === contactId)?.name ?? "Unknown contact";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track deals across stages with a simple Kanban board.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-[3fr,1.4fr]">
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-2">
            {STAGES.map((stage) => (
              <div
                key={stage.id}
                className="flex w-60 flex-shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void handleDrop(stage.id)}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {stage.label}
                  </p>
                  <span className="text-xs text-slate-500">
                    {dealsByStage[stage.id].length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {loading ? (
                    <p className="px-2 py-1 text-xs text-slate-500">
                      Loading…
                    </p>
                  ) : dealsByStage[stage.id].length === 0 ? (
                    <p className="px-2 py-1 text-xs text-slate-400">
                      No deals
                    </p>
                  ) : (
                    dealsByStage[stage.id].map((deal) => (
                      <article
                        key={deal.id}
                        draggable
                        onDragStart={() => setDraggingId(deal.id)}
                        className="cursor-move rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
                      >
                        <p className="font-semibold text-slate-900">
                          {deal.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          ${Number(deal.amount ?? 0).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {contactName(deal.contact_id)}
                        </p>
                        <div className="mt-1 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(deal)}
                            className="text-[11px] font-medium text-slate-700 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(deal.id)}
                            className="text-[11px] font-medium text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {form.id ? "Edit deal" : "Add new deal"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Amount *
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Stage *
                </label>
                <select
                  value={form.stage}
                  onChange={(e) =>
                    setForm({ ...form, stage: e.target.value as DealStage })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Contact *
              </label>
              <select
                value={form.contact_id}
                onChange={(e) =>
                  setForm({ ...form, contact_id: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="">Select a contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` – ${c.company}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Close date
                </label>
                <input
                  type="date"
                  value={form.close_date}
                  onChange={(e) =>
                    setForm({ ...form, close_date: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting
                  ? form.id
                    ? "Saving…"
                    : "Creating…"
                  : form.id
                  ? "Save changes"
                  : "Create deal"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}




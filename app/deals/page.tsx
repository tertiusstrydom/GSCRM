"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Deal, DealStage, Activity, Company } from "@/lib/types";
import { ActivityModal } from "@/components/ActivityModal";
import { KanbanBoard } from "@/components/KanbanBoard";
import { DealsAnalytics } from "@/components/DealsAnalytics";
import { DealsFilters } from "@/components/DealsFilters";

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

type ViewMode = "kanban" | "list";

export default function DealsPage() {
  const supabase = createSupabaseClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [selectedDealForActivity, setSelectedDealForActivity] = useState<Deal | null>(null);
  const [dealActivities, setDealActivities] = useState<Record<string, number>>({});

  // Filters and sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [filterContact, setFilterContact] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<DealStage | "all">("all");
  const [sortBy, setSortBy] = useState<"amount" | "close_date" | "updated">("amount");

  const [form, setForm] = useState<FormState>({
    title: "",
    amount: "",
    stage: "lead",
    contact_id: "",
    close_date: "",
    notes: ""
  });

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem("dealsViewMode") as ViewMode | null;
    if (savedView === "kanban" || savedView === "list") {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference to localStorage
  useEffect(() => {
    localStorage.setItem("dealsViewMode", viewMode);
  }, [viewMode]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [dealsRes, contactsRes, companiesRes, activitiesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("contacts").select("*").order("name"),
      supabase.from("companies").select("*").order("name"),
      supabase
        .from("activities")
        .select("deal_id")
        .not("deal_id", "is", null)
    ]);
    if (dealsRes.error) setError(dealsRes.error.message);
    else setDeals((dealsRes.data ?? []) as Deal[]);
    if (contactsRes.error) {
      setError((prev) => prev ?? contactsRes.error.message);
    } else {
      setContacts((contactsRes.data ?? []) as Contact[]);
    }
    if (companiesRes.error) {
      setError((prev) => prev ?? companiesRes.error.message);
    } else {
      setCompanies((companiesRes.data ?? []) as Company[]);
    }
    
    // Count activities per deal
    if (!activitiesRes.error && activitiesRes.data) {
      const counts: Record<string, number> = {};
      (activitiesRes.data as { deal_id: string }[]).forEach((a) => {
        if (a.deal_id) {
          counts[a.deal_id] = (counts[a.deal_id] || 0) + 1;
        }
      });
      setDealActivities(counts);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Filter and sort deals
  const filteredAndSortedDeals = useMemo(() => {
    let filtered = [...deals];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((deal) =>
        deal.title.toLowerCase().includes(query)
      );
    }

    // Filter by contact
    if (filterContact !== "all") {
      filtered = filtered.filter((deal) => deal.contact_id === filterContact);
    }

    // Filter by stage
    if (filterStage !== "all") {
      filtered = filtered.filter((deal) => deal.stage === filterStage);
    }

    // Sort deals
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "amount":
          return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        case "close_date":
          if (!a.close_date && !b.close_date) return 0;
          if (!a.close_date) return 1;
          if (!b.close_date) return -1;
          return new Date(a.close_date).getTime() - new Date(b.close_date).getTime();
        case "updated":
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        default:
          return 0;
      }
    });

    return filtered;
  }, [deals, searchQuery, filterContact, filterStage, sortBy]);

  const dealsByStage = useMemo(() => {
    const result: Record<DealStage, Deal[]> = {
      lead: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      closed_won: [],
      closed_lost: []
    };
    for (const deal of filteredAndSortedDeals) {
      result[deal.stage].push(deal);
    }
    return result;
  }, [filteredAndSortedDeals]);

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
    const supabase = createSupabaseClient();
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in");
      }

      if (form.id) {
        const { error } = await supabase
          .from("deals")
          .update({
            title: form.title.trim(),
            amount: amountNumber,
            stage: form.stage,
            contact_id: form.contact_id,
            close_date: form.close_date || null,
            notes: form.notes || null,
            user_id: user.id
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
          notes: form.notes || null,
          user_id: user.id
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
    // Scroll to form
    document.getElementById("deal-form")?.scrollIntoView({ behavior: "smooth" });
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

  const handleStageChange = async (dealId: string, newStage: DealStage) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;

    const oldStage = deal.stage;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
    );

    try {
      const { error } = await supabase
        .from("deals")
        .update({ stage: newStage })
        .eq("id", dealId);
      
      if (error) throw error;

      // Auto-create activity when deal stage changes
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activities").insert({
          type: "note",
          title: `Deal stage changed: ${deal.title}`,
          description: `Stage changed from "${oldStage}" to "${newStage}"`,
          activity_date: new Date().toISOString(),
          contact_id: deal.contact_id,
          deal_id: deal.id,
          created_by: user.email || "",
          user_id: user.id
        });
      }
    } catch (err: any) {
      // Revert on error
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: oldStage } : d))
      );
      alert(err.message || "Failed to update deal stage");
    }
  };

  const handleAddDeal = (stage: DealStage) => {
    setForm({
      id: undefined,
      title: "",
      amount: "",
      stage: stage,
      contact_id: "",
      close_date: "",
      notes: ""
    });
    document.getElementById("deal-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const contactName = (contactId: string) =>
    contacts.find((c) => c.id === contactId)?.name ?? "Unknown contact";

  const clearFilters = () => {
    setSearchQuery("");
    setFilterContact("all");
    setFilterStage("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your sales pipeline with a visual Kanban board.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-primary text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              List
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleAddDeal("lead")}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
          >
            + Add Deal
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Analytics */}
      <DealsAnalytics deals={deals} loading={loading} />

      {/* Filters */}
      <DealsFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterContact={filterContact}
        setFilterContact={setFilterContact}
        filterStage={filterStage}
        setFilterStage={setFilterStage}
        sortBy={sortBy}
        setSortBy={setSortBy}
        contacts={contacts}
        onClear={clearFilters}
      />

      {/* Main Content */}
      {viewMode === "kanban" ? (
        <div className="h-[calc(100vh-500px)] min-h-[600px]">
          <KanbanBoard
            deals={filteredAndSortedDeals}
            contacts={contacts}
            dealActivities={dealActivities}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onLogActivity={(deal) => {
              setSelectedDealForActivity(deal);
              setIsActivityModalOpen(true);
            }}
            onAddDeal={handleAddDeal}
            onStageChange={handleStageChange}
            draggingId={draggingId}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
          />
        </div>
      ) : (
        /* List View */
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Close Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Loading deals...
                  </td>
                </tr>
              ) : filteredAndSortedDeals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    No deals found.
                  </td>
                </tr>
              ) : (
                filteredAndSortedDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {deal.title}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {contactName(deal.contact_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {STAGES.find((s) => s.id === deal.stage)?.label || deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      ${Number(deal.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {deal.close_date
                        ? new Date(deal.close_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDealForActivity(deal);
                            setIsActivityModalOpen(true);
                          }}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Log
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(deal)}
                          className="text-xs font-medium text-slate-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(deal.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Deal Form */}
      <div id="deal-form" className="rounded-lg border border-slate-200 bg-white p-4">
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
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-60"
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

      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => {
          setIsActivityModalOpen(false);
          setSelectedDealForActivity(null);
        }}
        onSuccess={async () => {
          setIsActivityModalOpen(false);
          setSelectedDealForActivity(null);
          await loadData();
        }}
        initialDealId={selectedDealForActivity?.id || null}
        initialContactId={selectedDealForActivity?.contact_id || null}
        initialType="note"
      />
    </div>
  );
}

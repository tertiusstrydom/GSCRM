"use client";

import { useEffect, useState, useMemo } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Activity, ActivityType, ActivityOutcome, Contact, Company, Deal } from "@/lib/types";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ActivityModal } from "@/components/ActivityModal";
import Link from "next/link";

export default function ActivitiesPage() {
  const supabase = createSupabaseClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ActivityType | "all">("all");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [filterContact, setFilterContact] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterDeal, setFilterDeal] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [myActivitiesOnly, setMyActivitiesOnly] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setCurrentUserEmail(user?.email || null);
    };
    void loadUser();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        activitiesRes,
        contactsRes,
        companiesRes,
        dealsRes
      ] = await Promise.all([
        supabase
          .from("activities")
          .select("*")
          .order("activity_date", { ascending: false }),
        supabase.from("contacts").select("*").order("name"),
        supabase.from("companies").select("*").order("name"),
        supabase.from("deals").select("*").order("created_at", { ascending: false })
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (dealsRes.error) throw dealsRes.error;

      setActivities((activitiesRes.data ?? []) as Activity[]);
      setContacts((contactsRes.data ?? []) as Contact[]);
      setCompanies((companiesRes.data ?? []) as Company[]);
      setDeals((dealsRes.data ?? []) as Deal[]);
    } catch (err: any) {
      setError(err.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredActivities = useMemo(() => {
    let filtered = [...activities];

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((a) => a.type === filterType);
    }

    // Filter by outcome
    if (filterOutcome !== "all") {
      filtered = filtered.filter((a) => a.outcome === filterOutcome);
    }

    // Filter by contact
    if (filterContact !== "all") {
      filtered = filtered.filter((a) => a.contact_id === filterContact);
    }

    // Filter by company
    if (filterCompany !== "all") {
      filtered = filtered.filter((a) => a.company_id === filterCompany);
    }

    // Filter by deal
    if (filterDeal !== "all") {
      filtered = filtered.filter((a) => a.deal_id === filterDeal);
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((a) => new Date(a.activity_date) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter((a) => new Date(a.activity_date) <= toDate);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query) ||
          a.created_by.toLowerCase().includes(query)
      );
    }

    // Filter by my activities only
    if (myActivitiesOnly && currentUserEmail) {
      filtered = filtered.filter((a) => a.created_by === currentUserEmail);
    }

    return filtered;
  }, [
    activities,
    filterType,
    filterOutcome,
    filterContact,
    filterCompany,
    filterDeal,
    dateFrom,
    dateTo,
    searchQuery,
    myActivitiesOnly,
    currentUserEmail
  ]);

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this activity?")) return;
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      await loadData();
    }
  };

  const handleExport = () => {
    const csv = [
      ["Title", "Type", "Date", "Duration (min)", "Outcome", "Contact", "Company", "Deal", "Created By", "Description"].join(","),
      ...filteredActivities.map((a) => {
        const contact = contacts.find((c) => c.id === a.contact_id);
        const company = companies.find((c) => c.id === a.company_id);
        const deal = deals.find((d) => d.id === a.deal_id);
        const date = new Date(a.activity_date).toLocaleString();
        const description = (a.description || "").replace(/"/g, '""');
        return [
          `"${a.title.replace(/"/g, '""')}"`,
          a.type,
          `"${date}"`,
          a.duration_minutes || "",
          a.outcome || "",
          contact?.name || "",
          company?.name || "",
          deal?.title || "",
          a.created_by,
          `"${description}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activities-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilterType("all");
    setFilterOutcome("all");
    setFilterContact("all");
    setFilterCompany("all");
    setFilterDeal("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    setMyActivitiesOnly(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track all customer interactions and activities across your CRM.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredActivities.length === 0}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingActivity(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
          >
            + Log Activity
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Clear All
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, description..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ActivityType | "all")}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Types</option>
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="task_completed">Task Completed</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Outcome</label>
            <select
              value={filterOutcome}
              onChange={(e) =>
                setFilterOutcome(e.target.value)
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Outcomes</option>
              <option value="successful">Successful</option>
              <option value="no_answer">No Answer</option>
              <option value="follow_up_needed">Follow Up Needed</option>
              <option value="not_interested">Not Interested</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Contact</label>
            <select
              value={filterContact}
              onChange={(e) => setFilterContact(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Contacts</option>
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
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Companies</option>
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
              value={filterDeal}
              onChange={(e) => setFilterDeal(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Deals</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={myActivitiesOnly}
              onChange={(e) => setMyActivitiesOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-xs font-medium text-slate-700">My Activities Only</span>
          </label>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading..."
              : `${filteredActivities.length} activit${filteredActivities.length === 1 ? "y" : "ies"} found`}
          </p>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading activities...</p>
        ) : filteredActivities.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">No activities found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <div
                key={activity.id}
                className="group relative rounded-lg border border-slate-200 bg-white"
              >
                <ActivityTimeline activities={[activity]} showEntityLinks={true} />
                <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleEdit(activity)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(activity.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingActivity(null);
        }}
        onSuccess={loadData}
        activityId={editingActivity || undefined}
      />
    </div>
  );
}

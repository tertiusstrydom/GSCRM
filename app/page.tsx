"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Deal, Task } from "@/lib/types";

type ActivityItem =
  | { type: "contact"; item: Contact }
  | { type: "deal"; item: Deal }
  | { type: "task"; item: Task };

export default function DashboardPage() {
  const [totalContacts, setTotalContacts] = useState<number | null>(null);
  const [totalCompanies, setTotalCompanies] = useState<number | null>(null);
  const [totalDealValue, setTotalDealValue] = useState<number | null>(null);
  const [openTasksCount, setOpenTasksCount] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseClient();
      setLoading(true);
      setError(null);
      try {
        const [contactsCountRes, companiesCountRes, dealsRes, openTasksRes] = await Promise.all([
          supabase.from("contacts").select("id", { count: "exact", head: true }),
          supabase.from("companies").select("id", { count: "exact", head: true }),
          supabase.from("deals").select("amount, created_at").order("created_at", {
            ascending: false
          }),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("completed", false)
        ]);

        if (contactsCountRes.error) {
          console.error("Contacts error:", contactsCountRes.error);
          throw contactsCountRes.error;
        }
        if (companiesCountRes.error) {
          console.error("Companies error:", companiesCountRes.error);
          throw companiesCountRes.error;
        }
        if (dealsRes.error) {
          console.error("Deals error:", dealsRes.error);
          throw dealsRes.error;
        }
        if (openTasksRes.error) {
          console.error("Tasks error:", openTasksRes.error);
          throw openTasksRes.error;
        }

        setTotalContacts(contactsCountRes.count ?? 0);
        setTotalCompanies(companiesCountRes.count ?? 0);

        const totalValue =
          dealsRes.data?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) ??
          0;
        setTotalDealValue(totalValue);

        setOpenTasksCount(openTasksRes.count ?? 0);

        const [contactsRecentRes, dealsRecentRes, tasksRecentRes] =
          await Promise.all([
            supabase
              .from("contacts")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("deals")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("tasks")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(5)
          ]);

        if (contactsRecentRes.error) throw contactsRecentRes.error;
        if (dealsRecentRes.error) throw dealsRecentRes.error;
        if (tasksRecentRes.error) throw tasksRecentRes.error;

        const activities: ActivityItem[] = [
          ...(contactsRecentRes.data ?? []).map((c) => ({
            type: "contact" as const,
            item: c as Contact
          })),
          ...(dealsRecentRes.data ?? []).map((d) => ({
            type: "deal" as const,
            item: d as Deal
          })),
          ...(tasksRecentRes.data ?? []).map((t) => ({
            type: "task" as const,
            item: t as Task
          }))
        ].sort((a, b) => {
          const dateA = new Date(
            (a.type === "task"
              ? a.item.created_at
              : a.type === "deal"
              ? a.item.created_at
              : a.item.created_at) ?? ""
          ).getTime();
          const dateB = new Date(
            (b.type === "task"
              ? b.item.created_at
              : b.type === "deal"
              ? b.item.created_at
              : b.item.created_at) ?? ""
          ).getTime();
          return dateB - dateA;
        });

        setRecentActivity(activities.slice(0, 10));
      } catch (err: any) {
        setError(err.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          High-level overview of your CRM data.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Contacts"
          value={totalContacts?.toLocaleString() ?? "—"}
          loading={loading}
        />
        <StatCard
          label="Total Companies"
          value={totalCompanies?.toLocaleString() ?? "—"}
          loading={loading}
        />
        <StatCard
          label="Total Deal Value"
          value={
            totalDealValue !== null
              ? `$${totalDealValue.toLocaleString()}`
              : "—"
          }
          loading={loading}
        />
        <StatCard
          label="Open Tasks"
          value={openTasksCount?.toLocaleString() ?? "—"}
          loading={loading}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {recentActivity.length === 0 && !loading ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No recent activity yet. Start by adding contacts, deals, or tasks.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {loading && recentActivity.length === 0 ? (
                <li className="px-4 py-6 text-sm text-slate-500">
                  Loading activity...
                </li>
              ) : (
                recentActivity.map((activity, idx) => (
                  <li key={idx} className="px-4 py-3 text-sm">
                    <ActivityRow activity={activity} />
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">
        {loading ? <span className="text-slate-400">Loading…</span> : value}
      </p>
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  if (activity.type === "contact") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900">
            New contact: {activity.item.name}
          </p>
          <p className="text-xs text-slate-500">
            {activity.item.company || "No company specified"}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          Contact
        </span>
      </div>
    );
  }

  if (activity.type === "deal") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900">
            Deal: {activity.item.title}
          </p>
          <p className="text-xs text-slate-500">
            Stage: {activity.item.stage} · $
            {Number(activity.item.amount ?? 0).toLocaleString()}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
          Deal
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-slate-900">
          Task: {activity.item.title}
        </p>
        <p className="text-xs text-slate-500">
          Due {activity.item.due_date || "unscheduled"}
        </p>
      </div>
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
        Task
      </span>
    </div>
  );
}




"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Activity } from "@/lib/types";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ActivityModal } from "@/components/ActivityModal";

export default function DashboardPage() {
  const [totalContacts, setTotalContacts] = useState<number | null>(null);
  const [totalCompanies, setTotalCompanies] = useState<number | null>(null);
  const [totalDealValue, setTotalDealValue] = useState<number | null>(null);
  const [openTasksCount, setOpenTasksCount] = useState<number | null>(null);
  const [activitiesThisWeek, setActivitiesThisWeek] = useState<number | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    const supabase = createSupabaseClient();
    setLoading(true);
    setError(null);
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoISO = weekAgo.toISOString();

      const [
        contactsCountRes,
        companiesCountRes,
        dealsRes,
        openTasksRes,
        activitiesWeekRes,
        activitiesRecentRes
      ] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("amount, created_at").order("created_at", {
          ascending: false
        }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("completed", false),
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .gte("activity_date", weekAgoISO),
        supabase
          .from("activities")
          .select("*")
          .order("activity_date", { ascending: false })
          .limit(10)
      ]);

      if (contactsCountRes.error) throw contactsCountRes.error;
      if (companiesCountRes.error) throw companiesCountRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (openTasksRes.error) throw openTasksRes.error;
      if (activitiesWeekRes.error) throw activitiesWeekRes.error;
      if (activitiesRecentRes.error) throw activitiesRecentRes.error;

      setTotalContacts(contactsCountRes.count ?? 0);
      setTotalCompanies(companiesCountRes.count ?? 0);

      const totalValue =
        dealsRes.data?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) ?? 0;
      setTotalDealValue(totalValue);

      setOpenTasksCount(openTasksRes.count ?? 0);
      setActivitiesThisWeek(activitiesWeekRes.count ?? 0);
      setRecentActivities((activitiesRecentRes.data ?? []) as Activity[]);
    } catch (err: any) {
      setError(err.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <StatCard
          label="Activities This Week"
          value={activitiesThisWeek?.toLocaleString() ?? "—"}
          loading={loading}
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent Activities
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-hover"
            >
              + Log Activity
            </button>
            <Link
              href="/activities"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              View All
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
          {loading && recentActivities.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading activities...</p>
          ) : recentActivities.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No recent activities yet. Start by logging your first activity.
            </p>
          ) : (
            <ActivityTimeline activities={recentActivities} showEntityLinks={true} />
          )}
        </div>
      </section>

      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
      />
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





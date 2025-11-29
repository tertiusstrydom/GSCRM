"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Deal, Task } from "@/lib/types";

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const supabase = createSupabaseClient();
      try {
        const [contactRes, dealsRes, tasksRes] = await Promise.all([
          supabase.from("contacts").select("*, companies(name)").eq("id", id).maybeSingle(),
          supabase
            .from("deals")
            .select("*")
            .eq("contact_id", id)
            .order("created_at", { ascending: false }),
          supabase
            .from("tasks")
            .select("*")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
        ]);
        if (contactRes.error) throw contactRes.error;
        if (dealsRes.error) throw dealsRes.error;
        if (tasksRes.error) throw tasksRes.error;
        setContact(contactRes.data as Contact | null);
        setDeals((dealsRes.data ?? []) as Deal[]);
        setTasks((tasksRes.data ?? []) as Task[]);
      } catch (err: any) {
        setError(err.message ?? "Failed to load contact");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            <Link href="/contacts" className="hover:underline">
              Contacts
            </Link>{" "}
            / Details
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {contact?.name || "Contact"}
          </h1>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading contact…</p>
      ) : !contact ? (
        <p className="text-sm text-slate-500">Contact not found.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[3fr,2fr]">
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Contact info
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Email</dt>
                <dd className="mt-1 text-slate-800">
                  {contact.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Phone</dt>
                <dd className="mt-1 text-slate-800">
                  {contact.phone || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Company</dt>
                <dd className="mt-1 text-slate-800">
                  {(contact as any)?.companies?.name || contact.company || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Created
                </dt>
                <dd className="mt-1 text-slate-800">
                  {contact.created_at
                    ? new Date(contact.created_at).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
            <div>
              <dt className="text-xs font-medium text-slate-500">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-800">
                {contact.notes || "—"}
              </dd>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Deals</h2>
              {deals.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  No deals for this contact.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {deals.map((deal) => (
                    <li
                      key={deal.id}
                      className="rounded-md border border-slate-200 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {deal.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        Stage: {deal.stage} · $
                        {Number(deal.amount ?? 0).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tasks</h2>
              {tasks.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  No tasks linked to this contact.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {task.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {task.due_date
                            ? `Due ${task.due_date}`
                            : "No due date"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          task.completed
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {task.completed ? "Completed" : "Open"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}




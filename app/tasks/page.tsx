"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Task } from "@/lib/types";

type Filter = "all" | "open" | "completed";

type FormState = {
  id?: string;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
  contact_id: string;
};

export default function TasksPage() {
  const supabase = createSupabaseClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    due_date: "",
    completed: false,
    contact_id: ""
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [tasksRes, contactsRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("contacts").select("*").order("name")
    ]);
    if (tasksRes.error) setError(tasksRes.error.message);
    else setTasks((tasksRes.data ?? []) as Task[]);
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

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "open") return tasks.filter((t) => !t.completed);
    return tasks.filter((t) => t.completed);
  }, [tasks, filter]);

  const resetForm = () =>
    setForm({
      id: undefined,
      title: "",
      description: "",
      due_date: "",
      completed: false,
      contact_id: ""
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert("Title is required");
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

      if (form.id) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: form.title.trim(),
            description: form.description || null,
            due_date: form.due_date || null,
            completed: form.completed,
            contact_id: form.contact_id || null
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({
          title: form.title.trim(),
          description: form.description || null,
          due_date: form.due_date || null,
          completed: form.completed,
          contact_id: form.contact_id || null,
          user_id: user.id
        });
        if (error) throw error;
      }
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message ?? "Failed to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCompleted = async (task: Task) => {
    const next = !task.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t))
    );
    const { error } = await supabase
      .from("tasks")
      .update({ completed: next })
      .eq("id", task.id);
    if (error) {
      alert(error.message);
      await loadData();
    }
  };

  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      due_date: task.due_date ?? "",
      completed: task.completed,
      contact_id: task.contact_id ?? ""
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      await loadData();
    }
  };

  const contactName = (contactId: string | null) =>
    contacts.find((c) => c.id === contactId)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-slate-600">
            Stay on top of follow-ups and to-dos.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-[3fr,1.5fr]">
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilter("open")}
                className={`rounded-full px-3 py-1 ${
                  filter === "open"
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setFilter("completed")}
                className={`rounded-full px-3 py-1 ${
                  filter === "completed"
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Completed
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full px-3 py-1 ${
                  filter === "all"
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="mt-2 divide-y divide-slate-200">
            {loading ? (
              <p className="py-3 text-sm text-slate-500">Loading tasks…</p>
            ) : filteredTasks.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">No tasks found.</p>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex flex-1 gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => void handleToggleCompleted(task)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          task.completed
                            ? "text-slate-500 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {task.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>
                          Due: {task.due_date || "No due date"}
                        </span>
                        <span>·</span>
                        <span>Contact: {contactName(task.contact_id)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(task)}
                      className="text-xs font-medium text-slate-700 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(task.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {form.id ? "Edit task" : "Add new task"}
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
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Due date
                </label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="completed"
                  type="checkbox"
                  checked={form.completed}
                  onChange={(e) =>
                    setForm({ ...form, completed: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label
                  htmlFor="completed"
                  className="text-xs font-medium text-slate-700"
                >
                  Mark as completed
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Linked contact
              </label>
              <select
                value={form.contact_id}
                onChange={(e) =>
                  setForm({ ...form, contact_id: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="">No contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` – ${c.company}` : ""}
                  </option>
                ))}
              </select>
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
                  : "Create task"}
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




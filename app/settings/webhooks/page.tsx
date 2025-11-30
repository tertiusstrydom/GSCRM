"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Webhook, WebhookLog } from "@/lib/types";
import { WebhookFormModal } from "@/components/WebhookFormModal";
import { testWebhook } from "@/lib/webhook-service";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [viewingLogsWebhookId, setViewingLogsWebhookId] = useState<string | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  useEffect(() => {
    if (viewingLogsWebhookId) {
      loadLogs(viewingLogsWebhookId);
    }
  }, [viewingLogsWebhookId]);

  const loadWebhooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in");
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from("webhooks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (err) throw err;
      setWebhooks((data || []) as Webhook[]);
    } catch (err: any) {
      setError(err.message || "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (webhookId: string) => {
    try {
      const supabase = createSupabaseClient();
      const { data, error: err } = await supabase
        .from("webhook_logs")
        .select("*")
        .eq("webhook_id", webhookId)
        .order("triggered_at", { ascending: false })
        .limit(20);

      if (err) throw err;
      setLogs((data || []) as WebhookLog[]);
    } catch (err: any) {
      console.error("Failed to load logs:", err);
    }
  };

  const handleToggleActive = async (webhook: Webhook) => {
    try {
      const supabase = createSupabaseClient();
      const { error: err } = await supabase
        .from("webhooks")
        .update({ active: !webhook.active })
        .eq("id", webhook.id);

      if (err) throw err;
      await loadWebhooks();
    } catch (err: any) {
      alert(`Failed to update webhook: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      const supabase = createSupabaseClient();
      const { error: err } = await supabase.from("webhooks").delete().eq("id", id);
      if (err) throw err;
      await loadWebhooks();
    } catch (err: any) {
      alert(`Failed to delete webhook: ${err.message}`);
    }
  };

  const handleTest = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    try {
      const result = await testWebhook(webhookId);
      if (result.success) {
        alert(`✅ Test successful! Response code: ${result.statusCode || "N/A"}`);
      } else {
        alert(`❌ Test failed: ${result.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`❌ Test error: ${err.message}`);
    } finally {
      setTestingWebhookId(null);
    }
  };

  const formatEventName = (entityType: string, eventType: string) => {
    const entityLabels: Record<string, string> = {
      contact: "Contact",
      company: "Company",
      deal: "Deal",
      task: "Task",
      activity: "Activity"
    };

    const eventLabels: Record<string, string> = {
      created: "Created",
      updated: "Updated",
      deleted: "Deleted",
      stage_changed: "Stage Changed",
      tag_added: "Tag Added",
      tag_removed: "Tag Removed",
      status_changed: "Status Changed",
      field_changed: "Field Changed"
    };

    return `${entityLabels[entityType] || entityType} ${eventLabels[eventType] || eventType}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  const activeCount = webhooks.filter((w) => w.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure real-time notifications to external services when CRM events occur.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingWebhookId(null);
            setIsModalOpen(true);
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
        >
          Create Webhook
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-slate-500">Loading webhooks...</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                  Total Webhooks
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{webhooks.length}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-green-700">
                  Active
                </p>
                <p className="mt-1 text-2xl font-bold text-green-900">{activeCount}</p>
              </div>
            </div>
          </div>

          {/* Webhooks Table */}
          {webhooks.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
              <p className="text-slate-600">No webhooks configured yet.</p>
              <button
                onClick={() => {
                  setEditingWebhookId(null);
                  setIsModalOpen(true);
                }}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
              >
                Create Your First Webhook
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Last Triggered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Triggers
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {webhooks.map((webhook) => (
                    <tr key={webhook.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{webhook.name}</div>
                        {webhook.consecutive_failures >= 10 && (
                          <div className="text-xs text-red-600">
                            Disabled after 10 failures
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {formatEventName(webhook.entity_type, webhook.event_type)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="text-sm text-slate-600"
                          title={webhook.url}
                        >
                          {truncateUrl(webhook.url)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(webhook)}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            webhook.active
                              ? "bg-green-100 text-green-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {webhook.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatDate(webhook.last_triggered_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {webhook.trigger_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setViewingLogsWebhookId(
                                viewingLogsWebhookId === webhook.id ? null : webhook.id
                              );
                            }}
                            className="text-primary hover:text-primary-hover"
                          >
                            Logs
                          </button>
                          <button
                            onClick={() => handleTest(webhook.id)}
                            disabled={testingWebhookId === webhook.id}
                            className="text-primary hover:text-primary-hover disabled:opacity-50"
                          >
                            {testingWebhookId === webhook.id ? "Testing..." : "Test"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingWebhookId(webhook.id);
                              setIsModalOpen(true);
                            }}
                            className="text-primary hover:text-primary-hover"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(webhook.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Logs View */}
          {viewingLogsWebhookId && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Webhook Logs</h2>
                <button
                  onClick={() => setViewingLogsWebhookId(null)}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500">No logs yet</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              log.status === "success" ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <span className="text-sm font-medium text-slate-900">
                            {formatDate(log.triggered_at)}
                          </span>
                          {log.status_code && (
                            <span className="text-xs text-slate-500">
                              HTTP {log.status_code}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            log.status === "success"
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="mt-2 text-sm text-red-600">{log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <WebhookFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWebhookId(null);
        }}
        onSuccess={loadWebhooks}
        webhookId={editingWebhookId || undefined}
      />
    </div>
  );
}


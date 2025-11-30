"use client";

import { useState, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Webhook, WebhookEventType, WebhookEntityType } from "@/lib/types";
import { isValidWebhookUrl, testWebhook } from "@/lib/webhook-service";

type WebhookFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  webhookId?: string; // For editing
};

type Condition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in";
  value: string;
  logic?: "AND" | "OR";
};

export function WebhookFormModal({
  isOpen,
  onClose,
  onSuccess,
  webhookId
}: WebhookFormModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [entityType, setEntityType] = useState<WebhookEntityType>("contact");
  const [eventType, setEventType] = useState<WebhookEventType>("created");
  const [active, setActive] = useState(true);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (webhookId) {
        loadWebhook(webhookId);
      } else {
        resetForm();
      }
    }
  }, [isOpen, webhookId]);

  const loadWebhook = async (id: string) => {
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data, error: err } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", id)
      .single();

    if (err || !data) {
      setError("Failed to load webhook");
      setLoading(false);
      return;
    }

    setName(data.name);
    setUrl(data.url);
    setEntityType(data.entity_type);
    setEventType(data.event_type);
    setActive(data.active);
    setConditions(data.conditions || []);
    
    if (data.headers) {
      const headerEntries = Object.entries(data.headers);
      if (headerEntries.length > 0) {
        setHeaders(headerEntries.map(([k, v]) => ({ key: k, value: v as string })));
      } else {
        setHeaders([{ key: "", value: "" }]);
      }
    } else {
      setHeaders([{ key: "", value: "" }]);
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setName("");
    setUrl("");
    setEntityType("contact");
    setEventType("created");
    setActive(true);
    setConditions([]);
    setHeaders([{ key: "", value: "" }]);
    setError(null);
    setTestResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      setSubmitting(false);
      return;
    }

    if (!url.trim()) {
      setError("URL is required");
      setSubmitting(false);
      return;
    }

    if (!isValidWebhookUrl(url)) {
      setError("URL must be a valid HTTPS URL");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createSupabaseClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in");
        setSubmitting(false);
        return;
      }

      // Build headers object (filter empty keys)
      const headersObj: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key.trim() && h.value.trim()) {
          headersObj[h.key.trim()] = h.value.trim();
        }
      });

      // Filter empty conditions
      const validConditions = conditions.filter(
        (c) => c.field && c.operator && c.value !== undefined
      );

      const payload: any = {
        name: name.trim(),
        url: url.trim(),
        entity_type: entityType,
        event_type: eventType,
        active,
        conditions: validConditions.length > 0 ? validConditions : null,
        headers: Object.keys(headersObj).length > 0 ? headersObj : null,
        user_id: user.id
      };

      if (webhookId) {
        const { error: updateError } = await supabase
          .from("webhooks")
          .update(payload)
          .eq("id", webhookId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("webhooks")
          .insert(payload);
        if (insertError) throw insertError;
      }

      onSuccess?.();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to save webhook");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!isValidWebhookUrl(url)) {
      setError("URL must be a valid HTTPS URL");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in");
        setTesting(false);
        return;
      }

      // First save if new webhook (need ID for test)
      let testWebhookId = webhookId;
      if (!testWebhookId) {
        const headersObj: Record<string, string> = {};
        headers.forEach((h) => {
          if (h.key.trim() && h.value.trim()) {
            headersObj[h.key.trim()] = h.value.trim();
        }
        });

        const { data: newWebhook, error: createError } = await supabase
          .from("webhooks")
          .insert({
            name: name.trim() || "Test Webhook",
            url: url.trim(),
            entity_type: entityType,
            event_type: eventType,
            active: false, // Inactive until saved properly
            user_id: user.id
          })
          .select()
          .single();

        if (createError || !newWebhook) throw createError || new Error("Failed to create test webhook");
        testWebhookId = newWebhook.id;

        // Clean up test webhook after test
        setTimeout(() => {
          supabase.from("webhooks").delete().eq("id", testWebhookId);
        }, 1000);
      }

      const result = await testWebhook(testWebhookId);
      
      if (result.success) {
        setTestResult(`✅ Success! Response code: ${result.statusCode || "N/A"}`);
      } else {
        setTestResult(`❌ Failed: ${result.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setTestResult(`❌ Error: ${err.message || "Test failed"}`);
    } finally {
      setTesting(false);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "equals", value: "", logic: "AND" }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    setConditions(updated);
  };

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, key: string, value: string) => {
    const updated = [...headers];
    updated[index] = { key, value };
    setHeaders(updated);
  };

  if (!isOpen) return null;

  const entityTypeOptions = [
    { value: "contact", label: "Contact" },
    { value: "company", label: "Company" },
    { value: "deal", label: "Deal" },
    { value: "task", label: "Task" },
    { value: "activity", label: "Activity" }
  ];

  const getEventTypeOptions = () => {
    const baseEvents = [
      { value: "created", label: "Created" },
      { value: "updated", label: "Updated" },
      { value: "deleted", label: "Deleted" }
    ];

    if (entityType === "deal") {
      return [
        ...baseEvents,
        { value: "stage_changed", label: "Stage Changed" }
      ];
    }

    if (entityType === "contact" || entityType === "company") {
      return [
        ...baseEvents,
        { value: "tag_added", label: "Tag Added" },
        { value: "tag_removed", label: "Tag Removed" },
        { value: "status_changed", label: "Status Changed" },
        { value: "field_changed", label: "Field Changed" }
      ];
    }

    return baseEvents;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              {webhookId ? "Edit Webhook" : "Create Webhook"}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {testResult && (
            <div className={`mb-4 rounded-md px-3 py-2 text-sm ${
              testResult.startsWith("✅") 
                ? "bg-green-50 text-green-700" 
                : "bg-yellow-50 text-yellow-700"
            }`}>
              {testResult}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Webhook Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g., Notify n8n on new contact"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Target URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="https://your-app.com/webhook"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Must be a valid HTTPS URL
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Entity Type *
                </label>
                <select
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value as WebhookEntityType);
                    setEventType("created"); // Reset event type
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {entityTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Event Type *
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as WebhookEventType)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {getEventTypeOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Conditions (Optional)
              </label>
              <p className="mb-3 text-xs text-slate-500">
                Only trigger webhook when these conditions are met
              </p>
              {conditions.map((condition, index) => (
                <div key={index} className="mb-2 flex gap-2 items-start">
                  {index > 0 && (
                    <select
                      value={condition.logic || "AND"}
                      onChange={(e) => updateCondition(index, { logic: e.target.value as "AND" | "OR" })}
                      className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  <input
                    type="text"
                    value={condition.field}
                    onChange={(e) => updateCondition(index, { field: e.target.value })}
                    placeholder="Field name (e.g., lifecycle_stage)"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="equals">=</option>
                    <option value="not_equals">≠</option>
                    <option value="contains">contains</option>
                    <option value="greater_than">&gt;</option>
                    <option value="less_than">&lt;</option>
                    <option value="in">in</option>
                  </select>
                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCondition}
                className="text-sm text-primary hover:text-primary-hover"
              >
                + Add Condition
              </button>
            </div>

            {/* Custom Headers */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Custom Headers (Optional)
              </label>
              <p className="mb-3 text-xs text-slate-500">
                Add authentication headers or other custom headers
              </p>
              {headers.map((header, index) => (
                <div key={index} className="mb-2 flex gap-2">
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => updateHeader(index, e.target.value, header.value)}
                    placeholder="Header name (e.g., Authorization)"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    value={header.value}
                    onChange={(e) => updateHeader(index, header.key, e.target.value)}
                    placeholder="Header value"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeHeader(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addHeader}
                className="text-sm text-primary hover:text-primary-hover"
              >
                + Add Header
              </button>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <label htmlFor="active" className="text-sm text-slate-700">
                Active (enable this webhook)
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !url.trim()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Webhook"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Saving..." : webhookId ? "Update Webhook" : "Create Webhook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


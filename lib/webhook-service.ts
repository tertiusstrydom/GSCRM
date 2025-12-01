// Webhook Service for triggering webhooks and logging results

import { createSupabaseClient } from "./supabase";

export type WebhookEventType =
  | "created"
  | "updated"
  | "deleted"
  | "stage_changed"
  | "tag_added"
  | "tag_removed"
  | "status_changed"
  | "field_changed";

export type EntityType = "contact" | "company" | "deal" | "task" | "activity";

export type WebhookPayload = {
  event: string;
  timestamp: string;
  entity_type: EntityType;
  entity_id: string;
  data: any;
  previous_data?: any;
  changed_fields?: string[];
  webhook_id?: string;
  webhook_name?: string;
};

type WebhookCondition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in";
  value: any;
  logic?: "AND" | "OR";
};

// Validate webhook URL (must be HTTPS)
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Check if conditions are met
function checkConditions(
  conditions: WebhookCondition[] | null | undefined,
  data: any,
  previousData?: any
): boolean {
  if (!conditions || conditions.length === 0) return true;

  let result = true;
  let logic = "AND";

  for (const condition of conditions) {
    if (condition.logic) logic = condition.logic;

    const fieldValue = getNestedValue(data, condition.field);
    let conditionMet = false;

    switch (condition.operator) {
      case "equals":
        conditionMet = String(fieldValue) === String(condition.value);
        break;
      case "not_equals":
        conditionMet = String(fieldValue) !== String(condition.value);
        break;
      case "contains":
        conditionMet = String(fieldValue || "").toLowerCase().includes(String(condition.value || "").toLowerCase());
        break;
      case "greater_than":
        conditionMet = Number(fieldValue) > Number(condition.value);
        break;
      case "less_than":
        conditionMet = Number(fieldValue) < Number(condition.value);
        break;
      case "in":
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        conditionMet = values.includes(fieldValue);
        break;
    }

    if (logic === "AND") {
      result = result && conditionMet;
    } else {
      result = result || conditionMet;
    }
  }

  return result;
}

// Get nested value from object (e.g., "tags.name")
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

// Send webhook request with retries
async function sendWebhookRequest(
  url: string,
  payload: WebhookPayload,
  headers: Record<string, string> = {},
  retries: number = 3
): Promise<{ success: boolean; statusCode?: number; error?: string; responseBody?: string }> {
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...headers
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text().catch(() => "");

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          responseBody: responseBody || undefined
        };
      } else {
        if (attempt === retries) {
          return {
            success: false,
            statusCode: response.status,
            error: `HTTP ${response.status}: ${response.statusText}`,
            responseBody: responseBody || undefined
          };
        }
      }
    } catch (error: any) {
      if (attempt === retries) {
        return {
          success: false,
          error: error.message || "Network error",
          responseBody: undefined
        };
      }
      // Exponential backoff: wait 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

// Trigger webhooks for an event (non-blocking)
export async function triggerWebhooks(
  eventType: WebhookEventType,
  entityType: EntityType,
  entityId: string,
  data: any,
  previousData?: any,
  changedFields?: string[]
): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    // Find matching webhooks
    const { data: webhooks, error } = await supabase
      .from("webhooks")
      .select("*")
      .eq("active", true)
      .eq("entity_type", entityType)
      .eq("event_type", eventType)
      .eq("user_id", user.id);

    if (error || !webhooks || webhooks.length === 0) return;

    // Filter by conditions and trigger each webhook
    const eventName = `${entityType}.${eventType}`;
    const timestamp = new Date().toISOString();

    for (const webhook of webhooks) {
      // Check conditions
      if (webhook.conditions && !checkConditions(webhook.conditions, data, previousData)) {
        continue;
      }

      // Build payload
      const payload: WebhookPayload = {
        event: eventName,
        timestamp,
        entity_type: entityType,
        entity_id: entityId,
        data,
        previous_data: previousData,
        changed_fields: changedFields,
        webhook_id: webhook.id,
        webhook_name: webhook.name
      };

      // Send webhook (fire and forget with logging)
      sendWebhookAndLog(webhook, payload, user.id).catch((error) => {
        console.error("Webhook error:", error);
      });
    }
  } catch (error) {
    console.error("Error triggering webhooks:", error);
  }
}

// Send webhook and log result
async function sendWebhookAndLog(
  webhook: any,
  payload: WebhookPayload,
  userId: string
): Promise<void> {
  const supabase = createSupabaseClient();
  const headers = webhook.headers || {};

  const result = await sendWebhookRequest(webhook.url, payload, headers);

  // Log the result
  const logData: any = {
    webhook_id: webhook.id,
    status: result.success ? "success" : "failed",
    status_code: result.statusCode || null,
    response_body: result.responseBody || null,
    error_message: result.error || null,
    payload,
    user_id: userId
  };

  await supabase.from("webhook_logs").insert(logData);

  // Update webhook stats
  const updateData: any = {
    last_triggered_at: new Date().toISOString(),
    trigger_count: (webhook.trigger_count || 0) + 1
  };

  if (result.success) {
    updateData.consecutive_failures = 0;
  } else {
    const failures = (webhook.consecutive_failures || 0) + 1;
    updateData.consecutive_failures = failures;

    // Auto-disable after 10 consecutive failures
    if (failures >= 10) {
      updateData.active = false;
    }
  }

  await supabase.from("webhooks").update(updateData).eq("id", webhook.id);
}

// Test webhook with dummy payload
export async function testWebhook(
  webhookId: string,
  testPayload?: Partial<WebhookPayload>
): Promise<{ success: boolean; statusCode?: number; error?: string; responseBody?: string }> {
  const supabase = createSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to test webhooks");
  }

  const { data: webhook, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .single();

  if (error || !webhook) {
    throw new Error("Webhook not found");
  }

  const defaultPayload: WebhookPayload = {
    event: `${webhook.entity_type}.${webhook.event_type}`,
    timestamp: new Date().toISOString(),
    entity_type: webhook.entity_type as EntityType,
    entity_id: "test-id-" + Date.now(),
    data: {
      id: "test-id",
      name: "Test Record",
      email: "test@example.com"
    },
    webhook_id: webhook.id,
    webhook_name: webhook.name
  };

  const payload = { ...defaultPayload, ...testPayload };
  const headers = webhook.headers || {};

  return await sendWebhookRequest(webhook.url, payload, headers, 1); // Single attempt for testing
}



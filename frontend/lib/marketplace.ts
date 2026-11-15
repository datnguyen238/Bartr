export interface Profile {
  id: string;
  username: string;
  name: string;
  community: string;
  interests: string[];
  exclusions: string[];
  gap_limit: number;
  revision: number;
}
export interface Member {
  id: string;
  name: string;
  community: string;
}
export interface Analysis {
  analysis_id: string;
  status?: "estimated" | "insufficient_evidence" | "clarification_required" | "unknown";
  estimate_minor?: number | null;
  uncertainty?: string;
  uncertainty_reasons?: string[];
  attributes: {
    description: string;
    title?: string | null;
    category?: string | null;
    brand: string | null;
    model: string | null;
    clarification_needed: boolean;
    clarification_questions: string[];
  };
  range?: { low_minor: number; high_minor: number };
  reason?: string;
  comparison_basis?: "asking" | "sold" | null;
  price_basis?: "market_comparables" | "image_assisted_estimate";
  evidence?: { uri: string; title: string; price_minor: number; price_type?: string; condition?: string; match_kind?: "exact" | "similar" | "unknown" }[];
  attribution?: { search_entry_point_html?: string | null };
  generated_at: string;
  item_revision: number;
}
export interface Item {
  id: string;
  owner: string;
  revision: number;
  title: string;
  description: string;
  category: string;
  condition: string;
  image_id: string | null;
  value_minor: number | null;
  value_source: string;
  value_basis?: "market_comparables" | "image_assisted_estimate" | null;
  value_set_at: string | null;
  uncertainty: string | null;
  status: "draft" | "available" | "reserved" | "exchanged" | "removed";
  analysis: Analysis | null;
}
export interface Terms {
  left_owner: string;
  right_owner: string;
  left: Item[];
  right: Item[];
  left_total_minor: number | null;
  right_total_minor: number | null;
  gap_percent: number | null;
  value_warning: boolean;
}
export interface Offer {
  version: number;
  sender: string;
  terms: Terms;
  consents: string[];
  created_at: string;
}
export interface Trade {
  id: string;
  participants: string[];
  revision: number;
  status: string;
  offers: Offer[];
  notes: { sender: string; text: string; created_at: string }[];
  handoffs: string[];
  cancellations: string[];
  reason: string | null;
}
export interface View {
  storage: "temporary-memory" | "temporary-json" | "mongodb" | "dynamodb";
  integrations: { gemini_configured: boolean; bedrock_configured: boolean };
  profile: Profile;
  members: Member[];
  items: Item[];
  trades: Trade[];
}
export interface Recommendation {
  id: string;
  terms: Terms;
  member: Member;
  explanation: string;
}
export interface Recommendations {
  recommendations: Recommendation[];
  reason: string | null;
  retrieval: string;
  matching_item_ids?: string[];
  matching_item_revisions?: Record<string, number>;
}
export interface ApiFieldError { field: string; message: string }
export type FieldIssue = ApiFieldError;

function errorFields(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is ApiFieldError => Boolean(
    field && typeof field === "object" && typeof field.field === "string" && typeof field.message === "string",
  ));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public fields: ApiFieldError[] = [],
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Bartr-Request": "1" },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(/^items\/[^/]+\/analysis$/.test(path) ? 200000 : 120000),
    });
  } catch {
    throw new ApiError(
      "Connection interrupted. Reload to check the current saved outcome before retrying.",
      0,
    );
  }
  let value: any;
  try {
    value = await response.json();
  } catch {
    throw new ApiError("The server returned an unreadable response. Reload to check the saved outcome, then try again.", response.status);
  }
  if (!response.ok) {
    const fields = errorFields(value.fields);
    throw new ApiError(
      fields.map((field) => `${field.field}: ${field.message}`).join("; ") || value.detail || "Request failed.",
      response.status,
      value.code,
      fields,
    );
  }
  return value as T;
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "B";
const itemStatusLabels: Record<Item["status"], string> = {
  draft: "Draft",
  available: "Available",
  reserved: "Reserved",
  exchanged: "Exchanged",
  removed: "Removed",
};
export const itemStatusLabel = (status: Item["status"]) =>
  itemStatusLabels[status] ?? status;
const tradeStatusLabels: Record<string, string> = {
  open: "Open offer",
  agreed: "Agreed",
  awaiting_handoff: "Awaiting handoff",
  completed: "Completed",
  declined: "Declined",
  withdrawn: "Withdrawn",
  invalidated: "Needs review",
  cancelled: "Cancelled",
};
export const tradeStatusLabel = (status: string) =>
  tradeStatusLabels[status] ?? status.replaceAll("_", " ");

export async function upload(item: Item, file: File): Promise<Item> {
  const data = new FormData();
  data.append("file", file);
  const r = await fetch(
    `/api/items/${item.id}/image?expected_revision=${item.revision}`,
    { method: "POST", headers: { "X-Bartr-Request": "1" }, body: data },
  );
  const value = await r.json();
  if (!r.ok)
    throw new ApiError(value.detail || "Photo upload failed.", r.status, value.code, errorFields(value.fields));
  return value;
}
export const money = (v: number | null) =>
  v === null
    ? "Unknown"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(v / 100);
export const list = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

// Keep the same opaque command ID after an interrupted request. Store only a digest,
// never note text or credentials, so explicit retries cannot duplicate trade actions.
export async function command<T>(
  path: string,
  data: Record<string, unknown>,
): Promise<T> {
  const bytes = new TextEncoder().encode(JSON.stringify({ path, data }));
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const key = `bartr-command:${hash}`;
  const id = sessionStorage.getItem(key) || crypto.randomUUID();
  sessionStorage.setItem(key, id);
  try {
    const result = await api<T>(path, "POST", { ...data, command_id: id });
    sessionStorage.removeItem(key);
    return result;
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500)
      sessionStorage.removeItem(key);
    throw e;
  }
}

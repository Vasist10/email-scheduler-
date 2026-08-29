// Vite injects VITE_* env vars at build time.
// In Docker the value comes from the VITE_API_BASE_URL build arg.
// Falls back to localhost for local `npm run dev`.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// ── Shared email shape returned by all three list endpoints ──────────────────
export type ApiEmail = {
  id: string;
  to: string;
  subject: string;
  body: string;
  sendAt: string;       // scheduled send time (ISO)
  updatedAt: string;    // last state-change time (ISO) — use for sent/failed
  status: "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";
  failureReason: string | null;
  attempts: number;
  campaignId: string | null;
  jobId: string | null;
};

export const fetchScheduledEmails = async (): Promise<ApiEmail[]> => {
  const res = await fetch(`${API_BASE}/api/emails/scheduled`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch scheduled emails");
  const data = await res.json();
  return data.emails;
};

export const fetchSentEmails = async (): Promise<ApiEmail[]> => {
  const res = await fetch(`${API_BASE}/api/emails/sent`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch sent emails");
  const data = await res.json();
  return data.emails;
};

export const fetchFailedEmails = async (): Promise<ApiEmail[]> => {
  const res = await fetch(`${API_BASE}/api/emails/failed`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch failed emails");
  const data = await res.json();
  return data.emails;
};

export type SchedulePayload = {
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
};

export type ScheduleResponse = {
  message: string;
  campaignId: string;
  totalEmails: number;
  scheduledEmails: ApiEmail[];
};

export const scheduleEmails = async (
  payload: SchedulePayload
): Promise<ScheduleResponse> => {
  const res = await fetch(`${API_BASE}/api/emails/schedule`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to schedule emails"
    );
  }

  return res.json();
};

// ── Slack integration ────────────────────────────────────────────────────────

export type SlackStatus = {
  connected: boolean;
  teamName: string | null;
};

export const fetchSlackStatus = async (): Promise<SlackStatus> => {
  const res = await fetch(`${API_BASE}/auth/slack/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch Slack status");
  return res.json();
};

export const disconnectSlack = async (): Promise<void> => {
  const res = await fetch(`${API_BASE}/auth/slack/disconnect`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to disconnect Slack");
};

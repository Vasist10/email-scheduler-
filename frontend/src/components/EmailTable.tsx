import type { TabType } from "./Tabs";

export type EmailRow = {
  id: string;
  to: string;
  subject: string;
  scheduledTime: string;  // sendAt formatted
  statusTime: string;     // updatedAt formatted (for sent / failed)
  status: string;
  failureReason: string | null;
  attempts: number;
};

interface Props {
  emails: EmailRow[];
  tab: TabType;
  loading: boolean;
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED:  "bg-indigo-50  text-indigo-700  ring-indigo-200",
  PROCESSING: "bg-amber-50   text-amber-700   ring-amber-200",
  SENT:       "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED:     "bg-red-50     text-red-700     ring-red-200",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${style}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[40, 32, 24, 20, 16].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-3 bg-slate-200 rounded animate-pulse w-${w}`} />
        </td>
      ))}
    </tr>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
const EMPTY: Record<TabType, { icon: string; heading: string; sub: string }> = {
  scheduled: {
    icon: "🕐",
    heading: "No scheduled emails",
    sub: "Click \"+ Compose\" to schedule your first email.",
  },
  sent: {
    icon: "✅",
    heading: "No sent emails yet",
    sub: "Sent emails will appear here once the worker processes them.",
  },
  failed: {
    icon: "⚠️",
    heading: "No failed emails",
    sub: "Emails that exhaust all retry attempts appear here.",
  },
};

// ── Column definitions per tab ────────────────────────────────────────────────
const COLUMNS: Record<TabType, { label: string; className?: string }[]> = {
  scheduled: [
    { label: "Recipient" },
    { label: "Subject" },
    { label: "Scheduled time" },
    { label: "Status" },
  ],
  sent: [
    { label: "Recipient" },
    { label: "Subject" },
    { label: "Sent time" },
    { label: "Status" },
  ],
  failed: [
    { label: "Recipient" },
    { label: "Subject" },
    { label: "Last attempt" },
    { label: "Status" },
    { label: "Reason", className: "hidden lg:table-cell" },
  ],
};

export default function EmailTable({ emails, tab, loading }: Props) {
  const columns = COLUMNS[tab];

  return (
    <div className="overflow-x-auto rounded-b-xl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.label}
                className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide ${col.className ?? ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {/* Loading skeleton — 5 placeholder rows */}
          {loading &&
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

          {/* Empty state */}
          {!loading && emails.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <span className="text-4xl" aria-hidden="true">
                    {EMPTY[tab].icon}
                  </span>
                  <p className="font-medium text-slate-600">{EMPTY[tab].heading}</p>
                  <p className="text-sm text-center max-w-xs">{EMPTY[tab].sub}</p>
                </div>
              </td>
            </tr>
          )}

          {/* Data rows */}
          {!loading &&
            emails.map((email) => (
              <tr key={email.id} className="hover:bg-slate-50 transition-colors group">
                {/* Recipient */}
                <td className="px-4 py-3 text-slate-800 font-medium max-w-[180px] truncate">
                  {email.to}
                </td>

                {/* Subject */}
                <td className="px-4 py-3 text-slate-700 max-w-[240px] truncate">
                  {email.subject}
                </td>

                {/* Time — scheduled time for scheduled tab, updatedAt for others */}
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {tab === "scheduled" ? email.scheduledTime : email.statusTime}
                </td>

                {/* Status badge */}
                <td className="px-4 py-3">
                  <StatusBadge status={email.status} />
                </td>

                {/* Failure reason — only on failed tab */}
                {tab === "failed" && (
                  <td
                    className="px-4 py-3 text-red-600 text-xs max-w-[240px] truncate hidden lg:table-cell"
                    title={email.failureReason ?? ""}
                  >
                    {email.failureReason ?? "—"}
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

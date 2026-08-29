import { useEffect, useState, useCallback } from "react";
import ComposeModal from "../components/ComposeEmailModal";
import { ToastContainer, useToast } from "../components/Toast";
import {
  fetchScheduledEmails,
  fetchSentEmails,
  fetchFailedEmails,
  type ApiEmail,
} from "../api/emailApi";
import type { TabType } from "../layouts/AppLayout";

interface Props {
  activeTab:    TabType;
  setActiveTab: (t: TabType) => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Status pill ───────────────────────────────────────────────────────────────
const PILL: Record<string, string> = {
  SCHEDULED:  "bg-orange-100 text-orange-600",
  PROCESSING: "bg-yellow-100 text-yellow-600",
  SENT:       "bg-green-100  text-green-600",
  FAILED:     "bg-red-100    text-red-600",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${PILL[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100">
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
        <div className="h-2.5 bg-gray-100 rounded animate-pulse w-2/3" />
      </div>
      <div className="h-3 bg-gray-200 rounded animate-pulse w-16" />
    </div>
  );
}

export default function Dashboard({ activeTab, setActiveTab }: Props) {
  const [scheduled,  setScheduled]  = useState<ApiEmail[]>([]);
  const [sent,       setSent]       = useState<ApiEmail[]>([]);
  const [failed,     setFailed]     = useState<ApiEmail[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [selected,   setSelected]   = useState<ApiEmail | null>(null);
  const [compose,    setCompose]    = useState(false);

  const { toasts, toast, dismissToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, se, f] = await Promise.all([
        fetchScheduledEmails(), fetchSentEmails(), fetchFailedEmails(),
      ]);
      setScheduled(s); setSent(se); setFailed(f);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows      = { scheduled, sent, failed }[activeTab];
  const timeLabel = { scheduled: "Scheduled", sent: "Sent", failed: "Failed" }[activeTab];

  // Avatar initials from email address
  const initials = (email: string) =>
    email.split("@")[0].slice(0, 2).toUpperCase();

  const avatarColor = (email: string) => {
    const colors = [
      "bg-purple-500", "bg-blue-500", "bg-green-500",
      "bg-orange-500", "bg-red-500", "bg-pink-500", "bg-teal-500",
    ];
    let h = 0;
    for (const c of email) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return colors[h % colors.length];
  };

  return (
    <div className="flex h-screen">

      {/* ── Email list ────────────────────────────────────────────────── */}
      <div className="flex flex-col border-r border-gray-200 bg-white"
           style={{ width: selected ? "360px" : "100%" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-800">ON9</h1>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh" onClick={load}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setCompose(true)}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600
                text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Compose
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search emails..."
              className="bg-transparent text-xs text-gray-600 placeholder-gray-400 outline-none flex-1"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2">
          {(["scheduled", "sent", "failed"] as TabType[]).map((t) => {
            const count = { scheduled: scheduled.length, sent: sent.length, failed: failed.length }[t];
            return (
              <button
                key={t}
                onClick={() => { setActiveTab(t); setSelected(null); }}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition
                  ${activeTab === t
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                    ${activeTab === t ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg flex justify-between">
            {error}
            <button onClick={load} className="underline font-semibold ml-2">Retry</button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-500">No {activeTab} emails</p>
              <p className="text-xs mt-1">
                {activeTab === "scheduled" ? "Click Compose to schedule one." : "Nothing here yet."}
              </p>
            </div>
          )}

          {!loading && rows.map((email) => (
            <div
              key={email.id}
              onClick={() => setSelected(email)}
              className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100
                cursor-pointer transition hover:bg-gray-50
                ${selected?.id === email.id ? "bg-green-50 border-l-4 border-l-green-500" : ""}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center
                text-white text-xs font-bold shrink-0 ${avatarColor(email.to)}`}>
                {initials(email.to)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {email.to}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {fmt(activeTab === "scheduled" ? email.sendAt : email.updatedAt)}
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-600 truncate mt-0.5">{email.subject}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400 truncate">{email.body.slice(0, 60)}</p>
                  <StatusPill status={email.status} />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ── Detail panel ──────────────────────────────────────────────── */}
      {selected && (
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          {/* Detail header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center
                text-white text-sm font-bold ${avatarColor(selected.to)}`}>
                {initials(selected.to)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{selected.to}</p>
                <p className="text-xs text-gray-400">
                  {timeLabel} {fmt(activeTab === "scheduled" ? selected.sendAt : selected.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={selected.status} />
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 ml-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Detail body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{selected.subject}</h2>

            {/* Meta */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5 text-xs text-gray-500 space-y-1">
              <div><span className="font-medium text-gray-600 w-16 inline-block">To:</span>{selected.to}</div>
              <div>
                <span className="font-medium text-gray-600 w-16 inline-block">
                  {activeTab === "scheduled" ? "Fires at:" : "Sent at:"}
                </span>
                {fmt(activeTab === "scheduled" ? selected.sendAt : selected.updatedAt)}
              </div>
              {selected.attempts > 0 && (
                <div><span className="font-medium text-gray-600 w-16 inline-block">Attempts:</span>{selected.attempts}</div>
              )}
              {selected.campaignId && (
                <div><span className="font-medium text-gray-600 w-16 inline-block">Campaign:</span>
                  <span className="font-mono">{selected.campaignId.slice(0, 8)}…</span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {selected.body}
              </pre>
            </div>

            {/* Failure reason */}
            {selected.failureReason && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-600 mb-1">Failure reason</p>
                <p className="text-xs text-red-500">{selected.failureReason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Compose modal ─────────────────────────────────────────────── */}
      <ComposeModal
        isOpen={compose}
        onClose={() => setCompose(false)}
        onScheduled={(count) => {
          load();
          toast("success", count === 1 ? "Email scheduled!" : `${count} emails scheduled!`);
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

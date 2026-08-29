import { useState, useRef } from "react";
import { scheduleEmails } from "../api/emailApi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: (count: number) => void;
}

type Errs = Partial<Record<"recipients"|"subject"|"body"|"startTime", string>>;

export default function ComposeModal({ isOpen, onClose, onScheduled }: Props) {
  const [to,           setTo]           = useState("");
  const [subject,      setSubject]      = useState("");
  const [body,         setBody]         = useState("");
  const [csvEmails,    setCsvEmails]    = useState<string[]>([]);
  const [csvName,      setCsvName]      = useState<string|null>(null);
  const [startTime,    setStartTime]    = useState("");
  const [delayMs,      setDelayMs]      = useState(2000);
  const [hourlyLimit,  setHourlyLimit]  = useState(20);
  const [loading,      setLoading]      = useState(false);
  const [errs,         setErrs]         = useState<Errs>({});
  const [submitErr,    setSubmitErr]    = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseEmails = (raw: string) =>
    raw.split(/[\r\n,;]+/).map(s => s.trim()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

  const allRecipients = Array.from(new Set([...csvEmails, ...parseEmails(to)]));

  const handleCSV = (file: File) => {
    setCsvName(file.name);
    const r = new FileReader();
    r.onload = () => setCsvEmails(parseEmails(r.result as string));
    r.readAsText(file);
  };

  const validate = (): Errs => {
    const e: Errs = {};
    if (!allRecipients.length) e.recipients = "Add at least one recipient.";
    if (!subject.trim())       e.subject    = "Subject is required.";
    if (!body.trim())          e.body       = "Body is required.";
    if (!startTime)            e.startTime  = "Start time is required.";
    else if (new Date(startTime) <= new Date()) e.startTime = "Must be in the future.";
    return e;
  };

  const handleSend = async () => {
    setSubmitErr("");
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const res = await scheduleEmails({
        recipients: allRecipients, subject, body,
        startTime: new Date(startTime).toISOString(),
        delayMs, hourlyLimit,
      });
      reset(); onScheduled(res.totalEmails); onClose();
    } catch (err) {
      setSubmitErr((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTo(""); setSubject(""); setBody(""); setCsvEmails([]); setCsvName(null);
    setStartTime(""); setDelayMs(2000); setHourlyLimit(20); setErrs({}); setSubmitErr("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => { reset(); onClose(); };

  // ── Toolbar buttons (decorative — plain textarea body) ────────────────────
  const toolbarItems = [
    { icon: "B", title: "Bold", cls: "font-bold" },
    { icon: "I", title: "Italic", cls: "italic" },
    { icon: "U", title: "Underline", cls: "underline" },
    { icon: "S", title: "Strikethrough", cls: "line-through" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Modal header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-gray-800">Compose New Email</span>
            {allRecipients.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                {allRecipients.length} recipient{allRecipients.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Minimise">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Expand">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button onClick={close} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* To field */}
          <div className="flex items-start px-5 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-16 shrink-0 pt-1">To</span>
            <div className="flex-1">
              <textarea
                value={to}
                onChange={e => { setTo(e.target.value); setErrs(p => ({...p, recipients: undefined})); }}
                placeholder="recipient@example.com, another@example.com"
                rows={2}
                className={`w-full text-sm text-gray-700 placeholder-gray-300 outline-none resize-none
                  ${errs.recipients ? "text-red-500" : ""}`}
              />
              {errs.recipients && <p className="text-xs text-red-500 mt-0.5">{errs.recipients}</p>}
            </div>
          </div>

          {/* From field (display only) */}
          <div className="flex items-center px-5 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-16 shrink-0">From</span>
            <span className="text-sm text-gray-500">Email Scheduler (via Ethereal SMTP)</span>
          </div>

          {/* Subject */}
          <div className="flex items-center px-5 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-16 shrink-0">Subject</span>
            <input
              value={subject}
              onChange={e => { setSubject(e.target.value); setErrs(p => ({...p, subject: undefined})); }}
              placeholder="Enter subject..."
              className={`flex-1 text-sm text-gray-700 placeholder-gray-300 outline-none
                ${errs.subject ? "text-red-500" : ""}`}
            />
          </div>
          {errs.subject && <p className="px-5 text-xs text-red-500 -mt-2 mb-1">{errs.subject}</p>}

          {/* Body / text area */}
          <div className="px-5 py-3">
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setErrs(p => ({...p, body: undefined})); }}
              placeholder="Write your message here..."
              rows={8}
              className={`w-full text-sm text-gray-700 placeholder-gray-300 outline-none resize-none leading-relaxed
                ${errs.body ? "text-red-500" : ""}`}
            />
            {errs.body && <p className="text-xs text-red-500">{errs.body}</p>}
          </div>

          {/* Scheduling fields */}
          <div className="mx-5 mb-4 bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scheduling</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Start time <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={e => { setStartTime(e.target.value); setErrs(p => ({...p, startTime: undefined})); }}
                  className={`w-full text-xs border rounded-lg px-2.5 py-1.5 outline-none
                    focus:ring-1 focus:ring-green-400 bg-white
                    ${errs.startTime ? "border-red-400" : "border-gray-200"}`}
                />
                {errs.startTime && <p className="text-xs text-red-500 mt-0.5">{errs.startTime}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Delay (ms)</label>
                <input
                  type="number" min={0} step={500} value={delayMs}
                  onChange={e => setDelayMs(Number(e.target.value))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-green-400 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max / hour</label>
                <input
                  type="number" min={1} value={hourlyLimit}
                  onChange={e => setHourlyLimit(Number(e.target.value))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-green-400 bg-white"
                />
              </div>
            </div>
          </div>

          {/* CSV upload */}
          <div className="px-5 mb-4">
            {csvName ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-green-700 font-medium flex-1 truncate">{csvName}</span>
                <span className="text-xs text-green-600">{csvEmails.length} addresses</span>
                <button onClick={() => { setCsvEmails([]); setCsvName(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="text-xs text-green-600 hover:text-red-600 underline ml-1">
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 border-2 border-dashed border-gray-200
                hover:border-green-400 hover:bg-green-50/30 rounded-xl px-4 py-3 cursor-pointer transition">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-xs text-gray-500">Upload CSV (optional — bulk recipients)</span>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => e.target.files && handleCSV(e.target.files[0])} />
              </label>
            )}
          </div>

          {/* Submit error */}
          {submitErr && (
            <div className="mx-5 mb-4 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {submitErr}
            </div>
          )}
        </div>

        {/* ── Footer toolbar ────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-2xl shrink-0">

          {/* Formatting toolbar (cosmetic) */}
          <div className="flex items-center gap-1">
            {toolbarItems.map(t => (
              <button key={t.title} title={t.title}
                className={`w-7 h-7 flex items-center justify-center rounded text-xs text-gray-500
                  hover:bg-gray-200 transition ${t.cls}`}>
                {t.icon}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button title="Attach file" className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button title="Image" className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button onClick={close} disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSend} disabled={loading}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60
                text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm">
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Scheduling…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send{allRecipients.length > 1 ? ` (${allRecipients.length})` : ""}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

const STYLES: Record<ToastType, string> = {
  success: "bg-emerald-600 text-white",
  error:   "bg-red-600 text-white",
  info:    "bg-slate-700 text-white",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "bg-emerald-500",
  error:   "bg-red-500",
  info:    "bg-slate-600",
};

/**
 * ToastContainer — fixed bottom-right stack of auto-dismissing notifications.
 * Each toast auto-dismisses after 4 s. Clicking × dismisses immediately.
 */
export function ToastContainer({ toasts, onDismiss }: Props) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss after 4 s
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[260px] max-w-sm
        transition-all duration-300 ease-out
        ${STYLES[toast.type]}
        ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
    >
      {/* Icon badge */}
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center
          text-xs font-bold shrink-0 ${ICON_STYLES[toast.type]}`}
      >
        {ICONS[toast.type]}
      </span>

      {/* Message */}
      <p className="text-sm font-medium flex-1">{toast.message}</p>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-white/70 hover:text-white transition text-lg leading-none ml-1"
      >
        ×
      </button>
    </div>
  );
}

/**
 * useToast — simple hook that manages a toast stack.
 *
 * Usage:
 *   const { toasts, toast, dismissToast } = useToast();
 *   toast("success", "Emails scheduled!");
 *   <ToastContainer toasts={toasts} onDismiss={dismissToast} />
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = (type: ToastType, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, toast, dismissToast };
}

export type TabType = "scheduled" | "sent" | "failed";

type TabConfig = {
  key: TabType;
  label: string;
  count: number;
  activeClass: string;
  badgeClass: string;
};

type Props = {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  counts: { scheduled: number; sent: number; failed: number };
};

export default function Tabs({ activeTab, onChange, counts }: Props) {
  const tabs: TabConfig[] = [
    {
      key: "scheduled",
      label: "Scheduled",
      count: counts.scheduled,
      activeClass: "text-indigo-700 border-indigo-600 bg-indigo-50",
      badgeClass: "bg-indigo-100 text-indigo-700",
    },
    {
      key: "sent",
      label: "Sent",
      count: counts.sent,
      activeClass: "text-emerald-700 border-emerald-600 bg-emerald-50",
      badgeClass: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "failed",
      label: "Failed",
      count: counts.failed,
      activeClass: "text-red-700 border-red-500 bg-red-50",
      badgeClass: "bg-red-100 text-red-700",
    },
  ];

  return (
    <div className="flex gap-1 border-b border-slate-200 mb-1">
      {tabs.map(({ key, label, count, activeClass, badgeClass }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                isActive
                  ? `${activeClass} border-current`
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                  rounded-full text-xs font-semibold
                  ${isActive ? badgeClass : "bg-slate-100 text-slate-500"}`}
              >
                {count > 999 ? "999+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

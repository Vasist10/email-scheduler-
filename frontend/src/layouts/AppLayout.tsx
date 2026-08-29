import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SlackConnect from "../components/SlackConnect";

export type TabType = "scheduled" | "sent" | "failed";

interface Props {
  children: (activeTab: TabType, setActiveTab: (t: TabType) => void) => React.ReactNode;
}

function decodeJwt(token: string): Record<string, string> | null {
  try {
    const json = atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch { return null; }
}

const NAV_ITEMS: { tab: TabType; label: string; icon: React.ReactNode }[] = [
  {
    tab: "scheduled",
    label: "Scheduled",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    tab: "sent",
    label: "Sent",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    tab: "failed",
    label: "Failed",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function AppLayout({ children }: Props) {
  const navigate   = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("scheduled");

  const user = useMemo(() => {
    const token = localStorage.getItem("auth_token");
    return token ? decodeJwt(token) : null;
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">

        {/* User profile */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center
                justify-center text-white text-sm font-bold">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.name ?? "User"}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email ?? ""}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(({ tab, label, icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                  transition text-left font-medium
                  ${isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
              >
                <span className={isActive ? "text-green-600" : "text-gray-400"}>
                  {icon}
                </span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-gray-100 space-y-1">
          <SlackConnect />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
              text-gray-500 hover:bg-red-50 hover:text-red-600 transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>

      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {children(activeTab, setActiveTab)}
      </main>

    </div>
  );
}

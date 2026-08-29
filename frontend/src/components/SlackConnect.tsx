import { useEffect, useState } from "react";
import { fetchSlackStatus, disconnectSlack } from "../api/emailApi";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export default function SlackConnect() {
  const [connected, setConnected] = useState(false);
  const [teamName,  setTeamName]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [feedback,  setFeedback]  = useState<string | null>(null);

  useEffect(() => {
    fetchSlackStatus()
      .then(({ connected, teamName }) => { setConnected(connected); setTeamName(teamName); })
      .catch(() => {})
      .finally(() => setLoading(false));

    const params = new URLSearchParams(window.location.search);
    const slack = params.get("slack");
    if (slack) {
      if (slack === "connected") setFeedback("✅ Slack connected!");
      else if (slack === "denied") setFeedback("Slack cancelled.");
      else if (slack === "error") setFeedback("⚠️ Slack error.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleDisconnect = async () => {
    try {
      await disconnectSlack();
      setConnected(false); setTeamName(null); setFeedback("Slack disconnected.");
    } catch { setFeedback("⚠️ Failed to disconnect."); }
  };

  const handleConnect = () => {
    const token = localStorage.getItem("auth_token");
    window.location.href = `${API_BASE}/auth/slack/connect?token=${token ?? ""}`;
  };

  if (loading) return null;

  return (
    <div className="space-y-1">
      {feedback && (
        <p className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{feedback}</p>
      )}
      {connected ? (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-green-50">
          <span className="text-xs text-green-700 font-medium truncate">
            ✓ {teamName ?? "Slack"}
          </span>
          <button onClick={handleDisconnect}
            className="text-xs text-green-600 hover:text-red-600 underline ml-2 shrink-0">
            Disconnect
          </button>
        </div>
      ) : (
        <button onClick={handleConnect}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
            text-gray-500 hover:bg-gray-50 transition text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8"
            className="w-4 h-4 shrink-0" aria-hidden="true">
            <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a"/>
            <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0"/>
            <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d"/>
            <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e"/>
          </svg>
          Connect Slack
        </button>
      )}
    </div>
  );
}

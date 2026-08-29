
// Vite injects VITE_* env vars at build time.
// In Docker the value comes from the VITE_API_BASE_URL build arg.
// Falls back to localhost for local `npm run dev`.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const token = localStorage.getItem("auth_token");

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error("API request failed");
  }

  return res.json();
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export default function Login() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg w-80 px-8 py-10 flex flex-col items-center gap-6">

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-800">Login</h1>

        {/* Google Button */}
        <button
          onClick={() => { window.location.href = `${API_BASE}/auth/google`; }}
          className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600
            text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
        >
          <img src="/google.png" alt="" className="w-4 h-4 brightness-0 invert" />
          Login with Google
        </button>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email input (display only — auth is via Google) */}
        <div className="w-full space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              disabled
              placeholder="Use Google login above"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input
              type="password"
              disabled
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Login button (same Google auth) */}
        <button
          onClick={() => { window.location.href = `${API_BASE}/auth/google`; }}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold
            text-sm py-2.5 rounded-lg transition-colors"
        >
          Login
        </button>

      </div>
    </div>
  );
}

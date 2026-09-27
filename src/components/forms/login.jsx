'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import { MdOutlineDashboard, MdOutlineVisibility, MdOutlineVisibilityOff } from "react-icons/md";

import * as api from "src/services";
import useAdminUserStore from "src/stores/userStore";
import { useSiteSettings } from "src/context/SiteSettingsContext";
import Callout from "src/components/_admin/ui/Callout";
import { apiMessage } from "src/utils/swal";

// Per-app identity. Everything below this block matches the marketing app's
// sign-in (the shared Sidrat design system) — keep the redesigned apps in sync.
const APP_LABEL = "Management";
const APP_TAGLINE = "Sign in with your store admin account";
const AppIcon = MdOutlineDashboard;

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAdminUserStore();
  const { siteName, logo, logoType, primaryColor } = useSiteSettings();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  // The API client sends people here with ?reason=session-expired after a 401.
  // Read once on mount rather than with useSearchParams, which would force a
  // Suspense boundary during prerender.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "session-expired") setNotice("Your session expired. Sign in again to pick up where you left off.");
  }, []);

  const loginMutation = useMutation(api.login, {
    onSuccess: (data) => {
      login(data.user);
      // Read the return path at submit time instead of with useSearchParams:
      // that hook forces a Suspense boundary during prerender, and the value
      // is only ever needed once the user has already interacted.
      const params = new URLSearchParams(window.location.search);
      router.push(params.get("redirect") || "/");
    },
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setNotice("");
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  const error = loginMutation.isError ? apiMessage(loginMutation.error, "Sign-in failed. Check your details and try again.") : "";

  return (
    <div
      className="admin-root flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4 py-12"
      style={{ "--brand": primaryColor }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {logo ? (
            <span className="mb-4 flex h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <img src={logo} alt="" className={`h-full w-full ${logoType === "round" ? "rounded-md object-cover" : "object-contain"}`} />
            </span>
          ) : (
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
              <AppIcon size={26} aria-hidden />
            </span>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {siteName} {APP_LABEL}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{APP_TAGLINE}</p>
        </div>

        <form onSubmit={onSubmit} className="card-ui space-y-5 p-6 sm:p-8" noValidate>
          {notice && !error && <Callout tone="warning">{notice}</Callout>}
          {error && <Callout tone="danger">{error}</Callout>}

          <div>
            <label htmlFor="login-identifier" className="block mb-1.5 text-[13px] font-medium text-slate-800">
              Phone or email
            </label>
            <input
              id="login-identifier"
              type="text"
              inputMode="email"
              className="input-ui h-10"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="01XXXXXXXXX or you@example.com"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block mb-1.5 text-[13px] font-medium text-slate-800">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="input-ui h-10 pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <MdOutlineVisibilityOff size={18} /> : <MdOutlineVisibility size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-brand h-10 w-full"
            disabled={loginMutation.isLoading || !identifier.trim() || !password}
          >
            {loginMutation.isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

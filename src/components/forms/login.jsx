'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'react-query';
import { MdOutlineDashboard, MdOutlineVisibility, MdOutlineVisibilityOff } from 'react-icons/md';
import { toast } from 'react-toastify';

import * as api from 'src/services';
import useAdminUserStore from 'src/stores/userStore';
import { useSiteSettings } from 'src/context/SiteSettingsContext';

// Per-app identity. Everything below this block is deliberately identical
// across all six staff-facing apps — keep the sign-in screens in sync.
const APP_LABEL = 'Management';
const APP_TAGLINE = 'Sign in with your store admin account';
const AppIcon = MdOutlineDashboard;

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAdminUserStore();
  const { siteName, logo, logoType, primaryColor } = useSiteSettings();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation(api.login, {
    onSuccess: (data) => {
      login(data.user);
      // Read the return path at submit time instead of with useSearchParams:
      // that hook forces a Suspense boundary during prerender, and the value
      // is only ever needed once the user has already interacted.
      const params = new URLSearchParams(window.location.search);
      router.push(params.get('redirect') || '/');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Login failed');
    }
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <div
      className="admin-root flex min-h-screen items-center justify-center bg-slate-100 p-4"
      style={{ '--brand': primaryColor }}
    >
      <form onSubmit={onSubmit} className="card-ui w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-1 pb-2">
          {logo ? (
            <span className="flex h-14 w-14 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-sm">
              <img
                src={logo}
                alt={siteName || 'Site logo'}
                className={`h-full w-full ${logoType === 'round' ? 'rounded-md object-cover' : 'object-contain'}`}
              />
            </span>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)]">
              <AppIcon size={26} />
            </span>
          )}
          <h1 className="text-lg font-bold text-slate-800">
            {siteName} {APP_LABEL}
          </h1>
          <p className="text-sm text-slate-500">{APP_TAGLINE}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Phone or Email
          </label>
          <input
            type="text"
            inputMode="email"
            className="input-ui"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="01XXXXXXXXX or you@example.com"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-ui pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <MdOutlineVisibilityOff size={18} /> : <MdOutlineVisibility size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn-brand w-full" disabled={loginMutation.isLoading}>
          {loginMutation.isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

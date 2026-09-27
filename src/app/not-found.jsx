'use client';
import { useRouter } from 'next-nprogress-bar';
import React from 'react';

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="section-label">Error 404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        The link may be broken, or the page may have been moved or removed.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          Go back
        </button>
        <button type="button" className="btn-brand" onClick={() => router.push('/')}>
          Go to dashboard
        </button>
      </div>
    </div>
  );
}

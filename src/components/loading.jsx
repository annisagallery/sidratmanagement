'use client';
import React from 'react';

export default function LinearIndeterminate() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-700" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

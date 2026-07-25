'use client';
import { useRouter } from 'next-nprogress-bar';
import React from 'react';

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center">
      <p className="text-[120px] font-bold text-gray-200 leading-none select-none">404</p>
      <h1 className="text-2xl font-bold text-gray-800">404, Page not found</h1>
      <p className="text-base text-gray-600">
        Something went wrong. It looks like the page you requested could not be found. It might be that the link is
        broken or the page has been removed.
      </p>
      <div className="flex gap-4">
        <button className="px-6 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700" onClick={() => router.back()}>
          Go Back
        </button>
        <button
          className="px-6 py-3 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-100"
          onClick={() => router.push('/')}
        >
          Go To Home
        </button>
      </div>
    </div>
  );
}

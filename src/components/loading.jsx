'use client';
import React from 'react';
import Image from 'next/image';
import logo from '@/public/logo.png';

export default function LinearIndeterminate() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 z-50">
      <div className="relative flex items-center justify-center mb-4">
        {/* Animated progress circle */}
        <div className="absolute flex items-center justify-center">
          {/* Increase the size of the ring so it's visible outside the logo */}
          <div className="w-44 h-44 border-4 border-blue-500 border-t-transparent rounded-md animate-spin"></div>
        </div>
        {/* Logo */}
        <div className="relative z-10 animate-pulse">
          <Image src={logo} alt="Logo" width={160} height={160} className="w-40 h-40" />
        </div>
      </div>
    </div>
  );
}

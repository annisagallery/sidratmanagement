'use client';
import Link from 'next/link';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import Image from 'next/image';

export default function Logo() {
  const { siteName, logo, logoType } = useSiteSettings();

  return (
    <Link href="/" className="flex items-center gap-2 select-none">
      {logo ? (
        <Image
          src={logo}
          alt={siteName || 'Logo'}
          width={160}
          height={40}
          className={`h-10 w-auto object-contain ${logoType === 'round' ? 'rounded-md' : ''}`}
        />
      ) : (
        <span className="text-lg font-bold text-gray-800 tracking-tight">
          {siteName || 'Management'}
        </span>
      )}
    </Link>
  );
}

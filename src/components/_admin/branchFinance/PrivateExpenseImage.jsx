'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import * as api from 'src/services';

// Expense proof images are private — streamed as blobs through the
// authenticated admin endpoint, same pattern as complaint attachments.
export default function PrivateExpenseImage({ expenseId, imageId, alt, className }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed(false);
    api.getExpenseImageByAdmin(expenseId, imageId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [expenseId, imageId]);

  if (failed) return <div className={`${className} grid place-items-center text-center text-xs text-slate-400`}>Image unavailable</div>;
  if (!src) return <div className={`${className} animate-pulse bg-slate-200`} aria-label="Loading proof image" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className={className}>
      <Image src={src} alt={alt} fill unoptimized className="object-cover" />
    </a>
  );
}

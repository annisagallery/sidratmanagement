'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import * as api from 'src/services';

export default function PrivateComplaintImage({ complaintId, imageId, alt, className }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed(false);
    api.getComplaintImageByAdmin(complaintId, imageId)
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
  }, [complaintId, imageId]);

  if (failed) return <div className={`${className} grid place-items-center text-center text-xs text-gray-400`}>Image unavailable</div>;
  if (!src) return <div className={`${className} animate-pulse bg-gray-200`} aria-label="Loading attachment" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className={className}>
      <Image src={src} alt={alt} fill unoptimized className="object-cover" />
    </a>
  );
}

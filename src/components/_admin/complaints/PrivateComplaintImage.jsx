'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getComplaintImage } from 'src/services';

export default function PrivateComplaintImage({ complaintId, imageId, alt, className }) {
  return <ComplaintImage key={`${complaintId}-${imageId}`} complaintId={complaintId} imageId={imageId} alt={alt} className={className} />;
}

function ComplaintImage({ complaintId, imageId, alt, className }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    getComplaintImage(complaintId, imageId)
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

  if (failed) {
    return <div className={`${className} grid place-items-center text-center text-xs text-slate-400`}>Image unavailable</div>;
  }
  if (!src) return <div className={`${className} animate-pulse bg-slate-200`} aria-label="Loading attachment" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className={className}>
      <Image src={src} alt={alt} fill unoptimized className="object-cover" />
    </a>
  );
}

'use client';
import { useState } from 'react';
import { Watch } from 'lucide-react';
import { watchPhotos, type Model } from '../lib/market';

export default function WatchPhoto({ model, credit = true, iconSize = 40 }: { model: Model; credit?: boolean; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = watchPhotos[model.id];
  const src = photo?.url || model.imageUrl;
  if (!src || failed)
    return (
      <span className="watch-placeholder" role="img" aria-label="No watch photo available">
        <Watch size={iconSize} strokeWidth={1} />
      </span>
    );
  return (
    <>
      <img
        className="watch-photo"
        src={src}
        alt={`${model.brand} ${model.name} ${model.reference}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      {credit && <span className="photo-credit">Photo: {photo?.source || model.imageSource || 'Your source'}</span>}
    </>
  );
}

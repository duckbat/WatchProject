'use client';
import { useEffect, useState } from 'react';
import { Watch } from 'lucide-react';
import { watchPhotos, type Model } from '../lib/market';
import { watchCutout } from './watch-cutout';

/** cutout: show the watch as a transparent, cropped PNG (large photos on the watch page). */
export default function WatchPhoto({ model, credit = true, iconSize = 40, cutout = false }: { model: Model; credit?: boolean; iconSize?: number; cutout?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = watchPhotos[model.id];
  const src = photo?.url || model.imageUrl;
  const [cut, setCut] = useState<{ src: string; url: string } | null>(null);
  useEffect(() => {
    if (!cutout || !src) return;
    let live = true;
    watchCutout(src).then((url) => live && url && setCut({ src, url }));
    return () => { live = false; };
  }, [cutout, src]);
  const cutUrl = cut && cut.src === src ? cut.url : null;
  if (!src || failed)
    return (
      <span className="watch-placeholder" role="img" aria-label="No watch photo available">
        <Watch size={iconSize} strokeWidth={1} />
      </span>
    );
  return (
    <>
      <img
        className={`watch-photo${cutUrl ? ' cut' : ''}`}
        src={cutUrl || src}
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

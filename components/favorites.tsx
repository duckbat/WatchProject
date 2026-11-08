'use client';
import { createContext, useContext } from 'react';
import { Heart } from 'lucide-react';

/** Favourite watch models (catalog IDs) and a toggle. Provided once by the page; any card can show the heart. */
export const FavoritesContext = createContext<{ ids: Set<string>; toggle: (modelId: string) => void } | null>(null);

export const useFavorites = () => useContext(FavoritesContext);

export function FavoriteButton({ modelId, label = false }: { modelId: string; label?: boolean }) {
  const favorites = useFavorites();
  if (!favorites) return null;
  const on = favorites.ids.has(modelId);
  const text = on ? 'Remove from favourites' : 'Add to favourites';
  return (
    <button
      type="button"
      className={`favorite-btn${on ? ' on' : ''}${label ? ' labelled' : ''}`}
      aria-pressed={on}
      aria-label={text}
      title={text}
      onClick={(e) => {
        e.stopPropagation();
        favorites.toggle(modelId);
      }}
    >
      <Heart size={label ? 15 : 17} fill={on ? 'currentColor' : 'none'} />
      {label && (on ? 'Favourited' : 'Favourite')}
    </button>
  );
}

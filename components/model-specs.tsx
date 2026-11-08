'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { Model } from '../lib/market';
import { baseReference } from '../lib/collectors/matching/reference';

type CatalogModel = Model & { family?: string; sourceUrl?: string };

/** Catalog facts for a reference and its dial/bracelet variants. Only fields the catalog actually has are shown. */
export default function ModelSpecs({ model, onClose, onOpen }: { model: CatalogModel; onClose: () => void; onOpen: (id: string) => void }) {
  const base = baseReference(model.reference);
  const [variants, setVariants] = useState<CatalogModel[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog?${new URLSearchParams({ q: base, brand: model.brand, limit: '24' })}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: CatalogModel[] }>) : null))
      .then((d) => setVariants((d?.items || []).filter((m) => baseReference(m.reference).toLowerCase() === base.toLowerCase())))
      .catch(() => {});
    return () => controller.abort();
  }, [base, model.brand]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows: [string, React.ReactNode][] = [
    ['Brand', model.brand],
    ['Collection', model.family || '—'],
    [
      variants.length > 1 ? 'References' : 'Reference',
      variants.length > 1 ? (
        <span className="spec-refs">
          {variants.map((v) => (
            <button key={v.id} className={v.id === model.id ? 'current' : ''} onClick={() => v.id !== model.id && onOpen(v.id)} title={v.name}>
              {v.reference}
            </button>
          ))}
        </span>
      ) : (
        model.reference
      ),
    ],
    ['Model', model.name],
    ['Case diameter', model.size || '—'],
  ];

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal specs-modal" role="dialog" aria-modal="true" aria-labelledby="specs-title">
        <button className="close icon-btn" aria-label="Close dialog" onClick={onClose}><X size={21} /></button>
        <h2 id="specs-title">Model specifications</h2>
        <table className="specs-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>
            ))}
          </tbody>
        </table>
        {model.sourceUrl && (
          <a className="text-btn specs-source" href={model.sourceUrl} target="_blank" rel="noreferrer">
            Full specifications on Timepiecepedia <ArrowUpRight size={13} />
          </a>
        )}
      </section>
    </div>
  );
}

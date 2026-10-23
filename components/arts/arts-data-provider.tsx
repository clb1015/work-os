'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { ArtsSnapshot } from '@/lib/arts/types';
import { restoreRoster, rosterStorageKey } from '@/lib/arts/roster-import';

type ArtsData = {
  snapshot: ArtsSnapshot;
  ready: boolean;
  storageError: string;
  useRoster: (snapshot: ArtsSnapshot) => void;
  clearRoster: () => void;
};
const Context = createContext<ArtsData | null>(null);

export function ArtsDataProvider({ initialSnapshot, ownerId, children }: { initialSnapshot: ArtsSnapshot; ownerId: string; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const key = rosterStorageKey(ownerId);
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(key);
      if (stored) setSnapshot(restoreRoster(stored));
    } catch {
      setStorageError('The saved tab summary could not load. Sample data is shown. Upload the CSV again, or clear the saved summary from Data sources.');
    }
    setReady(true);
  }, [key]);
  function useRoster(next: ArtsSnapshot) {
    // Called only by the explicit reviewed "Use in dashboards" button.
    if (!next.roster?.mappingReviewed) throw new Error('Review the roster mappings before applying them.');
    const serialized = JSON.stringify(next);
    const checked = restoreRoster(serialized);
    window.sessionStorage.setItem(key, JSON.stringify(checked));
    setSnapshot(checked); setStorageError('');
  }
  function clearRoster() {
    window.sessionStorage.removeItem(key);
    setSnapshot(initialSnapshot); setStorageError('');
  }
  return <Context.Provider value={{ snapshot, ready, storageError, useRoster, clearRoster }}>{children}</Context.Provider>;
}

export function useArtsData() {
  const value = useContext(Context);
  if (!value) throw new Error('Arts data must be read inside the authenticated Arts OS shell.');
  return value;
}

export function ArtsDataBanner() {
  const { snapshot, ready, storageError } = useArtsData();
  if (!ready) return <p role="status" className="arts-sample-banner">Loading this tab’s data…</p>;
  const uploaded = snapshot.provenance.kind === 'uploaded';
  return <>{storageError && <p role="alert" className="arts-empty arts-error">{storageError}</p>}<div className="arts-sample-banner" role="note"><strong>{uploaded ? 'Uploaded roster' : 'Sample data'}</strong><p>{uploaded ? `${snapshot.roster?.fileName} · Aggregate summary in this tab. Source date not supplied; this is not a live connection.` : 'Schools, programs, instruction, resources and events are fictional examples. Existing Work OS projects are labeled separately.'}</p><Link href="/arts/data">{uploaded ? snapshot.roster?.mappingReviewed ? 'Manage data' : 'Review mappings' : 'Upload school data'}</Link></div></>;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAuthed } from '@/lib/auth';
import WorkspaceSidebar from '@/components/arts/workspace-sidebar';
import { ArtsDataBanner, ArtsDataProvider } from '@/components/arts/arts-data-provider';
import { readArtsSnapshot } from '@/lib/arts/data';
import './arts.css';

export const metadata: Metadata = { title: { default: 'Arts OS', template: '%s · Arts OS' } };
export const dynamic = 'force-dynamic';

export default async function ArtsLayout({ children }: { children: ReactNode }) {
  const { user } = await getAuthed();
  if (!user) redirect('/login');
  const initialSnapshot = await readArtsSnapshot();
  return <ArtsDataProvider initialSnapshot={initialSnapshot} ownerId={user.id}><div className="app-shell arts-shell">
    <a className="arts-skip" href="#arts-main">Skip to dashboard</a>
    <WorkspaceSidebar />
    <main className="main" id="arts-main">
      <header className="topbar"><div className="topbar-title"><strong>Arts OS</strong><span>District arts workspace</span></div><div className="top-actions"><Link href="/">Open Work OS</Link><form action="/auth/signout" method="post"><button className="ghost" type="submit">Sign out</button></form></div></header>
      <div className="arts-content">
        <ArtsDataBanner />
        {children}
      </div>
    </main>
  </div></ArtsDataProvider>;
}

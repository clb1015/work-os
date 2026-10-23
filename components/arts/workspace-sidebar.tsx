'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { artsModules } from '@/lib/arts/modules';

function ModuleLinks() {
  const pathname = usePathname();
  const params = useSearchParams();
  const school = pathname.startsWith('/arts/schools/') ? decodeURIComponent(pathname.split('/').at(-1) ?? '') : params.get('school');
  return <nav aria-label="Arts dashboards">{artsModules.map(module => {
    const href = `/arts/${module.slug}`;
    const selected = pathname === href || (module.slug === 'programs' && pathname.startsWith('/arts/schools/'));
    return <Link key={module.slug} href={school && module.slug !== 'projects' ? `${href}?school=${encodeURIComponent(school)}` : href} className={selected ? 'nav active' : 'nav'} aria-current={selected ? 'page' : undefined}>{module.name}</Link>;
  })}</nav>;
}

export default function WorkspaceSidebar({ children }: { children?: ReactNode }) {
  return <aside className="sidebar arts-sidebar">
    <Link className="brand arts-brand" href="/arts/overview" aria-label="Arts OS overview"><span className="brand-mark" aria-hidden="true">A</span><div><strong>Arts OS</strong><small>Fine & performing arts</small></div></Link>
    <Suspense fallback={<nav aria-label="Arts dashboards">{artsModules.map(module => <Link className="nav" key={module.slug} href={`/arts/${module.slug}`}>{module.name}</Link>)}</nav>}><ModuleLinks /></Suspense>
    <div className="side-section arts-work-nav"><Link className="nav" href="/arts/data">School data</Link><Link className="nav" href="/">Work OS workspace</Link>{children}</div>
    <p className="arts-sidebar-note">One workspace for arts programs and the work behind them.</p>
  </aside>;
}

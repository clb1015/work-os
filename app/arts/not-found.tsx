import Link from 'next/link';
export default function ArtsNotFound() {
  return <div className="arts-empty"><h1>Page not found</h1><p>This school or dashboard is not available in Arts OS.</p><Link href="/arts/programs">Browse schools and programs</Link></div>;
}

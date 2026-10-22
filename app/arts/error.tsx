'use client';
export default function ArtsError({ reset }: { reset: () => void }) {
  return <div className="arts-empty arts-error" role="alert"><h2>This dashboard could not load</h2><p>Try again. If the problem continues, return to Work OS.</p><button className="arts-button" onClick={reset}>Try again</button> <a href="/">Open Work OS</a></div>;
}

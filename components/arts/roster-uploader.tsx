'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { importRoster, MAX_ROSTER_BYTES } from '@/lib/arts/roster-import';
import type { ArtsSnapshot } from '@/lib/arts/types';
import { formatCount } from '@/lib/arts/selectors';
import { useArtsData } from './arts-data-provider';

export default function RosterUploader() {
  const { snapshot, ready, storageError, useRoster, clearRoster } = useArtsData();
  const [preview, setPreview] = useState<ArtsSnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const router = useRouter();
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const current = ++generation.current;
    setPreview(null); setError(''); setBusy(false);
    if (!file) { setBusy(false); return; }
    if (!/\.csv$/i.test(file.name)) { setError('Save the Excel workbook as CSV UTF-8, then select the .csv file.'); return; }
    if (file.size > MAX_ROSTER_BYTES) { setError('Choose a CSV smaller than 10 MB.'); return; }
    setBusy(true);
    try {
      const text = await file.text();
      if (current !== generation.current) return;
      const importedOn = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      setPreview(importRoster(text, file.name, importedOn));
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : 'The roster could not be read. Save it again as CSV UTF-8.');
    } finally { if (current === generation.current) setBusy(false); }
  }
  function apply() {
    if (!preview) return;
    try { useRoster(preview); router.push('/arts/overview'); }
    catch { setError('The summary could not be saved in this tab. Allow browser storage and try again. Your current dashboard data is unchanged.'); }
  }
  function clear() {
    try { clearRoster(); setPreview(null); setError(''); }
    catch { setError('The saved summary could not be cleared. Check browser storage permissions and try again.'); }
  }
  const summary = preview?.roster;
  return <>
    <header className="arts-heading"><div><h1>School data</h1><p>Upload an arts enrollment CSV, review its counts, then use the summary across the dashboards in this browser tab.</p></div></header>
    <section className="arts-section arts-upload"><h2>Upload a roster</h2><p>The file is read in your browser. Student IDs are used temporarily for distinct counts. Student IDs, student rows and teacher names are excluded from the saved summary and are never sent to the app’s server.</p>
      <label htmlFor="arts-roster-file">Arts enrollment CSV</label><input id="arts-roster-file" type="file" accept=".csv,text/csv" onChange={selectFile} disabled={!ready} aria-describedby="arts-roster-help" />
      <p id="arts-roster-help" className="arts-note">Required columns: School, Student ID, Grade, Course Num, Course Title, School Year. Schools must include a four-digit code in brackets. Export one school year at a time. Maximum 10 MB.</p>
      {busy && <p role="status">Reading and counting the roster…</p>}
      {error && <p role="alert" className="arts-empty arts-error">{error}</p>}
    </section>
    {preview && summary && <section className="arts-section" aria-labelledby="arts-upload-review"><h2 id="arts-upload-review">Review before using</h2><p>{summary.fileName} · {preview.academicYear} · Observed grades: {summary.observedGrades}</p>
      <dl className="arts-summary"><div><dt>Schools in file</dt><dd>{preview.schools.length}</dd></div><div><dt>Distinct students</dt><dd>{formatCount(summary.uniqueStudents)}</dd></div><div><dt>School-course offerings</dt><dd>{formatCount(preview.programs.length)}</dd></div><div><dt>Course enrollments</dt><dd>{formatCount(summary.courseEnrollments)}</dd></div></dl>
      <ul className="arts-import-notes"><li>{formatCount(summary.sourceRows)} source rows; {formatCount(summary.repeatedEnrollments)} repeated student/school/course/year rows do not add another enrollment.</li><li>{summary.crossSchoolStudents} students appear at multiple schools. The all-schools distinct count counts each student once.</li><li>Original course codes, leading zeros and suffixes are preserved. Similar titles are not merged.</li><li>Discipline grouping is suggested from course titles. {summary.unmappedOfferings} offerings need discipline mapping; they remain visible as “Not mapped.”</li><li>This export shows observed grades and arts students. It does not establish complete school enrollment, school grade ranges or participation rates.</li><li>Capacity, staffing FTE, instructional evidence, budgets, events and project links remain “Not mapped.”</li></ul>
      <button className="arts-button" type="button" onClick={apply}>Use in dashboards</button>
    </section>}
    {ready && <section className="arts-section"><h2>Current dashboard data</h2><p>{snapshot.provenance.kind === 'uploaded' ? `${snapshot.roster?.fileName} is active in this tab. Refreshes and dashboard navigation retain the aggregate summary. Other tabs and devices use their own data selection.` : 'Sample data is active. Selecting a file does not replace it until you click “Use in dashboards.”'}</p>
      {(snapshot.provenance.kind === 'uploaded' || storageError) && <button className="arts-button" type="button" onClick={clear}>Clear tab data and show samples</button>} <Link href="/arts/overview">Open overview</Link>
    </section>}
  </>;
}

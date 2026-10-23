'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { importRoster, MAX_ROSTER_BYTES, parseRosterCsv, rosterColumns, suggestRosterColumns, type RosterColumnMapping } from '@/lib/arts/roster-import';
import { confirmRosterMappings } from '@/lib/arts/roster-mapping';
import type { ArtsSnapshot } from '@/lib/arts/types';
import { formatCount } from '@/lib/arts/selectors';
import { useArtsData } from './arts-data-provider';
import RosterMappingReview from './roster-mapping-review';

export default function RosterUploader() {
  const { snapshot, ready, storageError, useRoster, clearRoster } = useArtsData();
  const [preview, setPreview] = useState<ArtsSnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columns, setColumns] = useState<RosterColumnMapping>(() => suggestRosterColumns([]));
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewVersion, setReviewVersion] = useState(0);
  const rawFile = useRef<{ text: string; fileName: string; importedOn: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const router = useRouter();
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const current = ++generation.current;
    rawFile.current = null;
    setPreview(null); setHeaders([]); setReviewConfirmed(false); setError(''); setBusy(false);
    if (!file) { setBusy(false); return; }
    if (!/\.csv$/i.test(file.name)) { setError('Save the Excel workbook as CSV UTF-8, then select the .csv file.'); return; }
    if (file.size > MAX_ROSTER_BYTES) { setError('Choose a CSV smaller than 10 MB.'); return; }
    setBusy(true);
    try {
      const text = await file.text();
      if (current !== generation.current) return;
      const importedOn = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const rows = parseRosterCsv(text);
      if (rows.length < 2) throw new Error('Choose a CSV with a header and at least one enrollment record.');
      if (new Set(rows[0]).size !== rows[0].length) throw new Error('The CSV contains duplicate column headings. Give each source column a unique name.');
      rawFile.current = { text, fileName: file.name, importedOn };
      setHeaders(rows[0]); setColumns(suggestRosterColumns(rows[0]));
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : 'The roster could not be read. Save it again as CSV UTF-8.');
    } finally { if (current === generation.current) setBusy(false); }
  }
  function reviewFile() {
    const file = rawFile.current;
    if (!file) return;
    setError(''); setReviewConfirmed(false);
    try {
      setPreview(importRoster(file.text, file.fileName, file.importedOn, columns));
      setReviewVersion(version => version + 1);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : 'Check the column mappings and try again.');
    }
  }
  function updateMappings(next: ArtsSnapshot) { setPreview(next); setReviewConfirmed(false); }
  function reviewCurrent() {
    generation.current++; rawFile.current = null; setBusy(false); setHeaders([]); setError(''); setReviewConfirmed(false);
    setPreview(snapshot); setReviewVersion(version => version + 1);
    if (fileInput.current) fileInput.current.value = '';
  }
  function apply() {
    if (!preview || !reviewConfirmed) return;
    try {
      useRoster(confirmRosterMappings(preview)); rawFile.current = null;
      if (fileInput.current) fileInput.current.value = '';
      router.push('/arts/overview');
    }
    catch { setError('The summary could not be saved in this tab. Allow browser storage and try again. Your current dashboard data is unchanged.'); }
  }
  function clear() {
    try { clearRoster(); generation.current++; rawFile.current = null; setBusy(false); setPreview(null); setHeaders([]); setReviewConfirmed(false); setError(''); if (fileInput.current) fileInput.current.value = ''; }
    catch { setError('The saved summary could not be cleared. Check browser storage permissions and try again.'); }
  }
  const summary = preview?.roster;
  return <>
    <header className="arts-heading"><div><h1>School data</h1><p>Upload a CSV, map its columns, then review course and school mappings before applying the summary to this tab’s dashboards.</p></div></header>
    <section className="arts-section arts-upload"><h2>Upload a roster</h2><p>The file is read in your browser. Student IDs are used temporarily for distinct counts. Student IDs, student rows and teacher names are excluded from the saved summary and are never sent to the app’s server.</p>
      <label htmlFor="arts-roster-file">Arts enrollment CSV</label><input ref={fileInput} id="arts-roster-file" type="file" accept=".csv,text/csv" onChange={selectFile} disabled={!ready} aria-describedby="arts-roster-help" />
      <p id="arts-roster-help" className="arts-note">You can choose source columns for School, Student ID, Grade, Course Num, Course Title and School Year. Schools must include a four-digit code in brackets. Export one school year at a time. Maximum 10 MB.</p>
      {busy && <p role="status">Reading CSV headings…</p>}
      {error && <p role="alert" className="arts-empty arts-error">{error}</p>}
    </section>
    {headers.length > 0 && <section className="arts-section"><h2>Map CSV columns</h2><p>Check each source column. Matching headings are suggested; each required field must use a different column. Teacher names are not needed.</p><div className="arts-column-mapping">{rosterColumns.map(field => <div className="arts-field" key={field}><label htmlFor={`column-${field.replace(/ /g, '-')}`}>{field}{field === 'Student ID' ? ' (counting only)' : ''}</label><select id={`column-${field.replace(/ /g, '-')}`} value={columns[field]} onChange={event => { setColumns(previous => ({ ...previous, [field]: event.target.value })); setPreview(null); setReviewConfirmed(false); setError(''); }}><option value="">Choose a source column</option>{headers.map(header => <option key={header}>{header}</option>)}</select></div>)}</div><button className="arts-button" type="button" onClick={reviewFile}>Review roster</button></section>}
    {preview && summary && <section className="arts-section" aria-labelledby="arts-upload-review"><h2 id="arts-upload-review">Review before using</h2><p>{summary.fileName} · {preview.academicYear} · Observed grades: {summary.observedGrades}</p>
      <dl className="arts-summary"><div><dt>Schools in file</dt><dd>{preview.schools.length}</dd></div><div><dt>Distinct students</dt><dd>{formatCount(summary.uniqueStudents)}</dd></div><div><dt>School-course offerings</dt><dd>{formatCount(preview.programs.length)}</dd></div><div><dt>Course enrollments</dt><dd>{formatCount(summary.courseEnrollments)}</dd></div></dl>
      <ul className="arts-import-notes"><li>{formatCount(summary.sourceRows)} source rows; {formatCount(summary.repeatedEnrollments)} repeated student/school/course/year rows do not add another enrollment.</li><li>{summary.crossSchoolStudents} students appear at multiple schools. The all-schools distinct count counts each student once.</li><li>Original course codes, leading zeros and suffixes are preserved. Similar titles are not merged.</li><li>{summary.unmappedOfferings} offerings currently have no discipline mapping. You may map them below or intentionally leave them Not mapped.</li><li>This export shows observed grades and arts students. It does not establish complete school enrollment, school grade ranges or participation rates.</li></ul>
      <RosterMappingReview key={reviewVersion} snapshot={preview} onChange={updateMappings} />
      {headers.length === 0 && <p className="arts-note">To change the source column assignments, select the CSV again. You can review the saved course and school mappings here without the original file.</p>}
      <label className="arts-review-confirm"><input type="checkbox" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} />I reviewed the {headers.length ? 'column, course and school' : 'course and school'} mappings. Any fields left Not mapped are intentional.</label>
      <button className="arts-button" type="button" disabled={!reviewConfirmed} onClick={apply}>Use in dashboards</button>
    </section>}
    {ready && <section className="arts-section"><h2>Current dashboard data</h2><p>{snapshot.provenance.kind === 'uploaded' ? `${snapshot.roster?.fileName} is active in this tab. Refreshes and dashboard navigation retain the aggregate summary. Other tabs and devices use their own data selection.` : 'Sample data is active. Selecting a file does not replace it until you click “Use in dashboards.”'}</p>
      {snapshot.provenance.kind === 'uploaded' && <button className="arts-button" type="button" onClick={reviewCurrent}>Review current mappings</button>} {(snapshot.provenance.kind === 'uploaded' || storageError) && <button className="arts-button" type="button" onClick={clear}>Clear tab data and show samples</button>} <Link href="/arts/overview">Open overview</Link>
    </section>}
  </>;
}

import 'server-only';
import { sampleArtsSnapshot } from './sample-data';
import type { ArtsSnapshot } from './types';

/** Read-only adapter boundary. No database seeds, jobs, mutations or live fallback. */
export async function readArtsSnapshot(): Promise<ArtsSnapshot> {
  return sampleArtsSnapshot;
}

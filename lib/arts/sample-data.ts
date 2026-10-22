import type { ArtsSnapshot, Provenance } from './types';

const provenance: Provenance = { kind: 'sample', sourceId: 'arts-sample-v1', asOf: '2026-10-15' };

// Fictional schools and aggregate program data only. Never seed these into Work OS.
export const sampleArtsSnapshot: ArtsSnapshot = {
  academicYear: '2026–27',
  provenance,
  schools: [
    { id: 'sample-cedar', name: 'Cedar Grove Elementary', level: 'Elementary', grades: 'K–5', enrollment: 520, coordinator: 'Sample arts team', provenance },
    { id: 'sample-harbor', name: 'Harbor View Elementary', level: 'Elementary', grades: 'K–5', enrollment: 465, coordinator: 'Sample arts team', provenance },
    { id: 'sample-river', name: 'Riverbend Middle', level: 'Middle', grades: '6–8', enrollment: 780, coordinator: 'Sample arts team', provenance },
    { id: 'sample-meadow', name: 'Meadow Park Middle', level: 'Middle', grades: '6–8', enrollment: 640, coordinator: 'Sample arts team', provenance },
    { id: 'sample-summit', name: 'Summit High', level: 'High', grades: '9–12', enrollment: 1420, coordinator: 'Sample arts team', provenance },
    { id: 'sample-lake', name: 'Lakewood High', level: 'High', grades: '9–12', enrollment: 1180, coordinator: 'Sample arts team', provenance },
  ],
  programs: [
    { id: 'sample-cedar-music', schoolId: 'sample-cedar', name: 'General music', discipline: 'Music', academicYear: '2026–27', status: 'Active', enrolled: 520, capacity: 520, staffingFte: 1, priority: 'Refresh classroom instruments', provenance },
    { id: 'sample-cedar-art', schoolId: 'sample-cedar', name: 'Studio foundations', discipline: 'Visual arts', academicYear: '2026–27', status: 'Active', enrolled: 520, capacity: 520, staffingFte: 1, priority: 'Replenish consumable supplies', provenance },
    { id: 'sample-harbor-music', schoolId: 'sample-harbor', name: 'General music', discipline: 'Music', academicYear: '2026–27', status: 'Active', enrolled: 465, capacity: 465, staffingFte: 1, priority: 'Build a singing games sequence', provenance },
    { id: 'sample-harbor-art', schoolId: 'sample-harbor', name: 'Visual storytelling', discipline: 'Visual arts', academicYear: '2026–27', status: 'Active', enrolled: 465, capacity: 465, staffingFte: 1, priority: 'Plan the family gallery', provenance },
    { id: 'sample-river-band', schoolId: 'sample-river', name: 'Beginning & concert band', discipline: 'Music', academicYear: '2026–27', status: 'Active', enrolled: 146, capacity: 180, staffingFte: 1, priority: 'Review instrument repair needs', provenance },
    { id: 'sample-river-art', schoolId: 'sample-river', name: 'Visual arts', discipline: 'Visual arts', academicYear: '2026–27', status: 'Active', enrolled: 210, capacity: 240, staffingFte: 1, priority: 'Calibrate portfolio feedback', provenance },
    { id: 'sample-river-theatre', schoolId: 'sample-river', name: 'Theatre ensemble', discipline: 'Theatre', academicYear: '2026–27', status: 'Planning', enrolled: null, capacity: 60, staffingFte: null, priority: 'Confirm staffing and rehearsal space', provenance },
    { id: 'sample-meadow-band', schoolId: 'sample-meadow', name: 'Concert band', discipline: 'Music', academicYear: '2026–27', status: 'Active', enrolled: 112, capacity: 150, staffingFte: 1, priority: 'Review beginner recruitment', provenance },
    { id: 'sample-meadow-dance', schoolId: 'sample-meadow', name: 'Dance foundations', discipline: 'Dance', academicYear: '2026–27', status: 'Active', enrolled: 64, capacity: 80, staffingFte: 0.5, priority: 'Assess floor and space needs', provenance },
    { id: 'sample-summit-band', schoolId: 'sample-summit', name: 'Band & instrumental music', discipline: 'Music', academicYear: '2026–27', status: 'Active', enrolled: 182, capacity: 220, staffingFte: 1.5, priority: 'Plan replacement instrument cycle', provenance },
    { id: 'sample-summit-art', schoolId: 'sample-summit', name: 'Studio art & portfolio', discipline: 'Visual arts', academicYear: '2026–27', status: 'Active', enrolled: 236, capacity: 250, staffingFte: 1.5, priority: 'Coordinate portfolio review', provenance },
    { id: 'sample-summit-theatre', schoolId: 'sample-summit', name: 'Theatre production', discipline: 'Theatre', academicYear: '2026–27', status: 'Active', enrolled: 96, capacity: 120, staffingFte: 1, priority: 'Review production calendar', provenance },
    { id: 'sample-lake-choir', schoolId: 'sample-lake', name: 'Choral music', discipline: 'Music', academicYear: '2026–27', status: 'Active', enrolled: 124, capacity: 160, staffingFte: 1, priority: 'Support feeder-school transition', provenance },
    { id: 'sample-lake-dance', schoolId: 'sample-lake', name: 'Dance ensemble', discipline: 'Dance', academicYear: '2026–27', status: 'Active', enrolled: 72, capacity: 90, staffingFte: 0.5, priority: 'Build performance assessment rubric', provenance },
  ],
  learning: [
    { id: 'sample-learning-1', programId: 'sample-cedar-music', focus: 'Steady beat & rhythm', evidence: 'Sample walkthrough: students transfer spoken patterns to instruments.', nextStep: 'Add an individual rhythm check.', reviewedOn: '2026-10-08', provenance },
    { id: 'sample-learning-2', programId: 'sample-river-art', focus: 'Student critique', evidence: 'Sample walkthrough: students reference criteria in peer feedback.', nextStep: 'Compare feedback across two portfolio tasks.', reviewedOn: '2026-10-09', provenance },
    { id: 'sample-learning-3', programId: 'sample-summit-theatre', focus: 'Ensemble collaboration', evidence: 'Sample walkthrough: rehearsal roles are visible and rotated.', nextStep: 'Include student reflection after rehearsal.', reviewedOn: '2026-10-12', provenance },
    { id: 'sample-learning-4', programId: 'sample-lake-dance', focus: 'Performance assessment', evidence: 'Sample planning note: common criteria are being drafted.', nextStep: 'Review criteria with the teaching team.', reviewedOn: '2026-10-14', provenance },
  ],
  resources: [
    { id: 'sample-resource-1', programId: 'sample-cedar-music', purpose: 'Classroom instruments', allocated: 6000, spent: 2200, need: 'Replace worn mallets and hand drums', provenance },
    { id: 'sample-resource-2', programId: 'sample-cedar-art', purpose: 'Studio supplies', allocated: 4500, spent: 1800, need: 'Paper, paint and clay replenishment', provenance },
    { id: 'sample-resource-3', programId: 'sample-river-band', purpose: 'Instrument repairs', allocated: 12000, spent: 9200, need: 'Prioritize the repair queue', provenance },
    { id: 'sample-resource-4', programId: 'sample-meadow-dance', purpose: 'Dance space', allocated: 8000, spent: 1500, need: 'Floor assessment pending', provenance },
    { id: 'sample-resource-5', programId: 'sample-summit-band', purpose: 'Instrument replacement', allocated: 24000, spent: 14500, need: 'Review replacement cycle', provenance },
    { id: 'sample-resource-6', programId: 'sample-summit-theatre', purpose: 'Production equipment', allocated: 10000, spent: 4000, need: 'Review lighting maintenance', provenance },
    { id: 'sample-resource-7', programId: 'sample-lake-dance', purpose: 'Performance resources', allocated: null, spent: null, need: 'Allocation not yet mapped in this example', provenance },
  ],
  events: [
    { id: 'sample-event-1', schoolId: 'sample-harbor', programIds: ['sample-harbor-art'], title: 'Family gallery evening', date: '2026-10-29', partner: 'Sample community arts council', status: 'Confirmed', provenance },
    { id: 'sample-event-2', schoolId: 'sample-summit', programIds: ['sample-summit-theatre'], title: 'Fall theatre showcase', date: '2026-11-06', partner: null, status: 'Planning', provenance },
    { id: 'sample-event-3', schoolId: 'sample-river', programIds: ['sample-river-band'], title: 'Instrument clinic', date: '2026-11-12', partner: 'Sample teaching artist network', status: 'Planning', provenance },
    { id: 'sample-event-4', schoolId: 'sample-lake', programIds: ['sample-lake-choir', 'sample-lake-dance'], title: 'Winter arts evening', date: '2026-12-10', partner: null, status: 'Planning', provenance },
  ],
  sourceMappings: [
    { id: 'schools', domain: 'Schools & programs', candidate: 'District school directory and course roster — to confirm', requiredFields: 'School ID, program ID, academic year, discipline, enrollment, capacity', status: 'Not connected' },
    { id: 'learning', domain: 'Teaching & learning', candidate: 'Curriculum and walkthrough records — to confirm', requiredFields: 'Program ID, focus, reviewed date, aggregate evidence, next step', status: 'Not connected' },
    { id: 'resources', domain: 'Resources & budget', candidate: 'Approved finance and inventory sources — to confirm', requiredFields: 'Program ID, fiscal period, allocation, actual spend, currency', status: 'Not connected' },
    { id: 'events', domain: 'Events & partnerships', candidate: 'Approved arts calendar and partner directory — to confirm', requiredFields: 'Event ID, school ID, program IDs, date, partner, status', status: 'Not connected' },
    { id: 'project-links', domain: 'School–project relationships', candidate: 'Explicitly reviewed links to existing Work OS IDs', requiredFields: 'School ID or program ID, existing work item UUID, owner approval', status: 'Not connected' },
  ],
};

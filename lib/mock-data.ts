import { WorkItem } from './types';

export const areas = [
  'Curriculum','Finance & Budget','Advocacy','Construction / FF&E','Technology','Data / Analytics','Teacher Support / PD','CTE Development','Presentations / Communications','Partnerships / Grants'
];

export const initialItems: WorkItem[] = [
  { id:'arts-intel', title:'District Arts Intelligence Hub', type:'Dashboard', area:'Data / Analytics', status:'Active', priority:'Now', impact:'High', effort:'Significant', outcome:'Early-warning system identifying arts programs needing district support.', nextAction:'Finalize enrollment warning indicators.', whyNow:'Needed for data-driven program support decisions.', source:'Work OS / Arts Data ecosystem', relatedItems:['Enrollment Dashboard','Arts Import & Reconciliation','Data Debrief Dashboard'], lastActivityDays:9, purpose:'Program health and early-warning monitoring' },
  { id:'importer', title:'Arts Import & Reconciliation', type:'Tool / App', area:'Technology', status:'Review', priority:'Now', impact:'High', effort:'Significant', outcome:'Reliable canonical ingestion and reconciliation for arts enrollment data.', nextAction:'Complete browser acceptance testing.', source:'GitHub: clb1015/district-arts-dashboard', relatedItems:['Enrollment Dashboard','District Arts Intelligence Hub'], lastActivityDays:2, purpose:'Canonical data ingestion and reconciliation' },
  { id:'enrollment', title:'Enrollment Dashboard', type:'Dashboard', area:'Data / Analytics', status:'Active', priority:'Now', impact:'High', effort:'Moderate', nextAction:'Validate 2026 enrollment course mappings.', source:'Arts Data ecosystem', relatedItems:['Arts Import & Reconciliation','District Arts Intelligence Hub'], lastActivityDays:4, purpose:'Enrollment and participation trends' },
  { id:'genmusbot', title:'GenMusBot', type:'Tool / App', area:'Technology', status:'Active', priority:'Next', impact:'High', effort:'Significant', nextAction:'Finish current knowledge and lesson-generation validation.', source:'GitHub / Vercel', lastActivityDays:7, purpose:'Elementary general-music lesson generation and coaching' },
  { id:'ai-fellows', title:'AI Fellows Problem of Practice', type:'Project', area:'Teacher Support / PD', status:'Active', priority:'Now', impact:'High', effort:'Moderate', nextAction:'Refine measurable classroom implementation and evidence plan.', lastActivityDays:1 },
  { id:'band-central', title:'Band Central Funding', type:'Workflow', area:'Finance & Budget', status:'Active', priority:'Now', impact:'High', effort:'Moderate', nextAction:'Collect remaining three-quote documentation.', source:'District finance workflow', lastActivityDays:1, purpose:'Annual instrument/equipment funding workflow' },
  { id:'valencia', title:'Valencia DirectConnect Alignment', type:'Project', area:'CTE Development', status:'Active', priority:'Next', impact:'High', effort:'Significant', outcome:'Align district music/entertainment pathways with Valencia programs and direct-connect opportunities.', lastActivityDays:10 },
  { id:'ffe', title:'FF&E Lessons Learned', type:'Workflow', area:'Construction / FF&E', status:'Active', priority:'Next', impact:'High', effort:'Moderate', nextAction:'Continue capturing project-specific lessons and normalize into reusable records.', source:'OneDrive', lastActivityDays:5 },
  { id:'nova-stage', title:'Nova Lakes Stage Issue', type:'Issue', area:'Construction / FF&E', status:'Waiting', priority:'Now', impact:'High', effort:'Moderate', nextAction:'Follow up on corrective-action timeline.', waitingOn:'Facilities / construction response', lastActivityDays:8 },
  { id:'seal', title:'Florida Seal of Fine Arts', type:'Workflow', area:'Curriculum', status:'Active', priority:'Next', impact:'High', effort:'Moderate', nextAction:'Maintain counselor support and annual submission workflow.', lastActivityDays:6 },
  { id:'chorus', title:'All County Elementary Chorus', type:'Project', area:'Curriculum', status:'Active', priority:'Next', impact:'Medium', effort:'Moderate', nextAction:'Continue event planning for Feb. 18, 2027.', targetDate:'2027-02-18', lastActivityDays:4 },
  { id:'disney', title:'Disney Musicals Transportation', type:'Issue', area:'Partnerships / Grants', status:'Waiting', priority:'Now', impact:'High', effort:'Moderate', nextAction:'Await district leadership guidance on transportation support.', waitingOn:'District leadership response', targetDate:'2027-04-29', lastActivityDays:1 },
  { id:'chart-builder', title:'Modern Band Chart Builder', type:'Tool / App', area:'Technology', status:'Review', priority:'Later', impact:'Medium', effort:'Moderate', nextAction:'Validate chart layout against reference examples.', lastActivityDays:4, purpose:'Generate usable modern-band charts' },
  { id:'mcgolden', title:'McGolden / Osceola Rocks Grant', type:'Project', area:'Partnerships / Grants', status:'Active', priority:'Now', impact:'High', effort:'Moderate', nextAction:'Finalize application budget and narrative.', lastActivityDays:2 },
  { id:'debrief', title:'Data Debrief Dashboard', type:'Dashboard', area:'Data / Analytics', status:'Review', priority:'Later', impact:'Medium', effort:'Moderate', nextAction:'Decide whether to archive or fold useful components into Arts Intelligence Hub.', relatedItems:['District Arts Intelligence Hub'], lastActivityDays:5, purpose:'Instructional data-debrief visualization' },
  { id:'replacement', title:'Arts Equipment Replacement Cycle', type:'Idea', area:'Finance & Budget', status:'Inbox', priority:'Later', impact:'High', effort:'Significant', ideaStage:'Spark', nextAction:'Explore overlap with inventory, Band Central, and FF&E planning.', lastActivityDays:0 },
  { id:'old-brief', title:'2025 Arts Year-in-Review Brief', type:'Presentation', area:'Presentations / Communications', status:'Done', priority:'Later', impact:'Medium', effort:'Moderate', outcome:'Annual accomplishments communicated to district leadership.', lastActivityDays:120 }
];

export const bandCentralSteps = [
  ['Identify eligible schools', true],
  ['Notify directors', true],
  ['Collect three quotes', false],
  ['Validate purchases', false],
  ['Transfer funds', false],
  ['Purchase', false],
  ['Archive documentation', false]
] as const;

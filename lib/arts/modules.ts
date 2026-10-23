export const artsModules = [
  { slug: 'overview', name: 'Overview', description: 'A district view of arts access, priorities and source readiness.' },
  { slug: 'programs', name: 'Schools & Programs', description: 'Find a school, explore its programs and open its School 360 profile.' },
  { slug: 'teaching', name: 'Teaching & Learning', description: 'Connect program priorities with instructional evidence and next steps.' },
  { slug: 'resources', name: 'Resources & Budget', description: 'Review recorded allocations, spending and program resource needs.' },
  { slug: 'events', name: 'Events & Partnerships', description: 'See school events and the partners supporting arts experiences.' },
  { slug: 'projects', name: 'Projects & Priorities', description: 'Review existing Work OS projects and return to the workspace to act.' },
] as const;
export type ArtsModuleSlug = typeof artsModules[number]['slug'];

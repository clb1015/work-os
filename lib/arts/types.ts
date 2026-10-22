/** Shared read model. Sample IDs must never be used as production identifiers. */
export type Discipline = 'Music' | 'Visual arts' | 'Theatre' | 'Dance';
export type SchoolLevel = 'Elementary' | 'Middle' | 'High';
export type Provenance = Readonly<{
  kind: 'sample' | 'connected';
  sourceId: string;
  asOf: string;
}>;
export type School = Readonly<{
  id: string;
  name: string;
  level: SchoolLevel;
  grades: string;
  enrollment: number | null;
  coordinator: string;
  provenance: Provenance;
}>;
export type Program = Readonly<{
  id: string;
  schoolId: School['id'];
  name: string;
  discipline: Discipline;
  academicYear: string;
  status: 'Active' | 'Planning';
  enrolled: number | null;
  capacity: number | null;
  staffingFte: number | null;
  priority: string;
  provenance: Provenance;
}>;
export type LearningRecord = Readonly<{
  id: string;
  programId: Program['id'];
  focus: string;
  evidence: string;
  nextStep: string;
  reviewedOn: string;
  provenance: Provenance;
}>;
export type ResourceAllocation = Readonly<{
  id: string;
  programId: Program['id'];
  purpose: string;
  allocated: number | null;
  spent: number | null;
  need: string;
  provenance: Provenance;
}>;
export type ArtsEvent = Readonly<{
  id: string;
  schoolId: School['id'];
  programIds: readonly Program['id'][];
  title: string;
  date: string;
  partner: string | null;
  status: 'Planning' | 'Confirmed';
  provenance: Provenance;
}>;
export type SourceMapping = Readonly<{
  id: string;
  domain: string;
  candidate: string;
  requiredFields: string;
  status: 'Not connected';
}>;
export type ArtsSnapshot = Readonly<{
  academicYear: string;
  provenance: Provenance;
  schools: readonly School[];
  programs: readonly Program[];
  learning: readonly LearningRecord[];
  resources: readonly ResourceAllocation[];
  events: readonly ArtsEvent[];
  sourceMappings: readonly SourceMapping[];
}>;

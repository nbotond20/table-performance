export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type Status = 'Active' | 'Inactive' | 'Graduated';

export const GRADES: readonly Grade[] = ['A', 'B', 'C', 'D', 'F'];
export const STATUSES: readonly Status[] = ['Active', 'Inactive', 'Graduated'];

export interface StudentRow {
  id: number;
  // Metadata
  name: string;
  email: string;
  age: number;
  grade: Grade;
  status: Status;
  enrollmentDate: string;
  // Exercises (30)
  [key: `ex${number}`]: number;
  // Aggregates (computed)
  avgScore: number;
  minScore: number;
  maxScore: number;
  totalPoints: number;
  passRate: number; // percentage of exercises >= 50
}

export const EXERCISE_COUNT = 30;

export type ExerciseKey = `ex${number}`;

export const EXERCISE_KEYS = Array.from(
  { length: EXERCISE_COUNT },
  (_, i) => `ex${i + 1}` as ExerciseKey,
);

export interface PerformanceMetrics {
  initialRender: number | null;
  lastSort: number | null;
  lastFilter: number | null;
  lastEdit: number | null;
  renderCount: number;
  lastRenderTime: number | null;
}

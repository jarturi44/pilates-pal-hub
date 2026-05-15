export const EXERCISE_CATEGORIES = [
  "Mat Work",
  "Stretching",
  "Foam Roller",
  "Resistance Bands",
  "Ring Work",
  "Strap Work",
  "Door Anchor",
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EXERCISE_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];

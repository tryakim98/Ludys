import type { ExerciseDefinition } from "../../core/skynja/exercise-room.js";
import { buildingExercises } from "./building-exercises.js";
import { readingExercises } from "./reading-exercises.js";
import { judgmentExercises } from "./judgment-exercises.js";
import { evidenceExercise } from "./evidence-exercise.js";

export const exerciseCatalog: readonly ExerciseDefinition[] = [
  ...buildingExercises.filter((exercise) => exercise.kind === "WORD" || exercise.kind === "COMPOUND"),
  ...readingExercises.filter((exercise) => exercise.kind === "CLOZE"),
  ...buildingExercises.filter((exercise) => exercise.kind === "SENTENCE"),
  ...readingExercises.filter((exercise) => exercise.kind === "READING"),
  ...judgmentExercises,
  evidenceExercise,
];

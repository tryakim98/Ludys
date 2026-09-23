import { ExerciseRoomController } from "../application/skynja/exercise-room-controller.js";
import { exerciseCatalog } from "../content/skynja/exercise-catalog.js";

export function createExerciseRoom(): ExerciseRoomController { return new ExerciseRoomController(exerciseCatalog); }

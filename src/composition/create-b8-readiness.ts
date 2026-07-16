import { B8ReadinessController } from "../application/b8-readiness-controller.js";
import { b8ReadinessDossier } from "../content/prototype/b8-readiness-dossier.js";

export function createB8ReadinessController(): B8ReadinessController {
  return new B8ReadinessController(b8ReadinessDossier);
}

import { BetaOperationsController } from "../application/beta-operations-controller.js";
import { wp13_11OperationsKit } from "../content/operations/wp13-11-operations-kit.js";

export function createBetaOperations(): BetaOperationsController {
  return new BetaOperationsController(wp13_11OperationsKit);
}

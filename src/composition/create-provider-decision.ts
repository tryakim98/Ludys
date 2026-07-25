import { ProviderDecisionController } from "../application/provider-decision-controller.js";
import { wp13_12aProviderDecisionPackage } from "../content/provider-decision/wp13-12a-decision-package.js";

export function createProviderDecision(): ProviderDecisionController {
  return new ProviderDecisionController(wp13_12aProviderDecisionPackage);
}

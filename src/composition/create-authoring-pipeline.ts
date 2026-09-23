import { AuthoringPipelineController } from "../application/authoring-pipeline-controller.js";
import { wp13_9AuthoringPackages } from "../content/authoring/wp13-9-authoring-packages.js";
import { wp13_9TechnicalAudioFixtures } from "../content/authoring/wp13-9-technical-audio-fixtures.js";
import { contentExpansionDraftPackages } from "../content/authoring/content-expansion-2026-09-22.js";

export function createAuthoringPipeline(): AuthoringPipelineController {
  return new AuthoringPipelineController([...wp13_9AuthoringPackages, ...contentExpansionDraftPackages], wp13_9TechnicalAudioFixtures);
}

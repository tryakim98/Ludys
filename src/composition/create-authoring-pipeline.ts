import { AuthoringPipelineController } from "../application/authoring-pipeline-controller.js";
import { wp13_9AuthoringPackages } from "../content/authoring/wp13-9-authoring-packages.js";
import { wp13_9TechnicalAudioFixtures } from "../content/authoring/wp13-9-technical-audio-fixtures.js";

export function createAuthoringPipeline(): AuthoringPipelineController {
  return new AuthoringPipelineController(wp13_9AuthoringPackages, wp13_9TechnicalAudioFixtures);
}

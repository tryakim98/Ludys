import { readFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { exerciseCatalog } from "../dist/src/content/skynja/exercise-catalog.js";
import { createExerciseReviewPacket, createExerciseReviewForm, exerciseReviewJson, exerciseReviewMarkdown } from "../dist/src/application/skynja/exercise-review.js";
import { createAuthoringPipeline } from "../dist/src/composition/create-authoring-pipeline.js";
import { createSyntheticAppNavigation } from "../dist/src/composition/create-synthetic-app-navigation.js";
import { partitionExercisePolicy } from "../dist/src/core/skynja/exercise-room-policy.js";

const root = fileURLToPath(new URL("../release/skynja-pilot-review/", import.meta.url));
const check = process.argv.includes("--check");
const policy = JSON.parse(await readFile(new URL("../web/corpus-lifecycle-policy.json", import.meta.url), "utf8"));
const authoringPolicy = JSON.parse(await readFile(new URL("../web/authoring-lifecycle-policy.json", import.meta.url), "utf8"));
const partition = partitionExercisePolicy(policy, exerciseCatalog);
// Reuse the app's policy validators; unknown legacy IDs must remain an error.
createSyntheticAppNavigation("nb-NO").controller.applyRestrictiveCorpusPolicy(partition.legacyPolicy);
const authoring = createAuthoringPipeline();
authoring.applyRestrictivePolicy(authoringPolicy);
const blocked = [...partition.blockedIds, ...authoring.view.packages.filter((item) => item.lifecycle !== "CURRENT").map((item) => item.activityId)];
const packet = createExerciseReviewPacket(exerciseCatalog, blocked);
const files = {
  "content-review.md": exerciseReviewMarkdown(packet),
  "content-snapshot.json": exerciseReviewJson(packet),
  "review-form-template.json": exerciseReviewJson(createExerciseReviewForm(packet)),
};
if (!check) await mkdir(root, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  if (check) {
    const actual = await readFile(join(root, name), "utf8").catch(() => null);
    if (actual !== content) throw new Error(`SKYNJA_REVIEW_PACKAGE_STALE: ${name}; rebuild and run npm run pilot:review:generate`);
  } else await writeFile(join(root, name), content, "utf8");
}
// A withdrawn/renamed artifact must not silently remain in a regenerated handoff.
const unexpected = (await readdir(root)).filter((name) => !(name in files));
if (unexpected.length) throw new Error(`SKYNJA_REVIEW_PACKAGE_UNEXPECTED_FILES: ${unexpected.join(", ")}`);
console.log(JSON.stringify({ status: check ? "REVIEW_PACKAGE_CURRENT" : "REVIEW_PACKAGE_GENERATED", exerciseCount: packet.exerciseCount, semanticRoundCount: packet.semanticRoundCount, localizedRoundCount: packet.localizedRoundCount, contentSetSha256: packet.contentSetSha256, humanReview: "AWAITING_HUMAN_REVIEW", pilotAuthorization: "NOT_GRANTED" }, null, 2));

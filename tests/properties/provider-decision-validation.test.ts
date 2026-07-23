import assert from "node:assert/strict";
import test from "node:test";
import { wp13_12aProviderDecisionPackage as baseline } from "../../src/content/provider-decision/wp13-12a-decision-package.js";
import { validateProviderDecisionPackage, type ProviderDecisionPackage } from "../../src/core/provider-decision.js";

type MutablePackage = {
  -readonly [K in keyof ProviderDecisionPackage]: ProviderDecisionPackage[K] extends readonly (infer U)[] ? U[] : ProviderDecisionPackage[K];
};

function copy(): MutablePackage {
  return structuredClone(baseline) as unknown as MutablePackage;
}

function invalid(mutator: (pkg: MutablePackage) => void, expected: RegExp): void {
  const candidate = copy();
  mutator(candidate);
  const result = validateProviderDecisionPackage(candidate as ProviderDecisionPackage);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), expected);
}

const cases: readonly [string, (pkg: MutablePackage) => void, RegExp][] = [
  ["missing provider option", (pkg) => { pkg.providerOptions = pkg.providerOptions.slice(1); }, /provider options/],
  ["duplicate optionId", (pkg) => { pkg.providerOptions = [...pkg.providerOptions, pkg.providerOptions[0]!]; }, /provider options|duplicate/],
  ["missing recommendation", (pkg) => { pkg.providerOptions = pkg.providerOptions.map((item) => ({ ...item, status: item.status === "RECOMMENDED" ? "NOT_RECOMMENDED" : item.status })); }, /exactly one/],
  ["multiple recommendations", (pkg) => { pkg.providerOptions = pkg.providerOptions.map((item) => ({ ...item, status: item.optionId === "LOCAL_ONLY" ? "RECOMMENDED" : item.status })); }, /exactly one/],
  ["recommendation without source", (pkg) => { pkg.providerOptions = pkg.providerOptions.map((item) => item.optionId === pkg.recommendedOptionId ? { ...item, sourceIds: [] } : item); }, /source grounding/],
  ["source without reverification marker", (pkg) => { pkg.officialSources = pkg.officialSources.map((item, index) => index === 0 ? { ...item, reverificationRequiredBefore: "" } : item); }, /undated/],
  ["missing region analysis", (pkg) => { pkg.regionAnalysis = []; }, /region analysis/],
  ["executed region lock", (pkg) => { (pkg as unknown as { regionLockNotExecuted: boolean }).regionLockNotExecuted = false; }, /region lock/],
  ["missing capability option", (pkg) => { pkg.capabilityOptions = pkg.capabilityOptions.slice(1); }, /capability options/],
  ["stable identity in recommended option", (pkg) => { pkg.providerOptions = pkg.providerOptions.map((item) => item.optionId === pkg.recommendedOptionId ? { ...item, requiresStableIdentity: true } : item); }, /identity/],
  ["direct client write", (pkg) => { pkg.providerOptions = pkg.providerOptions.map((item) => item.optionId === pkg.recommendedOptionId ? { ...item, allowsDirectClientWrite: true } : item); }, /authority/],
  ["client-selected authority generation", (pkg) => { pkg.dataflow = pkg.dataflow.map((item) => item.stepId === "AUTHORITATIVE_HANDLER" ? { ...item, authority: "CLIENT_SELECTED_AUTHORITY" } : item); }, /client-selected authority/],
  ["real data in model", (pkg) => { pkg.dataClasses = pkg.dataClasses.map((item) => item.dataClass === "name" ? { ...item, status: "ALLOWED_SYNTHETIC_CANDIDATE", authorization: "SYNTHETIC_ONLY_IF_OWNER_APPROVES_WP13_12B", storage: "AUTHORITATIVE_STORE" } : item); }, /data class register/],
  ["analytics activated", (pkg) => { pkg.noGo = pkg.noGo.filter((item) => item.noGoId !== "NO_ANALYTICS"); }, /no-go/],
  ["Cloud Storage activated", (pkg) => { pkg.noGo = pkg.noGo.filter((item) => item.noGoId !== "NO_CLOUD_STORAGE"); }, /no-go/],
  ["browser secret", (pkg) => { (pkg.iamAndSecrets as unknown as { browserServerSecrets: boolean }).browserServerSecrets = true; }, /IAM or secrets/],
  ["request body logging", (pkg) => { (pkg.loggingObservability as unknown as { requestBodyLogging: boolean }).requestBodyLogging = true; }, /request body/],
  ["capability logging", (pkg) => { (pkg.loggingObservability as unknown as { capabilityLogging: boolean }).capabilityLogging = true; }, /capability logging/],
  ["TTL as immediate deletion", (pkg) => { (pkg.retentionDeletion as unknown as { ttlIsImmediateDeletion: boolean }).ttlIsImmediateDeletion = true; }, /TTL/],
  ["missing explicit deletion", (pkg) => { (pkg.retentionDeletion as unknown as { explicitDeletion: string[] }).explicitDeletion = []; }, /explicit deletion/],
  ["missing tombstone", (pkg) => { (pkg.retentionDeletion as unknown as { tombstone: string[] }).tombstone = []; }, /tombstone/],
  ["no-resurrection broken", (pkg) => { (pkg.retentionDeletion as unknown as { deletedSessionCannotResurrect: boolean }).deletedSessionCannotResurrect = false; }, /no-resurrection/],
  ["overbroad service account", (pkg) => { (pkg.iamAndSecrets as unknown as { broadOwnerRoleAllowedForRuntime: boolean }).broadOwnerRoleAllowedForRuntime = true; }, /IAM or secrets/],
  ["cost estimate as guarantee", (pkg) => { (pkg.costModel.rows[0] as unknown as { estimateIsGuarantee: boolean }).estimateIsGuarantee = true; }, /guaranteed/],
  ["billing alert as hard cap", (pkg) => { (pkg.costModel.rows[0] as unknown as { billingAlertIsHardCap: boolean }).billingAlertIsHardCap = true; }, /hard cap/],
  ["missing kill switch owner field", (pkg) => { delete (pkg.costModel.ownerFields as unknown as { killSwitchOwner?: string }).killSwitchOwner; }, /owner cost fields/],
  ["missing exit plan", (pkg) => { (pkg.migrationExit as unknown as { providerMigration: string[] }).providerMigration = []; }, /exit plan/],
  ["missing no-go", (pkg) => { pkg.noGo = []; }, /no-go/],
  ["missing BM", (pkg) => { pkg.localeBundles = pkg.localeBundles.filter((item) => item.locale !== "nb"); }, /locale bundles/],
  ["missing NN", (pkg) => { pkg.localeBundles = pkg.localeBundles.filter((item) => item.locale !== "nn"); }, /locale bundles/],
  ["BM/NN status mismatch", (pkg) => { pkg.localeBundles = pkg.localeBundles.map((item) => item.locale === "nn" ? { ...item, humanReviewStatus: "APPROVED" as never } : item); }, /incomplete or falsely reviewed/],
  ["automatic owner approval", (pkg) => { (pkg.authorization as unknown as { ownerDecision: string }).ownerDecision = "APPROVE_RECOMMENDED_SYNTHETIC_DEV"; }, /owner decision/],
  ["fabricated signature", (pkg) => { (pkg.ownerDecisionTemplate as unknown as { signaturePresent: boolean }).signaturePresent = true; }, /signature/],
  ["provider activated", (pkg) => { (pkg.authorization as unknown as { providerActivation: string }).providerActivation = "ACTIVE"; }, /provider activation/],
  ["cloud resources greater than zero", (pkg) => { (pkg.authorization as unknown as { cloudResources: number }).cloudResources = 1; }, /cloud resources/],
  ["B8 approved", (pkg) => { (pkg.authorization as unknown as { b8: string }).b8 = "APPROVED"; }, /B8/],
  ["student beta authorized", (pkg) => { (pkg.authorization as unknown as { studentBeta: string }).studentBeta = "AUTHORIZED"; }, /student/],
  ["production authorized", (pkg) => { (pkg.authorization as unknown as { production: string }).production = "AUTHORIZED"; }, /production/],
  ["WP13.12B opened", (pkg) => { (pkg.authorization as unknown as { wp13_12b: string }).wp13_12b = "OPEN"; }, /WP13.12B/],
];

for (const [name, mutate, expected] of cases) {
  test(`provider decision validator rejects ${name}`, () => invalid(mutate, expected));
}

test("valid package returns the exact machine-readable authorization ceiling", () => {
  assert.deepEqual(validateProviderDecisionPackage(baseline), {
    valid: true,
    errors: [],
    warnings: [],
    packageStatus: "READY_FOR_OWNER_DECISION",
    ownerDecision: "PENDING_OWNER_ACTION",
    providerActivation: "BLOCKED",
    cloudResources: 0,
    externalReceipts: 0,
    studentBetaAuthorized: false,
  });
});

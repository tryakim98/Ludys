import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  copyReviewRequiredStatus,
  copyReviewSourceSetSha256,
  evaluateCopyReview,
  requiredHumanApprovalStatement,
} from "../tools/copy-review-preflight.mjs";
import { buildApprovedCopyReviewContract } from "../tools/record-copy-review.mjs";
import {
  createLocaleRequestCoordinator,
  reviewedDenialClass,
  validateLocaleModule,
} from "../lib/reviewed-copy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function source(path) {
  return readFile(resolve(root, path), "utf8");
}

test("preview is dependency-free and has exact same-origin operator endpoints", async () => {
  await assert.rejects(access(resolve(root, "package.json")));
  await access(resolve(root, "api/issue.mjs"));
  await access(resolve(root, "api/delete.mjs"));
  const app = await source("app.mjs");
  assert.match(app, /sameOriginPost\("\/api\/issue"/u);
  assert.match(app, /sameOriginPost\("\/api\/delete"/u);
  assert.match(app, /Authorization: `Bearer \$\{capability\}`/u);
  assert.doesNotMatch(app, /[?&](?:capability|token|authorization)=/iu);
});

test("capabilities have no application persistence or diagnostic logging path", async () => {
  const runtimePaths = [
    "app.mjs",
    "api/issue.mjs",
    "api/delete.mjs",
    "api/runtime-config.mjs",
    "lib/http.mjs",
    "lib/runtime-config.mjs",
    "lib/google-identity.mjs",
    "lib/private-function-proxy.mjs",
  ];
  const combined = (await Promise.all(runtimePaths.map(source))).join("\n");
  for (const prohibited of [
    /\blocalStorage\b/u,
    /\bsessionStorage\b/u,
    /\bdocument\.cookie\b/u,
    /\bnavigator\.clipboard\b/u,
    /\bClipboard(?:Event|Item)\b/u,
    /\b(?:readText|writeText)\b/u,
    /\blocation\.(?:hash|search)\b/u,
    /\bconsole\.(?:log|info|warn|error|debug)\b/u,
    /\bVERCEL_OIDC_TOKEN\b/u,
  ]) assert.doesNotMatch(combined, prohibited);
  const html = await source("index.html");
  assert.match(html, /id="connect-capability" type="password" autocomplete="off"/u);
  assert.match(html, /id="child-capability" type="password" readonly autocomplete="off"/u);
  assert.match(html, /id="adult-capability" type="password" readonly autocomplete="off"/u);
  assert.match(html, /data-reveal-capability="CHILD" aria-pressed="false"/u);
  assert.match(html, /data-reveal-capability="ADULT" aria-pressed="false"/u);
  assert.match(html, /data-use-issued-role="CHILD"/u);
  assert.match(html, /data-use-issued-role="ADULT"/u);
  assert.doesNotMatch(html, /data-copy-capability/u);
  assert.doesNotMatch(html, /<form\b/iu);
  assert.doesNotMatch(html, /<script(?![^>]*type="module"[^>]*src="\/app\.mjs")/iu);
  const app = await source("app.mjs");
  assert.doesNotMatch(app, /\bURLSearchParams\b/u);
});

test("BM and NN are separate first-class bundles with no fallback", async () => {
  const app = await source("app.mjs");
  const nb = await source("locales/nb.mjs");
  const nn = await source("locales/nn.mjs");
  const [{ copy: nbCopy }, { copy: nnCopy }] = await Promise.all([
    import("../locales/nb.mjs"),
    import("../locales/nn.mjs"),
  ]);
  const review = JSON.parse(await source("copy-review-contract.json"));
  assert.match(app, /import\(`\.\/locales\/nb\.mjs\?request=\$\{generation\}`\)/u);
  assert.match(app, /import\(`\.\/locales\/nn\.mjs\?request=\$\{generation\}`\)/u);
  assert.match(nb, /locale: "nb-NO"/u);
  assert.doesNotMatch(nb, /locale: "nn-NO"/u);
  assert.match(nn, /locale: "nn-NO"/u);
  assert.doesNotMatch(nn, /locale: "nb-NO"/u);
  assert.deepEqual(Object.keys(nbCopy).sort(), Object.keys(nnCopy).sort());
  const {
    reviewedDenialClasses: nbReviewedDenials,
    ...nbText
  } = nbCopy;
  const {
    reviewedDenialClasses: nnReviewedDenials,
    ...nnText
  } = nnCopy;
  assert.ok(Object.values(nbText).every((value) => typeof value === "string" && value.length > 0));
  assert.ok(Object.values(nnText).every((value) => typeof value === "string" && value.length > 0));
  assert.deepEqual(nbReviewedDenials, nnReviewedDenials);
  assert.equal(Object.isFrozen(nbReviewedDenials), true);
  assert.equal(Object.isFrozen(nnReviewedDenials), true);
  assert.equal(Object.isFrozen(nbCopy), true);
  assert.equal(Object.isFrozen(nnCopy), true);
  assert.equal(review.fallbackAllowed, false);
  assert.equal(
    review.schemaVersion,
    "wp13.12b-external-preview-copy-review-v2",
  );
  assert.ok([
    "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT",
    copyReviewRequiredStatus,
  ].includes(review.status));
  assert.equal(review.requiredHumanApprovalStatement, requiredHumanApprovalStatement);
  assert.deepEqual(review.sharedSources.map((entry) => entry.source), ["index.html"]);
  assert.deepEqual(review.bundles.map((bundle) => bundle.locale), ["nb", "nn"]);
  if (review.status === "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT") {
    assert.equal(review.approvalMetadata.humanApprovalStatement, null);
    assert.equal(review.approvalMetadata.sourceSetSha256, null);
    assert.ok([...review.sharedSources, ...review.bundles].every(
      (entry) => (
        entry.reviewStatus === "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT"
        && entry.sourceSha256 === null
      ),
    ));
  } else {
    const validation = await evaluateCopyReview({ root, contract: review });
    assert.equal(validation.valid, true);
  }
});

test("locale validator rejects every incomplete, mismatched, or expanded bundle", async () => {
  const [{ copy: nbCopy }, { copy: nnCopy }] = await Promise.all([
    import("../locales/nb.mjs"),
    import("../locales/nn.mjs"),
  ]);
  assert.equal(validateLocaleModule("nb-NO", { copy: nbCopy }), nbCopy);
  assert.equal(validateLocaleModule("nn-NO", { copy: nnCopy }), nnCopy);

  const candidate = (mutate, options = {}) => {
    const copy = { ...nnCopy };
    mutate(copy);
    return {
      copy: options.freeze === false ? copy : Object.freeze(copy),
      ...(options.extraModuleExport === true ? { fallback: nbCopy } : {}),
    };
  };
  for (const invalid of [
    null,
    {},
    candidate(() => {}, { freeze: false }),
    candidate(() => {}, { extraModuleExport: true }),
    candidate((copy) => { delete copy.terminalCopy; }),
    candidate((copy) => { copy.unreviewed = "forbidden"; }),
    candidate((copy) => { copy.locale = "nb-NO"; }),
    candidate((copy) => { copy.htmlLang = "nb"; }),
    candidate((copy) => { copy.pageTitle = ""; }),
    candidate((copy) => { copy.ready = 1; }),
    candidate((copy) => {
      copy.reviewedDenialClasses = Object.freeze(
        copy.reviewedDenialClasses.slice(1),
      );
    }),
  ]) {
    assert.throws(
      () => validateLocaleModule("nn-NO", invalid),
      /LOCALE_BUNDLE_INVALID/u,
    );
  }
  assert.throws(
    () => validateLocaleModule("sv-SE", { copy: nnCopy }),
    /LOCALE_BUNDLE_INVALID/u,
  );
});

test("locale request generations make stale success and failure side-effect free", async () => {
  const [{ copy: nbCopy }, { copy: nnCopy }] = await Promise.all([
    import("../locales/nb.mjs"),
    import("../locales/nn.mjs"),
  ]);
  const deferred = () => {
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    return { promise, reject: rejectPromise, resolve: resolvePromise };
  };

  const olderSuccess = deferred();
  const successEvents = [];
  const successCoordinator = createLocaleRequestCoordinator({
    loaders: {
      "nb-NO": async () => ({ copy: nbCopy }),
      "nn-NO": async () => olderSuccess.promise,
    },
    onPending: ({ locale }) => successEvents.push(`pending:${locale}`),
    onCommit: ({ locale }) => successEvents.push(`commit:${locale}`),
    onFailure: ({ locale }) => successEvents.push(`failure:${locale}`),
  });
  const oldSuccessRequest = successCoordinator.request("nn-NO");
  const newSuccessResult = await successCoordinator.request("nb-NO");
  olderSuccess.resolve({ copy: nnCopy });
  const oldSuccessResult = await oldSuccessRequest;
  assert.equal(newSuccessResult.status, "COMMITTED");
  assert.equal(oldSuccessResult.status, "STALE");
  assert.deepEqual(successEvents, [
    "pending:nn-NO",
    "pending:nb-NO",
    "commit:nb-NO",
  ]);

  const olderFailure = deferred();
  const failureEvents = [];
  const failureCoordinator = createLocaleRequestCoordinator({
    loaders: {
      "nb-NO": async () => ({ copy: nbCopy }),
      "nn-NO": async () => olderFailure.promise,
    },
    onPending: ({ locale }) => failureEvents.push(`pending:${locale}`),
    onCommit: ({ locale }) => failureEvents.push(`commit:${locale}`),
    onFailure: ({ locale }) => failureEvents.push(`failure:${locale}`),
  });
  const oldFailureRequest = failureCoordinator.request("nn-NO");
  const latestResult = await failureCoordinator.request("nb-NO");
  olderFailure.reject(new Error("synthetic import rejection"));
  const oldFailureResult = await oldFailureRequest;
  assert.equal(latestResult.status, "COMMITTED");
  assert.equal(oldFailureResult.status, "STALE");
  assert.deepEqual(failureEvents, [
    "pending:nn-NO",
    "pending:nb-NO",
    "commit:nb-NO",
  ]);
});

test("current locale failure is fail-closed and explicit recovery revalidates", async () => {
  const { copy: nnCopy } = await import("../locales/nn.mjs");
  let invalid = true;
  const events = [];
  const coordinator = createLocaleRequestCoordinator({
    loaders: {
      "nn-NO": async () => {
        if (!invalid) return { copy: nnCopy };
        const copy = { ...nnCopy };
        delete copy.terminalCopy;
        return { copy: Object.freeze(copy) };
      },
    },
    onPending: ({ locale }) => events.push(`pending:${locale}`),
    onCommit: ({ locale }) => events.push(`commit:${locale}`),
    onFailure: ({ denialClass }) => events.push(`failure:${denialClass}`),
  });
  assert.equal((await coordinator.request("nn-NO")).status, "FAILED");
  invalid = false;
  assert.equal((await coordinator.request("nn-NO")).status, "COMMITTED");
  assert.deepEqual(events, [
    "pending:nn-NO",
    "failure:LOCALE_BUNDLE_INVALID",
    "pending:nn-NO",
    "commit:nn-NO",
  ]);
});

test("R2 DOM control copy, locale copy, and document language binding are exact", async () => {
  const html = await source("index.html");
  const app = await source("app.mjs");
  const [{ copy: nbCopy }, { copy: nnCopy }] = await Promise.all([
    import("../locales/nb.mjs"),
    import("../locales/nn.mjs"),
  ]);
  const expectedNb = {
    operatorCopy:
      "Den syntetiske økten varer i høyst ti minutter og krever Vercel-innlogging.",
    transferCopy:
      "Del bare kapabiliteten for riktig syntetisk rolle med den aktuelle test-enheten.",
    childRole: "Syntetisk barnerolle",
    adultRole: "Syntetisk voksenrolle",
    revealChild: "Vis eller skjul kapabiliteten for barnerollen",
    revealAdult: "Vis eller skjul kapabiliteten for voksenrollen",
    useChild: "Bruk den syntetiske barnerollen her",
    useAdult: "Bruk den syntetiske voksenrollen her",
    deleteAction: "Slett den syntetiske økten",
    child: "Syntetisk barnerolle",
    adult: "Syntetisk voksenrolle",
    terminalCopy:
      "En stoppet eller slettet økt skal ikke bli aktiv igjen ved ny tilkobling.",
    deleted: "Økten er slettet. Ny tilkobling skal ikke gjøre den aktiv igjen.",
    confirmDelete:
      "Slette denne syntetiske økten og hindre at den blir aktiv igjen?",
  };
  const expectedNn = {
    operatorCopy:
      "Den syntetiske økta varer i høgst ti minutt og krev Vercel-innlogging.",
    transferCopy:
      "Del berre kapabiliteten for rett syntetisk rolle med den aktuelle testeininga.",
    childRole: "Syntetisk barnerolle",
    adultRole: "Syntetisk vaksenrolle",
    revealChild: "Vis eller skjul kapabiliteten for barnerolla",
    revealAdult: "Vis eller skjul kapabiliteten for vaksenrolla",
    useChild: "Bruk den syntetiske barnerolla her",
    useAdult: "Bruk den syntetiske vaksenrolla her",
    deleteAction: "Slett den syntetiske økta",
    child: "Syntetisk barnerolle",
    adult: "Syntetisk vaksenrolle",
    terminalCopy:
      "Ei stoppa eller sletta økt skal ikkje bli aktiv igjen ved ny tilkopling.",
    deleted: "Økta er sletta. Ny tilkopling skal ikkje gjere henne aktiv igjen.",
    confirmDelete:
      "Slette denne syntetiske økta og hindre at ho blir aktiv igjen?",
  };
  for (const [key, value] of Object.entries(expectedNb)) {
    assert.equal(nbCopy[key], value, `BM ${key}`);
  }
  for (const [key, value] of Object.entries(expectedNn)) {
    assert.equal(nnCopy[key], value, `NN ${key}`);
  }
  for (const exactControl of [
    '<button type="button" data-reveal-capability="CHILD" aria-pressed="false">Vis eller skjul kapabiliteten for barnerollen</button>',
    '<button type="button" data-use-issued-role="CHILD">Bruk den syntetiske barnerollen her</button>',
    '<button type="button" data-reveal-capability="ADULT" aria-pressed="false">Vis eller skjul kapabiliteten for voksenrollen</button>',
    '<button type="button" data-use-issued-role="ADULT">Bruk den syntetiske voksenrollen her</button>',
    '<button id="delete-session" class="danger" type="button">Slett den syntetiske økten</button>',
    '<option value="CHILD">Syntetisk barnerolle</option>',
    '<option value="ADULT">Syntetisk voksenrolle</option>',
  ]) assert.ok(html.includes(exactControl), exactControl);
  assert.match(app, /document\.documentElement\.lang = copy\.htmlLang;/u);
  assert.doesNotMatch(
    html,
    /Barnets testrolle|Voksen testrolle|Vis\/skjul barn|Vis\/skjul voksen/u,
  );
});

test("unreviewed provider denial codes are never rendered", async () => {
  const [{ copy: nbCopy }, { copy: nnCopy }] = await Promise.all([
    import("../locales/nb.mjs"),
    import("../locales/nn.mjs"),
  ]);
  for (const copy of [nbCopy, nnCopy]) {
    assert.equal(
      reviewedDenialClass("ATTACKER_CONTROLLED_UNREVIEWED_TEXT", copy.reviewedDenialClasses),
      "REQUEST_DENIED",
    );
    assert.equal(
      reviewedDenialClass("KILL_SWITCH_ACTIVE", copy.reviewedDenialClasses),
      "KILL_SWITCH_ACTIVE",
    );
  }
});

test("external deployment preflight rejects review-required and stale metadata", async () => {
  const current = JSON.parse(await source("copy-review-contract.json"));
  const pending = structuredClone(current);
  pending.status = "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT";
  pending.approvalMetadata = {
    confirmationChannel: null,
    humanApprovalStatement: null,
    reviewerIdentity: null,
    reviewerRole: null,
    reviewedAt: null,
    sourceSetSha256: null,
  };
  for (const entry of [...pending.sharedSources, ...pending.bundles]) {
    entry.reviewStatus = "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT";
    entry.sourceSha256 = null;
  }
  const blocked = await evaluateCopyReview({ root, contract: pending });
  assert.equal(blocked.valid, false);
  assert.equal(blocked.deploymentAllowed, false);
  assert.equal(blocked.externalWrites, 0);
  assert.ok(blocked.errors.includes("COPY_REVIEW_STATUS_NOT_HUMAN_APPROVED"));
  assert.ok(blocked.errors.includes("COPY_REVIEW_HUMAN_APPROVAL_STATEMENT_MISSING"));
  assert.ok(blocked.errors.some(
    (error) => error.startsWith("COPY_REVIEW_SOURCE_CHECKSUM_MISMATCH:"),
  ));

  const sourceChecksums = new Map();
  for (const path of ["index.html", "locales/nb.mjs", "locales/nn.mjs"]) {
    sourceChecksums.set(
      path,
      createHash("sha256").update(await readFile(resolve(root, path))).digest("hex"),
    );
  }
  const approved = structuredClone(pending);
  approved.status = copyReviewRequiredStatus;
  approved.approvalMetadata = {
    confirmationChannel: "CODEX_EXPLICIT_HUMAN_CONFIRMATION",
    humanApprovalStatement: requiredHumanApprovalStatement,
    reviewerIdentity: "test-product-owner@example.invalid",
    reviewerRole: "PRODUCT_OWNER",
    reviewedAt: "2026-07-27T00:00:00.000Z",
    sourceSetSha256: copyReviewSourceSetSha256(sourceChecksums),
  };
  for (const entry of [...approved.sharedSources, ...approved.bundles]) {
    entry.reviewStatus = copyReviewRequiredStatus;
    entry.sourceSha256 = sourceChecksums.get(entry.source);
  }
  const valid = await evaluateCopyReview({ root, contract: approved });
  assert.equal(valid.valid, true);
  assert.equal(valid.deploymentAllowed, true);

  approved.bundles[1].sourceSha256 = "0".repeat(64);
  const stale = await evaluateCopyReview({ root, contract: approved });
  assert.equal(stale.valid, false);
  assert.ok(stale.errors.includes(
    "COPY_REVIEW_SOURCE_CHECKSUM_MISMATCH:locales/nn.mjs",
  ));

  const vercel = JSON.parse(await source("vercel.json"));
  assert.equal(
    vercel.buildCommand,
    "node ./tools/build-deploy-dist.mjs",
  );
  assert.equal(vercel.framework, null);
  assert.equal(vercel.outputDirectory, "dist");
  assert.equal(vercel.cleanUrls, false);
  assert.equal(vercel.rewrites, undefined);
  assert.equal(vercel.functions["api/*.mjs"].maxDuration, 10);
  const ignore = await source(".vercelignore");
  assert.match(ignore, /^\/\*$/mu);
  for (const path of [
    "!vercel.json",
    "!index.html",
    "!styles.css",
    "!app.mjs",
    "!api/delete.mjs",
    "!api/issue.mjs",
    "!api/runtime-config.mjs",
    "!lib/reviewed-copy.mjs",
    "!tools/build-deploy-dist.mjs",
    "!tools/copy-review-preflight.mjs",
  ]) assert.ok(ignore.split(/\r?\n/u).includes(path));
  assert.doesNotMatch(ignore, /!README\.md|!tests/u);
});

test("copy approval recorder requires the exact owner token and source set", async () => {
  const pending = JSON.parse(await source("copy-review-contract.json"));
  pending.status = "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT";
  pending.approvalMetadata = {
    confirmationChannel: null,
    humanApprovalStatement: null,
    reviewerIdentity: null,
    reviewerRole: null,
    reviewedAt: null,
    sourceSetSha256: null,
  };
  for (const entry of [...pending.sharedSources, ...pending.bundles]) {
    entry.reviewStatus = "REVIEW_REQUIRED_BEFORE_EXTERNAL_DEPLOYMENT";
    entry.sourceSha256 = null;
  }
  const sourceBytes = new Map(await Promise.all(
    ["index.html", "locales/nb.mjs", "locales/nn.mjs"].map(
      async (path) => [path, await readFile(resolve(root, path))],
    ),
  ));
  const approved = buildApprovedCopyReviewContract({
    pendingContract: pending,
    sourceBytes,
    approvalStatement: requiredHumanApprovalStatement,
    reviewerIdentity: "tryakim@gmail.com",
    reviewedAt: "2026-07-27T12:00:00.000Z",
  });
  assert.equal(
    (await evaluateCopyReview({ root, contract: approved })).valid,
    true,
  );
  assert.throws(
    () => buildApprovedCopyReviewContract({
      pendingContract: pending,
      sourceBytes,
      approvalStatement: `${requiredHumanApprovalStatement} `,
      reviewerIdentity: "tryakim@gmail.com",
      reviewedAt: "2026-07-27T12:00:00.000Z",
    }),
    /EXACT_COPY_REVIEW_APPROVAL_REQUIRED/u,
  );
  const incomplete = new Map(sourceBytes);
  incomplete.delete("locales/nn.mjs");
  assert.throws(
    () => buildApprovedCopyReviewContract({
      pendingContract: pending,
      sourceBytes: incomplete,
      approvalStatement: requiredHumanApprovalStatement,
      reviewerIdentity: "tryakim@gmail.com",
      reviewedAt: "2026-07-27T12:00:00.000Z",
    }),
    /EXACT_SOURCE_SET/u,
  );
});

test("UI includes WAIT, help, pause, resume, STOP, reconnect, stale, and delete", async () => {
  const html = await source("index.html");
  for (const command of [
    "ACTIVATE",
    "ENTER_WAIT",
    "REQUEST_HELP",
    "PAUSE",
    "RESUME",
    "RECONNECT",
    "STOP",
  ]) assert.match(html, new RegExp(`data-command="${command}"`, "u"));
  assert.match(html, /id="send-stale"/u);
  assert.match(html, /id="refresh-projection"/u);
  assert.match(html, /id="delete-session"/u);
  assert.match(html, /SYNTHETIC_ONLY_NO_PARTICIPANT_DATA/u);
  assert.match(html, /Studentbeta: NOT_AUTHORIZED/u);
  assert.match(html, /Produksjon: NOT_AUTHORIZED/u);
  assert.match(html, /WP13\.12C: BLOCKED/u);
});

test("Vercel headers fail closed and do not enable CORS", async () => {
  const config = JSON.parse(await source("vercel.json"));
  const headers = new Map(
    config.headers[0].headers.map((entry) => [entry.key.toLowerCase(), entry.value]),
  );
  assert.equal(headers.get("cache-control"), "no-store, max-age=0");
  assert.match(headers.get("content-security-policy"), /default-src 'none'/u);
  assert.match(headers.get("content-security-policy"), /form-action 'none'/u);
  assert.match(headers.get("content-security-policy"), /frame-ancestors 'none'/u);
  assert.equal(headers.get("referrer-policy"), "no-referrer");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.has("access-control-allow-origin"), false);
});

test("README documents only the exact non-secret preview configuration keys", async () => {
  const readme = await source("README.md");
  const documentedKeys = [
    "LUDYS_GCP_PROJECT_NUMBER",
    "LUDYS_GCP_WIF_POOL_ID",
    "LUDYS_GCP_WIF_PROVIDER_ID",
    "LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT",
    "LUDYS_ISSUE_FUNCTION_URL",
    "LUDYS_DELETE_FUNCTION_URL",
    "LUDYS_COMMAND_FUNCTION_URL",
    "LUDYS_PROJECTION_FUNCTION_URL",
  ];
  for (const key of documentedKeys) assert.match(readme, new RegExp(`^${key}$`, "mu"));
  assert.doesNotMatch(readme, /PRIVATE_KEY|CLIENT_SECRET|SERVICE_ACCOUNT_KEY=/u);
  assert.match(readme, /Do not add `VERCEL_OIDC_TOKEN`/u);
});

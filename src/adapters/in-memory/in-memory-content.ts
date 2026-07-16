import type { HumanFirstContentBundle } from "../../core/content-contracts.js";
import type { ContentPort } from "../../ports/content.js";

export class InMemoryContent implements ContentPort {
  public constructor(private readonly bundles: readonly HumanFirstContentBundle[]) {}

  public resolve(input: Parameters<ContentPort["resolve"]>[0]): HumanFirstContentBundle {
    const bundle = this.bundles.find(
      (candidate) =>
        candidate.releaseId === input.releaseId &&
        candidate.activityId === input.activityId &&
        candidate.locale === input.locale,
    );
    if (bundle === undefined) {
      throw new Error("No exact locale/content release match");
    }
    return bundle;
  }
}

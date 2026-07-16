import type { HumanFirstContentBundle, Locale } from "../core/content-contracts.js";

export interface ContentPort {
  resolve(input: {
    readonly releaseId: string;
    readonly activityId: string;
    readonly locale: Locale;
  }): HumanFirstContentBundle;
}

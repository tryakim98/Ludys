import type { ClockPort } from "../../ports/clock.js";

export class FixedClock implements ClockPort {
  public constructor(private readonly fixedNow: string) {}

  public now(): string {
    return this.fixedNow;
  }
}

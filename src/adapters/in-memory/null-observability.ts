import type { ObservabilityPort, TechnicalSignal } from "../../ports/observability.js";

export class NullObservability implements ObservabilityPort {
  public readonly signals: TechnicalSignal[] = [];

  public record(signal: TechnicalSignal): void {
    this.signals.push(signal);
  }
}

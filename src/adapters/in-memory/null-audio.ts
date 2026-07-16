import type { AudioPort } from "../../ports/audio.js";

export class NullAudio implements AudioPort {
  public readonly requested: string[] = [];

  public request(audioSpecId: string): void {
    this.requested.push(audioSpecId);
  }

  public stopAll(): void {
    this.requested.length = 0;
  }
}

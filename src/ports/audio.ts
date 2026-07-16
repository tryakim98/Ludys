export interface AudioPort {
  request(audioSpecId: string): void;
  stopAll(): void;
}

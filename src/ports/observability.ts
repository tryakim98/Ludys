export type TechnicalSignal =
  | { readonly type: "AUDIO_LOAD_FAILURE"; readonly correlationId: string }
  | { readonly type: "CONTENT_RESOLUTION_FAILURE"; readonly correlationId: string }
  | { readonly type: "SESSION_EXPIRY_EVENT"; readonly correlationId: string }
  | { readonly type: "ERROR_CODE"; readonly correlationId: string; readonly code: string };

export interface ObservabilityPort {
  record(signal: TechnicalSignal): void;
}

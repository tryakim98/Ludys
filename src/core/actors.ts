export const ACTOR_TYPES = [
  "CHILD",
  "ADULT",
  "SYSTEM",
  "EDITORIAL_CONTENT",
  "HUMAN_VOICE",
  "TECHNICAL_OPERATOR",
] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export const SENDER_TYPES = [
  "SYSTEM",
  "EDITORIAL_CONTENT",
  "ADULT",
  "HUMAN_VOICE",
] as const;

export type SenderType = (typeof SENDER_TYPES)[number];

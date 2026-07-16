import {
  transition,
  type SessionCommand,
  type SessionState,
  type TransitionResult,
} from "../../core/state.js";

export function applyCommand(
  state: SessionState,
  command: SessionCommand,
): TransitionResult {
  return transition(state, command);
}

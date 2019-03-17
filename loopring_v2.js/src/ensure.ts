import { logDebug } from "./logs";

export function ensure(valid: boolean, description: string) {
  if (!valid) {
    logDebug(description);
  }
  return valid;
}

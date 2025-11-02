import { store } from "@/store/store";
import { addDebugInfo } from "@/store/slices/preferencesSlice";

export function debugLog(logtext: string, error? :any) {
  let log = logtext;
  if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log = `Failed to schedule next notification: ${errorMessage}`;
  }
  console.log(logtext);
  store.dispatch(addDebugInfo(logtext));
}

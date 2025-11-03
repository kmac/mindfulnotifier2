import { store } from "@/store/store";
import { addDebugInfo } from "@/store/slices/preferencesSlice";

export function debugLog(logtext: string, error?: any): string {
  let logmsg = logtext;
  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logmsg = `${logtext}: ${errorMessage}`;
  } else {
  }
  store.dispatch(addDebugInfo(logmsg));
  return logmsg;
}

import { store } from "@/store/store";
import { addDebugInfo } from "@/store/slices/preferencesSlice";

export function debugLog(logtext: string, error?: any): string {
  const timestamp = new Date().toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  let logmsg = `[${timestamp}] ${logtext}`;
  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logmsg = `[${timestamp}] ${logtext}: ${errorMessage}`;
  }
  store.dispatch(addDebugInfo(logmsg));
  return logmsg;
}

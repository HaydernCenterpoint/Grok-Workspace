import { useCallback, useEffect, useState } from "react";
import {
  applyWorkMode,
  loadWorkMode,
  saveWorkMode,
  type WorkMode,
} from "@/lib/grokOffice";

/**
 * Persisted work mode (`code` | `office` | `studio`) + `html[data-work-mode]`.
 * Keep product state here — do not add it to App.tsx.
 */
export function useGrokOffice() {
  const [workMode, setWorkModeState] = useState<WorkMode>(() => loadWorkMode());

  useEffect(() => {
    applyWorkMode(workMode);
    saveWorkMode(workMode);
  }, [workMode]);

  const setWorkMode = useCallback((mode: WorkMode) => {
    setWorkModeState(mode);
  }, []);

  return {
    workMode,
    setWorkMode,
    isOffice: workMode === "office",
    isStudio: workMode === "studio",
  };
}

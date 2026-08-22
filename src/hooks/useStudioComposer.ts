import { useCallback, useState } from "react";
import {
  nextStudioAspect,
  type StudioAspect,
  type StudioDuration,
  type StudioKind,
  type StudioResolution,
} from "@/lib/studio";

export function useStudioComposer() {
  const [kind, setKind] = useState<StudioKind>("image");
  const [aspect, setAspect] = useState<StudioAspect>("2:3");
  const [resolution, setResolution] = useState<StudioResolution>("1080p");
  const [duration, setDuration] = useState<StudioDuration>(6);

  const cycleAspect = useCallback(() => {
    setAspect((a) => nextStudioAspect(a));
  }, []);

  return {
    kind,
    setKind,
    aspect,
    cycleAspect,
    resolution,
    setResolution,
    duration,
    setDuration,
  };
}

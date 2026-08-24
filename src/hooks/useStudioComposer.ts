import { useCallback, useState } from "react";
import {
  nextStudioAspect,
  type StudioAspect,
  type StudioDuration,
  type StudioImageCount,
  type StudioKind,
  type StudioResolution,
} from "@/lib/studio";

export function useStudioComposer() {
  const [kind, setKind] = useState<StudioKind>("image");
  const [aspect, setAspect] = useState<StudioAspect>("2:3");
  const [resolution, setResolution] = useState<StudioResolution>("1080p");
  const [duration, setDuration] = useState<StudioDuration>(6);
  const [count, setCount] = useState<StudioImageCount>(1);

  const cycleAspect = useCallback(() => {
    setAspect((a) => nextStudioAspect(a));
  }, []);

  return {
    kind,
    setKind,
    aspect,
    setAspect,
    cycleAspect,
    resolution,
    setResolution,
    duration,
    setDuration,
    count,
    setCount,
  };
}

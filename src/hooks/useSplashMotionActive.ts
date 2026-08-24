import { useEffect, useState } from "react";
import {
  readSplashMotionEnv,
  shouldRunSplashMotion,
  subscribeSplashMotionEnv,
  type SplashMotionEnv,
} from "@/lib/splashMotion";

/** True only while the splash/setup mark should keep sheening. */
export function useSplashMotionActive(requested: boolean): boolean {
  const [env, setEnv] = useState<SplashMotionEnv>(() => readSplashMotionEnv());
  useEffect(() => subscribeSplashMotionEnv(setEnv), []);
  return shouldRunSplashMotion({ requested, ...env });
}

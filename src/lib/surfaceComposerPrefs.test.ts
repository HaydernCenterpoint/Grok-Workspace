import { describe, expect, it } from "vitest";
import { DEFAULT_EFFORT, DEFAULT_MODEL_ID } from "./grokCatalog";
import {
  SURFACE_COMPOSER_PREFS_KEY,
  defaultSurfaceComposerChoice,
  loadSurfaceComposerPrefs,
  parseSurfaceComposerPrefs,
  persistComposerPrefsToHost,
  resolveSurfaceComposerChoice,
  saveSurfaceComposerChoice,
  type SurfaceComposerStorage,
} from "./surfaceComposerPrefs";

function memoryStorage(
  initial: Record<string, string> = {},
): SurfaceComposerStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return key in data ? data[key]! : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

describe("surfaceComposerPrefs", () => {
  it("keeps Host writes on Build only", () => {
    expect(persistComposerPrefsToHost("code")).toBe(true);
    expect(persistComposerPrefsToHost("office")).toBe(false);
    expect(persistComposerPrefsToHost("studio")).toBe(false);
  });

  it("defaults Studio to official Imagine thinking + ask", () => {
    const studio = defaultSurfaceComposerChoice("studio");
    expect(studio.modelId).toBe(DEFAULT_MODEL_ID);
    expect(studio.effort).toBe(DEFAULT_EFFORT);
    expect(studio.mode).toBe("agent");
    expect(studio.policy).toBe("ask");
  });

  it("stores Office and Studio separately", () => {
    const storage = memoryStorage();
    saveSurfaceComposerChoice(
      "office",
      {
        modelId: "grok-4.5",
        effort: "low",
        mode: "plan",
        policy: "accept_edits",
      },
      storage,
    );
    saveSurfaceComposerChoice(
      "studio",
      {
        modelId: DEFAULT_MODEL_ID,
        effort: "high",
        mode: "agent",
        policy: "ask",
      },
      storage,
    );
    expect(resolveSurfaceComposerChoice("office", storage).modelId).toBe(
      "grok-4.5",
    );
    expect(resolveSurfaceComposerChoice("office", storage).policy).toBe(
      "accept_edits",
    );
    expect(resolveSurfaceComposerChoice("studio", storage).policy).toBe("ask");
    expect(resolveSurfaceComposerChoice("code", storage).modelId).toBe(
      DEFAULT_MODEL_ID,
    );
    expect(storage.data[SURFACE_COMPOSER_PREFS_KEY]).toContain("office");
  });

  it("rejects junk policy and mode", () => {
    const parsed = parseSurfaceComposerPrefs({
      v: 1,
      office: {
        modelId: "grok-4.6",
        effort: "high",
        mode: "yolo",
        policy: "bypass",
      },
    });
    expect(parsed.office?.mode).toBe("agent");
    expect(parsed.office?.policy).toBe("ask");
  });

  it("loads empty store when missing", () => {
    expect(loadSurfaceComposerPrefs(memoryStorage())).toEqual({ v: 1 });
  });
});

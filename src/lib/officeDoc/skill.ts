import { applyFilePatch, fsReadFile, isTauri } from "@/lib/api";
import {
  OFFICE_SKILL_MARKER,
  OFFICE_SKILL_REL,
  officeSkillMarkdown,
} from "./skillMd";

export { OFFICE_SKILL_REL, officeSkillMarkdown } from "./skillMd";

export async function ensureProjectOfficeSkill(
  projectPath: string | null | undefined,
): Promise<void> {
  const root = (projectPath ?? "").trim();
  if (!root || !isTauri()) return;
  try {
    const existing = await fsReadFile(root, OFFICE_SKILL_REL);
    if ((existing.text ?? "").includes(OFFICE_SKILL_MARKER)) return;
  } catch {
    /* missing — write */
  }
  await applyFilePatch(root, OFFICE_SKILL_REL, officeSkillMarkdown());
}

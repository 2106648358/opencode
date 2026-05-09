import fs from "fs"
import path from "path"

const SKILLS_DIR = path.join(import.meta.dirname, "builtin", "skills")

function loadSkill(dirName: string) {
  return fs.readFileSync(path.join(SKILLS_DIR, dirName, "SKILL.md"), "utf-8")
}

export const BUILTIN_SKILLS: Array<{ name: string; description: string; content: string; location: string }> = [
  { name: "openspec-propose", description: "Propose a new change with all artifacts generated in one step", content: loadSkill("openspec-propose"), location: path.join(SKILLS_DIR, "openspec-propose", "SKILL.md") },
  { name: "openspec-apply-change", description: "Implement tasks from an OpenSpec change", content: loadSkill("openspec-apply-change"), location: path.join(SKILLS_DIR, "openspec-apply-change", "SKILL.md") },
  { name: "openspec-new-change", description: "Start a new OpenSpec change", content: loadSkill("openspec-new-change"), location: path.join(SKILLS_DIR, "openspec-new-change", "SKILL.md") },
  { name: "openspec-continue-change", description: "Continue working on an OpenSpec change by creating the next artifact", content: loadSkill("openspec-continue-change"), location: path.join(SKILLS_DIR, "openspec-continue-change", "SKILL.md") },
  { name: "openspec-ff-change", description: "Fast-forward through OpenSpec artifact creation", content: loadSkill("openspec-ff-change"), location: path.join(SKILLS_DIR, "openspec-ff-change", "SKILL.md") },
  { name: "openspec-explore", description: "Enter explore mode - a thinking partner for exploring ideas", content: loadSkill("openspec-explore"), location: path.join(SKILLS_DIR, "openspec-explore", "SKILL.md") },
  { name: "openspec-archive-change", description: "Archive a completed change", content: loadSkill("openspec-archive-change"), location: path.join(SKILLS_DIR, "openspec-archive-change", "SKILL.md") },
  { name: "openspec-sync-specs", description: "Sync delta specs from a change to main specs", content: loadSkill("openspec-sync-specs"), location: path.join(SKILLS_DIR, "openspec-sync-specs", "SKILL.md") },
  { name: "openspec-verify-change", description: "Verify implementation matches change artifacts", content: loadSkill("openspec-verify-change"), location: path.join(SKILLS_DIR, "openspec-verify-change", "SKILL.md") },
  { name: "openspec-bulk-archive-change", description: "Archive multiple completed changes at once", content: loadSkill("openspec-bulk-archive-change"), location: path.join(SKILLS_DIR, "openspec-bulk-archive-change", "SKILL.md") },
  { name: "openspec-onboard", description: "Guided onboarding for OpenSpec", content: loadSkill("openspec-onboard"), location: path.join(SKILLS_DIR, "openspec-onboard", "SKILL.md") },
]

export const BUILTIN_SKILLS_DIR = SKILLS_DIR

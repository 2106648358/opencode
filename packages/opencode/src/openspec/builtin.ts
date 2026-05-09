import SKILL_PROPOSE from "./builtin/skills/openspec-propose/SKILL.md"
import SKILL_APPLY from "./builtin/skills/openspec-apply-change/SKILL.md"
import SKILL_NEW from "./builtin/skills/openspec-new-change/SKILL.md"
import SKILL_CONTINUE from "./builtin/skills/openspec-continue-change/SKILL.md"
import SKILL_FF from "./builtin/skills/openspec-ff-change/SKILL.md"
import SKILL_EXPLORE from "./builtin/skills/openspec-explore/SKILL.md"
import SKILL_ARCHIVE from "./builtin/skills/openspec-archive-change/SKILL.md"
import SKILL_SYNC from "./builtin/skills/openspec-sync-specs/SKILL.md"
import SKILL_VERIFY from "./builtin/skills/openspec-verify-change/SKILL.md"
import SKILL_BULK_ARCHIVE from "./builtin/skills/openspec-bulk-archive-change/SKILL.md"
import SKILL_ONBOARD from "./builtin/skills/openspec-onboard/SKILL.md"
import path from "path"

// Directory containing the SKILL.md files (for filesystem-based discovery fallback)
const SKILLS_DIR = path.join(import.meta.dirname, "builtin", "skills")

export const BUILTIN_SKILLS: Array<{ name: string; description: string; content: string; location: string }> = [
  { name: "openspec-propose", description: "Propose a new change with all artifacts generated in one step", content: SKILL_PROPOSE, location: path.join(SKILLS_DIR, "openspec-propose", "SKILL.md") },
  { name: "openspec-apply-change", description: "Implement tasks from an OpenSpec change", content: SKILL_APPLY, location: path.join(SKILLS_DIR, "openspec-apply-change", "SKILL.md") },
  { name: "openspec-new-change", description: "Start a new OpenSpec change", content: SKILL_NEW, location: path.join(SKILLS_DIR, "openspec-new-change", "SKILL.md") },
  { name: "openspec-continue-change", description: "Continue working on an OpenSpec change by creating the next artifact", content: SKILL_CONTINUE, location: path.join(SKILLS_DIR, "openspec-continue-change", "SKILL.md") },
  { name: "openspec-ff-change", description: "Fast-forward through OpenSpec artifact creation", content: SKILL_FF, location: path.join(SKILLS_DIR, "openspec-ff-change", "SKILL.md") },
  { name: "openspec-explore", description: "Enter explore mode - a thinking partner for exploring ideas", content: SKILL_EXPLORE, location: path.join(SKILLS_DIR, "openspec-explore", "SKILL.md") },
  { name: "openspec-archive-change", description: "Archive a completed change", content: SKILL_ARCHIVE, location: path.join(SKILLS_DIR, "openspec-archive-change", "SKILL.md") },
  { name: "openspec-sync-specs", description: "Sync delta specs from a change to main specs", content: SKILL_SYNC, location: path.join(SKILLS_DIR, "openspec-sync-specs", "SKILL.md") },
  { name: "openspec-verify-change", description: "Verify implementation matches change artifacts", content: SKILL_VERIFY, location: path.join(SKILLS_DIR, "openspec-verify-change", "SKILL.md") },
  { name: "openspec-bulk-archive-change", description: "Archive multiple completed changes at once", content: SKILL_BULK_ARCHIVE, location: path.join(SKILLS_DIR, "openspec-bulk-archive-change", "SKILL.md") },
  { name: "openspec-onboard", description: "Guided onboarding for OpenSpec", content: SKILL_ONBOARD, location: path.join(SKILLS_DIR, "openspec-onboard", "SKILL.md") },
]

// Filesystem path for runtime scanning compatibility
export const BUILTIN_SKILLS_DIR = SKILLS_DIR

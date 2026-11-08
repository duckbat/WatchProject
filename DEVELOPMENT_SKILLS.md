# Universal development skills

The eleven skills in `.agents/skills/` are self-contained and independent of WatchLedger, a programming language, a framework or a hosting provider. They discover project conventions before applying a workflow. No repository-relative reference is required by a core skill.

## Installed on this machine

- Canonical user-level copies: `~/.agents/skills/<name>/SKILL.md` (Codex and Cursor).
- Claude Code entries: `~/.claude/skills/<name>` links to the canonical user-level folders.
- This repository retains portable, versioned copies in `.agents/skills/`.

User-level copies are installed snapshots, not links into this repository. Editing the versioned copy does not automatically update the installed copy. New sessions can discover the user-level skills; activation in an already-running session was not tested. Local installation does not sync skills to other machines or hosted agents.

## Project specialization

`AGENTS.md` routes to the generic skills and loads `WATCHLEDGER_GUIDANCE.md` for watch-specific identity, sale evidence, pricing and hosting invariants. `PROJECT_CONTEXT.md` and `DEVELOPMENT_AUDIT.md` remain local project evidence; they are not global requirements.

The old `watch-data-pipeline` skill is now the general `data-pipeline` skill. All former WatchLedger-specific skill bodies are preserved in WATCHLEDGER_GUIDANCE.md.

## Reuse elsewhere

Copy any needed skill folders into another repository's `.agents/skills/` or the agent's supported skill directory. Merge relevant routing into that repository's instructions; do not copy WatchLedger's AGENTS.md, product constraints, paths or access assumptions into another project. No account settings or cloud sync were changed.

Documentation used to verify local discovery locations: [Codex/OpenAI CLI skill locations](https://developers.openai.com/api/reference/cli), [Claude skills](https://code.claude.com/docs/en/skills), [Cursor skills](https://cursor.com/help/customization/skills).

## Browsing the collection

Open `~/Desktop/Universal Development Skills/README.md` for a categorized index of all eleven skills. The category folders are shortcuts to the live user-level installation; no agent discovery folders were moved. A portable ZIP snapshot is kept beside the index.

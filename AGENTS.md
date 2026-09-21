# Peanut Admin Web Core development entry

This repository owns framework-neutral client facilities, generic UI, Vue/Nuxt/UniApp integration, and shared testing support. Complete business pages, business state and product/module API SDKs belong to their owning modules in the application repository, not Web Core.

## Mandatory documented rules

The single project rule source is the authorized `peanut-business/peanut-admin-project` checkout. Before edits, resolve its actual path and read `AGENTS.md`, `project-rules/document-execution.md`, `project-rules/execution.md`, `project-rules/rule-index.json`, and applicable source sections. Linked worktrees need verified Git common-directory/workspace mapping; `../` may not identify Project.

Use Project's `scripts/docs-governance check` / `plan` and completed-receipt `verify` as documented. Do not copy private project documents or customer data into this public repository. If the source is unavailable, report it and limit work to safe read-only inspection rather than guessing requirements.

Report any suspected error or conflict in an effective rule to the user with evidence and a proposed change BEFORE changing the rule or implementing a conflicting result. Pause only the affected slice. Do not weaken requirements or tests to make code appear compliant. `reviewed_not_rejected` proposals are not implementation approvals; removal candidates need explicit confirmation.

Preserve the client/Vue/UI/Nuxt/UniApp/testing boundaries and per-request SSR identity isolation. Develop in isolated feature worktrees and integrate validated changes into `dev` without force pushes. `main`, package publication, releases, production and customer-data operations require separate authorization. Docs-only rule entry changes do not imply a package release, dependency lock update or product validation.

---
name: Security remediation boundaries
description: User-required compatibility boundaries for Monarch security maintenance.
---

Security fixes must preserve Monarch's business calculations, data ingestion, integration access, file/storage paths, and frontend appearance.

**Why:** The user explicitly wants Monarch secure without breaking existing logic or the paths by which data and information enter the platform. Clearing a vulnerability count is not sufficient if data stops arriving or metrics change.

**How to apply:** Prefer minimal compatible dependency updates; compare behavior and representative data against a baseline. Verify real connection/query behavior and ingestion freshness, not just successful builds or cached dashboards. Obtain approval before incompatible upgrades or major library replacements; disclose blocked checks and remaining risks instead of silently changing logic, disabling protection, or removing integrations.

Use staged security maintenance: complete compatible fixes and proportionate verification first, report results and remaining risks, then stop for explicit approval before major upgrades, replacements, extended troubleshooting, or further remediation batches.

**Why:** The user approved this staged approach to control uncertain effort and credit usage while preserving Monarch functionality.

**How to apply:** Do not automatically expand work to eliminate every remaining finding. Present the smallest next batch and its risks at the checkpoint, distinguishing partial progress from full remediation. The approval checkpoint is a scope control, not an enforced billing cap.

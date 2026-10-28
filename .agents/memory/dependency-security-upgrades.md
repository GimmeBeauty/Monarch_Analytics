---
name: Dependency security upgrades
description: Compatibility checks required when security fixes cross dependency major versions.
---
For dependency security upgrades, do not treat a clean audit and successful bundle as proof that third-party integrations still work. Exercise the actual integration and round-trip exported files when replacements or major-version overrides are required.

**Why:** Security fixes may require overriding a parent's declared dependency range or replacing an abandoned package. These changes can pass bundling but break runtime APIs or silently change exported data.

**How to apply:** Keep overrides centralized in the workspace, preserve existing supply-chain safeguards, and verify the affected runtime behavior separately from the audit. For spreadsheet-library replacements, check identifiers with leading zeroes, numeric cells, worksheet order, and formula-like strings.

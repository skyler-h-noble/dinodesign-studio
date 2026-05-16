---
description: Scan the codebase for tagged lib-component gaps (MISSING-LIB-COMPONENT)
---

Run `grep -rn "MISSING-LIB-COMPONENT" src/` from the repo root and report what
turns up.

How to format the answer:

- **If the output is empty**: reply with a single line, e.g. "No outstanding
  lib-component gaps." Don't pad with anything else.
- **If there are matches**: group by file. For each match, show:
  - `<file>:<line>` reference
  - The full `MISSING-LIB-COMPONENT` comment block (typically the tag line
    plus the next 2–3 comment lines beneath it — `Needed for`, `Proposed API`,
    `Lib-track`)
  - One blank line between entries
- **If there are more than 15 matches total**: switch to a compact summary —
  one line per file showing `<file>: N gaps` and a list of component names
  found (parse the `<ComponentName>` from each tag).

After the listing, end with a single short sentence suggesting the next step:
either "Lib looks complete." (when empty) or "Consider lifting these into
`@dynodesign/components`." (when there are matches).

Do not edit files. Do not look for related issues. Just grep and report.

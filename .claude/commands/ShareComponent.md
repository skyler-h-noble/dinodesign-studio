---
description: Share a MISSING-LIB-COMPONENT with the DynoDesign admin dashboard for review
---

The user wants to share an inline component (tagged `MISSING-LIB-COMPONENT`)
with the DynoDesign maintainers. Submissions are posted to a cloud function
and reviewed in the admin dashboard at /admin/proposals.

**Endpoint:**
`https://us-central1-dino-design.cloudfunctions.net/submitComponentProposal`

Workflow:

1. **Find candidates.** Run `grep -rn "MISSING-LIB-COMPONENT" src/`.

2. **Pick what to share.**
   - If the user passed a component name as the slash command argument (e.g.
     `/ShareComponent Popover`), use only the matching tags.
   - Otherwise, if exactly one tag exists, use it.
   - Multiple tags + no argument: list them and ask which one. Don't bundle
     unless asked.

3. **Extract context.** Open the file at the tagged line and read:
   - The tag block (the `MISSING-LIB-COMPONENT` line and the next 3–4
     comment lines: `Needed for`, `Proposed API`, `Lib-track`).
   - The inline implementation that follows the tag, with surrounding code
     needed to make it self-contained (imports, tightly-coupled helpers).

4. **Read installed lib version.** From the consumer project's `package.json`,
   look up `dependencies["@dynodesign/components"]` (or `devDependencies`).

5. **Show a preview.** Print a summary to the user:

   ```
   Ready to submit:

     Component: <ComponentName>
     Use case:  <one-line summary>
     Source:    <file path>:<line>
     Version:   <lib version>

   This will POST to the DynoDesign admin dashboard. The submission is
   anonymous (no auth required) but the endpoint logs your IP for
   rate-limiting purposes (10 submissions / 24h per IP).

   Confirm submission? (yes / no)
   ```

   Wait for the user to confirm. Don't submit until they say yes.

6. **Submit.** On confirm, run a curl POST (or use the Bash tool to run it).
   The payload shape:

   ```json
   {
     "componentName": "<PascalCase or kebab-case identifier>",
     "useCase": "<paraphrased from 'Needed for' + any extra context>",
     "proposedApi": "<the props sketch / TypeScript interface>",
     "implementation": "<the inline code, including imports>",
     "sourceFilePath": "<file path:line>",
     "libVersion": "<from package.json>",
     "submittedBy": "<git user.email if available, else omit>",
     "notes": "<edge cases / a11y notes / hesitations>"
   }
   ```

   Use a heredoc to keep the JSON readable in the command:

   ```bash
   curl -sS -X POST \
     'https://us-central1-dino-design.cloudfunctions.net/submitComponentProposal' \
     -H 'Content-Type: application/json' \
     -d @- <<'EOF'
   {
     "componentName": "...",
     ...
   }
   EOF
   ```

7. **Report the result.**
   - **201**: `Submitted as proposal <proposalId>. The DynoDesign team will review
     and reply via the admin dashboard. <remainingToday> submissions remaining
     today from this IP.`
   - **400**: relay the validation errors from the response body and offer to
     fix and retry.
   - **429**: `Rate limit reached. Try again in <retryAfterSeconds> seconds.`
   - **5xx or network error**: fall back to printing the submission as a
     markdown block (the original behavior — see fallback format below) so
     the user can paste it manually. End with: `Submission via API failed;
     copy the block above and send it to lib@dynodesign.dev or paste it into
     the admin dashboard manually.`

8. **Don't modify source files.** The inline `MISSING-LIB-COMPONENT` tag and
   implementation stay in place. Once the admin marks the proposal as `inLib`
   in a future lib release, a separate cleanup pass replaces the inline copy.

### Fallback markdown format (only used when API call fails)

````markdown
# DynoDesign component proposal: <ComponentName>

## Use case
<paraphrased>

## Proposed API
```tsx
<sketch>
```

## Inline implementation
```tsx
<code>
```

## Source
- File: <path:line>
- Lib version: <version>

## Notes
<notes>
````

### Empty case

If `grep` finds zero tags, reply with one line:
"No `MISSING-LIB-COMPONENT` tags to share. Run `/ScanComponents` to confirm,
or add a tag in your code following the format in `CLAUDE.md`."

/**
 * The converter prompt is one long template literal, and a stray backtick in
 * prose silently TERMINATES it — the rules after that point vanish from the
 * string while the file may still parse. That has happened twice: `variant` in
 * the Buttons-mode rule, and `elevated` in the Button variant map. Both were
 * caught by `tsc -b` and NOT by the 441 tests, because nothing read the string.
 *
 * These assertions read it. A truncated prompt loses its tail, so checking that
 * markers from the beginning, middle and END are all present turns a silent
 * amputation into a failing test.
 */
import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT } from '../utils/figmaToCode';

describe('SYSTEM_PROMPT integrity', () => {
  it('carries the rules from start to finish', () => {
    for (const marker of [
      'You are a Figma-to-React converter',   // first line
      '0. RESOLVED NOTES (_aaid)',            // rule 0
      'modes.Buttons',                        // the colour axis
      '4f. BUTTON VARIANT + COLOR',           // deep in the middle
      'letterNumber',                         // the Type mapping
    ]) {
      expect(`${marker}: ${SYSTEM_PROMPT.includes(marker)}`).toBe(`${marker}: true`);
    }
  });

  it('is not truncated', () => {
    // Length is the blunt but reliable signal: a stray backtick amputates
    // everything after it, and the tail is where the component rules live.
    // (A backtick CAN appear legitimately — the prompt escapes them in code
    // samples — so its presence proves nothing. Its effect does.)
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(40000);
    expect(SYSTEM_PROMPT.trimEnd().endsWith('`')).toBe(false);
  });

  it('never instructs the model to EMIT a *-Light theme', () => {
    // The regression: rule 3a's fill table used to map fills onto
    // `-> data-theme="Primary-Light"`, a name no generated sheet defines, while
    // rule 0 forbade exactly that. Prohibitions, the explanation of what a tint
    // really is, and the WRONG example may all keep the string; an ARROW
    // pointing at one may not.
    const instructed = SYSTEM_PROMPT
      .split('\n')
      .filter(l => /(->|→)\s*data-theme="[A-Za-z]+-Light"/.test(l));
    expect(instructed).toEqual([]);
  });

  it('does not tell the model to emit a removed Button shape', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/->\s*variant="[a-z-]*-light"/);
  });
});

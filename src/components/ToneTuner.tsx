import { useState } from 'react';
import chroma from 'chroma-js';
import { generateSemanticLightModeScale } from '../utils/colorScale';

/**
 * Tone Tuner — a one-time utility page to visually tune the
 * Text/Header/Quiet/Border lookup tables for all 14 surface tones.
 *
 * Route: /tune
 */

const TONE_SCALE = [1, 10, 19, 28, 37, 46.6, 53, 62, 71, 81, 90, 95, 98, 99];

const INITIAL_TEXT: number[] =    [11, 11, 11, 12, 12, 13, 1, 3, 3, 4, 4, 5, 5, 5];
const INITIAL_HEADER: number[] =  [9, 9, 10, 10, 11, 11, 3, 4, 5, 5, 6, 7, 7, 7];
const INITIAL_QUIET: number[] =   [9, 9, 10, 10, 11, 12, 2, 3, 4, 4, 5, 6, 6, 6];

// Test with a few different palette hues
const TEST_COLORS = [
  { name: 'Pink/Rose', hex: '#c9a08a' },
  { name: 'Teal', hex: '#2e8b8b' },
  { name: 'Blue', hex: '#4a7bf7' },
  { name: 'Orange', hex: '#d4941a' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Green', hex: '#2e9e5a' },
];

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = chroma(hex1).luminance();
  const l2 = chroma(hex2).luminance();
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export default function ToneTuner() {
  const [textLookup, setTextLookup] = useState<number[]>([...INITIAL_TEXT]);
  const [headerLookup, setHeaderLookup] = useState<number[]>([...INITIAL_HEADER]);
  const [quietLookup, setQuietLookup] = useState<number[]>([...INITIAL_QUIET]);
  const [selectedColor, setSelectedColor] = useState(TEST_COLORS[0].hex);

  const palette = generateSemanticLightModeScale(selectedColor);
  const p = (n: number) => palette[n - 1]?.hex || '#888';

  const update = (type: 'text' | 'header' | 'quiet', index: number, value: number) => {
    const clamped = Math.max(1, Math.min(14, value));
    if (type === 'text') {
      const next = [...textLookup]; next[index] = clamped; setTextLookup(next);
    } else if (type === 'header') {
      const next = [...headerLookup]; next[index] = clamped; setHeaderLookup(next);
    } else {
      const next = [...quietLookup]; next[index] = clamped; setQuietLookup(next);
    }
  };

  const copyArrays = () => {
    const output = `const TEXT_LOOKUP_LIGHT_BG: number[] = [\n  ${textLookup.slice(0, 7).join(', ')},\n  ${textLookup.slice(7).join(', ')},\n];\n\nconst HEADER_LOOKUP_LIGHT_BG: number[] = [\n  ${headerLookup.slice(0, 7).join(', ')},\n  ${headerLookup.slice(7).join(', ')},\n];\n\nconst QUIET_LOOKUP_LIGHT_BG: number[] = [\n  ${quietLookup.slice(0, 7).join(', ')},\n  ${quietLookup.slice(7).join(', ')},\n];`;
    navigator.clipboard.writeText(output);
    alert('Copied to clipboard!');
  };

  return (
    <div style={{ padding: 32, fontFamily: 'system-ui', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Tone Tuner</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>
        Adjust Text, Header, and Quiet Color-N values for each of the 14 surface tones.
        Contrast ratios are shown — Text/Quiet need 4.5:1, Header needs 3.1:1.
      </p>

      {/* Color picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TEST_COLORS.map(c => (
          <button
            key={c.hex}
            onClick={() => setSelectedColor(c.hex)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: selectedColor === c.hex ? '2px solid #333' : '1px solid #ccc',
              background: c.hex, color: chroma(c.hex).luminance() > 0.5 ? '#000' : '#fff',
              fontWeight: 600, cursor: 'pointer',
            }}
          >{c.name}</button>
        ))}
      </div>

      {/* Palette strip */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24 }}>
        {palette.map((t, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 32, background: t.hex, borderRadius: 4, marginBottom: 4 }} />
            <span style={{ fontSize: 10, color: '#888' }}>{i + 1}</span>
          </div>
        ))}
      </div>

      {/* Main tuning grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 8, marginBottom: 32 }}>
        {TONE_SCALE.map((tone, i) => {
          const bgHex = p(i + 1);
          const textHex = p(textLookup[i]);
          const headerHex = p(headerLookup[i]);
          const quietHex = p(quietLookup[i]);
          const textCR = contrastRatio(bgHex, textHex);
          const headerCR = contrastRatio(bgHex, headerHex);
          const quietCR = contrastRatio(bgHex, quietHex);

          return (
            <div key={i} style={{
              background: bgHex, borderRadius: 12, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
              border: '1px solid rgba(128,128,128,0.3)',
              minHeight: 280,
            }}>
              {/* Surface label */}
              <div style={{ fontSize: 11, fontWeight: 700, color: chroma(bgHex).luminance() > 0.5 ? '#333' : '#ddd', textAlign: 'center' }}>
                C-{i + 1} (L={tone})
              </div>

              {/* Header preview */}
              <div style={{ color: headerHex, fontWeight: 700, fontSize: 14 }}>Header</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={1} max={14} value={headerLookup[i]}
                  onChange={e => update('header', i, parseInt(e.target.value) || 1)}
                  style={{ width: 36, padding: 2, fontSize: 11, textAlign: 'center', borderRadius: 4, border: '1px solid rgba(128,128,128,0.5)' }}
                />
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: headerCR >= 3.1 ? '#22c55e' : '#ef4444',
                }}>{headerCR.toFixed(1)}</span>
              </div>

              {/* Text preview */}
              <div style={{ color: textHex, fontSize: 13 }}>Body text sample</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={1} max={14} value={textLookup[i]}
                  onChange={e => update('text', i, parseInt(e.target.value) || 1)}
                  style={{ width: 36, padding: 2, fontSize: 11, textAlign: 'center', borderRadius: 4, border: '1px solid rgba(128,128,128,0.5)' }}
                />
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: textCR >= 4.5 ? '#22c55e' : '#ef4444',
                }}>{textCR.toFixed(1)}</span>
              </div>

              {/* Quiet preview */}
              <div style={{ color: quietHex, fontSize: 11 }}>Quiet text</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={1} max={14} value={quietLookup[i]}
                  onChange={e => update('quiet', i, parseInt(e.target.value) || 1)}
                  style={{ width: 36, padding: 2, fontSize: 11, textAlign: 'center', borderRadius: 4, border: '1px solid rgba(128,128,128,0.5)' }}
                />
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: quietCR >= 4.5 ? '#22c55e' : '#ef4444',
                }}>{quietCR.toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Copy button */}
      <button
        onClick={copyArrays}
        style={{
          padding: '12px 32px', fontSize: 16, fontWeight: 700, borderRadius: 8,
          background: '#333', color: '#fff', border: 'none', cursor: 'pointer',
        }}
      >
        Copy Lookup Arrays to Clipboard
      </button>

      {/* Current values display */}
      <pre style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
{`TEXT:   [${textLookup.join(', ')}]
HEADER: [${headerLookup.join(', ')}]
QUIET:  [${quietLookup.join(', ')}]`}
      </pre>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getPublicFileUrl } from '../utils/firebase/storage';
import { buildAccessibilityReport, type ReportSection } from '../utils/accessibilityReport';
import { buildTargetAreaReport, TARGET_AREA_MIN, type TargetSection } from '../utils/targetAreaReport';

type Status = 'loading' | 'ready' | 'not-found' | 'error';

export default function AccessibilityReport() {
  const [searchParams] = useSearchParams();
  const uuid = searchParams.get('id');
  const [status, setStatus] = useState<Status>('loading');
  const [tokens, setTokens] = useState<any>(null);
  const [designName, setDesignName] = useState<string>('');

  useEffect(() => {
    if (!uuid) { setStatus('not-found'); return; }
    let cancelled = false;
    fetch(getPublicFileUrl(uuid, 'tokens.json'))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (cancelled) return;
        setTokens(json);
        // Metadata entries are shaped as { value, type }; unwrap before rendering.
        const nameNode = json?.Metadata?.['Design-System-Name'] ?? json?.Metadata?.Name;
        const name = typeof nameNode === 'object' && nameNode !== null ? nameNode.value : nameNode;
        setDesignName(typeof name === 'string' && name ? name : uuid);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [uuid]);

  const sections = useMemo<ReportSection[]>(() => {
    if (!tokens) return [];
    try {
      return buildAccessibilityReport(tokens);
    } catch (err) {
      console.error('Failed to build report:', err);
      return [];
    }
  }, [tokens]);

  const targetSections = useMemo<TargetSection[]>(() => {
    if (!tokens) return [];
    try {
      return buildTargetAreaReport(tokens);
    } catch (err) {
      console.error('Failed to build target report:', err);
      return [];
    }
  }, [tokens]);

  if (status === 'loading') {
    return <ReportShell><p>Loading accessibility report…</p></ReportShell>;
  }
  if (status === 'not-found') {
    return <ReportShell><h2>No design system ID provided.</h2><p>Append <code>?id=&lt;uuid&gt;</code> to the URL.</p></ReportShell>;
  }
  if (status === 'error') {
    return <ReportShell><h2>Couldn't load this design system.</h2><p>Check the ID and try again.</p></ReportShell>;
  }

  return (
    <ReportShell>
      <header className="ar-header">
        <div>
          <h1>Accessibility Report</h1>
          <p className="ar-sub">{designName} · WCAG 2.2 AA · {sections.length} contexts checked</p>
        </div>
        <button type="button" className="ar-print-btn no-print" onClick={() => window.print()}>
          Download PDF
        </button>
      </header>

      <Summary sections={sections} targetSections={targetSections} />

      <h2 className="ar-major-heading">Contrast (WCAG 2.2 AA · 1.4.3 / 1.4.11)</h2>
      {sections.map((section, i) => (
        <SectionBlock key={i} section={section} />
      ))}

      <h2 className="ar-major-heading">Target Size (WCAG 2.2 AA · 2.5.8, min {TARGET_AREA_MIN}×{TARGET_AREA_MIN}px)</h2>
      {targetSections.map((section, i) => (
        <TargetSectionBlock key={i} section={section} />
      ))}
    </ReportShell>
  );
}

function Summary({ sections, targetSections }: { sections: ReportSection[]; targetSections: TargetSection[] }) {
  const contrastTotal = sections.reduce((sum, s) => sum + s.checks.length, 0);
  const contrastFailed = sections.reduce((sum, s) => sum + s.checks.filter(c => !c.passes).length, 0);
  const targetTotal = targetSections.reduce((sum, s) => sum + s.checks.length, 0);
  const targetFailed = targetSections.reduce((sum, s) => sum + s.checks.filter(c => !c.passes).length, 0);
  const total = contrastTotal + targetTotal;
  const failed = contrastFailed + targetFailed;
  const passed = total - failed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 100;
  return (
    <div className="ar-summary">
      <div className="ar-stat"><strong>{total}</strong><span>total checks</span></div>
      <div className="ar-stat ar-stat-pass"><strong>{passed}</strong><span>passing</span></div>
      <div className="ar-stat ar-stat-fail"><strong>{failed}</strong><span>failing</span></div>
      <div className="ar-stat"><strong>{passRate}%</strong><span>pass rate</span></div>
    </div>
  );
}

function TargetSectionBlock({ section }: { section: TargetSection }) {
  const failedCount = section.checks.filter(c => !c.passes).length;
  return (
    <section className="ar-section">
      <header className="ar-section-header">
        <h2>{section.title}</h2>
        <div className="ar-section-meta">
          {failedCount > 0
            ? <span className="ar-badge-fail">{failedCount} failing</span>
            : <span className="ar-badge-pass">all pass</span>}
        </div>
      </header>
      <table className="ar-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Context</th>
            <th className="ar-num">Width</th>
            <th className="ar-num">Height</th>
            <th className="ar-num">Minimum</th>
            <th>Source</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {section.checks.map((c, i) => (
            <tr key={i} className={c.passes ? '' : 'ar-row-fail'}>
              <td>
                {c.component}
                {c.note && <div className="ar-note">{c.note}</div>}
              </td>
              <td>{c.context || '—'}</td>
              <td className="ar-num">{c.width}px</td>
              <td className="ar-num">{c.height}px</td>
              <td className="ar-num">{TARGET_AREA_MIN}×{TARGET_AREA_MIN}px</td>
              <td>
                <span className={c.source === 'configurable' ? 'ar-source-config' : 'ar-source-default'}>
                  {c.source === 'configurable' ? 'your system' : 'library default'}
                </span>
              </td>
              <td>{c.passes ? <span className="ar-pass">PASS</span> : <span className="ar-fail">FAIL</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SectionBlock({ section }: { section: ReportSection }) {
  const failedCount = section.checks.filter(c => !c.passes).length;
  return (
    <section className="ar-section">
      <header className="ar-section-header">
        <h2>{section.mode} · {section.background} · {section.surfaceLevel}</h2>
        <div className="ar-section-meta">
          <span className="ar-swatch" style={{ background: section.surfaceBg }} aria-hidden />
          <code>{section.surfaceBg}</code>
          {failedCount > 0
            ? <span className="ar-badge-fail">{failedCount} failing</span>
            : <span className="ar-badge-pass">all pass</span>}
        </div>
      </header>
      <table className="ar-table">
        <thead>
          <tr>
            <th>Check</th>
            <th>Token</th>
            <th>Foreground</th>
            <th>Background</th>
            <th className="ar-num">Ratio</th>
            <th className="ar-num">Required</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {section.checks.map((c, i) => (
            <tr key={i} className={c.passes ? '' : 'ar-row-fail'}>
              <td>{c.label}</td>
              <td><code className="ar-token">{c.token}</code></td>
              <td>
                <span className="ar-swatch-sm" style={{ background: c.fgColor }} aria-hidden />
                <code>{c.fgColor}</code>
              </td>
              <td>
                <span className="ar-swatch-sm" style={{ background: c.bgColor }} aria-hidden />
                <code>{c.bgColor}</code>
              </td>
              <td className="ar-num">{c.ratio.toFixed(2)}:1</td>
              <td className="ar-num">{c.required.toFixed(1)}:1</td>
              <td>{c.passes ? <span className="ar-pass">PASS</span> : <span className="ar-fail">FAIL</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ReportShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{reportCSS}</style>
      <div className="ar-root">{children}</div>
    </>
  );
}

const reportCSS = `
  .ar-root {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 24px 80px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
  }
  .ar-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
  }
  .ar-header h1 { margin: 0 0 4px 0; font-size: 28px; }
  .ar-sub { margin: 0; color: #666; font-size: 14px; }
  .ar-print-btn {
    background: #1a1a1a; color: #fff; border: none; padding: 10px 18px;
    border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .ar-print-btn:hover { opacity: 0.85; }

  .ar-summary {
    display: flex; gap: 16px;
    margin-bottom: 24px; padding: 16px 20px;
    background: #f5f5f5; border-radius: 8px;
  }
  .ar-stat { display: flex; flex-direction: column; gap: 2px; }
  .ar-stat strong { font-size: 22px; font-weight: 700; }
  .ar-stat span { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }
  .ar-stat-pass strong { color: #0a7d2a; }
  .ar-stat-fail strong { color: #c0392b; }

  .ar-section {
    margin-bottom: 32px;
    border: 1px solid #e4e4e4;
    border-radius: 8px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .ar-section-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #e4e4e4;
    flex-wrap: wrap; gap: 12px;
  }
  .ar-section-header h2 { margin: 0; font-size: 16px; font-weight: 700; }
  .ar-section-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; }
  .ar-swatch { width: 18px; height: 18px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1); }
  .ar-swatch-sm { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.1); vertical-align: middle; margin-right: 6px; }
  .ar-badge-pass { color: #0a7d2a; font-weight: 600; }
  .ar-badge-fail { color: #c0392b; font-weight: 600; }

  .ar-table {
    width: 100%; border-collapse: collapse; font-size: 13px;
  }
  .ar-table th, .ar-table td {
    padding: 8px 12px; text-align: left;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
  }
  .ar-table th { font-weight: 600; background: #fff; color: #555; font-size: 12px; }
  .ar-table tr:last-child td { border-bottom: none; }
  .ar-row-fail { background: #fdf0ee; }
  .ar-num { text-align: right; font-variant-numeric: tabular-nums; }
  .ar-table code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 11.5px; color: #444; }
  .ar-token { font-size: 10.5px !important; color: #777 !important; white-space: nowrap; }
  .ar-pass { color: #0a7d2a; font-weight: 600; font-size: 11px; letter-spacing: 0.04em; }
  .ar-fail { color: #c0392b; font-weight: 700; font-size: 11px; letter-spacing: 0.04em; }

  .ar-major-heading {
    font-size: 18px; font-weight: 700; margin: 32px 0 16px;
    padding-bottom: 8px; border-bottom: 2px solid #1a1a1a;
    page-break-after: avoid;
  }
  .ar-note { font-size: 11.5px; color: #666; margin-top: 2px; font-style: italic; }
  .ar-source-config {
    font-size: 11px; font-weight: 600; color: #0a4d7a;
    background: #e4f0fa; padding: 2px 6px; border-radius: 3px;
  }
  .ar-source-default {
    font-size: 11px; color: #555;
    background: #f0f0f0; padding: 2px 6px; border-radius: 3px;
  }

  @media print {
    @page { size: letter portrait; margin: 0.5in; }
    .no-print { display: none !important; }
    .ar-root { max-width: none; padding: 0; }
    .ar-section { page-break-inside: avoid; break-inside: avoid; border-radius: 0; }
    .ar-summary { page-break-after: avoid; }
    body { background: #fff !important; }
  }
`;

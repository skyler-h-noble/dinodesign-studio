/**
 * The page a Figma component's "Link to documentation" opens.
 *
 * Two things a static reference cannot do, and both need the design system id
 * in the path:
 *
 *   It renders the component the user ACTUALLY HAS — their radius, their type,
 *   their palette — by loading their six published stylesheets into the
 *   provider. A prop table describes a component; an example shows theirs.
 *
 *   It reports an issue WITH CONTEXT. A bug report that already knows which
 *   component and which design system is one a maintainer can act on.
 *
 * Sections are tabs rather than one long page because an agent reads all of it
 * and a person reads one part — and the part they want is almost never the
 * first. Props and Theming are where people arrive.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { COMPONENT_DOCS } from '../utils/docs/components';
import type { ComponentDoc } from '../utils/docs/componentDoc';
import { docsSlug } from '../utils/docs/docsLink';
import { systemCssUrls, systemExists } from '../utils/docs/systemCss';
import { EXAMPLES, hasExample } from '../utils/docs/examples';
import { renderFoundations } from '../utils/docs/foundations';
import { renderColourSystem } from '../utils/docs/componentDoc';

const TABS = ['Example', 'Props', 'States', 'Theming', 'Tokens', 'Composition', 'Accessibility', 'Gotchas'] as const;
type TabName = typeof TABS[number];

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6,
};
const wrap: React.CSSProperties = { padding: '32px 24px', maxWidth: 960, margin: '0 auto' };

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table style={{ ...mono, width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>{head.map(h => (
          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--Border, #ddd)' }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => (
            <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid var(--Border-Variant, #eee)', verticalAlign: 'top' }}>{c}</td>
          ))}</tr>
        ))}
      </tbody>
    </table>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul style={{ ...mono, paddingLeft: 20 }}>{items.map((t, i) => <li key={i} style={{ marginBottom: 6 }}>{t}</li>)}</ul>
);

function TabBody({ doc, tab }: { doc: ComponentDoc; tab: TabName }) {
  switch (tab) {
    case 'Example':
      if (!hasExample(doc.name)) {
        /* Said rather than left blank: a component with no example and one an
           agent has not found look identical otherwise, and the first is a real
           answer. Modal and Drawer need open state and a portal, and a
           half-working example teaches a shape that does not run. */
        return <p style={mono}>No live example — this component needs state or a portal to be shown honestly. The props below are the reference.</p>;
      }
      return <div style={{ padding: 24 }} data-surface="Surface">{EXAMPLES[doc.name]()}</div>;

    case 'Props':
      return <Table head={['Prop', 'Type', 'Values', 'Default']}
        rows={doc.props.map(p => [<code>{p.name}</code>, p.type,
          p.values?.length ? p.values.join(' · ') : '—',
          <><code>{p.default}</code>{p.note ? <div style={{ opacity: 0.75, marginTop: 4 }}>{p.note}</div> : null}</>])} />;

    case 'States':
      return <Table head={['State', 'Set by']}
        rows={doc.states.map(s => [s.state,
          <>{s.setBy === 'interaction' ? 'interaction — not a prop' : s.setBy}
            {s.note ? <div style={{ opacity: 0.75, marginTop: 4 }}>{s.note}</div> : null}</>])} />;

    case 'Theming':
      return (<>
        <Table head={['Collection', 'In code', 'In Figma']}
          rows={doc.theming.map(t => [<strong>{t.collection}</strong>, t.inCode, t.inFigma])} />
        {doc.themingNotes?.length ? <List items={doc.themingNotes} /> : null}
      </>);

    case 'Tokens':
      return <Table head={['Token', 'Sets', 'Varies with', 'Figma variable']}
        rows={doc.tokens.map(t => [<code>{t.name}</code>, t.sets, t.variesWith, <code>{t.figma}</code>])} />;

    case 'Composition': return <List items={doc.composition} />;
    case 'Accessibility': return <List items={doc.accessibility} />;
    case 'Gotchas': return <List items={doc.gotchas} />;
  }
}

export function ComponentDocsPage() {
  const { uuid, component } = useParams<{ uuid: string; component: string }>();
  const [tab, setTab] = useState<TabName>('Example');
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    if (!uuid) { setExists(false); return; }
    systemExists(uuid).then(ok => { if (live) setExists(ok); });
    return () => { live = false; };
  }, [uuid]);

  const wanted = docsSlug(component || '').toLowerCase();
  const doc = COMPONENT_DOCS.find(d => docsSlug(d.name).toLowerCase() === wanted);

  if (!doc) {
    return (
      <div style={wrap}>
        <h1 style={mono}>{component || 'Component'}</h1>
        <p style={mono}>No reference for this component.</p>
        <List items={COMPONENT_DOCS.map(d => d.name)} />
      </div>
    );
  }

  const body = (
    <div style={wrap}>
      <h1 style={{ ...mono, fontSize: 28, marginBottom: 4 }}>{doc.name}</h1>
      <p style={{ ...mono, opacity: 0.8 }}>{doc.summary}</p>

      {doc.insteadUse.length > 0 && (
        <div style={{ ...mono, margin: '16px 0', paddingLeft: 12, borderLeft: '3px solid var(--Border-Variant, #eee)' }}>
          {doc.insteadUse.map((i, n) => <div key={n}>Use <strong>{i.use}</strong> when {i.when}</div>)}
        </div>
      )}

      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '20px 0 16px' }}>
        {TABS.map(t => (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}
            style={{ ...mono, padding: '6px 12px', cursor: 'pointer',
              border: '1px solid var(--Border-Variant, #ddd)',
              borderBottomWidth: t === tab ? 2 : 1,
              borderBottomColor: t === tab ? 'var(--Buttons-Primary-Border, #333)' : 'var(--Border-Variant, #ddd)',
              background: 'transparent', fontWeight: t === tab ? 600 : 400 }}>
            {t}
          </button>
        ))}
      </div>

      <TabBody doc={doc} tab={tab} />

      <ReportLink component={doc.name} designSystemId={uuid || ''} />
    </div>
  );

  /* Rendered WITHOUT the provider until the system is known to exist: pointing
     it at six 404s leaves every token unresolved, so the page would paint its
     fallbacks and look like a brand that happens to be grey. */
  if (exists !== true) return body;

  const OmniDesignProvider = (require('@omni-design/components') as any).OmniDesignProvider;
  return (
    <OmniDesignProvider {...systemCssUrls(uuid!)}
      defaultTheme="Default" defaultStyle="Modern" defaultSurface="Surface">
      {body}
    </OmniDesignProvider>
  );
}

function ReportLink({ component, designSystemId }: { component: string; designSystemId: string }) {
  return (
    <p style={{ ...mono, marginTop: 40, opacity: 0.8 }}>
      Something wrong or missing?{' '}
      <a href={`/report?component=${encodeURIComponent(component)}&system=${encodeURIComponent(designSystemId)}`}>
        Report an issue or request a component
      </a>
    </p>
  );
}

/** Every component, plus the foundations, for the id at the root of the path. */
export function ComponentDocsIndex() {
  const { uuid } = useParams<{ uuid: string }>();
  return (
    <div style={wrap}>
      <h1 style={{ ...mono, fontSize: 28 }}>Component reference</h1>
      <pre style={{ ...mono, whiteSpace: 'pre-wrap' }}>{renderColourSystem()}</pre>
      <pre style={{ ...mono, whiteSpace: 'pre-wrap' }}>{renderFoundations()}</pre>
      <h2 style={mono}>Components</h2>
      <ul style={{ ...mono, paddingLeft: 20 }}>
        {COMPONENT_DOCS.map(d => (
          <li key={d.name} style={{ marginBottom: 6 }}>
            <a href={`/docs/${uuid}/${docsSlug(d.name)}`}>{d.name}</a> — {d.summary}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ComponentDocsPage;

/**
 * The public reference page a Figma component's "Link to documentation" opens.
 *
 * Rendered from the bundle rather than fetched: the studio already holds every
 * ComponentDoc, so there is nothing to publish and nothing to keep in step. A
 * second copy in Storage would be one more thing that can go stale — which is
 * the failure this whole reference exists to avoid.
 *
 * The design system id in the path is not used to look anything up yet. It is
 * there because the Figma SECTION of each doc is per design system: every user
 * imports their own .fig and gets their own component node ids, so a link that
 * did not carry the id could never resolve to their file. Wiring that lookup is
 * the next step; until then the renderer emits its own "not linked" block,
 * which is the honest state rather than a broken link.
 */
import React from 'react';
import { useParams } from 'react-router';
import { COMPONENT_DOCS } from '../utils/docs/components';
import { renderComponentDoc, renderColourSystem } from '../utils/docs/componentDoc';
import { docsSlug } from '../utils/docs/docsLink';

const page: React.CSSProperties = {
  padding: '32px 24px',
  maxWidth: 900,
  margin: '0 auto',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 13,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
};

export function ComponentDocsPage() {
  const { component } = useParams<{ uuid: string; component: string }>();
  const wanted = docsSlug(component || '');
  const doc = COMPONENT_DOCS.find(d => docsSlug(d.name).toLowerCase() === wanted.toLowerCase());

  if (!doc) {
    /* Named rather than blank: a component with no page and one whose name was
       mistyped look identical otherwise, and the first is a real answer. */
    return (
      <pre style={page}>
        {`# ${component || 'Component'}\n\nNo reference for this component.\n\n`}
        {`Documented components:\n${COMPONENT_DOCS.map(d => '  ' + d.name).join('\n')}\n`}
      </pre>
    );
  }
  return <pre style={page}>{renderComponentDoc(doc, null)}</pre>;
}

/** Every component, for the id at the root of the docs path. */
export function ComponentDocsIndex() {
  const { uuid } = useParams<{ uuid: string }>();
  const lines = [
    '# Component reference',
    '',
    renderColourSystem(),
    '',
    '## Components',
    '',
    ...COMPONENT_DOCS.map(d => `- ${d.name} — ${d.summary}`),
    '',
    `${COMPONENT_DOCS.length} components. Open one at /docs/${uuid}/<Component>.`,
  ];
  return <pre style={page}>{lines.join('\n')}</pre>;
}

export default ComponentDocsPage;

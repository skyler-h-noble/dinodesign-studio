/* Dead Token Audit — finds bindings that point at variables whose collection
 * no longer exists, and layers on text styles that are no longer local.
 *
 * Why this exists: a dead binding is INVISIBLE. The variable still resolves,
 * so Figma shows the layer as correctly bound and the swatch looks right. The
 * value simply stops tracking the brand. The Buttons set carried ~190 of these
 * with no visual symptom at all.
 *
 * The test is NOT "does the variable resolve" — it does. The test is whether
 * its collection is still one of the file's local collections.
 */

const state = { findings: [], byKey: new Map() };

figma.showUI(__html__, { width: 460, height: 620, themeColors: true });

function classify(node) {
  /* Board furniture does not reach an instance: loose frames on the page, and
     the COMPONENT_SET container itself (its padding only spaces the variants
     inside the purple box). Everything inside a variant ships. */
  if (node.type === 'COMPONENT_SET') return 'set-frame';
  let a = node.parent;
  while (a && a.type !== 'PAGE') {
    if (a.type === 'COMPONENT' || a.type === 'COMPONENT_SET') return 'ships';
    a = a.parent;
  }
  return 'loose';
}

function ownerOf(node) {
  let a = node;
  let owner = null;
  while (a && a.type !== 'PAGE') {
    if (a.type === 'COMPONENT_SET') owner = a.name;
    else if (!owner && (a.type === 'COMPONENT' || a.type === 'INSTANCE')) owner = a.name;
    a = a.parent;
  }
  return owner;
}

async function scan(scope) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const liveCollectionIds = new Set(collections.map((c) => c.id));
  const localStyleIds = new Set((await figma.getLocalTextStylesAsync()).map((s) => s.id));

  let roots = [];
  if (scope === 'selection') {
    roots = figma.currentPage.selection.slice();
    if (!roots.length) return { error: 'Nothing selected.' };
  } else if (scope === 'page') {
    roots = [figma.currentPage];
  } else {
    await figma.loadAllPagesAsync();
    roots = figma.root.children.slice();
  }

  /* One lookup per variable id, not per binding. A big page can hold tens of
     thousands of bindings across a few dozen distinct variables. */
  const variableCache = new Map();
  const resolve = async (id) => {
    if (variableCache.has(id)) return variableCache.get(id);
    let verdict;
    try {
      const v = await figma.variables.getVariableByIdAsync(id);
      if (!v) verdict = { state: 'missing', name: '(deleted variable)' };
      else if (!liveCollectionIds.has(v.variableCollectionId)) verdict = { state: 'dead', name: v.name };
      else verdict = null;
    } catch (e) {
      verdict = { state: 'missing', name: '(unreadable)' };
    }
    variableCache.set(id, verdict);
    return verdict;
  };

  const styleCache = new Map();
  const resolveStyle = async (id) => {
    if (styleCache.has(id)) return styleCache.get(id);
    let verdict = null;
    if (!localStyleIds.has(id)) {
      try {
        const s = await figma.getStyleByIdAsync(id);
        verdict = { name: s ? s.name : '(unknown style)' };
      } catch (e) {
        verdict = { name: '(unreadable style)' };
      }
    }
    styleCache.set(id, verdict);
    return verdict;
  };

  const findings = [];
  const visited = new Set();
  let nodesScanned = 0;
  let skipped = 0;

  for (const root of roots) {
    const pageName = root.type === 'PAGE' ? root.name : figma.currentPage.name;
    const nodes = root.type === 'PAGE' ? root.findAll(() => true) : [root].concat(root.findAll(() => true));
    for (const node of nodes) {
      /* findAll on a PAGE already returns its children, so a naive
         findAll().concat(children) double-counts everything at page level.
         The visited set makes the count trustworthy. */
      let nodeId;
      try {
        nodeId = node.id;
      } catch (e) {
        skipped++;
        continue;
      }
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      nodesScanned++;

      /* Instance sublayers (ids shaped `I<inst>;<comp>;<node>`) are
         materialised on demand, so the reference findAll() handed back can be
         collected before this line runs — reading any property then throws
         "The node ... does not exist". Skipping is correct, but it is COUNTED:
         an audit that silently drops nodes reports a number that is wrong in
         the safe-looking direction, which is the same failure this plugin
         exists to catch. */
      let bound, styleId;
      try {
        bound = node.boundVariables || {};
        styleId = node.type === 'TEXT' ? node.textStyleId : null;
      } catch (e) {
        skipped++;
        continue;
      }

      for (const field of Object.keys(bound)) {
        const value = bound[field];
        const aliases = Array.isArray(value) ? value : [value];
        for (const alias of aliases) {
          if (!alias || !alias.id) continue;
          const verdict = await resolve(alias.id);
          if (!verdict) continue;
          findings.push({
            kind: verdict.state === 'missing' ? 'missing-variable' : 'dead-variable',
            token: verdict.name,
            field: field,
            nodeId: nodeId,
            nodeName: node.name,
            nodeType: node.type,
            page: pageName,
            owner: ownerOf(node),
            where: classify(node),
          });
        }
      }

      if (styleId && styleId !== figma.mixed) {
        const verdict = await resolveStyle(styleId);
        if (verdict) {
          findings.push({
            kind: 'orphaned-style',
            token: verdict.name,
            field: 'textStyleId',
            nodeId: nodeId,
            nodeName: node.name,
            nodeType: node.type,
            page: pageName,
            owner: ownerOf(node),
            where: classify(node),
          });
        }
      }
    }
  }

  return { findings: findings, nodesScanned: nodesScanned, pages: roots.length, skipped: skipped };
}

function group(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = f.kind + '|' + f.token + '|' + f.field;
    if (!map.has(key)) {
      map.set(key, {
        key: key, kind: f.kind, token: f.token, field: f.field,
        total: 0, ships: 0, furniture: 0, nodeIds: [], pages: new Set(), owners: new Set(),
      });
    }
    const row = map.get(key);
    row.total++;
    if (f.where === 'ships') row.ships++; else row.furniture++;
    if (row.nodeIds.length < 500) row.nodeIds.push(f.nodeId);
    row.pages.add(f.page);
    if (f.owner) row.owners.add(f.owner);
  }
  return Array.from(map.values())
    .map((r) => ({
      key: r.key, kind: r.kind, token: r.token, field: r.field,
      total: r.total, ships: r.ships, furniture: r.furniture,
      nodeIds: r.nodeIds,
      pages: Array.from(r.pages).slice(0, 4),
      owners: Array.from(r.owners).slice(0, 4),
    }))
    .sort((a, b) => b.ships - a.ships || b.total - a.total);
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'scan') {
    figma.ui.postMessage({ type: 'scanning' });
    try {
      const result = await scan(msg.scope);
      if (result.error) {
        figma.ui.postMessage({ type: 'error', message: result.error });
        return;
      }
      state.findings = result.findings;
      const rows = group(result.findings);
      state.byKey = new Map(rows.map((r) => [r.key, r.nodeIds]));
      figma.ui.postMessage({
        type: 'results',
        rows: rows,
        nodesScanned: result.nodesScanned,
        pages: result.pages,
        totalShips: result.findings.filter((f) => f.where === 'ships').length,
        total: result.findings.length,
        skipped: result.skipped,
      });
    } catch (e) {
      figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
    }
  }

  if (msg.type === 'select') {
    const ids = state.byKey.get(msg.key) || [];
    const nodes = [];
    for (const id of ids.slice(0, 200)) {
      try {
        const n = await figma.getNodeByIdAsync(id);
        if (n && !n.removed) nodes.push(n);
      } catch (e) { /* node may live on an unloaded page */ }
    }
    if (!nodes.length) {
      figma.ui.postMessage({ type: 'error', message: 'Those nodes are not reachable from the current page.' });
      return;
    }
    let page = nodes[0];
    while (page && page.type !== 'PAGE') page = page.parent;
    if (page && page.id !== figma.currentPage.id) await figma.setCurrentPageAsync(page);
    const same = nodes.filter((n) => {
      let a = n;
      while (a && a.type !== 'PAGE') a = a.parent;
      return a && a.id === figma.currentPage.id;
    });
    figma.currentPage.selection = same;
    figma.viewport.scrollAndZoomIntoView(same);
  }

  if (msg.type === 'close') figma.closePlugin();
};

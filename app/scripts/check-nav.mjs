#!/usr/bin/env node
/**
 * Fails the build when the sidebar and the router disagree.
 *
 * WHY THIS EXISTS.
 *
 * The navigation manifest in this package was written without access to the
 * Workspace repository, so several of its routes are a best reading rather
 * than a verified fact. Shipping that as prose in a document would mean the
 * first person to click a wrong link finds the mistake.
 *
 * This turns it into a build-time guarantee instead. It reads the paths out
 * of `workspaceNav.ts`, reads the routes out of `App.tsx`, and reports:
 *
 *   MISSING   a sidebar destination with no route. The link would 404.
 *   ORPHANED  a route with no sidebar destination. Reachable only by URL,
 *             which is how a page quietly stops being used.
 *   STALE     a path in `legacyRedirects.ts` that no longer resolves.
 *
 * Exit code 1 on any MISSING. ORPHANED is reported and does not fail, because
 * detail routes and nested pages legitimately have no sidebar entry.
 *
 * Run: node scripts/check-nav.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NAV = resolve('src/lib/workspace/workspaceNav.ts');
const APP = resolve('src/App.tsx');
const REDIRECTS = resolve('src/lib/workspace/legacyRedirects.ts');

function read(path, what) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    console.error(`Could not read ${what} at ${path}`);
    console.error('Run this from the app directory, with the paths at the top adjusted if your layout differs.');
    process.exit(2);
  }
}

const navSource = read(NAV, 'the navigation manifest');
const appSource = read(APP, 'the router');

/* The stage switch. The manifest hides either the four merged destinations or
   the seventeen they replace, so only one of those sets is ever on screen.
   Checking the hidden set would fail a correct install, which is how a build
   gate teaches people to ignore it or to delete things to get past it. */
const mergedReady = /MERGED_PAGES_READY\s*=\s*true/.test(navSource);

/* Every `path: '...'` in the manifest, with the line it is on, whether it is
   marked unverified, and whether this stage renders it. */
const destinations = [];
const mergeTargets = new Set();
for (const match of navSource.matchAll(/mergedInto:\s*'([^']+)'/g)) mergeTargets.add(match[1]);

navSource.split('\n').forEach((line, index) => {
  const match = line.match(/path:\s*'([^']+)'/);
  if (!match) return;
  const path = match[1];
  const isLegacy = /mergedInto:/.test(line);
  const isTarget = mergeTargets.has(path);
  destinations.push({
    path,
    line: index + 1,
    unverified: /unverified:\s*true/.test(line),
    // What this build actually renders.
    active: mergedReady ? !isLegacy : !isTarget,
    deferred: mergedReady ? isLegacy : isTarget,
  });
});

/* Every `path="..."` on a Route in the router.

   Three things this has to get right, each of which produced a false positive
   the first time this script was run against a stand-in router:

     a wildcard route, `path="/crm/*"`, also serves /crm and everything under
     it, so the bare prefix counts as declared;

     a nested child, `path="needs-attention"` inside `<Route path="/email">`,
     is not a top-level route and must not be reported as an orphan;

     a route is a path, so a target carrying a hash or a query is matched on
     the path part alone.

   A checker that cries wolf is a checker people stop reading. */
const routes = new Set();
const bareChildren = new Set();
for (const match of appSource.matchAll(/<Route\s+[^>]*path=["'{]([^"'}]+)["'}]/g)) {
  const raw = match[1].trim();
  if (!raw || raw === '*') continue;
  if (!raw.startsWith('/')) {
    bareChildren.add(raw);
    routes.add(`/${raw}`);
    continue;
  }
  routes.add(raw);
  if (raw.endsWith('/*')) routes.add(raw.slice(0, -2));
}

/** A route is a path. Strip anything after it. */
function pathOf(target) {
  return target.split('#')[0].split('?')[0] || '/';
}

/* A nested route declared as path="needs-attention" inside <Route path="/email">
   resolves to /email/needs-attention. The regex above cannot see the nesting,
   so a destination also counts as routed when a parent prefix is declared and
   the remainder appears as a bare child path somewhere. */
function isRouted(raw) {
  const path = pathOf(raw);
  if (routes.has(path)) return true;
  // A wildcard ancestor serves everything beneath it.
  for (const route of routes) {
    if (route.endsWith('/*') && path.startsWith(route.slice(0, -1))) return true;
  }
  const segments = path.split('/').filter(Boolean);
  for (let i = segments.length - 1; i > 0; i -= 1) {
    const parent = `/${segments.slice(0, i).join('/')}`;
    const child = segments.slice(i).join('/');
    if (routes.has(parent) && (routes.has(child) || routes.has(`/${child}`))) return true;
  }
  return false;
}

const active = destinations.filter((d) => d.active);
const missing = active.filter((d) => !isRouted(d.path));
const deferred = destinations.filter((d) => d.deferred && !isRouted(d.path));
const routed = new Set(destinations.map((d) => d.path));
const orphaned = [...routes].filter(
  (route) =>
    !routed.has(route) &&
    !route.includes(':') &&
    !route.endsWith('/*') &&
    !routed.has(route.replace(/\/\*$/, '')) &&
    !bareChildren.has(route.replace(/^\//, '')) &&
    route !== '/' &&
    !/^\/(login|signup|auth|callback|reset)/.test(route)
);

let stale = [];
try {
  const redirectSource = readFileSync(REDIRECTS, 'utf8');
  // The merge redirects are only wired when the switch is on, so an unbuilt
  // target is expected until then.
  const mergeBlock = redirectSource.slice(
    redirectSource.indexOf('MERGED_PATHS'),
    redirectSource.indexOf('SPELLING_PATHS')
  );
  for (const match of redirectSource.matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    const inMergeBlock = mergeBlock.includes(match[0]);
    if (inMergeBlock && !mergedReady) continue;
    if (!isRouted(match[2])) stale.push({ from: match[1], to: match[2] });
  }
} catch {
  // The redirect map is optional.
}

console.log(`Stage: MERGED_PAGES_READY is ${mergedReady}`);
console.log(`Sidebar destinations rendered at this stage: ${active.length} of ${destinations.length}`);
console.log(`Routes declared in App.tsx: ${routes.size}`);
console.log('');

if (missing.length > 0) {
  console.log(`MISSING, ${missing.length}. These links would 404:`);
  for (const d of missing) {
    const note = d.unverified ? '  (marked unverified, so this is expected until checked)' : '';
    console.log(`  ${d.path}   workspaceNav.ts line ${d.line}${note}`);
  }
  console.log('');
  console.log('Fix each one by correcting the path in workspaceNav.ts to the route that');
  console.log('exists, or by adding the route to App.tsx. Do not delete the destination');
  console.log('to make this pass.');
  console.log('');
}

if (orphaned.length > 0) {
  console.log(`ORPHANED, ${orphaned.length}. Routed but not in the sidebar:`);
  for (const route of orphaned.sort()) console.log(`  ${route}`);
  console.log('');
  console.log('Some of these are legitimate: detail pages, tabs inside a destination, and');
  console.log('anything reached from inside a page. Check that none of them is a');
  console.log('destination somebody expects to find in the sidebar.');
  console.log('');
}

if (stale.length > 0) {
  console.log(`STALE redirects, ${stale.length}:`);
  for (const r of stale) console.log(`  ${r.from} points at ${r.to}, which has no route`);
  console.log('');
}

if (deferred.length > 0) {
  console.log(`DEFERRED, ${deferred.length}. Not rendered at this stage, and not yet routed:`);
  for (const d of deferred) console.log(`  ${d.path}`);
  console.log('');
  console.log(mergedReady
    ? 'These are the destinations the merges replaced. Removing their routes is a'
    : 'These are the four merged pages. They are expected to be missing until the');
  console.log(mergedReady
    ? 'separate change, after the redirects have been live for a release.'
    : 'pages are built. Do not add routes for them as part of this install.');
  console.log('');
}

if (missing.length === 0) {
  console.log('Every destination this stage renders resolves to a route.');
}

process.exit(missing.length > 0 ? 1 : 0);

/**
 * Organisation hierarchy: parent and child as one tree.
 *
 * WHY A LIST WITH INDENTATION RATHER THAN A DRAWN TREE.
 *
 * A drawn tree with connecting lines looks better in a screenshot and is worse
 * to use: it cannot be read by a screen reader as a structure, it cannot be
 * scanned for "which of these has open work", and it falls apart on a phone.
 * A nested list IS the structure, so assistive technology announces the depth
 * for free, and the columns stay readable at 390 pixels.
 *
 * The depth guard is here as well as in the database. A cycle should be
 * impossible, the trigger refuses one, and rendering a view that hangs is a
 * worse way to find out it got through than rendering one that says so.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { Value } from '../../components/crm/viewPrimitives';
import { HierarchyNode, MAX_DEPTH, buildHierarchy, flattenHierarchy } from '../../lib/crm/stage4/hierarchy';

const NodeList: React.FC<{
  nodes: HierarchyNode[];
  linkTo: (path: string) => string;
}> = ({ nodes, linkTo }) => (
  <ul className="ccrm-tree">
    {nodes.map((node) => (
      <li className="ccrm-tree-node" key={node.organisation.id}>
        <div className="ccrm-tree-row">
          <Link
            className="ccrm-tree-name ccrm-text-link"
            to={linkTo(`/crm/organisations/${node.organisation.id}`)}
          >
            {node.organisation.name}
          </Link>
          <span className="ccrm-tree-meta">
            <Value value={node.organisation.industry} absent="Industry not recorded" />
          </span>
          <span className="ccrm-tree-counts">
            {node.peopleCount} {node.peopleCount === 1 ? 'person' : 'people'}
            {', '}
            {node.openWorkCount} open
          </span>
          {node.depth > 0 ? (
            <span className="ccrm-tree-depth">
              Level {node.depth}
              <span className="ccrm-visually-hidden"> of the organisation hierarchy</span>
            </span>
          ) : null}
        </div>
        {node.children.length > 0 ? <NodeList nodes={node.children} linkTo={linkTo} /> : null}
      </li>
    ))}
  </ul>
);

export const CrmHierarchyPage: React.FC = () => {
  const { data, linkTo } = useStage4();

  const roots = React.useMemo(() => buildHierarchy(data), [data]);
  const flat = React.useMemo(() => flattenHierarchy(roots), [roots]);
  const deepest = flat.reduce((max, node) => Math.max(max, node.depth), 0);
  const withChildren = flat.filter((node) => node.children.length > 0);

  return (
    <Stage4Scaffold
      title="Organisation hierarchy"
      description="Parent and child organisations as one tree, with the people and open work recorded at each."
      loadingLabel="the organisation hierarchy"
      emptyTitle="No organisations are recorded in this workspace"
      emptyBody="The hierarchy appears here once organisations are recorded."
      resultCount={flat.length}
      totalCount={data.organisations.filter((o) => o.deletedAt === null).length}
    >
      <ul className="ccrm-card-rail">
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{roots.length}</span>
            <span className="ccrm-card-label">Top-level organisations</span>
            <span className="ccrm-card-note">
              Organisations with no parent recorded, and any whose recorded parent is not here.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{withChildren.length}</span>
            <span className="ccrm-card-label">Have a subsidiary</span>
            <span className="ccrm-card-note">
              A parent and its subsidiary are two records. Merging them would lose the relationship.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{deepest + 1}</span>
            <span className="ccrm-card-label">Levels deep</span>
            <span className="ccrm-card-note">
              The database refuses a loop and refuses anything beyond {MAX_DEPTH} levels.
            </span>
          </span>
        </li>
      </ul>

      <section className="ccrm-panel" aria-labelledby="ccrm-tree-heading">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="ccrm-tree-heading">
              The tree
            </h3>
            <p className="ccrm-panel-description">
              Indentation is the structure. Each level is announced, so the shape is readable without
              seeing it.
            </p>
          </div>
        </div>
        {roots.length === 0 ? (
          <p className="ccrm-panel-empty">No organisations are recorded.</p>
        ) : (
          <NodeList nodes={roots} linkTo={linkTo} />
        )}
      </section>
    </Stage4Scaffold>
  );
};

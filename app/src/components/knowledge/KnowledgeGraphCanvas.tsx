import React, { useState, useMemo } from 'react';
import { KnowledgeNode, KnowledgeRelationship, KnowledgeNodeType } from '../../lib/knowledge/types';

interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  onSelectNode?: (node: KnowledgeNode) => void;
  selectedNodeId?: string | null;
}

const NODE_COLORS: Record<KnowledgeNodeType, string> = {
  project: '#38bdf8', // sky
  transcript: '#94a3b8', // slate
  output: '#a855f7', // purple
  decision: '#e2b53c', // gold
  action: '#4ade80', // green
  insight: '#f472b6', // pink
  risk: '#ef4444', // red
  opportunity: '#22c55e', // emerald
  recommendation: '#fb923c', // orange
  report: '#818cf8', // indigo
  forecast: '#06b6d4', // cyan
  team: '#3b82f6', // blue
  user: '#e2e8f0', // light
  organization: '#ffd700', // yellow gold
};

export const KnowledgeGraphCanvas: React.FC<KnowledgeGraphCanvasProps> = ({
  nodes,
  relationships,
  onSelectNode,
  selectedNodeId,
}) => {
  const [zoom, setZoom] = useState(1);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchType = filterType === 'all' || n.node_type === filterType;
      const matchSearch =
        !searchFilter ||
        n.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (n.summary && n.summary.toLowerCase().includes(searchFilter.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [nodes, filterType, searchFilter]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // Filter relationships connecting visible nodes
  const filteredRelationships = useMemo(() => {
    return relationships.filter(
      (r) => filteredNodeIds.has(r.source_node_id) && filteredNodeIds.has(r.target_node_id)
    );
  }, [relationships, filteredNodeIds]);

  // Calculate circular/clustered layout positions
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const count = filteredNodes.length;
    const centerX = 400;
    const centerY = 280;
    const radius = Math.min(220, 60 + count * 18);

    filteredNodes.forEach((node, idx) => {
      const angle = (idx / (count || 1)) * 2 * Math.PI;
      // Stagger slightly by node type for visual clustering
      const r = radius * (node.node_type === 'project' ? 0.6 : node.node_type === 'decision' ? 0.85 : 1.05);
      positions.set(node.id, {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      });
    });

    return positions;
  }, [filteredNodes]);

  return (
    <div
      style={{
        background: '#0b1322',
        borderRadius: '8px',
        border: '1px solid rgba(226, 181, 60, 0.2)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.7)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Filter Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              background: '#16263f',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.8rem',
            }}
          >
            <option value="all">All Types ({nodes.length})</option>
            <option value="project">Projects</option>
            <option value="decision">Decisions</option>
            <option value="action">Actions</option>
            <option value="report">Reports</option>
            <option value="insight">Lessons / Insights</option>
            <option value="risk">Risks</option>
            <option value="opportunity">Opportunities</option>
          </select>

          <input
            type="text"
            placeholder="Search nodes in graph..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              background: '#16263f',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              width: '180px',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
            {filteredNodes.length} nodes · {filteredRelationships.length} relationships
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            -
          </button>
          <span style={{ color: '#cbd5e1', fontSize: '0.75rem', width: '36px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            style={{
              background: '#1e293b',
              color: '#e2b53c',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* SVG Visualization Canvas */}
      <div style={{ height: '540px', width: '100%', overflow: 'hidden', position: 'relative' }}>
        {filteredNodes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: '0.9rem',
            }}
          >
            No matching nodes in Knowledge Graph. Click "Sync Knowledge Graph" to discover entities.
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 560"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out',
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="18"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="rgba(226, 181, 60, 0.6)" />
              </marker>
            </defs>

            {/* Relationships (Edges) */}
            {filteredRelationships.map((r) => {
              const srcPos = nodePositions.get(r.source_node_id);
              const tgtPos = nodePositions.get(r.target_node_id);
              if (!srcPos || !tgtPos) return null;

              const isHighlighted =
                selectedNodeId &&
                (r.source_node_id === selectedNodeId || r.target_node_id === selectedNodeId);

              return (
                <g key={r.id}>
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    stroke={isHighlighted ? '#e2b53c' : 'rgba(255, 255, 255, 0.18)'}
                    strokeWidth={isHighlighted ? 2.5 : 1.2}
                    markerEnd="url(#arrowhead)"
                  />
                  {isHighlighted && (
                    <text
                      x={(srcPos.x + tgtPos.x) / 2}
                      y={(srcPos.y + tgtPos.y) / 2 - 4}
                      fill="#e2b53c"
                      fontSize="9px"
                      textAnchor="middle"
                      style={{ background: '#0b1322' }}
                    >
                      {r.relationship_type.replace(/_/g, ' ')} ({r.confidence_score}%)
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const isSelected = selectedNodeId === node.id;
              const color = NODE_COLORS[node.node_type] || '#cbd5e1';

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => onSelectNode && onSelectNode(node)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r={isSelected ? 18 : 12}
                    fill={color}
                    fillOpacity={0.85}
                    stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.4)'}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  <text
                    y={isSelected ? 28 : 22}
                    fill="#f8fafc"
                    fontSize="10px"
                    fontWeight={isSelected ? 700 : 500}
                    textAnchor="middle"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {node.title.length > 20 ? node.title.slice(0, 18) + '...' : node.title}
                  </text>
                  <text
                    y={isSelected ? 38 : 31}
                    fill="#94a3b8"
                    fontSize="8px"
                    textAnchor="middle"
                    style={{ textTransform: 'uppercase' }}
                  >
                    {node.node_type}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

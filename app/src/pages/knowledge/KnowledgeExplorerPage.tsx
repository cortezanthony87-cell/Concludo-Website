import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  KnowledgeNode,
  KnowledgeRelationship,
  DecisionNetwork,
  ProjectNetwork,
  EvidenceNetwork,
  KnowledgeSearchResult,
  CLUSTER_CATEGORY_LABELS,
} from '../../lib/knowledge/types';
import { KnowledgeGraphCanvas } from '../../components/knowledge/KnowledgeGraphCanvas';

export const KnowledgeExplorerPage: React.FC = () => {
  const { user, profile } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const [activeTab, setActiveTab] = useState<
    'search' | 'graph' | 'decision_networks' | 'project_networks' | 'evidence_networks'
  >('graph');

  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [relationships, setRelationships] = useState<KnowledgeRelationship[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Network views state
  const [decisionNetwork, setDecisionNetwork] = useState<DecisionNetwork | null>(null);
  const [projectNetwork, setProjectNetwork] = useState<ProjectNetwork | null>(null);
  const [evidenceNetwork, setEvidenceNetwork] = useState<EvidenceNetwork | null>(null);

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading Knowledge Graph...');
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    loadGraphData();
  }, [user]);

  const loadGraphData = async () => {
    if (!user) return;
    setLoading(true);
    setLoadingMessage('Loading Knowledge Graph...');
    setError(null);

    try {
      const { data: nodesData, error: nodesErr } = await supabase
        .from('knowledge_nodes')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (nodesErr) throw nodesErr;

      setLoadingMessage('Loading Relationships...');
      const { data: relsData, error: relsErr } = await supabase
        .from('knowledge_relationships')
        .select('*, source_node:knowledge_nodes!source_node_id(*), target_node:knowledge_nodes!target_node_id(*)')
        .is('deleted_at', null);

      if (relsErr) throw relsErr;

      const loadedNodes = nodesData || [];
      const loadedRels = relsData || [];

      setNodes(loadedNodes);
      setRelationships(loadedRels);

      if (loadedNodes.length > 0 && !selectedNode) {
        setSelectedNode(loadedNodes[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncGraph = async () => {
    setIsSyncing(true);
    setSyncStatus('Discovering entities and mapping relationships...');
    try {
      const res = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });

      if (!res.ok) throw new Error('Failed to synchronize knowledge graph');
      const json = await res.json();
      setSyncStatus(`Sync complete! ${json.data?.nodesCount || 0} nodes and ${json.data?.relationshipsCount || 0} relationships discovered.`);
      await loadGraphData();
    } catch (err: any) {
      setSyncStatus(`Sync notice: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();
      setSearchResults(json.data || []);
    } catch (err: any) {
      setError('Failed to calculate relationship paths: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const loadDecisionNetwork = async (decisionId: string) => {
    setLoadingMessage('Loading Decision Network...');
    try {
      const res = await fetch(`/api/knowledge/decision-network/${decisionId}`);
      if (!res.ok) throw new Error('Decision network not found');
      const json = await res.json();
      setDecisionNetwork(json.data);
    } catch (err: any) {
      setError('Failed to load decision network: ' + err.message);
    }
  };

  const loadProjectNetwork = async (projectId: string) => {
    setLoadingMessage('Loading Project Network...');
    try {
      const res = await fetch(`/api/knowledge/project-network/${projectId}`);
      if (!res.ok) throw new Error('Project network not found');
      const json = await res.json();
      setProjectNetwork(json.data);
    } catch (err: any) {
      setError('Failed to load project network: ' + err.message);
    }
  };

  const loadEvidenceNetwork = async (entityType: string, entityId: string) => {
    setLoadingMessage('Generating Evidence Network...');
    try {
      const res = await fetch(`/api/knowledge/evidence/${entityType}/${entityId}`);
      if (!res.ok) throw new Error('Evidence network failed');
      const json = await res.json();
      setEvidenceNetwork(json.data);
    } catch (err: any) {
      setError('Failed to generate visualization: ' + err.message);
    }
  };

  // Decisions list for network selector
  const decisionNodes = nodes.filter((n) => n.node_type === 'decision');
  // Projects list for network selector
  const projectNodes = nodes.filter((n) => n.node_type === 'project');

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ color: '#f8fafc', fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
              Knowledge Explorer
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(226, 181, 60, 0.2)', color: '#e2b53c', fontWeight: 600 }}>
              Organizational Memory Graph
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px' }}>
            Centralized Knowledge Network mapping relationships between projects, decisions, actions, and strategic outcomes across time.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleSyncGraph}
            disabled={isSyncing}
            className="btn btn-secondary"
            style={{
              background: '#1e293b',
              color: '#e2b53c',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
            }}
          >
            {isSyncing ? 'Syncing...' : '⚡ Sync Knowledge Graph'}
          </button>
        </div>
      </div>

      {syncStatus && (
        <div style={{ padding: '10px 14px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', color: '#38bdf8', fontSize: '0.82rem', marginBottom: '18px' }}>
          {syncStatus}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px', overflowX: 'auto' }}>
        {[
          { id: 'graph', label: 'Relationship Explorer & Graph' },
          { id: 'search', label: 'Knowledge Search & Trace' },
          { id: 'decision_networks', label: 'Decision Networks' },
          { id: 'project_networks', label: 'Project Networks' },
          { id: 'evidence_networks', label: 'Evidence Networks' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'decision_networks' && decisionNodes.length > 0 && !decisionNetwork) {
                loadDecisionNetwork(decisionNodes[0].id);
              }
              if (tab.id === 'project_networks' && projectNodes.length > 0 && !projectNetwork) {
                loadProjectNetwork(projectNodes[0].id);
              }
              if (tab.id === 'evidence_networks' && !evidenceNetwork) {
                loadEvidenceNetwork('recommendation', 'rec-resolve-overdue');
              }
            }}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #e2b53c' : '2px solid transparent',
              color: activeTab === tab.id ? '#e2b53c' : '#94a3b8',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button
            onClick={loadGraphData}
            style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ color: '#e2b53c', fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
            {loadingMessage}
          </div>
          <div style={{ fontSize: '0.85rem' }}>Traversing persistent organizational relationships...</div>
        </div>
      ) : (
        <>
          {/* TAB 1: Graph Visualization & Node Inspector */}
          {activeTab === 'graph' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '20px' }}>
              <KnowledgeGraphCanvas
                nodes={nodes}
                relationships={relationships}
                selectedNodeId={selectedNode?.id}
                onSelectNode={(node) => setSelectedNode(node)}
              />

              {/* Node Inspector Drawer */}
              <div
                className="panel"
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Node Inspector
                  </div>
                  <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 700, margin: '4px 0 0 0' }}>
                    {selectedNode ? selectedNode.title : 'Select a node'}
                  </h3>
                  {selectedNode && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: '6px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedNode.node_type}
                    </span>
                  )}
                </div>

                {selectedNode ? (
                  <>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Summary:</div>
                      <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5, margin: '4px 0 0 0' }}>
                        {selectedNode.summary || 'No summary available.'}
                      </p>
                    </div>

                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Created Date:</div>
                      <div style={{ color: '#f8fafc', fontSize: '0.82rem', marginTop: '2px' }}>
                        {new Date(selectedNode.created_at).toLocaleDateString('en-AU', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    {/* Connected Relationships */}
                    <div>
                      <div style={{ color: '#e2b53c', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
                        Connected Relationships:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                        {relationships
                          .filter(
                            (r) =>
                              r.source_node_id === selectedNode.id ||
                              r.target_node_id === selectedNode.id
                          )
                          .map((r) => {
                            const isSource = r.source_node_id === selectedNode.id;
                            const other = isSource ? r.target_node : r.source_node;
                            return (
                              <div
                                key={r.id}
                                style={{
                                  padding: '8px 10px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 255, 255, 0.06)',
                                }}
                              >
                                <div style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 600 }}>
                                  {isSource ? `-> ${r.relationship_type.replace(/_/g, ' ')}` : `<- influenced by`}
                                </div>
                                <div style={{ color: '#38bdf8', fontSize: '0.78rem', marginTop: '2px' }}>
                                  [{other?.node_type || 'node'}] {other?.title || 'Unknown'}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '2px' }}>
                                  Confidence: {r.confidence_score}%
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
                    Click any node in the graph visualization to inspect properties and trace relationships.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Knowledge Search & Trace */}
          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Search decisions, projects, actions, risks, forecasts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#16263f',
                    color: '#f8fafc',
                    border: '1px solid rgba(226, 181, 60, 0.3)',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="btn btn-primary"
                  style={{
                    background: '#e2b53c',
                    color: '#0f172a',
                    fontWeight: 700,
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: isSearching ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSearching ? 'Searching...' : 'Explore Knowledge'}
                </button>
              </form>

              {searchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {searchResults.map((res) => (
                    <div
                      key={res.node.id}
                      className="panel"
                      style={{
                        padding: '18px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              marginRight: '8px',
                            }}
                          >
                            {res.node.node_type}
                          </span>
                          <span style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600 }}>
                            {res.node.title}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            background: 'rgba(74, 222, 128, 0.15)',
                            color: '#4ade80',
                            fontWeight: 700,
                          }}
                        >
                          Confidence: {res.confidence_score}% ({res.confidence_level.replace(/_/g, ' ')})
                        </span>
                      </div>

                      <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                        {res.node.summary}
                      </p>

                      {/* Relationship Paths & Supporting Evidence */}
                      <div style={{ background: 'rgba(11, 19, 34, 0.8)', padding: '12px 14px', borderRadius: '6px' }}>
                        <div style={{ color: '#e2b53c', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                          Traceable Relationship Path:
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {res.relationship_path.join(' ')}
                        </div>

                        {res.supporting_evidence.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                              Supporting Evidence:
                            </div>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', color: '#cbd5e1', fontSize: '0.8rem' }}>
                              {res.supporting_evidence.map((ev, i) => (
                                <li key={i}>{ev}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Enter a keyword or topic above to traverse organizational memory across projects, decisions, and outcomes.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Decision Networks */}
          {activeTab === 'decision_networks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Select Decision:</span>
                <select
                  onChange={(e) => loadDecisionNetwork(e.target.value)}
                  style={{
                    background: '#16263f',
                    color: '#f8fafc',
                    border: '1px solid rgba(226, 181, 60, 0.3)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    minWidth: '260px',
                  }}
                >
                  {decisionNodes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>

              {decisionNetwork && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  <div className="panel" style={{ padding: '18px' }}>
                    <div style={{ color: '#e2b53c', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Primary Decision Record
                    </div>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 700, margin: '6px 0' }}>
                      {decisionNetwork.decision.title}
                    </h3>
                    <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {decisionNetwork.decision.summary}
                    </p>
                    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Historical Outcomes:</div>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', color: '#cbd5e1', fontSize: '0.8rem' }}>
                        {decisionNetwork.historical_outcomes.map((o, idx) => (
                          <li key={idx}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="panel" style={{ padding: '18px' }}>
                    <div style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Dependent Execution Actions ({decisionNetwork.dependent_actions.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                      {decisionNetwork.dependent_actions.length > 0 ? (
                        decisionNetwork.dependent_actions.map((act) => (
                          <div key={act.id} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                            <div style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 600 }}>{act.title}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{act.summary}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No dependent actions linked.</div>
                      )}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: '18px' }}>
                    <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Affected Projects & Evidence
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                      {decisionNetwork.affected_projects.map((p) => (
                        <div key={p.id} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                          <div style={{ color: '#38bdf8', fontSize: '0.82rem', fontWeight: 600 }}>[Project] {p.title}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{p.summary}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Project Networks */}
          {activeTab === 'project_networks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Select Project:</span>
                <select
                  onChange={(e) => loadProjectNetwork(e.target.value)}
                  style={{
                    background: '#16263f',
                    color: '#f8fafc',
                    border: '1px solid rgba(226, 181, 60, 0.3)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    minWidth: '260px',
                  }}
                >
                  {projectNodes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              {projectNetwork && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div className="panel" style={{ padding: '18px' }}>
                    <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Project Hub
                    </div>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: 700, margin: '6px 0' }}>
                      {projectNetwork.project.title}
                    </h3>
                    <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {projectNetwork.project.summary}
                    </p>
                  </div>

                  <div className="panel" style={{ padding: '18px' }}>
                    <div style={{ color: '#e2b53c', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Linked Decisions ({projectNetwork.linked_decisions.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      {projectNetwork.linked_decisions.map((d) => (
                        <div key={d.id} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '0.8rem', color: '#f8fafc' }}>
                          {d.title}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: '18px' }}>
                    <div style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      Connected Projects ({projectNetwork.connected_projects.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      {projectNetwork.connected_projects.map((cp) => (
                        <div key={cp.id} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '0.8rem', color: '#f8fafc' }}>
                          {cp.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Evidence Networks */}
          {activeTab === 'evidence_networks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {evidenceNetwork ? (
                <div className="panel" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.7)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ color: '#e2b53c', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Traceable Evidence Graph
                      </div>
                      <h3 style={{ color: '#f8fafc', fontSize: '1.3rem', fontWeight: 700, margin: '4px 0' }}>
                        {evidenceNetwork.target_title}
                      </h3>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        Source: {evidenceNetwork.evidence_source} · Context: {evidenceNetwork.historical_context}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      Confidence: {evidenceNetwork.confidence_score}% ({evidenceNetwork.confidence_level.replace(/_/g, ' ')})
                    </span>
                  </div>

                  {/* Reasoning Path */}
                  <div style={{ marginTop: '20px', background: '#0b1322', padding: '16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ color: '#e2b53c', fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>
                      Reasoning Path (No Black-Box Traceability):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {evidenceNetwork.reasoning_path.map((path, idx) => (
                        <div key={idx} style={{ color: '#cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                          {path}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Supporting Records Table */}
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 600, marginBottom: '10px' }}>
                      Supporting Historical Records ({evidenceNetwork.supporting_records.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {evidenceNetwork.supporting_records.map((rec) => (
                        <div key={rec.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>
                              {rec.entity_type}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>
                              {rec.confidence}% conf
                            </span>
                          </div>
                          <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600, marginTop: '4px' }}>
                            {rec.title}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '2px' }}>
                            {rec.detail}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>Generating Evidence Graph...</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

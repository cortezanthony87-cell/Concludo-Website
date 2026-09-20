/**
 * Tasklet 9.8: Knowledge Graph References Engine
 * Tasklet 9.9: Source Attribution and Citation Service
 */

export class EntityNotFoundInGraphError extends Error {
  constructor(message = 'Entity not found in organisation knowledge graph') {
    super(message);
    this.name = 'ENTITY_NOT_FOUND_IN_GRAPH';
  }
}

export class CopilotGraphReferencesEngine {
  constructor() {
    this.nodes = new Map(); // nodeId -> node
    this.edges = []; // Array of edges
  }

  addNode(node) {
    // Structural security check: no person node carries a behavioural metric
    if (node.type === 'PERSON' && (node.talk_time || node.contribution_score || node.engagement_index)) {
      throw new Error('SECURITY VIOLATION: Person nodes cannot store behavioural metrics');
    }
    this.nodes.set(node.id, node);
  }

  addEdge(edge) {
    this.edges.push(edge);
  }

  traverse(entityId, orgId, hops = 1, userCapabilities = []) {
    if (!userCapabilities.includes('governance_policy')) {
      throw new Error('UNAUTHORIZED_GRAPH_ACCESS: Knowledge graph access requires governance_policy capability flag.');
    }

    const startNode = this.nodes.get(entityId);
    if (!startNode || startNode.organisation_id !== orgId) {
      throw new EntityNotFoundInGraphError();
    }

    const visitedNodes = new Map([[startNode.id, startNode]]);
    let currentLevelIds = [startNode.id];

    for (let h = 0; h < hops; h++) {
      const nextLevelIds = [];
      for (const edge of this.edges) {
        if (edge.organisation_id !== orgId) continue;

        let neighborId = null;
        if (currentLevelIds.includes(edge.source_id)) neighborId = edge.target_id;
        else if (currentLevelIds.includes(edge.target_id)) neighborId = edge.source_id;

        if (neighborId && !visitedNodes.has(neighborId)) {
          const neighbor = this.nodes.get(neighborId);
          if (neighbor && neighbor.organisation_id === orgId) {
            visitedNodes.set(neighbor.id, neighbor);
            nextLevelIds.push(neighbor.id);
          }
        }
      }
      currentLevelIds = nextLevelIds;
    }

    return {
      rootEntity: startNode,
      traversalHops: hops,
      connectedEntities: Array.from(visitedNodes.values()),
    };
  }
}

export class SourceAttributionService {
  constructor() {
    this.transcripts = new Map(); // transcriptId -> text
  }

  registerTranscript(id, text) {
    this.transcripts.set(id, text);
  }

  verifyAndSanitizeResponse(responseClaimText, transcriptId) {
    if (!responseClaimText) return { cleanText: '', strippedCount: 0 };
    const sourceText = this.transcripts.get(transcriptId) || '';

    // Extract quoted strings
    const quotes = responseClaimText.match(/"([^"]+)"/g) || [];
    let strippedCount = 0;
    let sanitizedText = responseClaimText;

    for (const q of quotes) {
      const rawQuote = q.replace(/"/g, '');
      if (rawQuote.length > 5 && !sourceText.includes(rawQuote)) {
        // Ungrounded quote: strip and record that it was removed
        sanitizedText = sanitizedText.replace(q, '[UNVERIFIABLE_CITATION_REMOVED]');
        strippedCount++;
      }
    }

    return {
      cleanText: sanitizedText,
      strippedCount,
      isFullyGrounded: strippedCount === 0,
    };
  }
}

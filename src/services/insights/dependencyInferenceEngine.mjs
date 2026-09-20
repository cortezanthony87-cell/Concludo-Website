/**
 * Tasklet 3.2: Dependency Inference (Channel INS-E)
 * 
 * Infer structural and sequence dependencies over actions and decisions.
 * Rule: Every finding must cite its comparison basis.
 * Render: observation. Cap: 6.
 */

export class CircularDependencyDetectedError extends Error {
  constructor(cycle) {
    super(`Circular sequence bottleneck detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyDetectedError';
    this.code = 'CIRCULAR_DEPENDENCY_DETECTED';
    this.cycle = cycle;
  }
}

export const INS_E_CHANNEL = {
  id: 'INS-E',
  question: 'What dependencies exist?',
  detector: 'dependency inference over actions and decisions',
  tier: 'T2',
  cap: 6,
  render: 'observation'
};

export function inferActionDependencies(actions = [], decisions = [], options = {}) {
  const dependencies = [];

  // Check explicit depends_on across all actions
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (act.depends_on) {
      dependencies.push({
        channel_id: INS_E_CHANNEL.id,
        prerequisite_item_id: act.depends_on,
        dependent_item_id: act.id || act.action_id || `ACT-0${i + 1}`,
        dependency_type: 'BLOCKING',
        comparison_basis: 'Explicit prerequisite sequence declared in meeting transcript',
        observation_text: `Action "${act.title || act.what || act.id}" is explicitly blocked by prerequisite "${act.depends_on}".`,
        render_type: INS_E_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    }
  }

  // Check decisions that prerequisite this action
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    const actDesc = (act.title || act.what || act.description || '').toLowerCase();

    for (const dec of decisions) {
      const decDesc = (dec.title || dec.decision_statement || dec.rationale || '').toLowerCase();
      const sharedWords = actDesc.split(/\s+/).filter(w => w.length > 4 && decDesc.includes(w));
      if (sharedWords.length > 0 || (act.prerequisite_decision_id && act.prerequisite_decision_id === dec.id)) {
        dependencies.push({
          channel_id: INS_E_CHANNEL.id,
          prerequisite_item_id: dec.id || 'DEC-01',
          dependent_item_id: act.id || act.action_id || `ACT-0${i + 1}`,
          dependency_type: 'BLOCKING',
          comparison_basis: `Decision prerequisite sequence rule: action execution rests on prior resolution of ${dec.title || 'formal decision'}`,
          observation_text: `Action "${act.title || act.what || 'Action ' + (i + 1)}" is structurally dependent on Decision "${dec.title || 'Decision'}".`,
          render_type: INS_E_CHANNEL.render,
          created_at: new Date().toISOString()
        });
      }
      if (dependencies.length >= INS_E_CHANNEL.cap) break;
    }
    if (dependencies.length >= INS_E_CHANNEL.cap) break;
  }

  // Check for circular dependencies
  const graph = new Map();
  for (const dep of dependencies) {
    if (!graph.has(dep.prerequisite_item_id)) graph.set(dep.prerequisite_item_id, []);
    graph.get(dep.prerequisite_item_id).push(dep.dependent_item_id);
  }

  const visited = new Set();
  const recStack = new Set();

  function checkCycle(node, path = []) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        checkCycle(neighbor, [...path]);
      } else if (recStack.has(neighbor)) {
        throw new CircularDependencyDetectedError([...path, neighbor]);
      }
    }

    recStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      checkCycle(node, []);
    }
  }

  return dependencies.slice(0, INS_E_CHANNEL.cap);
}

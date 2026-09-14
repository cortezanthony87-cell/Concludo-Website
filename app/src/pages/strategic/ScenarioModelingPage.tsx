import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Shield,
  Layers,
  HelpCircle,
  Save,
  Trash2,
  Sparkles,
  Clock,
} from 'lucide-react';
import { StrategicClient } from '../../lib/strategic/strategicClient';
import {
  ScenarioType,
  ScenarioParameters,
  ScenarioSimulationResults,
  StrategicScenario,
} from '../../lib/strategic/types';
import { ScenarioEngine } from '../../lib/strategic/scenarioEngine';

export const ScenarioModelingPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<ScenarioType>('delivery_slowdown');
  const [deliveryPct, setDeliveryPct] = useState<number>(15);
  const [velocityPct, setVelocityPct] = useState<number>(20);
  const [overdueSurgePct, setOverdueSurgePct] = useState<number>(25);
  const [delayWeeks, setDelayWeeks] = useState<number>(4);
  const [capacityPct, setCapacityPct] = useState<number>(25);
  const [customText, setCustomText] = useState<string>('');

  const [results, setResults] = useState<ScenarioSimulationResults | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<StrategicScenario[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getParams = (): ScenarioParameters => {
    switch (selectedType) {
      case 'delivery_slowdown':
        return { delivery_change_pct: deliveryPct };
      case 'velocity_improvement':
        return { velocity_change_pct: velocityPct };
      case 'action_backlog_surge':
        return { overdue_action_surge_pct: overdueSurgePct };
      case 'initiative_delay':
        return { delay_weeks: delayWeeks, target_initiative_name: 'Project Atlas' };
      case 'capacity_expansion':
        return { capacity_change_pct: capacityPct };
      case 'custom':
      default:
        return { custom_hypothesis: customText };
    }
  };

  const runSimulation = () => {
    setIsSimulating(true);
    setError(null);
    try {
      const res = ScenarioEngine.simulateScenario(selectedType, getParams());
      setResults(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to execute simulation');
    } finally {
      setIsSimulating(false);
    }
  };

  const loadSaved = async () => {
    try {
      setLoadingList(true);
      const list = await StrategicClient.getScenarios();
      setSavedScenarios(list);
    } catch (e) {
      console.error('Failed to load saved scenarios', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    runSimulation();
    loadSaved();
  }, [selectedType]);

  const handleSaveScenario = async () => {
    if (!results) return;
    try {
      setIsSaving(true);
      const titleMap: Record<ScenarioType, string> = {
        delivery_slowdown: `Delivery Slowdown (${deliveryPct}%)`,
        velocity_improvement: `Decision Velocity Improvement (+${velocityPct}%)`,
        action_backlog_surge: `Action Backlog Surge (+${overdueSurgePct}%)`,
        initiative_delay: `Project Atlas Delayed (${delayWeeks} wks)`,
        capacity_expansion: `Team Capacity Expansion (+${capacityPct}%)`,
        custom: 'Custom Hypothetical Scenario',
      };
      await StrategicClient.createScenario(
        titleMap[selectedType] || 'Hypothetical Scenario',
        selectedType,
        getParams(),
        'Saved hypothetical simulation from Scenario Modeling studio'
      );
      await loadSaved();
    } catch (e: any) {
      setError(e?.message || 'Failed to save scenario');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await StrategicClient.deleteScenario(id);
      setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error('Failed to delete scenario', e);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Scenario Modeling & Simulation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E2B53C]/10 text-[#E2B53C] border border-[#E2B53C]/30">
              Hypothetical Exploration
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Simulate operational shifts and evaluate estimated impacts on delivery, resources, and governance risk without claiming certainty.
          </p>
        </div>
      </div>

      {/* Scenario Presets Selector */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Select Strategic Scenario Type
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { id: 'delivery_slowdown', label: 'Delivery Slowdown', desc: '15% pace decrease' },
            { id: 'velocity_improvement', label: 'Velocity Boost', desc: '20% faster decisions' },
            { id: 'action_backlog_surge', label: 'Action Backlog', desc: 'Surge in overdue tasks' },
            { id: 'initiative_delay', label: 'Initiative Delay', desc: '4 weeks schedule slip' },
            { id: 'capacity_expansion', label: 'Capacity Expansion', desc: '25% team scale' },
            { id: 'custom', label: 'Custom Hypothesis', desc: 'User-defined parameters' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedType(item.id as ScenarioType)}
              className={`p-3 rounded-lg text-left transition border ${
                selectedType === item.id
                  ? 'bg-[#E2B53C]/10 border-[#E2B53C] text-white'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-xs font-semibold truncate">{item.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Dynamic Parameter Adjuster */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            {selectedType === 'delivery_slowdown' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Delivery Slowdown Percentage: <span className="text-[#E2B53C] font-bold">{deliveryPct}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="40"
                  step="5"
                  value={deliveryPct}
                  onChange={(e) => setDeliveryPct(Number(e.target.value))}
                  className="w-full max-w-md accent-[#E2B53C]"
                />
              </div>
            )}

            {selectedType === 'velocity_improvement' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Decision Velocity Improvement: <span className="text-[#E2B53C] font-bold">+{velocityPct}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={velocityPct}
                  onChange={(e) => setVelocityPct(Number(e.target.value))}
                  className="w-full max-w-md accent-[#E2B53C]"
                />
              </div>
            )}

            {selectedType === 'action_backlog_surge' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Overdue Action Item Surge: <span className="text-[#E2B53C] font-bold">+{overdueSurgePct}%</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={overdueSurgePct}
                  onChange={(e) => setOverdueSurgePct(Number(e.target.value))}
                  className="w-full max-w-md accent-[#E2B53C]"
                />
              </div>
            )}

            {selectedType === 'initiative_delay' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Target Initiative Delay: <span className="text-[#E2B53C] font-bold">{delayWeeks} weeks</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={delayWeeks}
                  onChange={(e) => setDelayWeeks(Number(e.target.value))}
                  className="w-full max-w-md accent-[#E2B53C]"
                />
              </div>
            )}

            {selectedType === 'capacity_expansion' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Squad Capacity Expansion: <span className="text-[#E2B53C] font-bold">+{capacityPct}%</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={capacityPct}
                  onChange={(e) => setCapacityPct(Number(e.target.value))}
                  className="w-full max-w-md accent-[#E2B53C]"
                />
              </div>
            )}

            {selectedType === 'custom' && (
              <div className="max-w-md">
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Hypothetical Premise
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vendor API SLA doubles during peak quarter"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-slate-950 font-semibold rounded-lg text-xs transition"
            >
              <Play className="w-3.5 h-3.5" />
              {isSimulating ? 'Running Simulation...' : 'Re-Run Simulation'}
            </button>
            <button
              onClick={handleSaveScenario}
              disabled={isSaving || !results}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs border border-slate-700 transition"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Scenario'}
            </button>
          </div>
        </div>
      </div>

      {/* Simulation Output Section */}
      {results && (
        <div className="space-y-6">
          {/* Top Level Impacts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Risk Level Impact</span>
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-lg font-bold text-white uppercase">{results.risk_impact.level}</div>
              <p className="text-xs text-slate-300 mt-1">{results.risk_impact.summary}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Timeline Variance</span>
                <Clock className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-lg font-bold text-white">
                {results.project_impact.timelineVarianceDays > 0 ? `+${results.project_impact.timelineVarianceDays}` : results.project_impact.timelineVarianceDays} Days
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Affected: {results.project_impact.affectedProjects.join(', ') || 'None'}
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Confidence Rating</span>
                <Sparkles className="w-4 h-4 text-[#E2B53C]" />
              </div>
              <div className="text-lg font-bold text-[#E2B53C]">{results.confidence_level}</div>
              <p className="text-xs text-slate-400 mt-1">Based on historical project variance</p>
            </div>
          </div>

          {/* Possible Outcomes & Operational Impact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Projected Possible Outcomes</h3>
              <ul className="space-y-2.5">
                {results.possible_outcomes.map((outcome, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E2B53C] shrink-0 mt-1.5" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Resource & Governance Impact</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400">Resource Contention:</span>
                  <p className="text-slate-200 mt-0.5">{results.resource_impact.bottleneckRisk}</p>
                </div>
                <div>
                  <span className="text-slate-400">Governance Friction:</span>
                  <p className="text-slate-200 mt-0.5">{results.decision_impact.governanceFriction}</p>
                </div>
                <div>
                  <span className="text-slate-400">Operational Health Shift:</span>
                  <p className={`font-semibold mt-0.5 ${results.operational_impact.overallHealthDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {results.operational_impact.overallHealthDelta > 0 ? `+${results.operational_impact.overallHealthDelta}` : results.operational_impact.overallHealthDelta} points overall
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Model Assumptions and Evidence Grounding */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-white">Simulation Assumptions & Evidence Citations</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div>
                <span className="text-slate-400 font-medium block mb-2">Explicit Assumptions (No Absolute Certainty Claimed)</span>
                <ul className="space-y-1.5 text-slate-300">
                  {results.assumptions.map((asm, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-slate-500">•</span>
                      <span>{asm}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-slate-400 font-medium block mb-2">Retrieved Supporting Evidence</span>
                <ul className="space-y-2">
                  {results.supporting_evidence.map((ev, i) => (
                    <li key={i} className="bg-slate-800/40 p-2.5 rounded border border-slate-700/60">
                      <div className="font-semibold text-slate-200">{ev.source}: {ev.metric}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">{ev.observation}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Scenarios Table */}
      {savedScenarios.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Saved Scenarios Archive</h3>
          <div className="divide-y divide-slate-800">
            {savedScenarios.map((sc) => (
              <div key={sc.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-white">{sc.title}</h4>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span className="uppercase">{sc.scenario_type.replace(/_/g, ' ')}</span>
                    <span>•</span>
                    <span>Confidence: {sc.confidence_level}</span>
                    <span>•</span>
                    <span>Created: {new Date(sc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteScenario(sc.id)}
                  className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                  title="Delete Scenario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

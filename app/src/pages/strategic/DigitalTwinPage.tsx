import React, { useState, useEffect } from 'react';
import {
  Activity,
  Shield,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  FolderKanban,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  GitBranch,
  BookOpen,
} from 'lucide-react';
import { StrategicClient } from '../../lib/strategic/strategicClient';
import { StrategicDigitalTwin } from '../../lib/strategic/types';

export const DigitalTwinPage: React.FC = () => {
  const [twin, setTwin] = useState<StrategicDigitalTwin | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTwin = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = refresh
        ? await StrategicClient.refreshDigitalTwin()
        : await StrategicClient.getDigitalTwin();
      setTwin(data);
    } catch (err: any) {
      console.error('Failed to load digital twin:', err);
      setError(err?.message || 'Failed to load Digital Twin. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTwin();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400">
        <Cpu className="w-12 h-12 animate-spin text-[#E2B53C] mb-4" />
        <p className="text-base font-medium text-slate-200">Loading Digital Twin...</p>
        <p className="text-sm text-slate-400 mt-1">Modeling organization, projects, decisions, and knowledge streams</p>
      </div>
    );
  }

  if (error || !twin) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-300">Failed to load Digital Twin</h3>
        <p className="text-sm text-red-200/80 mt-1 mb-4">{error || 'An unexpected error occurred.'}</p>
        <button
          onClick={() => loadTwin()}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Digital Twin Organisation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E2B53C]/10 text-[#E2B53C] border border-[#E2B53C]/30">
              Enterprise Continuous Model
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic, real-time representation of organisational performance, operational health, and strategic execution.
          </p>
        </div>

        <button
          onClick={() => loadTwin(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#E2B53C]' : ''}`} />
          {refreshing ? 'Updating Model...' : 'Refresh Digital Twin'}
        </button>
      </div>

      {/* Core Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Strategic Health</span>
            <Activity className="w-4 h-4 text-[#E2B53C]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{twin.strategic_health}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-xs text-emerald-400 mt-1">Vision & Delivery Cadence</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Operational Health</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{twin.operational_health}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-xs text-sky-400 mt-1">Action & Alignment Cadence</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Risk Exposure</span>
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{twin.risk_exposure}%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Controlled enterprise buffer</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Opportunity Signals</span>
            <Zap className="w-4 h-4 text-[#E2B53C]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{twin.opportunity_score}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-xs text-emerald-400 mt-1">High growth readiness</p>
        </div>
      </div>

      {/* Six Health Dimension Meters */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Organizational Health Dimensions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Execution Health</span>
              <span className="text-white font-semibold">{twin.execution_health}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-[#E2B53C] h-full rounded-full" style={{ width: `${twin.execution_health}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Collaboration Health</span>
              <span className="text-white font-semibold">{twin.collaboration_health}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-sky-400 h-full rounded-full" style={{ width: `${twin.collaboration_health}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Decision Health</span>
              <span className="text-white font-semibold">{twin.decision_health}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${twin.decision_health}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Knowledge Health</span>
              <span className="text-white font-semibold">{twin.knowledge_health}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${twin.knowledge_health}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Strategic Alignment</span>
              <span className="text-white font-semibold">{twin.strategic_health}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-400 h-full rounded-full" style={{ width: `${twin.strategic_health}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Operational Velocity</span>
              <span className="text-white font-semibold">{twin.operational_health}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full" style={{ width: `${twin.operational_health}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Modeled Entity Stream Metrics */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-2">Continuously Modeled Entities</h2>
        <p className="text-xs text-slate-400 mb-6">
          The Digital Twin continuously updates as projects progress, decisions settle, actions resolve, and knowledge nodes expand.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <FolderKanban className="w-3.5 h-3.5 text-[#E2B53C]" />
              Projects
            </div>
            <div className="text-xl font-bold text-white">{twin.model_state.projects_count}</div>
            <span className="text-[10px] text-slate-400">{twin.model_state.active_initiatives_count} active</span>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              Decisions
            </div>
            <div className="text-xl font-bold text-white">{twin.model_state.decisions_count}</div>
            <span className="text-[10px] text-slate-400">Decision Memory</span>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Actions
            </div>
            <div className="text-xl font-bold text-white">{twin.model_state.actions_count}</div>
            <span className="text-[10px] text-emerald-400">{twin.model_state.open_actions_count} open</span>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              Workflows
            </div>
            <div className="text-xl font-bold text-white">{twin.model_state.workflows_count}</div>
            <span className="text-[10px] text-slate-400">Orchestrations</span>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              Knowledge
            </div>
            <div className="text-xl font-bold text-white">{twin.model_state.knowledge_nodes_count}</div>
            <span className="text-[10px] text-slate-400">{twin.model_state.knowledge_relationships_count} links</span>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              Lessons
            </div>
            <div className="text-xl font-bold text-white">{twin.model_state.lessons_learned_count}</div>
            <span className="text-[10px] text-slate-400">Cataloged</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Compass,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  FileText,
  Shield,
  Zap,
  Target,
  ArrowRight,
  Bell,
  Clock,
  Sparkles,
} from 'lucide-react';
import { StrategicClient } from '../../lib/strategic/strategicClient';
import {
  StrategicDigitalTwin,
  StrategicAlert,
  StrategicRecommendationItem,
  EnterpriseRiskNetwork,
} from '../../lib/strategic/types';

export const ExecutiveCommandCenterPage: React.FC = () => {
  const [twin, setTwin] = useState<StrategicDigitalTwin | null>(null);
  const [alerts, setAlerts] = useState<StrategicAlert[]>([]);
  const [recommendations, setRecommendations] = useState<StrategicRecommendationItem[]>([]);
  const [riskNet, setRiskNet] = useState<EnterpriseRiskNetwork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [twinData, alertsData, recsData, riskData] = await Promise.all([
        StrategicClient.getDigitalTwin(),
        StrategicClient.getAlerts(),
        StrategicClient.getRecommendations(),
        StrategicClient.getRiskNetwork(),
      ]);
      setTwin(twinData);
      setAlerts(alertsData);
      setRecommendations(recsData);
      setRiskNet(riskData);
    } catch (err: any) {
      console.error('Failed to load command center data:', err);
      setError(err?.message || 'Failed to load Executive Command Centre');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDismissAlert = async (id: string) => {
    try {
      await StrategicClient.dismissAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error('Failed to dismiss alert', e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400">
        <Compass className="w-12 h-12 animate-spin text-[#E2B53C] mb-4" />
        <p className="text-base font-medium text-slate-200">Loading Executive Command Centre...</p>
        <p className="text-sm text-slate-400 mt-1">Aggregating strategic priorities, risk heat maps, and enterprise health</p>
      </div>
    );
  }

  if (error || !twin) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-300">Failed to load Command Centre</h3>
        <p className="text-sm text-red-200/80 mt-1 mb-4">{error || 'An unexpected error occurred.'}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Executive Command Centre</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E2B53C]/10 text-[#E2B53C] border border-[#E2B53C]/30">
              Leadership Oversight
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Unified strategic operating dashboard for enterprise visibility, initiative health, and proactive risk control.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400">Organization Health</div>
            <div className="text-2xl font-bold text-white flex items-center justify-end gap-1">
              <span className="text-[#E2B53C]">{twin.strategic_health}</span>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            Active Strategic Alerts (Informational Only)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-4 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">{alert.title}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{alert.description}</p>
                    <span className="inline-block mt-2 text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {alert.alert_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDismissAlert(alert.id)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executive Oversight Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategic Priorities */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#E2B53C]" />
                <h3 className="text-sm font-semibold text-white">Strategic Priorities</h3>
              </div>
              <span className="text-xs text-emerald-400 font-medium">On Track</span>
            </div>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E2B53C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Project Atlas Core Milestones:</strong> Architecture validated and baseline sprint targets achieved.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E2B53C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Enterprise Governance Standards:</strong> Decision rationale logged in Decision Memory before commitment.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E2B53C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Cross-Squad PMO Synchronization:</strong> Turnaround cadence under 48 hours on critical reviews.
                </span>
              </li>
            </ul>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
            <span>Vision Alignment: 92%</span>
            <span className="text-slate-300 font-medium">Q4 Priority Focus</span>
          </div>
        </div>

        {/* Initiative Health */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">Initiative Health</h3>
              </div>
              <span className="text-xs text-sky-400 font-medium">
                {twin.model_state.active_initiatives_count} Active
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Delivery Velocity</span>
                  <span className="text-white font-semibold">{twin.execution_health}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-sky-400 h-full rounded-full" style={{ width: `${twin.execution_health}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Action Follow-Through</span>
                  <span className="text-white font-semibold">{twin.operational_health}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#E2B53C] h-full rounded-full" style={{ width: `${twin.operational_health}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Knowledge Utilization</span>
                  <span className="text-white font-semibold">{twin.knowledge_health}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${twin.knowledge_health}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
            <span>Completion Confidence</span>
            <span className="text-emerald-400 font-medium">High</span>
          </div>
        </div>

        {/* Risk Heat Map */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Risk Heat Map</h3>
              </div>
              <span className="text-xs text-amber-400 font-medium">
                Level: {riskNet?.overallRiskLevel || 'Moderate'}
              </span>
            </div>

            <div className="space-y-2.5">
              {riskNet?.nodes.slice(0, 3).map((r) => (
                <div key={r.id} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200 truncate pr-2">{r.title}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        r.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {r.severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    Origin: {r.originTitle}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
            <span>Mitigation Coverage</span>
            <span className="text-slate-200 font-medium">{riskNet?.mitigationCoverageRate || 88}%</span>
          </div>
        </div>
      </div>

      {/* Critical Decisions & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Critical Decisions */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Critical Decisions</h3>
            </div>
            <span className="text-xs text-slate-400">{twin.model_state.decisions_count} Documented</span>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-white">Primary Cloud Storage & Microservices Architecture</h4>
              <p className="text-xs text-slate-300 mt-1">
                Approved standard for scalable storage and unified event dispatching across backend services.
              </p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                <span>Outcome: Implemented</span>
                <span>•</span>
                <span>Rationale: 100% Verified</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-white">Unified Copilot & Decision Assistant Engine</h4>
              <p className="text-xs text-slate-300 mt-1">
                Selected conversational intelligence model grounded in tenant knowledge graph.
              </p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                <span>Outcome: Active</span>
                <span>•</span>
                <span>Turnaround: 1.2 days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Actions */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Critical Actions</h3>
            </div>
            <span className="text-xs text-slate-400">{twin.model_state.open_actions_count} Open</span>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-semibold text-white">Complete Security Architecture Documentation</h4>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">In Progress</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Prerequisite for staging environment verification and partner audit review.
              </p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                <span>Owner: Lead Architect</span>
                <span>•</span>
                <span>Priority: High</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-semibold text-white">Execute Automated Retention Purge Verification</h4>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">Verified</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Periodic verification that soft-deleted items past 30 days purge cleanly unless under legal hold.
              </p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                <span>Owner: Compliance Officer</span>
                <span>•</span>
                <span>Retention: Enforced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Recommendations Center */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#E2B53C]" />
            <h2 className="text-base font-semibold text-white">Executive Recommendations</h2>
          </div>
          <span className="text-xs text-slate-400">Evidence-backed advisory guidance</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.slice(0, 3).map((rec) => (
            <div key={rec.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[10px] uppercase font-bold text-[#E2B53C] bg-[#E2B53C]/10 px-2 py-0.5 rounded border border-[#E2B53C]/20">
                    {rec.category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-400 font-medium">{rec.confidenceScore}% Confidence</span>
                </div>
                <h4 className="text-sm font-semibold text-white">{rec.title}</h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{rec.summary}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700/60 text-[11px] text-slate-400 flex justify-between items-center">
                <span>Impact: {rec.impactScore}/100</span>
                <span>Effort: {rec.effortRating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

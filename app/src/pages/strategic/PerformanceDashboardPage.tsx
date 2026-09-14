import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Layers,
  Users,
  Award,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowUpRight,
} from 'lucide-react';
import { StrategicClient } from '../../lib/strategic/strategicClient';
import { EnterprisePerformanceModel, OrganizationalLearningModel } from '../../lib/strategic/types';
import { OrganizationalLearningEngine } from '../../lib/strategic/organizationalLearningEngine';

export const PerformanceDashboardPage: React.FC = () => {
  const [performance, setPerformance] = useState<EnterprisePerformanceModel | null>(null);
  const [learning, setLearning] = useState<OrganizationalLearningModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [perf] = await Promise.all([
          StrategicClient.getPerformanceModel(),
        ]);
        setPerformance(perf);
        setLearning(OrganizationalLearningEngine.computeLearningModel());
      } catch (e) {
        console.error('Failed to load performance data', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading || !performance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400">
        <BarChart3 className="w-12 h-12 animate-spin text-[#E2B53C] mb-4" />
        <p className="text-base font-medium text-slate-200">Loading Performance Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Enterprise Performance</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E2B53C]/10 text-[#E2B53C] border border-[#E2B53C]/30">
              Operations Intelligence
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Holistic cross-department performance framework evaluating execution, delivery, leadership, and knowledge effectiveness.
          </p>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400 uppercase">Execution Score</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{performance.execution}</span>
            <span className="text-xs text-emerald-400 font-semibold">+4% vs Q2</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Completion rate {performance.action_completion_rate}%</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400 uppercase">Delivery Cadence</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{performance.delivery}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Stable release throughput</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400 uppercase">Decision Quality</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{performance.decision_quality}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">{performance.decision_effectiveness_rate}% effectiveness</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400 uppercase">Forecast Accuracy</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{performance.forecast_accuracy}%</span>
          </div>
          <div className="text-xs text-emerald-400 mt-1">High predictive reliability</div>
        </div>
      </div>

      {/* Department Performance Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">Departmental Performance Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 rounded-l">Department</th>
                <th className="py-2.5 px-3">Execution Score</th>
                <th className="py-2.5 px-3">Delivery Rate</th>
                <th className="py-2.5 px-3">Active Projects</th>
                <th className="py-2.5 px-3">On-Track Rate</th>
                <th className="py-2.5 px-3 rounded-r">Velocity Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {performance.department_breakdown.map((dept, i) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-semibold text-white">{dept.department}</td>
                  <td className="py-3 px-3">
                    <span className="text-[#E2B53C] font-semibold">{dept.executionScore}%</span>
                  </td>
                  <td className="py-3 px-3">{dept.deliveryRate}%</td>
                  <td className="py-3 px-3">{dept.activeProjects}</td>
                  <td className="py-3 px-3 text-emerald-400 font-medium">{dept.onTrackRate}%</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 border border-slate-700">
                      {dept.velocityRating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Performance Breakdown & Trend Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team Breakdown */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Team Performance</h3>
            </div>
          </div>
          <div className="space-y-3">
            {performance.team_breakdown.map((team) => (
              <div key={team.teamId} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">{team.teamName}</h4>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {team.memberCount} members • Action completion: {team.actionCompletionRate}% • Turnaround: {team.decisionVelocityDays}d
                  </div>
                </div>
                <div className="text-center px-3 py-1 bg-slate-800 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-400">Grade</div>
                  <div className="text-sm font-bold text-[#E2B53C]">{team.healthGrade}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Trend Analysis */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">6-Month Trend Trajectory</h3>
            </div>
            <span className="text-xs text-emerald-400 font-medium">Consistent Improvement</span>
          </div>

          <div className="space-y-2.5">
            {performance.historical_trend.map((pt, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/80">
                <span className="text-slate-400 font-medium">{pt.month}</span>
                <div className="flex items-center gap-4 text-slate-300">
                  <span>Execution: <strong className="text-white">{pt.execution}%</strong></span>
                  <span>Delivery: <strong className="text-white">{pt.delivery}%</strong></span>
                  <span>Alignment: <strong className="text-white">{pt.alignment}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Organizational Learning & Memory Evolution */}
      {learning && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#E2B53C]" />
              <h3 className="text-base font-semibold text-white">Organizational Learning & Memory Evolution</h3>
            </div>
            <span className="text-xs text-slate-400">Institutional Knowledge Reuse</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            {/* Patterns That Consistently Work */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <span className="font-semibold text-emerald-400 uppercase text-[10px] tracking-wider block mb-2">
                What Consistently Works
              </span>
              <ul className="space-y-2">
                {learning.successfulPatterns.map((pat, idx) => (
                  <li key={idx} className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                    <div className="font-semibold text-white">{pat.pattern}</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      {pat.occurrences} instances • {pat.successRate}% success rate
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Failure Patterns & Pitfalls */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <span className="font-semibold text-amber-400 uppercase text-[10px] tracking-wider block mb-2">
                Identified Risk Patterns
              </span>
              <ul className="space-y-2">
                {learning.failurePatterns.map((pat, idx) => (
                  <li key={idx} className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                    <div className="font-semibold text-white">{pat.pattern}</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      Remedy: {pat.remedyRecommendation}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Memory Evolution Dynamics */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="font-semibold text-sky-400 uppercase text-[10px] tracking-wider block mb-2">
                  Memory Evolution Metrics
                </span>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Knowledge Growth Rate</span>
                      <span className="text-emerald-400 font-bold">+{learning.memoryEvolution.knowledgeGrowthRatePct}% / mo</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Knowledge Relevance</span>
                      <span className="text-white font-bold">{learning.memoryEvolution.knowledgeRelevanceScore}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Knowledge Reuse Rate</span>
                      <span className="text-[#E2B53C] font-bold">{learning.knowledgeReuseRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700 text-[11px] text-slate-400">
                <span>Decay Risk: {learning.memoryEvolution.knowledgeDecayRisk}</span>
                <span className="float-right">Dependency Depth: {learning.memoryEvolution.knowledgeDependencyDepth}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

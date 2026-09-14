import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Shield,
  TrendingUp,
  Target,
  Sparkles,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { StrategicClient } from '../../lib/strategic/strategicClient';
import {
  StrategicBriefing,
  StrategicBriefingType,
  BoardReportingSections,
} from '../../lib/strategic/types';

export const ExecutiveBriefingCenterPage: React.FC = () => {
  const [briefings, setBriefings] = useState<StrategicBriefing[]>([]);
  const [selectedBriefing, setSelectedBriefing] = useState<StrategicBriefing | null>(null);
  const [briefingType, setBriefingType] = useState<StrategicBriefingType>('board_update');
  const [customTitle, setCustomTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBriefings = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await StrategicClient.getBriefings();
      setBriefings(list);
      if (list.length > 0 && !selectedBriefing) {
        setSelectedBriefing(list[0]);
      }
    } catch (e: any) {
      console.error('Failed to load briefings', e);
      setError(e?.message || 'Failed to load executive briefings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBriefings();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      setError(null);
      const created = await StrategicClient.createBriefing(briefingType, customTitle || undefined);
      setBriefings((prev) => [created, ...prev]);
      setSelectedBriefing(created);
      setCustomTitle('');
    } catch (e: any) {
      setError(e?.message || 'Failed to generate briefing');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await StrategicClient.deleteBriefing(id);
      const updated = briefings.filter((b) => b.id !== id);
      setBriefings(updated);
      if (selectedBriefing?.id === id) {
        setSelectedBriefing(updated[0] || null);
      }
    } catch (e) {
      console.error('Failed to delete briefing', e);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Executive Briefing Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E2B53C]/10 text-[#E2B53C] border border-[#E2B53C]/30">
              Board-Ready Intelligence
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Generate and archive high-level strategic summaries, board updates, and quarterly operating reviews grounded in verified data.
          </p>
        </div>
      </div>

      {/* Generation Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Generate New Executive Document
        </h3>
        <form onSubmit={handleGenerate} className="flex flex-col md:flex-row gap-3">
          <select
            value={briefingType}
            onChange={(e) => setBriefingType(e.target.value as StrategicBriefingType)}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          >
            <option value="board_update">Board Strategic Update</option>
            <option value="executive_strategic_briefing">Executive Strategic Briefing</option>
            <option value="quarterly_operating_review">Quarterly Operating Review (QOR)</option>
            <option value="transformation_report">Transformation & Delivery Report</option>
            <option value="enterprise_performance_report">Enterprise Performance Report</option>
            <option value="risk_review">Enterprise Risk Review</option>
            <option value="opportunity_review">Opportunity & Growth Review</option>
          </select>

          <input
            type="text"
            placeholder="Custom Document Title (optional)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
          />

          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#E2B53C] hover:bg-[#BC8A1C] text-slate-950 font-semibold rounded-lg text-xs transition"
          >
            <Plus className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate Document'}
          </button>
        </form>
      </div>

      {/* Main Two Column View: Document List + Selected Document */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document List */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Archived Briefings ({briefings.length})
          </h3>
          {briefings.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No briefings generated yet. Select a type above and click Generate.
            </div>
          ) : (
            briefings.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBriefing(b)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedBriefing?.id === b.id
                    ? 'bg-[#E2B53C]/10 border-[#E2B53C] text-white'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-semibold truncate">{b.title}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span className="uppercase">{b.briefing_type.replace(/_/g, ' ')}</span>
                  <span>{new Date(b.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Selected Document Reader */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          {selectedBriefing ? (
            <div className="space-y-6 text-xs text-slate-300">
              {/* Document Header */}
              <div className="border-b border-slate-800 pb-4">
                <span className="text-[10px] uppercase font-bold text-[#E2B53C] bg-[#E2B53C]/10 px-2 py-0.5 rounded border border-[#E2B53C]/20">
                  {selectedBriefing.briefing_type.replace(/_/g, ' ')}
                </span>
                <h2 className="text-xl font-bold text-white mt-2">{selectedBriefing.title}</h2>
                <div className="text-[11px] text-slate-400 mt-1">
                  Generated {new Date(selectedBriefing.created_at).toLocaleDateString()} • Evidence-Backed Platform Synthesis
                </div>
              </div>

              {/* Section 1: Executive Summary */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Executive Summary
                </h4>
                <p className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 text-slate-200 leading-relaxed">
                  {selectedBriefing.sections.executive_summary}
                </p>
              </div>

              {/* Section 2: Strategic Highlights */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Strategic Highlights
                </h4>
                <ul className="space-y-2">
                  {selectedBriefing.sections.strategic_highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 bg-slate-800/30 p-2.5 rounded border border-slate-700/40">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#E2B53C] shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Section 3: Initiative Health */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Initiative Health & Milestones
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedBriefing.sections.progress_summaries.map((p, i) => (
                    <div key={i} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
                      <div className="flex justify-between font-semibold text-white">
                        <span>{p.initiative}</span>
                        <span className="text-emerald-400">{p.status}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{p.keyMilestone}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Risk Exposure & Mitigations */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Enterprise Risk Exposure & Mitigations
                </h4>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-amber-400 font-semibold block mb-1">Key Identified Risks:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {selectedBriefing.sections.risk_exposure.topRisks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60">
                    <span className="text-emerald-400 font-semibold block mb-1">Recommended Mitigations:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {selectedBriefing.sections.risk_exposure.mitigationActions.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Section 5: Strategic Recommendations */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Board & Leadership Recommendations
                </h4>
                <ul className="space-y-2">
                  {selectedBriefing.sections.recommendation_summaries.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 bg-slate-800/30 p-2.5 rounded border border-slate-700/40">
                      <Target className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
              <FileText className="w-10 h-10 mb-2 opacity-50" />
              <p>Select a briefing from the archive or generate a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

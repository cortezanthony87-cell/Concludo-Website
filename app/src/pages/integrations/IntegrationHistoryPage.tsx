import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Calendar,
} from 'lucide-react';
import { fetchSyncLogs } from '../../lib/integrations/integrationClient';
import { IntegrationSyncLog } from '../../lib/integrations/types';

export const IntegrationHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSyncLogs();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load integration history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/integrations"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Synchronization History</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Detailed audit trail of all manual, scheduled, and one-way integration sync operations.
            </p>
          </div>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition border border-slate-700 flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadLogs}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Sync Logs Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-amber-400" />
          <p className="text-sm">Loading Integration History...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3">
          <Layers className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-base font-semibold text-white">No Synchronization Records</h3>
          <p className="text-xs max-w-sm mx-auto">
            Sync records appear here when you run a manual synchronization, export actions, or schedule background updates.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Integration</th>
                  <th className="py-3.5 px-4">Sync Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Records</th>
                  <th className="py-3.5 px-4 text-center">Success</th>
                  <th className="py-3.5 px-4 text-center">Failures</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4 text-right">Time Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-sans font-medium text-white capitalize">
                      {log.provider.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                        {log.sync_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      {log.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-medium border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-white">{log.records_processed}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-400">{log.success_count}</td>
                    <td className="py-3.5 px-4 text-center text-slate-400">{log.failure_count}</td>
                    <td className="py-3.5 px-4 text-slate-400">{log.duration_ms} ms</td>
                    <td className="py-3.5 px-4 text-right text-slate-400 font-sans">
                      {new Date(log.created_at).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

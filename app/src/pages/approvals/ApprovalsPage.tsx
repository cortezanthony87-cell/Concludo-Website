import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { WorkflowApprovalRecord, ApprovalStatus } from '../../lib/workflows/types';
import { fetchWorkflowApprovals, respondToApproval } from '../../lib/workflows/workflowService';

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<WorkflowApprovalRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ApprovalStatus>('pending');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Response dialog state
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadApprovals = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkflowApprovals({ userId: user.id });
      setApprovals(data);
    } catch (err: any) {
      setError('Failed to load approvals. Please verify enterprise permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [user]);

  const handleDecision = async (approvalId: string, decision: 'approve' | 'reject') => {
    if (!user) return;
    setSubmitting(true);
    setActionFeedback(null);
    try {
      await respondToApproval({
        approvalId,
        approverId: user.id,
        decision,
        notes: responseNotes.trim() || undefined,
      });
      setActionFeedback(`Approval request successfully ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      setRespondingId(null);
      setResponseNotes('');
      await loadApprovals();
    } catch (err: any) {
      setActionFeedback(`Failed to approve request: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredApprovals = approvals.filter((a) => a.status === activeTab);
  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#0E1726] text-[#F4F6FA] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#21395C] pb-6 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#E2B53C]/20 text-[#E2B53C] border border-[#E2B53C]/40">
                HUMAN-IN-THE-LOOP GOVERNANCE
              </span>
              <span className="text-xs text-gray-400">Strict Operational Control</span>
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mt-1">
              Approval Centre
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Review and authorise staged AI agent actions and external system dispatches.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/workflows"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-white border border-[#21395C] rounded-lg text-sm font-medium transition"
            >
              Workflows
            </Link>
            <Link
              to="/agents"
              className="px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-[#E2B53C] border border-[#E2B53C]/40 rounded-lg text-sm font-medium transition"
            >
              AI Agents
            </Link>
          </div>
        </div>

        {/* Feedback Messages */}
        {actionFeedback && (
          <div className="bg-[#16263F] border border-[#E2B53C]/40 text-[#E2B53C] p-4 rounded-xl text-sm flex items-center justify-between">
            <span>{actionFeedback}</span>
            <button onClick={() => setActionFeedback(null)} className="text-xs text-gray-400 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
            <span>{error}</span>
            <button onClick={loadApprovals} className="underline hover:text-white font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex border-b border-[#21395C] space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'pending'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Pending Sign-Off</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'approved'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Approved ({approvals.filter((a) => a.status === 'approved').length})
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'rejected'
                ? 'border-[#E2B53C] text-[#E2B53C]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Rejected ({approvals.filter((a) => a.status === 'rejected').length})
          </button>
        </div>

        {/* Approvals List */}
        <div>
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading Approvals...</div>
          ) : filteredApprovals.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[#21395C] rounded-xl p-8 space-y-2">
              <p className="text-gray-300 font-medium">No {activeTab} approval requests found.</p>
              <p className="text-xs text-gray-400">
                {activeTab === 'pending'
                  ? 'All automated agent actions and external dispatches are currently up to date.'
                  : `No requests with ${activeTab} status on record.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApprovals.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#16263F]/70 border border-[#21395C] rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-[#21395C]/60 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white text-base">
                          {req.workflow?.name || 'Autonomous Agent Pipeline'}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#21395C] text-gray-300">
                          {req.action_type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested: {new Date(req.created_at).toLocaleString('en-AU')}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-xs font-semibold uppercase rounded self-start md:self-auto ${
                        req.status === 'approved'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : req.status === 'rejected'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {req.notes && (
                    <div className="text-xs text-gray-300 bg-[#0E1726]/40 p-3 rounded-lg border border-[#21395C]">
                      <span className="text-gray-400 font-medium">Notes:</span> {req.notes}
                    </div>
                  )}

                  {/* Payload Preview */}
                  <div className="bg-[#0E1726] p-3 rounded-lg border border-[#21395C]">
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">
                      Staged Action Payload
                    </span>
                    <pre className="text-xs font-mono text-gray-300 overflow-x-auto max-h-40">
                      {JSON.stringify(req.action_payload, null, 2)}
                    </pre>
                  </div>

                  {/* Actions for Pending */}
                  {req.status === 'pending' && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                      {respondingId === req.id ? (
                        <div className="w-full space-y-3 bg-[#0E1726]/60 p-4 rounded-lg border border-[#21395C]">
                          <input
                            type="text"
                            placeholder="Add sign-off notes or rejection reason (optional)"
                            value={responseNotes}
                            onChange={(e) => setResponseNotes(e.target.value)}
                            className="w-full bg-[#16263F] border border-[#21395C] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E2B53C]"
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setRespondingId(null)}
                              className="px-3 py-1.5 bg-[#21395C] hover:bg-gray-700 text-white rounded text-xs font-medium"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDecision(req.id, 'reject')}
                              disabled={submitting}
                              className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700 rounded text-xs font-semibold"
                            >
                              Confirm Reject
                            </button>
                            <button
                              onClick={() => handleDecision(req.id, 'approve')}
                              disabled={submitting}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow"
                            >
                              Confirm Authorise & Execute
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3 ml-auto">
                          <button
                            onClick={() => {
                              setRespondingId(req.id);
                              setResponseNotes('');
                            }}
                            className="px-4 py-2 bg-[#21395C] hover:bg-[#E2B53C] hover:text-[#0E1726] text-white rounded-lg text-xs font-semibold transition"
                          >
                            Review & Sign-Off
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Authorised Metadata */}
                  {(req.approved_at || req.rejected_at) && (
                    <div className="text-[11px] text-gray-500 pt-1">
                      {req.approved_at && `Approved at: ${new Date(req.approved_at).toLocaleString('en-AU')}`}
                      {req.rejected_at && `Rejected at: ${new Date(req.rejected_at).toLocaleString('en-AU')}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ApprovalsPage;

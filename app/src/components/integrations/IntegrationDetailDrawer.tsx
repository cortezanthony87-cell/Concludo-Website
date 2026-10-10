import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  ExternalLink,
  Edit2,
  Check,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import {
  ProviderDefinition,
  IntegrationConnection,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import {
  describeStatus,
  lastCheckedText,
  ConnectionEvidence,
} from '../../lib/integrations/connectionStatus';
import { independenceLine } from '../../lib/integrations/appCatalogue';
import { IntegrationIcon } from './IntegrationIcon';

export interface IntegrationDetailDrawerProps {
  provider: ProviderDefinition | null;
  connection: IntegrationConnection | null;
  allConnections?: IntegrationConnection[];
  isOpen: boolean;
  onClose: () => void;
  onConnect: (provider: ProviderDefinition, existingConn?: IntegrationConnection | null, isNew?: boolean) => void;
  onRefresh: () => Promise<void>;
  onSelectConnection?: (conn: IntegrationConnection) => void;
}

export const IntegrationDetailDrawer: React.FC<IntegrationDetailDrawerProps> = ({
  provider,
  connection,
  allConnections = [],
  isOpen,
  onClose,
  onConnect,
  onRefresh,
  onSelectConnection,
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (connection) {
      setNameValue(connection.connection_name || '');
      setEmailValue((connection as any)?.account_label || '');
      setIsEditing(false);
      setSaveSuccess(null);
      setSaveError(null);
      setRemoved(false);
    }
  }, [connection?.id]);

  if (!isOpen || !provider) return null;

  const connEvidence: ConnectionEvidence = {
    status: connection?.status || 'not_connected',
    verified_at: (connection as any)?.verified_at || null,
    last_test_at: (connection as any)?.last_test_at || null,
    last_test_result: (connection as any)?.last_test_result || null,
  };

  const statusMeta = describeStatus(connEvidence);
  const isMicrosoft = provider.provider_family === 'microsoft' || provider.id.startsWith('microsoft_');

  const handleConfirmRemove = async () => {
    if (!connection) return;
    setIsRemoving(true);
    setErrorMsg(null);
    try {
      await integrationsHubService.disconnect(connection.id);
      setRemoved(true);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove connection.');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!connection) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await integrationsHubService.updateConnection(connection.id, {
        connection_name: nameValue.trim() || undefined,
        account_label: emailValue.trim() || null,
      });
      setSaveSuccess('Account details updated successfully.');
      setIsEditing(false);
      await onRefresh();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save account details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden justify-between p-6"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '32rem',
          backgroundColor: '#0f172a',
          borderLeft: '1px solid #1e293b',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        }}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <IntegrationIcon slug={provider.iconSlug || provider.id} size={36} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{provider.name}</h2>
                <span className="text-xs text-slate-400">{provider.category}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status info if connected */}
          {connection && !removed && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-semibold text-slate-200">{statusMeta.label}</span>
              </div>
              <div className="text-[10.5px] text-slate-500 pt-2 border-t border-slate-800/60">
                {lastCheckedText(connEvidence)}
              </div>
            </div>
          )}

          {/* Account Identity & Email Edit Section */}
          {connection && !removed && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <span className="font-semibold text-white">Account details</span>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-[#E2B53C] hover:underline inline-flex items-center gap-1 text-[11px] font-medium"
                  >
                    <Edit2 className="w-3 h-3" /> Edit email or name
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setNameValue(connection.connection_name || '');
                      setEmailValue((connection as any)?.account_label || '');
                    }}
                    className="text-slate-400 hover:text-white text-[11px]"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {saveSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {saveError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>{saveError}</span>
                </div>
              )}

              {!isEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Connection name</span>
                    <span className="text-slate-200 font-medium">{connection.connection_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Account email</span>
                    <span className="text-slate-300 font-mono font-medium">
                      {(connection as any)?.account_label || 'Not set'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Email address of your choosing
                    </label>
                    <input
                      type="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      placeholder="e.g. yourname@company.com"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Set the email address for this specific connected account.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Connection display label
                    </label>
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      placeholder="e.g. Work Outlook, Personal Calendar"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-[#E2B53C] rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveDetails}
                      className="btn-connect-gold px-3.5 py-1.5 bg-[#E2B53C] hover:bg-[#d4a62f] text-[#16263F] font-bold rounded-lg text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSaving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multiple Accounts Listing if more than one */}
          {allConnections.length > 1 && !removed && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2.5">
              <span className="font-semibold text-white block">
                All connected accounts ({allConnections.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {allConnections.map((c) => {
                  const isCurrent = c.id === connection?.id;
                  const label = (c as any).account_label || c.connection_name;
                  return (
                    <div
                      key={c.id}
                      className={`p-2 rounded-lg flex items-center justify-between border transition ${
                        isCurrent
                          ? 'bg-slate-900 border-[#E2B53C]/50'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 cursor-pointer'
                      }`}
                      onClick={() => !isCurrent && onSelectConnection && onSelectConnection(c)}
                    >
                      <div className="truncate pr-2">
                        <span className="font-mono text-slate-300 text-[11px] block truncate">
                          {label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {c.connection_name}
                        </span>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#E2B53C]/20 text-[#E2B53C] font-semibold">
                          Current
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectConnection && onSelectConnection(c)}
                          className="text-[10px] text-slate-400 hover:text-white underline"
                        >
                          Manage
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Another Account Option */}
          {provider.availability === 'available' && !removed && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onConnect(provider, null, true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-[#E2B53C]" />
              <span>Connect another account for {provider.name}</span>
            </button>
          )}

          {/* Remove Section */}
          {!removed ? (
            <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">
                Remove {provider.name}?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Concludo will delete its sign-in for {provider.name}. Workflows that use it will stop at that step until you connect again.
              </p>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={handleConfirmRemove}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {isRemoving ? 'Removing...' : 'Remove'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">
                {provider.name} removed
              </h3>
              {isMicrosoft ? (
                <p className="text-xs text-slate-300 leading-relaxed">
                  To remove Concludo's approval from your Microsoft account too, go to{' '}
                  <a
                    href="https://myapps.microsoft.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#E2B53C] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    your Microsoft account's apps page <ExternalLink className="w-3 h-3 inline" />
                  </a>.
                </p>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  Concludo has revoked the sign-in with Google and removed the connection.
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Independence line */}
        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 italic leading-normal">
          {independenceLine()}
        </div>
      </div>
    </div>
  );
};

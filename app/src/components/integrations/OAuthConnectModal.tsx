import React from 'react';
import { X } from 'lucide-react';
import { Integration, ProviderMeta } from '../../lib/integrations/types';
import { IntegrationIcon } from './IntegrationIcon';

export interface OAuthConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ProviderMeta | null;
  onSuccess?: (integration: Integration) => void;
}

export const OAuthConnectModal: React.FC<OAuthConnectModalProps> = ({
  isOpen,
  onClose,
  provider,
}) => {
  if (!isOpen || !provider) return null;

  const isMicrosoft365 =
    provider.id.startsWith('microsoft_') ||
    provider.id === 'microsoft_outlook' ||
    provider.id === 'microsoft_teams' ||
    provider.id === 'microsoft_planner' ||
    provider.id === 'microsoft_todo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <IntegrationIcon slug={provider.id} size={32} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Connect {provider.name}
              </h2>
              <span className="text-[11px] text-slate-400 block">{provider.category}</span>
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

        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
          <p>
            Concludo will connect to {provider.name} through {isMicrosoft365 ? "Microsoft's" : `${provider.name}'s`} own sign-in page. You will sign in there, see exactly what Concludo is asking for, and approve it. Concludo never sees your password.
          </p>
          <p className="text-slate-400">
            {isMicrosoft365
              ? `This sign-in is being set up. Until it is ready, Concludo will not show ${provider.name} as connected.`
              : 'Concludo does not support this app yet.'}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800/80 text-[10.5px] text-slate-500 italic leading-normal">
          Concludo is an independent product and is not affiliated with, endorsed by, or partnered with any device maker, meeting platform or note-taking service.
        </div>
      </div>
    </div>
  );
};

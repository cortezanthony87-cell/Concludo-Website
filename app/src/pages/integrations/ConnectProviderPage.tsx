import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import {
  INTEGRATION_PROVIDERS_CATALOG,
  ProviderDefinition,
} from '../../lib/integrations/hubRegistry';
import { IntegrationIcon } from '../../components/integrations/IntegrationIcon';

export const ConnectProviderPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();

  const provider: ProviderDefinition | undefined = INTEGRATION_PROVIDERS_CATALOG.find(
    (p) => p.id === providerId
  );

  if (!provider) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
          <h2 className="text-lg font-bold text-white">App Not Found</h2>
          <p className="text-sm text-slate-400 mt-1">
            The requested app could not be located in the catalogue.
          </p>
        </div>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#16263F] hover:bg-[#21395C] text-[#E2B53C] rounded-lg text-sm font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Integrations Hub
        </Link>
      </div>
    );
  }

  const isMicrosoft365 =
    provider.id.startsWith('microsoft_') ||
    provider.id === 'microsoft_outlook' ||
    provider.id === 'microsoft_teams' ||
    provider.id === 'microsoft_planner' ||
    provider.id === 'microsoft_todo' ||
    provider.id === 'microsoft_excel' ||
    provider.id === 'microsoft_onedrive' ||
    provider.id === 'microsoft_onenote';

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Integrations Hub</span>
        </Link>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <div className="p-3 bg-[#16263F] rounded-xl border border-slate-700/80 shadow-md">
            <IntegrationIcon slug={provider.iconSlug || provider.id} size={40} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Connect {provider.name}
            </h1>
            <span className="text-xs text-slate-400">{provider.category}</span>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>
            Concludo will connect to {provider.name} through {isMicrosoft365 ? "Microsoft's" : `${provider.name}'s`} own sign-in page. You will sign in there, see exactly what Concludo is asking for, and approve it. Concludo never sees your password.
          </p>
          <p className="text-slate-400">
            {isMicrosoft365
              ? `This sign-in is being set up. Until it is ready, Concludo will not show ${provider.name} as connected.`
              : 'Concludo does not support this app yet.'}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <Link
            to="/integrations"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
          >
            Close
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 italic leading-normal">
          Concludo is an independent product and is not affiliated with, endorsed by, or partnered with any device maker, meeting platform or note-taking service.
        </div>
      </div>
    </div>
  );
};

import { getSupabaseBrowserClient } from '../supabase/client';
import { EmailAccountSummary, EmailAccountType } from './types';
import { SYNTHETIC_ACCOUNTS } from './shellAdapter';

export interface UserConnectedMailbox {
  id: string;
  providerId: 'gmail' | 'microsoft_outlook';
  emailAddress: string;
  label: string;
  accountType: EmailAccountType;
  connectedAt: string;
}

/**
 * Loads the authenticated user's live connected mailboxes from integration_connections.
 * If live mailboxes exist, maps them to the respective isolated work / personal datasets
 * and preserves exact user email display in the account selector.
 */
export async function loadUserEmailAccounts(): Promise<{
  accounts: EmailAccountSummary[];
  hasLiveAccounts: boolean;
  userEmail: string | null;
}> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { accounts: [...SYNTHETIC_ACCOUNTS], hasLiveAccounts: false, userEmail: null };
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('id, provider_id, external_account_reference, account_label, created_at, status')
      .in('provider_id', ['gmail', 'microsoft_outlook'])
      .eq('status', 'connected')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return { accounts: [...SYNTHETIC_ACCOUNTS], hasLiveAccounts: false, userEmail: user.email || null };
    }

    const liveAccounts: EmailAccountSummary[] = (data as any[]).map((row) => {
      const email = row.account_label || row.external_account_reference || 'Connected mailbox';
      const isPersonal = email.endsWith('@gmail.com') || email.endsWith('@live.com') || email.endsWith('@outlook.com') || email.endsWith('@hotmail.com');
      const accountType: EmailAccountType = isPersonal ? 'personal' : 'work';
      const providerLabel = row.provider_id === 'gmail' ? 'Google Workspace' : 'Microsoft 365';

      const mappedDatasetId = accountType === 'personal' ? 'acct-personal-01' : 'acct-work-01';

      return {
        id: mappedDatasetId,
        label: `${providerLabel} (${accountType === 'work' ? 'Work' : 'Personal'})`,
        address: email,
        accountType,
        lastSynchronisedAt: row.created_at,
        connected: true,
      };
    });

    return {
      accounts: liveAccounts,
      hasLiveAccounts: true,
      userEmail: user.email || null,
    };
  } catch (err) {
    console.warn('Failed to load user email accounts:', err);
    return { accounts: [...SYNTHETIC_ACCOUNTS], hasLiveAccounts: false, userEmail: null };
  }
}

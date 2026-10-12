import { getSupabaseBrowserClient } from '../supabase/client';
import { EmailAccountSummary, EmailAccountType } from './types';
import { SYNTHETIC_ACCOUNTS } from './shellAdapter';

export interface UserConnectedMailbox {
  id: string;
  providerId: 'gmail' | 'microsoft_outlook';
  emailAddress: string;
  connectionId: string;
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
  accounts: (EmailAccountSummary & { connectionId?: string })[];
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

    const liveAccounts: (EmailAccountSummary & { connectionId?: string })[] = (data as any[]).map((row) => {
      const rawEmail = (row.account_label || row.external_account_reference || '').trim();
      const email = rawEmail && rawEmail.includes('@') ? rawEmail : (user.email || 'Connected mailbox');
      const isPersonal = email.toLowerCase().endsWith('@gmail.com') || email.toLowerCase().endsWith('@live.com') || email.toLowerCase().endsWith('@outlook.com') || email.toLowerCase().endsWith('@hotmail.com');
      const accountType: EmailAccountType = isPersonal ? 'personal' : 'work';
      const providerLabel = row.provider_id === 'gmail' ? 'Google Workspace' : 'Microsoft 365';

      return {
        id: row.id,
        label: `${providerLabel} (${accountType === 'work' ? 'Work' : 'Personal'})`,
        address: email,
        accountType,
        lastSynchronisedAt: row.created_at,
        connected: true,
        connectionId: row.id,
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

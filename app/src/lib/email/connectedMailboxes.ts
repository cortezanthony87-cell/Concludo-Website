import { getSupabaseBrowserClient } from '../supabase/client';
import { EmailAccountSummary, EmailAccountType } from './types';
import { SYNTHETIC_ACCOUNTS } from './shellAdapter';
import { registerScanDataset, getDynamicDataset } from './dynamicDataset';

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
 * If live mailboxes exist, returns ONLY live accounts (zero synthetic/example accounts)
 * and hydrates any previously saved scan audit records from agent_memory.
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
      .eq('user_id', user.id).in('provider_id', ['gmail', 'microsoft_outlook'])
      .eq('status', 'connected')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return { accounts: [...SYNTHETIC_ACCOUNTS], hasLiveAccounts: false, userEmail: user.email || null };
    }

    // Load agent_memory to hydrate recent scans
    const { data: memData } = await supabase
      .from('agent_memory')
      .select('memory_key, memory_value, updated_at')
      .eq('agent_type', 'inbox_command_centre')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    const recentMemories = Array.isArray(memData) ? memData : [];

    const liveAccounts: (EmailAccountSummary & { connectionId?: string })[] = (data as any[]).map((row) => {
      const rawEmail = (row.account_label || row.external_account_reference || '').trim();
      const email = rawEmail && rawEmail.includes('@') ? rawEmail : (user.email || 'Connected mailbox');
      const isPersonal = email.toLowerCase().endsWith('@gmail.com') || email.toLowerCase().endsWith('@live.com') || email.toLowerCase().endsWith('@outlook.com') || email.toLowerCase().endsWith('@hotmail.com');
      const accountType: EmailAccountType = isPersonal ? 'personal' : 'work';
      const providerLabel = row.provider_id === 'gmail' ? 'Google Workspace' : 'Microsoft 365';

      const accountSummary: EmailAccountSummary & { connectionId?: string } = {
        id: row.id,
        label: `${providerLabel} (${accountType === 'work' ? 'Work' : 'Personal'})`,
        address: email,
        accountType,
        lastSynchronisedAt: row.created_at,
        connected: true,
        connectionId: row.id,
      };

      // Check if memory has a recent scan for this address
      const memMatch = recentMemories.find((m) => {
        const val = m.memory_value;
        return val && (val.accountEmail === email || val.connectionId === row.id);
      });

      if (memMatch && memMatch.memory_value) {
        accountSummary.lastSynchronisedAt = memMatch.updated_at || memMatch.memory_value.scannedAt || row.created_at;
        registerScanDataset(accountSummary, memMatch.memory_value);
      } else if (!getDynamicDataset(row.id)) {
        // Initialize an empty dynamic dataset specifically for this live account (zero example records)
        registerScanDataset(accountSummary, {
          accountEmail: email,
          scannedAt: row.created_at,
          metrics: { needsAttention: 0, repliesDue: 0, deadlines: 0, waitingOnOthers: 0 },
          topActions: [],
          replyQueue: [],
          emails: [],
        });
      }

      return accountSummary;
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

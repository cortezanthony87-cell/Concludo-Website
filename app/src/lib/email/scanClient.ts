import { getSupabaseBrowserClient } from '../supabase/client';
import { registerScanDataset } from './dynamicDataset';
import { EmailAccountSummary } from './types';

export interface ScanEmailsParams {
  connectionId: string;
  accountEmail: string;
  accountSummary?: EmailAccountSummary;
}

export interface ScanEmailsResult {
  success: boolean;
  summary: string;
  data: {
    connectionId: string;
    providerId: string;
    accountEmail: string;
    scannedAt: string;
    totalScanned: number;
    governance: string;
    metrics: {
      needsAttention: number;
      repliesDue: number;
      deadlines: number;
      waitingOnOthers: number;
      securityAdvisories?: number;
    };
    topActions: Array<{
      id: string;
      subject: string;
      counterparty: string;
      summary: string;
      priorityScore: number;
    }>;
    replyQueue: Array<{
      id: string;
      subject: string;
      sender: string;
      suggestedAction: string;
    }>;
    emails?: any[];
  };
}

/**
 * Invocates the server-side email-scan edge function to securely ingest live email headers.
 * Converts the ingested messages into an isolated dynamic dataset and registers it with the view layer.
 */
export async function scanMailbox(params: ScanEmailsParams): Promise<ScanEmailsResult> {
  const supabase = getSupabaseBrowserClient();
  
  const { data, error } = await supabase.functions.invoke('email-scan', {
    body: {
      connection_id: params.connectionId,
      account_email: params.accountEmail,
      limit: 20,
    },
  });

  if (error) {
    let message = error.message;
    if (data && data.error) {
      message = data.error;
    }
    throw new Error(message || 'Failed to scan mailbox');
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Email scan returned an unsuccessful response');
  }

  // Register dynamic dataset for the scanned account
  if (params.accountSummary) {
    registerScanDataset(params.accountSummary, data.data);
  }

  return data as ScanEmailsResult;
}

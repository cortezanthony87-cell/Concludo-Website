import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

export function getNangoHost(): string {
  return Deno.env.get('NANGO_HOST') || 'https://api.nango.dev';
}

export function getNangoSecretKey(): string {
  return requiredEnv('NANGO_SECRET_KEY');
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

export function createCallerClient(request: Request): { client: SupabaseClient; token: string } {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const token = authorization.slice(7);
  const client = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_ANON_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    },
  );

  return { client, token };
}

export async function requireUser(request: Request): Promise<{ client: SupabaseClient; user: User }> {
  const { client } = createCallerClient(request);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  return { client, user: data.user };
}

export function corsHeaders(request?: Request): HeadersInit {
  const allowedOrigins = [
    'https://app.concludo.com.au',
    'https://connect.concludo.au',
    'https://www.concludo.au',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  const requestOrigin = request?.headers.get('origin');
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : 'https://app.concludo.com.au';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(body: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function writeAuditEvent(
  service: SupabaseClient,
  event: {
    connection_id?: string | null;
    user_id: string;
    organization_id: string;
    event_type: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await service.from('integration_connection_events').insert({
      connection_id: event.connection_id ?? null,
      user_id: event.user_id,
      organization_id: event.organization_id,
      event_type: event.event_type,
      severity: event.severity ?? 'info',
      metadata: event.metadata ?? {},
    });
  } catch (err) {
    console.error('Failed to write audit event:', err);
  }
}

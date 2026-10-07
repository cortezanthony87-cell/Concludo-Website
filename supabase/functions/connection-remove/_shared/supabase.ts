import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
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

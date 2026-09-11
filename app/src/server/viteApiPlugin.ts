import type { Plugin } from 'vite';
import { handleApiRequest, ApiRequest } from './apiRouter';
import { createClient } from '@supabase/supabase-js';

export function viteApiPlugin(supabaseUrl: string, serviceRoleKey: string): Plugin {
  let adminClient: any = null;
  if (supabaseUrl && serviceRoleKey) {
    try {
      adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } catch {
      // Fallback
    }
  }

  return {
    name: 'vite-concludo-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        try {
          // Parse request body
          let body: any = undefined;
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf8');
            if (rawBody.trim()) {
              try {
                body = JSON.parse(rawBody);
              } catch {
                body = rawBody;
              }
            }
          }

          const apiReq: ApiRequest = {
            method: req.method || 'GET',
            url: req.url,
            headers: req.headers as Record<string, string | undefined>,
            body,
          };

          const apiRes = await handleApiRequest(apiReq, { adminClient });

          res.statusCode = apiRes.status;
          for (const [key, value] of Object.entries(apiRes.headers)) {
            res.setHeader(key, value);
          }
          res.end(JSON.stringify(apiRes.body));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'internal_server_error',
              message: err instanceof Error ? err.message : 'Unknown server error',
            })
          );
        }
      });
    },
  };
}

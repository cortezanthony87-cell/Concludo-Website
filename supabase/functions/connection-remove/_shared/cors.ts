const configuredOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://app.concludo.com.au';

export function corsHeaders(request?: Request): HeadersInit {
  const requestOrigin = request?.headers.get('origin');
  const allowedOrigin = requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  request?: Request,
): Response {
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

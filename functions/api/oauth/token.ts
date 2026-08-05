// Cloudflare Pages Function — generic OAuth "authorization code" token
// exchange proxy for providers that only issue confidential-client
// credentials (a client secret that must never reach the browser).
//
// This function is *stateless*: it takes a code (or refresh_token) plus
// a provider name, exchanges it with the provider's own token endpoint
// using the secret from environment variables, and returns the result
// unmodified. Nothing is logged, cached, or stored — the frontend keeps
// the resulting tokens in the browser's own localStorage, same as the
// Spotify PKCE flow that never touches this function.
//
// Configure secrets with (repeat per provider you want to enable):
//   npx wrangler pages secret put NOTION_CLIENT_ID
//   npx wrangler pages secret put NOTION_CLIENT_SECRET
// A provider with no secret configured returns 501 and the app falls
// back to its manual token-paste option.

interface Env {
  NOTION_CLIENT_ID?: string;   NOTION_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;   GITHUB_CLIENT_SECRET?: string;
  TODOIST_CLIENT_ID?: string;  TODOIST_CLIENT_SECRET?: string;
  LINEAR_CLIENT_ID?: string;   LINEAR_CLIENT_SECRET?: string;
}

const PROVIDERS: Record<string, { tokenUrl: string; basicAuth?: boolean }> = {
  // Notion expects client credentials as HTTP Basic auth, not form fields.
  notion:  { tokenUrl: 'https://api.notion.com/v1/oauth/token', basicAuth: true },
  github:  { tokenUrl: 'https://github.com/login/oauth/access_token' },
  todoist: { tokenUrl: 'https://todoist.com/oauth/access_token' },
  linear:  { tokenUrl: 'https://api.linear.app/oauth/token' },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: any;
  try { body = await ctx.request.json(); } catch { return json({ error: 'invalid_request' }, 400); }

  const { provider, code, redirect_uri, code_verifier, grant_type, refresh_token } = body ?? {};
  const cfg = provider ? PROVIDERS[provider as string] : undefined;
  if (!cfg) return json({ error: 'unknown_provider' }, 400);

  const idKey = `${(provider as string).toUpperCase()}_CLIENT_ID` as keyof Env;
  const secretKey = `${(provider as string).toUpperCase()}_CLIENT_SECRET` as keyof Env;
  const clientId = ctx.env[idKey];
  const clientSecret = ctx.env[secretKey];
  if (!clientId || !clientSecret) {
    return json({ error: 'not_configured', message: `Set ${idKey} and ${secretKey} as Pages secrets to enable ${provider} OAuth.` }, 501);
  }

  const params = new URLSearchParams({ grant_type: grant_type ?? 'authorization_code' });
  if (code) params.set('code', code);
  if (redirect_uri) params.set('redirect_uri', redirect_uri);
  if (code_verifier) params.set('code_verifier', code_verifier);
  if (refresh_token) params.set('refresh_token', refresh_token);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (cfg.basicAuth) {
    headers['Authorization'] = 'Basic ' + btoa(`${clientId}:${clientSecret}`);
  } else {
    params.set('client_id', clientId);
    params.set('client_secret', clientSecret);
  }

  try {
    const upstream = await fetch(cfg.tokenUrl, { method: 'POST', headers, body: params });
    const data = await upstream.json();
    return json(data, upstream.status);
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }
};

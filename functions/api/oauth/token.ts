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
// back to its manual token-paste option (or, for Google, its
// "use your own app" form — see resolveCredentials() below, which lets
// a visitor's own Client ID + Secret pair override the env-configured
// default app on a per-request basis).

interface Env {
  NOTION_CLIENT_ID?: string;
  NOTION_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TODOIST_CLIENT_ID?: string;
  TODOIST_CLIENT_SECRET?: string;
  LINEAR_CLIENT_ID?: string;
  LINEAR_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

const PROVIDERS: Record<string, { tokenUrl: string; basicAuth?: boolean }> = {
  // Notion expects client credentials as HTTP Basic auth, not form fields.
  notion: {
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    basicAuth: true,
  },
  github: { tokenUrl: "https://github.com/login/oauth/access_token" },
  todoist: { tokenUrl: "https://todoist.com/oauth/access_token" },
  linear: { tokenUrl: "https://api.linear.app/oauth/token" },
  // Google's Web-application OAuth client is a confidential client (it
  // issues a secret), same reason it needs to go through this proxy
  // instead of the browser calling the token endpoint directly.
  google: { tokenUrl: "https://oauth2.googleapis.com/token" },
};

interface TokenRequestBody {
  provider?: string;
  code?: string;
  redirect_uri?: string;
  code_verifier?: string;
  grant_type?: string;
  refresh_token?: string;
  // A visitor's own OAuth app pasted into the "use your own app"
  // self-host form (currently only Google sends these — see
  // integrations.ts OAUTH_PROVIDERS[...].clientSecretKey). Forwarded
  // straight to the provider's token endpoint and never logged or
  // stored, same promise as the env-configured default app below.
  client_id?: string;
  client_secret?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function parseBody(request: Request): Promise<TokenRequestBody | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as TokenRequestBody) : null;
  } catch {
    return null;
  }
}

function resolveCredentials(
  env: Env,
  provider: string,
  body: TokenRequestBody,
): { clientId: string; clientSecret: string } | null {
  // Prefer a visitor-supplied Client ID + Secret pair (their own OAuth
  // app) over the deployment's default one. Only honored as a pair —
  // a lone client_id with no secret falls through to the env-configured
  // app below, so it fails with a clear "not configured"/mismatch error
  // upstream instead of silently trying to use the wrong secret.
  if (body.client_id && body.client_secret) {
    return { clientId: body.client_id, clientSecret: body.client_secret };
  }
  const idKey = `${provider.toUpperCase()}_CLIENT_ID` as keyof Env;
  const secretKey = `${provider.toUpperCase()}_CLIENT_SECRET` as keyof Env;
  const clientId = env[idKey];
  const clientSecret = env[secretKey];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function buildTokenParams(body: TokenRequestBody): URLSearchParams {
  const params = new URLSearchParams({
    grant_type: body.grant_type ?? "authorization_code",
  });
  if (body.code) params.set("code", body.code);
  if (body.redirect_uri) params.set("redirect_uri", body.redirect_uri);
  if (body.code_verifier) params.set("code_verifier", body.code_verifier);
  if (body.refresh_token) params.set("refresh_token", body.refresh_token);
  return params;
}

function buildHeaders(
  cfg: { basicAuth?: boolean },
  clientId: string,
  clientSecret: string,
  params: URLSearchParams,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (cfg.basicAuth) {
    headers["Authorization"] = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  } else {
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
  }
  return headers;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await parseBody(ctx.request);
  if (!body) return json({ error: "invalid_request" }, 400);

  const provider = body.provider ?? "";
  const cfg = PROVIDERS[provider];
  if (!cfg) return json({ error: "unknown_provider" }, 400);

  const creds = resolveCredentials(ctx.env, provider, body);
  if (!creds) {
    const idKey = `${provider.toUpperCase()}_CLIENT_ID`;
    const secretKey = `${provider.toUpperCase()}_CLIENT_SECRET`;
    const message = body.client_id
      ? `No matching Client Secret was supplied for that Client ID — paste it into the "use your own app" form too, or ask the site owner to set ${idKey}/${secretKey} as Pages secrets.`
      : `Set ${idKey} and ${secretKey} as Pages secrets to enable ${provider} OAuth.`;
    return json({ error: "not_configured", message }, 501);
  }

  const params = buildTokenParams(body);
  const headers = buildHeaders(cfg, creds.clientId, creds.clientSecret, params);

  try {
    const upstream = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers,
      body: params,
    });
    const data = await upstream.json();
    return json(data, upstream.status);
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }
};

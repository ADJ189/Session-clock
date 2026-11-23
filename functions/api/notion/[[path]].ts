// Cloudflare Pages Function — same-origin relay for the Notion API.
// Notion's REST API returns no CORS headers at all, so the browser can
// never call api.notion.com directly regardless of auth method. This
// relay just forwards the request byte-for-byte: it reads nothing from
// the Authorization header and stores nothing. Works equally with an
// OAuth access token or a manually pasted internal-integration token.
export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/^\/api\/notion\//, '');

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_or_forbidden_path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // Guard against path traversal, empty paths, or non-Notion endpoint abuse
  if (!path || decodedPath.includes('..') || decodedPath.includes('\\') || !/^(databases|pages|blocks|users|search)(\/|$)/.test(decodedPath)) {
    return new Response(JSON.stringify({ error: 'invalid_or_forbidden_path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const upstream = `https://api.notion.com/v1/${path}${url.search}`;

  const init: RequestInit = {
    method: ctx.request.method,
    headers: {
      Authorization: ctx.request.headers.get('Authorization') ?? '',
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  };
  if (!['GET', 'HEAD'].includes(ctx.request.method)) {
    init.body = await ctx.request.text();
  }

  let res: Response;
  try {
    res = await fetch(upstream, init);
  } catch {
    return new Response(JSON.stringify({ error: 'upstream_unreachable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

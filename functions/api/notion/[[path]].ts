// Cloudflare Pages Function — same-origin relay for the Notion API.
// Notion's REST API returns no CORS headers at all, so the browser can
// never call api.notion.com directly regardless of auth method. This
// relay just forwards the request byte-for-byte: it reads nothing from
// the Authorization header and stores nothing. Works equally with an
// OAuth access token or a manually pasted internal-integration token.
export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/^\/api\/notion\//, '');
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

  const res = await fetch(upstream, init);
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

// 정적 페이지(site/)를 서빙하고, 에이전트/외부 도구용 읽기 API를 제공한다.
const API = {
  '/api/graph': '/data/graph.json',
  '/api/notes': '/data/notes.json',
  '/api/schedule': '/data/schedule.json',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = API[url.pathname];
    if (!target) return env.ASSETS.fetch(request);
    const res = await env.ASSETS.fetch(new URL(target, url.origin));
    return new Response(res.body, {
      status: res.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
    });
  },
};

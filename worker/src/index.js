// 정적 페이지(site/)를 서빙하고, 에이전트용 API를 제공한다.
// 2단계에서 /api/search 에 Workers AI 임베딩 + Vectorize 기반 RAG를 붙인다.
const API = {
  '/api/notes': '/data/notes.json',
  '/api/coverage': '/data/coverage.json',
  '/api/gaps': '/data/gaps.json',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = API[url.pathname];
    if (target) {
      const res = await env.ASSETS.fetch(new URL(target, url.origin));
      return new Response(res.body, {
        status: res.status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};

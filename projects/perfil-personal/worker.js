export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const fallback = url.pathname.startsWith('/comidas/')
      ? '/comidas/index.html'
      : '/index.html';

    return env.ASSETS.fetch(new Request(new URL(fallback, url.origin), request));
  },
};

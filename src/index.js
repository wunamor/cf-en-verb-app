import * as api from './api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- 1. API 路由 (优先处理后端逻辑) ---
    if (path.startsWith('/api/')) {
      try {
        // GET 请求
        if (path === '/api/search' && request.method === 'GET') {
          return await api.search(request, env);
        }

        // POST 请求
        if (request.method === 'POST') {
          switch (path) {
            case '/api/verify': return await api.verify(request, env);
            case '/api/batch_add': return await api.batchAdd(request, env);
            case '/api/update': return await api.update(request, env);
            case '/api/delete': return await api.deleteItem(request, env);
            case '/api/batch_delete': return await api.batchDelete(request, env);
          }
        }
        return new Response('API Not Found', { status: 404 });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // --- 2. 静态资源路由 (处理 index.html) ---
    // 如果不是 API 请求，就从 EN_VERB_EN_VERB_ASSETS (./public 文件夹) 里查找文件并返回
    // 比如访问 / 时，它会自动查找 public/index.html
    return env.EN_VERB_EN_VERB_ASSETS.fetch(request);
  },
};
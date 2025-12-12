import * as api from './api.js';

// ==========================================
// 🗺️ 路由配置表 (Key-Value 映射)
// ==========================================
const routes = {
  GET: {
    // 🔍 核心搜索：支持模糊/精确/备注查询，返回分页数据
    '/api/search': api.search,

    // ⚙️ 全局配置：前端获取后端允许暴露的配置项 (如每页条数)
    '/api/config': api.getConfig,

    // 📤 数据导出：生成 CSV 文件下载 (支持验证码校验)
    '/api/export': api.exportData,

    // 🤖 人机验证：获取数学题 (如 5+3=?) 用于非登录状态导出
    '/api/captcha': api.getCaptcha,
  },

  POST: {
    // 🔐 密码校验：前端登录时验证管理员密码
    '/api/verify': api.verify,

    // ➕ 批量/单条添加：核心写入接口 (支持去重/覆盖模式)
    '/api/batch_add': api.batchAdd,

    // ✏️ 更新数据：修改单条动词信息
    '/api/update': api.update,

    // 🗑️ 单条删除：删除指定 ID 的单词
    '/api/delete': api.deleteItem,

    // 💥 批量删除：根据 ID 数组删除多条数据
    '/api/batch_delete': api.batchDelete,
  }
};

// ==========================================
// 🚀 主入口
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- 1. API 路由处理 (后端逻辑) ---
    if (path.startsWith('/api/')) {
      try {
        const method = request.method;

        // 核心优化：直接通过 对象[方法][路径] 查找函数
        // 使用可选链 ?. 防止 method 不存在导致报错
        const handler = routes[method]?.[path];

        if (handler) {
          return await handler(request, env);
        }

        // 如果在路由表中找不到对应路径
        return new Response('API Not Found', { status: 404 });

      } catch (err) {
        // 捕获所有 API 内部错误
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // --- 2. 静态资源路由 (前端页面) ---
    // 只有非 API 请求才会走到这里 (返回 HTML/JS/CSS)
    return env.EN_VERB_EN_VERB_ASSETS.fetch(request);
  },
};
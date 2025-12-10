// src/api.js

// 辅助函数：统一鉴权
function checkAuth(request, env) {
  const userKey = request.headers.get('Admin-Key');
  // 如果环境变量没设置，默认不通过
  if (!env.ADMIN_PASSWORD) return false;
  return userKey === env.ADMIN_PASSWORD;
}

// 1. 搜索逻辑
// src/api.js 中的 search 函数

export async function search(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const page = parseInt(url.searchParams.get('page')) || 1;
  const mode = url.searchParams.get('mode') || 'fuzzy';

  // --- 修改开始：判断是否为导出请求 ---
  const isExport = url.searchParams.get('export') === 'true';

  let limit = parseInt(url.searchParams.get('limit')) || 10;

  if (!isExport) {
    // 常规查询：强制限制最大 50 条，防止页面卡顿
    if (limit > 50) limit = 50;
  } else {
    // 导出模式：取消限制 (SQLite 中 LIMIT -1 代表无限制)
    limit = -1;
  }

  // 导出时不需要分页偏移，强制从第 0 条开始
  const offset = isExport ? 0 : (page - 1) * limit;
  // --- 修改结束 ---

  let sql, params, countSql, countParams;

  if (!q) {
    sql = `SELECT * FROM verbs ORDER BY base_word ASC LIMIT ? OFFSET ?`;
    params = [limit, offset];
    countSql = `SELECT count(*) as total FROM verbs`;
    countParams = [];
  } else {
    if (mode === 'exact') {
      sql = `SELECT * FROM verbs WHERE lower(base_word) = lower(?) ORDER BY base_word ASC LIMIT ? OFFSET ?`;
      params = [q, limit, offset];
      countSql = `SELECT count(*) as total FROM verbs WHERE lower(base_word) = lower(?)`;
      countParams = [q];
    } else {
      sql = `SELECT * FROM verbs WHERE base_word LIKE ? OR definition LIKE ? ORDER BY base_word ASC LIMIT ? OFFSET ?`;
      const pattern = `%${q}%`;
      params = [pattern, pattern, limit, offset];
      countSql = `SELECT count(*) as total FROM verbs WHERE base_word LIKE ? OR definition LIKE ?`;
      countParams = [pattern, pattern];
    }
  }

  const [dataRes, countRes] = await Promise.all([
    env.DB.prepare(sql).bind(...params).all(),
    env.DB.prepare(countSql).bind(...countParams).first()
  ]);

  return Response.json({
    data: dataRes.results,
    total: countRes.total,
    page, limit
  });
}
// 2. 验证密码
export async function verify(request, env) {
  const { password } = await request.json();
  if (password === env.ADMIN_PASSWORD) {
    return Response.json({ success: true });
  }
  return Response.json({ success: false }, { status: 401 });
}

// 3. 批量添加/单条添加/修改
export async function batchAdd(request, env) {
  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const rows = body.rows;
  const mode = body.mode || 'skip';

  let successCount = 0;
  let skippedCount = 0;

  for (const item of rows) {
    if (!item.base) continue;

    const exists = await env.DB.prepare(
      'SELECT id FROM verbs WHERE lower(base_word) = lower(?) AND lower(past_tense) = lower(?) LIMIT 1'
    ).bind(item.base, item.past).first();

    if (exists) {
      if (mode === 'skip') {
        skippedCount++;
        continue;
      } else if (mode === 'update') {
        await env.DB.prepare('DELETE FROM verbs WHERE id = ?').bind(exists.id).run();
      }
    }

    await env.DB.prepare(
      'INSERT INTO verbs (base_word, past_tense, past_participle, definition, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(item.base, item.past, item.part, item.def, item.note).run();
    successCount++;
  }
  return Response.json({ success: true, added: successCount, skipped: skippedCount });
}

// 4. 更新单条
export async function update(request, env) {
  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });
  const data = await request.json();
  await env.DB.prepare(
    'UPDATE verbs SET base_word=?, past_tense=?, past_participle=?, definition=?, note=? WHERE id=?'
  ).bind(data.base, data.past, data.part, data.def, data.note, data.id).run();
  return Response.json({ success: true });
}

// 5. 删除单条
export async function deleteItem(request, env) {
  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });
  const { id } = await request.json();
  await env.DB.prepare('DELETE FROM verbs WHERE id = ?').bind(id).run();
  return Response.json({ success: true });
}

// 6. 批量删除
export async function batchDelete(request, env) {
  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });
  const { ids } = await request.json();
  const placeholders = ids.map(() => '?').join(', ');
  await env.DB.prepare(`DELETE FROM verbs WHERE id IN (${placeholders})`).bind(...ids).run();
  return Response.json({ success: true });
}
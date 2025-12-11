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
// src/api.js 中的 batchAdd 函数替换版

export async function batchAdd(request, env) {
  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const rows = body.rows;
  const mode = body.mode || 'skip'; // 'skip' (跳过) 或 'update' (覆盖)

  if (!rows || rows.length === 0) return Response.json({ success: true, count: 0 });

  const statements = [];

  for (const item of rows) {
    if (!item.base) continue;

    // 核心优化：不再先查后删，而是直接构造 SQL
    // 利用第一步创建的唯一索引 (idx_verbs_unique)

    let sql;
    if (mode === 'update') {
      // 覆盖模式：如果有重复，直接替换 (REPLACE INTO)
      sql = `INSERT OR REPLACE INTO verbs (base_word, past_tense, past_participle, definition, note) VALUES (?, ?, ?, ?, ?)`;
    } else {
      // 跳过模式：如果有重复，直接忽略 (INSERT OR IGNORE)
      sql = `INSERT OR IGNORE INTO verbs (base_word, past_tense, past_participle, definition, note) VALUES (?, ?, ?, ?, ?)`;
    }

    // 将 SQL 语句推入数组，准备批量执行
    statements.push(
      env.DB.prepare(sql).bind(item.base, item.past, item.part, item.def, item.note)
    );
  }

  try {
    // D1 核心大招：batch()
    // 这会将 130 条 SQL 语句打包成 1 次网络请求发给数据库
    // 速度提升 100 倍的关键在这里
    const results = await env.DB.batch(statements);

    // 计算成功插入的数量 (results 是一个数组)
    // 注意：REPLACE 可能会返回受影响行数，这里简单返回总处理数即可
    return Response.json({ success: true, added: results.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
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

// 7. 导出数据 (将生成 CSV 的逻辑移到后端)
export async function exportData(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const mode = url.searchParams.get('mode') || 'fuzzy';
  const delim = url.searchParams.get('delim') || ','; // 获取前端传来的分隔符

  // 1. 复用搜索逻辑查询所有数据 (无 LIMIT 限制)
  let sql, params;

  if (!q) {
    sql = `SELECT * FROM verbs ORDER BY base_word ASC`;
    params = [];
  } else {
    if (mode === 'exact') {
      sql = `SELECT * FROM verbs WHERE lower(base_word) = lower(?) ORDER BY base_word ASC`;
      params = [q];
    } else {
      sql = `SELECT * FROM verbs WHERE base_word LIKE ? OR definition LIKE ? ORDER BY base_word ASC`;
      const pattern = `%${q}%`;
      params = [pattern, pattern];
    }
  }

  const { results } = await env.DB.prepare(sql).bind(...params).all();

  // 2. 在后端构建 CSV 字符串
  const rows = results.map(item => {
    return [
      item.base_word || '',
      item.past_tense || '',
      item.past_participle || '',
      item.definition || '',
      item.note || ''
    ].join(delim);
  });

  // 3. 添加 BOM 头防止乱码
  const csvContent = '\uFEFF' + rows.join('\n');

  // 4. 返回文件流
  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="verbs.csv"'
    }
  });
}
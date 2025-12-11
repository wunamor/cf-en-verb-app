
// --- 核心变量 ---
let currentPage = 1
let totalPages = 1
let selectedIds = new Set()
let csvData = []

window.onload = () => {
  // 1. 恢复管理员状态
  if (localStorage.getItem('adminKey')) toggleAdmin(true)

  // 2. 核心优化：手机端默认每页显示 5 条
  if (window.innerWidth < 768) {
    const limitSelect = document.getElementById('pageSize')
    if (limitSelect) {
      limitSelect.value = '5' // 强制选中 5
    }
  }

  // 3. 执行首次搜索
  doSearch()
}

// --- 1. 搜索与渲染列表 ---
function resetSearch() {
  currentPage = 1
  selectedIds.clear()
  doSearch()
}

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim()
  const limit = document.getElementById('pageSize').value
  const mode = document.querySelector('input[name="mode"]:checked').value

  document.getElementById('resultArea').classList.remove('hidden')
  const container = document.getElementById('tableContainer')

  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(q)}&page=${currentPage}&limit=${limit}&mode=${mode}`
    )
    const json = await res.json()

    totalPages = Math.ceil((json.total || 0) / limit)
    renderTable(json.data)
    renderPagination(totalPages)
  } catch (e) {
    console.error(e)
  }
}

function renderTable(data) {
  const div = document.getElementById('tableContainer')
  if (!data || data.length === 0) {
    div.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-sub)">暂无数据</div>'
    return
  }
  const isAdmin = !!localStorage.getItem('adminKey')

  // PC端表头 (移动端 CSS 会隐藏它)
  let th = `<thead><tr>`
  if (isAdmin) th += `<th style="width:40px"><input type="checkbox" id="selectAll" onclick="toggleAll()"></th>`
  th += `<th>原形</th><th>过去式</th><th>过去分词</th><th>释义</th><th>备注</th>`
  if (isAdmin) {
    const delBtn =
      selectedIds.size > 0
        ? `<button class="btn btn-danger" style="padding:2px 8px; font-size:0.8rem" onclick="batchDeleteClick()">删 (${selectedIds.size})</button>`
        : `<span>操作</span>`
    th += `<th style="width:140px; text-align:right">${delBtn}</th>`
  }
  th += `</tr></thead>`

  // 构建内容
  let rows = data
    .map((item) => {
      const json = JSON.stringify(item).replace(/"/g, '&quot;')
      const checked = selectedIds.has(item.id) ? 'checked' : ''

      // 注意：这里添加了 data-label 属性，用于移动端显示
      let tr = `<tr>`
      if (isAdmin)
        tr += `<td data-label="选择"><input type="checkbox" class="row-cb" value="${item.id}" ${checked} onclick="toggleRow(${item.id})"></td>`
      tr += `
            <td data-label="原形" class="text-primary" style="font-weight:bold">${item.base_word}</td>
            <td data-label="过去式">${item.past_tense}</td>
            <td data-label="过去分词">${item.past_participle}</td>
            <td data-label="释义">${item.definition || ''}</td>
            <td data-label="备注" style="color:var(--text-sub); font-size:0.85rem">${item.note || ''}</td>
        `
      if (isAdmin)
        tr += `
            <td data-label="操作" style="text-align:right">
                <button class="btn btn-outline btn-sm" onclick="editItem(${json})">改</button>
                <button class="btn btn-danger btn-sm" style="margin-left:5px" onclick="delItemClick(${item.id})">删</button>
            </td>
        `
      tr += `</tr>`
      return tr
    })
    .join('')

  div.innerHTML = `<table>${th}<tbody>${rows}</tbody></table>`

  // 刷新全选框状态
  if (isAdmin && document.getElementById('selectAll')) {
    const allRows = document.querySelectorAll('.row-cb')
    if (allRows.length > 0 && Array.from(allRows).every((cb) => cb.checked)) {
      document.getElementById('selectAll').checked = true
    }
  }
}
// --- 2. 批量操作逻辑 ---
function toggleAll() {
  const master = document.getElementById('selectAll')
  document.querySelectorAll('.row-cb').forEach((cb) => {
    cb.checked = master.checked
    const id = parseInt(cb.value)
    if (master.checked) selectedIds.add(id)
    else selectedIds.delete(id)
  })
  // 仅刷新 UI 不重新请求
  doSearch()
}

function toggleRow(id) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
  doSearch()
}

// 核心修复：这里使用 showConfirmModal 而不是 confirm()
function batchDeleteClick() {
  showConfirmModal(`确定要删除选中的 ${selectedIds.size} 个单词吗？`, async () => {
    const ids = Array.from(selectedIds)
    await fetch('/api/batch_delete', {
      method: 'POST',
      headers: { 'Admin-Key': localStorage.getItem('adminKey') },
      body: JSON.stringify({ ids }),
    })
    showToast('批量删除成功')
    selectedIds.clear()
    doSearch()
  })
}

// 核心修复：这里使用 showConfirmModal 而不是 confirm()
function delItemClick(id) {
  showConfirmModal('确定删除这个单词吗？', async () => {
    await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Admin-Key': localStorage.getItem('adminKey') },
      body: JSON.stringify({ id }),
    })
    showToast('已删除')
    doSearch()
  })
}

// --- 3. 弹窗控制 (关键) ---
// 修改后的弹窗函数，支持传入 HTML 内容
function showConfirmModal(msg, actionCallback, isHtml = false) {
  const modal = document.getElementById('confirmModal')
  const msgDiv = document.getElementById('confirmMsg')

  // 支持 HTML 表格预览
  if (isHtml) {
    msgDiv.innerHTML = msg
  } else {
    msgDiv.innerText = msg
  }

  modal.classList.remove('hidden')

  const btn = document.getElementById('confirmActionBtn')
  const newBtn = btn.cloneNode(true) // 清除旧事件
  btn.parentNode.replaceChild(newBtn, btn)

  newBtn.addEventListener('click', () => {
    actionCallback()
    closeModal('confirmModal')
  })
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden')
}

// --- 4. 分页逻辑 (图二 方块风格) ---
// 替换原有的 renderPagination 函数
// 替换原有的 renderPagination 函数
function renderPagination(total) {
  const el = document.getElementById('pagination')
  let html = ''

  // 强制转换为数字，解决样式不生效问题
  const cur = parseInt(currentPage) || 1
  const totalPg = parseInt(total) || 1

  html += `<div class="page-btn" onclick="changePage(${cur - 1})">‹</div>`

  let start = Math.max(1, cur - 2)
  let end = Math.min(totalPg, cur + 2)

  if (end - start < 4) {
    if (start === 1) end = Math.min(totalPg, start + 4)
    else if (end === totalPg) start = Math.max(1, end - 4)
  }

  if (start > 1) {
    // 注意这里判断 active
    html += `<div class="page-btn ${1 === cur ? 'active' : ''}" onclick="changePage(1)">1</div>`
    if (start > 2)
      html += `<span style="color:var(--text-sub); padding:0 5px; display:flex; align-items:flex-end;">...</span>`
  }

  for (let i = start; i <= end; i++) {
    // 核心修复：确保 i 和 cur 都是数字，才能匹配成功
    const isActive = i === cur ? 'active' : ''
    html += `<div class="page-btn ${isActive}" onclick="changePage(${i})">${i}</div>`
  }

  if (end < totalPg) {
    if (end < totalPg - 1)
      html += `<span style="color:var(--text-sub); padding:0 5px; display:flex; align-items:flex-end;">...</span>`
    html += `<div class="page-btn ${totalPg === cur ? 'active' : ''
      }" onclick="changePage(${totalPg})">${totalPg}</div>`
  }

  html += `<div class="page-btn" onclick="changePage(${cur + 1})">›</div>`
  // PC端显示 Go 输入框
  html += `<input class="input page-input" id="jumpInput" placeholder="Go" onkeydown="if(event.key==='Enter') jumpPage()">`

  el.innerHTML = html
}

function changePage(p) {
  if (p < 1 || p > totalPages) return
  currentPage = p
  doSearch()
}
function jumpPage() {
  const p = parseInt(document.getElementById('jumpInput').value)
  if (p) changePage(p)
}

// --- 5. 导入逻辑 (文件清空修复) ---
function handleDelim() {
  const val = document.getElementById('delimSelect').value
  const custom = document.getElementById('customDelim')
  if (val === 'custom') {
    custom.style.display = 'block'
    custom.focus()
  } else {
    custom.value = val
  }
  parseFile()
}

function parseFile() {
  const fileInput = document.getElementById('fileInput')
  const file = fileInput.files[0]

  // 核心修复：如果用户清空了文件选择，立即重置界面
  if (!file) {
    csvData = []
    document.getElementById('mappingArea').classList.add('hidden')
    document.getElementById('mappingContainer').innerHTML = ''
    return
  }

  const delim = document.getElementById('customDelim').value
  if (!delim) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target.result
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    csvData = lines.map((l) => l.split(delim).map((c) => c.trim()))
    if (csvData.length > 0) renderMapping(csvData[0])
  }
  reader.readAsText(file)
}

function renderMapping(previewRow) {
  document.getElementById('mappingArea').classList.remove('hidden')
  const container = document.getElementById('mappingContainer')
  container.innerHTML = ''

  const fields = [
    { k: 'base', t: '单词原形 (Base)' },
    { k: 'past', t: '过去式 (Past)' },
    { k: 'part', t: '过去分词' },
    { k: 'def', t: '中文释义' },
    { k: 'note', t: '备注' },
  ]

  let opts = `<option value="">(忽略此字段)</option>`
  previewRow.forEach((v, i) => {
    opts += `<option value="${i}">列 ${i + 1}: ${v.substring(0, 15)}...</option>`
  })

  fields.forEach((f, idx) => {
    const selected = idx < previewRow.length ? `value="${idx}" selected` : ''
    const html = `
                    <div class="mapping-row">
                        <div class="mapping-label">${f.t}</div>
                        <select class="input map-select" data-key="${f.k}">
                            ${opts.replace(`value="${idx}"`, selected)}
                        </select>
                    </div>
                `
    container.innerHTML += html
  })
}

async function executeImport() {
  const selects = document.querySelectorAll('.map-select')
  const map = {}
  selects.forEach((s) => {
    if (s.value) map[s.dataset.key] = s.value
  })

  if (!map.base) return showToast('必须映射原形字段', 'error')

  const mode = document.querySelector('input[name="importMode"]:checked').value
  // 过滤并构建 payload
  const payload = csvData
    .map((r) => ({
      base: r[map.base] || '',
      past: r[map.past] || '',
      part: r[map.part] || '',
      def: r[map.def] || '',
      note: r[map.note] || '',
    }))
    .filter((i) => i.base)

  // 获取 DOM 元素
  const btn = document.getElementById('btnStartImport')
  const status = document.getElementById('importStatus')
  const pBar = document.getElementById('importProgressBar')
  const pFill = document.getElementById('importProgressFill')

  // --- 1. 锁定界面与初始化 ---
  btn.disabled = true // 禁用按钮
  btn.style.opacity = '0.6'
  btn.innerText = '导入中...'

  pBar.classList.remove('hidden') // 显示进度条
  pFill.style.width = '0%'
  status.innerText = '准备开始...'

  const BATCH = 50
  let processedCount = 0
  let hasError = false

  try {
    for (let i = 0; i < payload.length; i += BATCH) {
      const chunk = payload.slice(i, i + BATCH)

      await fetch('/api/batch_add', {
        method: 'POST',
        headers: { 'Admin-Key': localStorage.getItem('adminKey') },
        body: JSON.stringify({ rows: chunk, mode }),
      })

      // --- 2. 更新进度 ---
      processedCount += chunk.length
      const percent = Math.min(100, Math.round((processedCount / payload.length) * 100))

      // 更新 UI
      pFill.style.width = percent + '%'
      status.innerText = `正在处理: ${percent}% (${processedCount}/${payload.length})`
    }

    status.innerText = `完成！共 ${payload.length} 条`
    showToast('导入成功')

    // 成功后延迟刷新
    setTimeout(() => {
      resetSearch()
      document.getElementById('fileInput').value = ''
      parseFile() // 重置映射区
      // 隐藏进度条
      pBar.classList.add('hidden')
      status.innerText = ''
    }, 1500)
  } catch (e) {
    console.error(e)
    status.innerText = '上传中断，请检查网络'
    showToast('导入失败', 'error')
    hasError = true
  } finally {
    // --- 3. 恢复按钮状态 ---
    btn.disabled = false
    btn.style.opacity = '1'
    btn.innerText = '开始导入'
  }
}

// --- 6. 通用管理 ---
function switchTab(t) {
  document.getElementById('tab-single').classList.toggle('hidden', t !== 'single')
  document.getElementById('tab-batch').classList.toggle('hidden', t !== 'batch')
}
function editItem(item) {
  document.getElementById('editId').value = item.id
  document.getElementById('base').value = item.base_word
  document.getElementById('past').value = item.past_tense
  document.getElementById('part').value = item.past_participle
  document.getElementById('def').value = item.definition
  document.getElementById('note').value = item.note || ''
  document.getElementById('adminPanel').classList.remove('hidden')
  switchTab('single')
  document.getElementById('cancelEdit').classList.remove('hidden')
  document.getElementById('adminPanel').scrollIntoView({ behavior: 'smooth' })
}
// 替换原有的 saveSingle 函数
// 替换 index.html 中的 saveSingle 函数
async function saveSingle() {
  const id = document.getElementById('editId').value
  const body = {
    id,
    base: document.getElementById('base').value.trim(),
    past: document.getElementById('past').value.trim(),
    part: document.getElementById('part').value.trim(),
    def: document.getElementById('def').value.trim(),
    note: document.getElementById('note').value.trim(),
  }

  if (!body.base || !body.past || !body.part) {
    return showToast('请填写完整 (原形/过去式/过去分词)', 'error')
  }

  // --- 场景 1: 编辑模式 (有 ID) ---
  if (id) {
    await fetch('/api/update', {
      method: 'POST',
      headers: { 'Admin-Key': localStorage.getItem('adminKey') },
      body: JSON.stringify(body),
    })
    showToast('修改成功')
    resetSearch()
    resetForm()
    return
  }

  // --- 场景 2: 新增模式 (无 ID) ---
  // 2.1 先查重
  const searchRes = await fetch(`/api/search?q=${encodeURIComponent(body.base)}&mode=exact`)
  const searchJson = await searchRes.json()

  // 2.2 精确比对：原形 + 过去式 都相同才算重复
  const duplicate = searchJson.data.find(
    (item) =>
      item.base_word.toLowerCase() === body.base.toLowerCase() &&
      item.past_tense.toLowerCase() === body.past.toLowerCase()
  )

  // 2.3 辅助函数：执行保存
  const doAdd = async (mode) => {
    await fetch('/api/batch_add', {
      method: 'POST',
      headers: { 'Admin-Key': localStorage.getItem('adminKey') },
      body: JSON.stringify({ rows: [body], mode: mode }),
    })
    showToast(mode === 'update' ? '已覆盖并保存' : '保存成功')
    resetSearch()
    resetForm()
  }

  // 2.4 如果发现重复 -> 弹出预览框
  if (duplicate) {
    // 构建对比表格 HTML
    const tableHtml = `
            <div style="margin-bottom:10px; color:var(--text-main)">检测到已存在的单词形式，是否覆盖？</div>
            <table style="width:100%; border:1px solid var(--border); font-size:0.9rem;">
                <tr style="background:var(--bg-body); color:var(--text-sub)">
                    <th style="padding:8px">字段</th>
                    <th style="padding:8px">当前存在 (Old)</th>
                    <th style="padding:8px; color:var(--primary)">准备提交 (New)</th>
                </tr>
                <tr>
                    <td style="padding:8px; color:var(--text-sub)">原形</td>
                    <td style="padding:8px">${duplicate.base_word}</td>
                    <td style="padding:8px; font-weight:bold">${body.base}</td>
                </tr>
                <tr>
                    <td style="padding:8px; color:var(--text-sub)">过去式</td>
                    <td style="padding:8px">${duplicate.past_tense}</td>
                    <td style="padding:8px; font-weight:bold">${body.past}</td>
                </tr>
                <tr>
                    <td style="padding:8px; color:var(--text-sub)">过去分词</td>
                    <td style="padding:8px">${duplicate.past_participle}</td>
                    <td style="padding:8px; color:${duplicate.past_participle !== body.part ? 'var(--primary)' : 'inherit'
      }">${body.part}</td>
                </tr>
                <tr>
                    <td style="padding:8px; color:var(--text-sub)">释义</td>
                    <td style="padding:8px">${duplicate.definition || '-'}</td>
                    <td style="padding:8px; color:${(duplicate.definition || '') !== body.def ? 'var(--primary)' : 'inherit'
      }">${body.def}</td>
                </tr>
                <tr>
                    <td style="padding:8px; color:var(--text-sub)">备注</td>
                    <td style="padding:8px">${duplicate.note || '-'}</td>
                    <td style="padding:8px; color:${(duplicate.note || '') !== body.note ? 'var(--primary)' : 'inherit'
      }">${body.note}</td>
                </tr>
            </table>
            <div style="margin-top:10px; font-size:0.8rem; color:var(--danger)">注意：覆盖操作不可撤销。</div>
        `

    showConfirmModal(tableHtml, () => doAdd('update'), true)
    document.getElementById('confirmActionBtn').innerText = '覆盖保存'
  } else {
    // 2.5 无重复 -> 直接添加
    await doAdd('skip')
  }
}

function resetForm() {
  document.getElementById('editId').value = ''
  document.querySelectorAll('#tab-single input').forEach((i) => (i.value = ''))
  document.getElementById('cancelEdit').classList.add('hidden')
}

function showLogin() {
  document.getElementById('loginModal').classList.remove('hidden')
}
// 替换原有的 confirmLogin 函数
async function confirmLogin() {
  const pass = document.getElementById('modalPass').value

  // 1. 禁用按钮防止重复提交
  const btn = document.querySelector('#loginModal .btn-primary')
  const originalText = btn.innerText
  btn.innerText = '验证中...'
  btn.disabled = true

  try {
    // 2. 发送请求给后端验证
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass }),
    })

    const data = await res.json()

    // 3. 根据后端返回结果判断
    if (res.ok && data.success) {
      localStorage.setItem('adminKey', pass)
      closeModal('loginModal')
      toggleAdmin(true)
      showToast('登录成功')
      // 清空输入框，防止下次打开还能看到密码
      document.getElementById('modalPass').value = ''
    } else {
      showToast('密码错误', 'error')
      // 登录失败清除错误的 key（如果有的话）
      localStorage.removeItem('adminKey')
    }
  } catch (e) {
    console.error(e)
    showToast('网络请求失败', 'error')
  } finally {
    // 4. 恢复按钮状态
    btn.innerText = originalText
    btn.disabled = false
  }
}
// 新增：登出确认
function confirmLogout() {
  // 复用通用的 confirmModal，样式更统一
  showConfirmModal('确定要退出登录吗？', () => {
    localStorage.removeItem('adminKey')
    toggleAdmin(false)
    showToast('已退出登录')
  })
}

function logout() {
  localStorage.removeItem('adminKey')
  toggleAdmin(false)
}
function toggleAdmin(show) {
  document.getElementById('adminPanel').classList.toggle('hidden', !show)
  document.getElementById('loginBtn').classList.toggle('hidden', show)
  document.getElementById('logoutBtn').classList.toggle('hidden', !show)
  if (document.querySelector('table')) doSearch()
}
function showToast(msg, type) {
  const t = document.getElementById('toast')
  t.innerText = msg
  t.className = `toast show ${type || ''}`
  setTimeout(() => (t.className = 'toast'), 2000)
}

// --- 7. 导出功能 ---

function showExportModal() {
  document.getElementById('exportModal').classList.remove('hidden')
  document.getElementById('exportDelimSelect').value = ',' // 默认逗号
  toggleExportCustom()
}

function toggleExportCustom() {
  const val = document.getElementById('exportDelimSelect').value
  const customInput = document.getElementById('exportCustomDelim')
  if (val === 'custom') {
    customInput.classList.remove('hidden')
    customInput.focus()
  } else {
    customInput.classList.add('hidden')
  }
}

async function executeExport() {
  const btn = document.getElementById('btnExecuteExport');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = '正在下载...';

  try {
    // 1. 获取参数
    const q = document.getElementById('searchInput').value.trim();
    const mode = document.querySelector('input[name="mode"]:checked').value;

    // 获取分隔符
    const selectVal = document.getElementById('exportDelimSelect').value;
    let delim = selectVal;
    if (selectVal === 'custom') {
      delim = document.getElementById('exportCustomDelim').value;
    }
    if (!delim) {
      showToast('请输入分隔符', 'error');
      return; // 这里的 return 会跳到 finally 恢复按钮
    }

    // 2. 直接请求后端生成文件 (注意：这里把 delim 也传给后端)
    // 这是一个 GET 请求，浏览器会接收到一个 Blob 对象
    const res = await fetch(`/api/export?q=${encodeURIComponent(q)}&mode=${mode}&delim=${encodeURIComponent(delim)}`);

    if (!res.ok) throw new Error('导出失败');

    // 3. 处理下载流
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    // 生成文件名
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ext = selectVal === '	' ? 'txt' : 'csv';
    const fileNamePrefix = q ? `verbs_search_${q}` : `verbs_all`;

    link.setAttribute('href', url);
    link.setAttribute('download', `${fileNamePrefix}_${date}.${ext}`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 释放内存
    setTimeout(() => URL.revokeObjectURL(url), 100);

    showToast('导出成功');
    closeModal('exportModal');

  } catch (e) {
    console.error(e);
    showToast('导出失败，请重试', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

# 📘 English Verb Manager Pro (英语动词助手)

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare)
![Cloudflare D1](https://img.shields.io/badge/Database-D1-blue?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green.svg)

一个基于 Cloudflare Workers + D1 构建的现代化无服务器（Serverless）单词管理系统。专为英语学习者和极客设计，支持动词三态（原形、过去式、过去分词）的高效管理、批量导入及多端适配。

## ✨ 功能特性

* **全栈 Serverless 架构**：后端运行在 Cloudflare Workers 边缘网络，数据库使用 D1 (SQLite)，前端界面作为静态资源托管，极速响应。
* **极致响应式 UI**：
    * **PC 端**：高效的宽屏表格管理，输入框与按钮横向排列，操作直观。
    * **移动端**：自动适配竖屏，表格转为卡片视图，大按钮触控优化，完美支持手机访问。
* **核心功能**：
    * 🔍 **双模搜索**：支持模糊匹配（LIKE）和精确匹配，极速定位单词。
    * 📝 **智能添加**：单条录入时支持**冲突检测**。如果检测到“原形+过去式”已存在，会弹出对比表格询问是否覆盖。
    * 📂 **批量导入**：支持 `.txt` 或 `.csv` 文件拖拽上传，自定义分隔符，带进度条显示。
    * 🔐 **安全鉴权**：内置管理员密码验证机制，防止未授权的数据修改。
    * 📄 **分页管理**：内置智能分页逻辑，支持自定义每页条数及快速跳转。

## 🛠️ 技术栈

* **Runtime**: Cloudflare Workers
* **Database**: Cloudflare D1 (SQLite)
* **Frontend**: Vanilla HTML5, CSS3, JavaScript (无框架依赖，纯原生)
* **Deployment**: Wrangler CLI

## 📂 项目结构

项目的核心文件结构如下，采用了 Workers Monolith 模式（单入口路由）：

```text
/
├── src/
│   ├── index.js      # 后端入口：路由分发 (Router)
│   └── api.js        # 业务逻辑：数据库操作 (CRUD)
├── public/
│   └── index.html    # 前端界面 (Single Page Application)
├── data/
│   └── verbs_all_20251210.csv # 初始化导入的数据
├── wrangler.toml     # Cloudflare 配置文件
└── package.json
```

## 🚀 快速开始

### 1. 环境准备

确保你已安装 Node.js，并全局安装了 Cloudflare 的命令行工具 Wrangler：

```Bash
npm install -g wrangler
```

### 2. 安装依赖

```Bash
npm install
```

### 3. 配置数据库 (D1)

登录 Cloudflare 账号并创建一个新的 D1 数据库：

```Bash
npx wrangler login
npx wrangler d1 create verbs-db
```

在你的 `wrangler.toml` 文件中配置数据库绑定（将控制台输出的 ID 填入）：

```Ini, TOML
[[d1_databases]]
binding = "DB"
database_name = "verbs-db"
database_id = "这里填入你的数据库ID"
```

## ☁️ 部署上线

### 1. 设置初始化远程仓库数据

初始化远程仓库数据

```Bash
npx wrangler d1 execute verb-db --remote --file=./schema.sql
```

### 2. 设置生产环境密钥

在部署到 Cloudflare 之前，必须设置生产环境的管理员密码（Secret）：

```Bash
npx wrangler secret put ADMIN_PASSWORD
# 根据提示输入你的生产环境密码
```

### 3. 部署项目

```Bash
npx wrangler deploy
```

部署完成后，你将获得一个 `https://你的项目名.workers.dev` 的永久访问地址。

### 4. 导入数据

输入密码，进入后台，选择批量导入，选择 `${你的项目路径}/data/verbs_all_xxx.csv`
最后点击批量导入即可

## 📖 使用指南

1.  **管理员登录**：点击右上角登录按钮，输入你设置的密码。
2.  **录入数据**：
    * **单条**：填写原形、过去式、过去分词、释义及备注。系统会自动查重。
    * **批量**：准备 CSV 文件，格式如 `lie,lied,lied,撒谎,备注`，上传并选择对应的分隔符。
3.  **搜索与维护**：使用搜索框快速查找，支持对现有条目进行编辑或删除。
4.  **导出数据**：在查询附件，点击导出按钮，即可根据当前查询的全部结果经行导出

## 📄 License

MIT License

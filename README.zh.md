# ZClaw

基于 Claude 的飞书原生 AI Agent 框架。

## 特性

- 通过 `@larksuiteoapi/node-sdk` WebSocket 实时接收飞书事件
- 通过 `lark-cli` 子进程执行复杂的飞书操作
- 使用 SQLite 持久化会话与消息历史
- 进程内调用 Anthropic SDK，支持 Claude tool use
- **多账号飞书支持 + 工作区隔离**
- **完整的图片/文件支持**：入站图片和文件会被下载并作为内容块发送给 Claude
- **完整的卡片交互**：发送交互式卡片、处理按钮/表单点击、更新已有卡片

## 快速开始

1. 安装依赖：
   ```bash
   pnpm install
   ```

2. 将 `.env.example` 复制为 `.env`，并填写你的凭证。

3. 创建 `accounts.json`，填入你的飞书应用凭证：
   ```json
   {
     "accounts": {
       "default": {
         "appId": "cli_xxx",
         "appSecret": "xxx",
         "encryptKey": "xxx",
         "verificationToken": "xxx",
         "brand": "feishu",
         "enabled": true
       }
     }
   }
   ```

4. 以开发模式运行：
   ```bash
   pnpm dev
   ```

## 工作区隔离

每个飞书账号在 `ZCLAW_DATA_DIR` 下都有自己独立的工作区：

```
data/
├── workspaces/
│   ├── <accountId_1>/
│   │   ├── zclaw.db      # 账号级 SQLite
│   │   ├── media/        # 账号级媒体缓存
│   │   └── shared/       # 指向全局共享工作区的软链
│   └── <accountId_2>/
│       ├── zclaw.db
│       ├── media/
│       └── shared/
└── shared/
    ├── zclaw.db          # 共享 SQLite（账号表、全局配置）
    └── media/            # 共享媒体/文件
```

优势：
- 每个账号的会话和消息存储在独立的 SQLite 文件中
- 媒体缓存按账号隔离
- 共享工作区可供所有账号访问公共资源
- 启动时自动迁移旧数据（`data/zclaw.db`、`data/media/`）到新布局

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ANTHROPIC_API_KEY` | - | Claude API 密钥 |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Claude API 基础 URL（可选，用于代理/边缘节点） |
| `CLAUDE_MODEL` | `claude-sonnet-4-7` | Claude 模型 |
| `CLAUDE_MAX_TOKENS` | `4096` | 每次响应的最大 token 数 |
| `ZCLAW_DATA_DIR` | `./data` | 数据目录 |
| `ZCLAW_SESSION_MAX_MESSAGES` | `20` | 每个会话保留的最大消息数 |
| `ZCLAW_SESSION_TTL_MS` | `3600000` | 会话空闲超时时间（毫秒） |
| `ZCLAW_MEDIA_MAX_MB` | `30` | 入站媒体文件最大大小（MB） |
| `LARK_CLI_PATH` | - | `lark-cli` 二进制文件路径 |
| `ZCLAW_ACCOUNTS_CONFIG` | `./accounts.json` | 飞书账号配置文件 |
| `ZCLAW_TASKS_CONFIG` | `./tasks.json` | 定时任务配置文件 |

## Claude 工具

ZClaw 向 Claude 暴露以下工具：

- `lark_send_message` — 发送飞书消息
- `lark_create_doc` — 创建飞书文档
- `lark_read_doc` — 读取飞书文档（Markdown 或 XML）
- `lark_update_doc` — 更新飞书文档（追加、覆盖或替换文本）
- `lark_create_sheet` — 创建飞书表格
- `lark_read_sheet` — 读取飞书表格单元格（JSON 或 CSV）
- `lark_update_sheet` — 写入飞书表格单元格
- `lark_upload_file` — 上传文件到飞书云盘
- `lark_list_chat_members` — 列出群成员
- `lark_send_card` — 发送交互式卡片
- `lark_update_card` — 更新已有卡片消息
- `scheduler_list_tasks` — 列出定时任务（可按启用状态或工作区过滤）
- `scheduler_create_task` — 创建新的定时任务
- `scheduler_update_task` — 更新已有定时任务
- `scheduler_delete_task` — 删除定时任务

## 卡片交互

Claude 可以发送交互式卡片（按钮、表单、确认框）。当用户点击按钮时，事件会作为一条合成消息回传给 Claude，从而支持多轮卡片驱动的工作流。

## 媒体支持

入站图片会被转换为 Claude 的 `image` 内容块，PDF 会被转换为 `document` 块，纯文本文件会作为文本读取，其他文件则通过文件名引用。

## 定时任务

ZClaw 支持通过 `tasks.json` 配置 cron 定时任务，也可以直接让 Claude 管理：

```bash
cp tasks.json.example tasks.json
```

支持的动作：

- `send_message` — 发送飞书消息
- `run_lark_cli` — 执行 lark-cli 命令
- `invoke_claude` — 调用 Claude，并可选择发送结果
- `cleanup_media` — 清理过期媒体文件

示例：

```json
{
  "tasks": [
    {
      "id": "daily-report",
      "name": "日报提醒",
      "workspaceId": "default",
      "cron": "0 18 * * 1-5",
      "enabled": true,
      "action": {
        "type": "send_message",
        "payload": { "chat_id": "oc_xxx", "text": "请记得填写今日日报" }
      }
    }
  ]
}
```

- `workspaceId` 可以是 `shared`，也可以是 `accounts.json` 中的任意账号 ID
- 任务会持久化到对应工作区的 SQLite 数据库
- 启动时，`tasks.json` 会同步到数据库
- 通过 Claude 创建的任务会标记为 `runtime` 任务，不会被 `tasks.json` 的同步覆盖或删除
- 使用 `scheduler_*` 系列 Claude 工具可在运行时列出、创建、更新或删除任务

## 多账号配置

在 `accounts.json` 中添加多个账号：

```json
{
  "accounts": {
    "hr_bot": {
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "brand": "feishu",
      "enabled": true,
      "agent": {
        "systemPrompt": "你是 HR 助手，用中文回答。",
        "model": "claude-sonnet-4-7",
        "maxTokens": 2048,
        "enabledTools": ["lark_*"]
      }
    },
    "it_bot": {
      "appId": "cli_yyy",
      "appSecret": "yyy",
      "brand": "feishu",
      "enabled": true,
      "agent": {
        "systemPrompt": "你是 IT 支持助手，用英文回答。",
        "model": "claude-sonnet-4-7",
        "maxTokens": 4096,
        "enabledTools": ["lark_*", "scheduler_*"]
      }
    }
  }
}
```

每个启用的账号都会拥有自己的工作区、WebSocket 连接和独立的 Claude 实例。通过账号级的 `agent` 字段可以自定义 system prompt、模型、最大 token 数和可用工具；留空则回退到全局环境变量配置。

`enabledTools` 支持精确工具名和 `*` 通配符，例如 `lark_*` 会启用所有 Lark 工具。

## CLI 使用

构建或全局安装后，`zclaw` 可作为命令行工具使用。

### 守护进程控制

```bash
# 前台启动
zclaw start

# 后台守护进程启动
zclaw start --daemon

# 查看状态
zclaw status

# 重启 / 停止
zclaw restart
zclaw stop
```

### 账号管理

```bash
zclaw account list
zclaw account add mybot --app-id cli_xxx --app-secret xxx
zclaw account remove mybot
zclaw account set-model mybot claude-sonnet-4-7
```

### 定时任务管理

```bash
zclaw task list
zclaw task add daily-report \
  --name "日报提醒" \
  --cron "0 18 * * 1-5" \
  --workspace mybot \
  --action-type send_message \
  --action-payload '{"chat_id":"oc_xxx","text":"请填写日报"}'
zclaw task remove daily-report
```

管理命令会修改 `accounts.json` / `tasks.json`，修改后执行 `zclaw restart` 使运行中的守护进程生效。

## NPM 发布

```bash
pnpm run build
npm pack --dry-run
npm publish
```

包会暴露 `zclaw` 二进制命令，并附带 macOS x86_64 的 `lark-cli` 二进制。

## 开发与测试

```bash
# 类型检查
pnpm typecheck

# 构建
pnpm build

# 运行测试
pnpm test

# 开发模式（热重载）
pnpm dev
```

## 许可证

[LICENSE](./LICENSE)

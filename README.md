# ZClaw

Feishu-native AI Agent framework powered by Claude.

## Features

- Real-time events via `@larksuiteoapi/node-sdk` WebSocket
- Complex Feishu operations via `lark-cli` subprocess
- SQLite persistence for sessions and message history
- Anthropic SDK in-process Claude calls with tool use
- **Multi-account Feishu support with workspace isolation**
- **Full image/file support**: inbound images and files are downloaded and sent to Claude as content blocks
- **Full card interaction**: send interactive cards, handle button/form clicks, update existing cards

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in your credentials.

3. Create `accounts.json` with your Feishu app credentials:
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

4. Run in development mode:
   ```bash
   pnpm dev
   ```

## Workspace Isolation

Each Feishu account has its own isolated workspace under `ZCLAW_DATA_DIR`:

```
data/
├── workspaces/
│   ├── <accountId_1>/
│   │   ├── zclaw.db      # per-account SQLite
│   │   ├── media/        # per-account media cache
│   │   └── shared/       # symlink to global shared workspace
│   └── <accountId_2>/
│       ├── zclaw.db
│       ├── media/
│       └── shared/
└── shared/
    ├── zclaw.db          # shared SQLite (accounts table, global config)
    └── media/            # shared media/files
```

Benefits:
- Each account's sessions and messages are stored in separate SQLite files
- Media caches are isolated per account
- A shared workspace is available for common resources
- Legacy data (`data/zclaw.db`, `data/media/`) is automatically migrated on startup

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | - | Claude API key |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Claude API base URL (optional, for proxy/edge endpoints) |
| `CLAUDE_MODEL` | `claude-sonnet-4-7` | Claude model |
| `CLAUDE_MAX_TOKENS` | `4096` | Max tokens per response |
| `ZCLAW_DATA_DIR` | `./data` | Data directory |
| `ZCLAW_SESSION_MAX_MESSAGES` | `20` | Max messages kept per session |
| `ZCLAW_SESSION_TTL_MS` | `3600000` | Session idle TTL |
| `ZCLAW_MEDIA_MAX_MB` | `30` | Max inbound media size |
| `LARK_CLI_PATH` | - | Path to lark-cli binary |
| `ZCLAW_ACCOUNTS_CONFIG` | `./accounts.json` | Feishu accounts config |
| `ZCLAW_TASKS_CONFIG` | `./tasks.json` | Scheduled tasks config |

## Claude Tools

ZClaw exposes the following tools to Claude:

- `lark_send_message` — Send a Feishu message
- `lark_create_doc` — Create a Feishu document
- `lark_upload_file` — Upload a file to Feishu Drive
- `lark_list_chat_members` — List chat members
- `lark_send_card` — Send an interactive card
- `lark_update_card` — Update an existing card message
- `scheduler_list_tasks` — List scheduled tasks (optionally filter by enabled status or workspace)
- `scheduler_create_task` — Create a new scheduled task
- `scheduler_update_task` — Update an existing scheduled task
- `scheduler_delete_task` — Delete a scheduled task by ID

## Card Interactions

Claude can send interactive cards (buttons, forms, confirmations). When a user clicks a button, the event is routed back to Claude as a synthetic message, allowing multi-turn card-based workflows.

## Media Support

Inbound images are converted to Claude `image` content blocks. PDFs are converted to `document` blocks. Plain text files are read as text. Other files are referenced by name.

## Scheduled Tasks

ZClaw supports cron-based scheduled tasks via `tasks.json` and direct management through Claude:

```bash
cp tasks.json.example tasks.json
```

Supported actions:

- `send_message` — Send a Feishu message
- `run_lark_cli` — Execute a lark-cli command
- `invoke_claude` — Invoke Claude and optionally send the result
- `cleanup_media` — Clean up old media files

Example:

```json
{
  "tasks": [
    {
      "id": "daily-report",
      "name": "Daily Report Reminder",
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

- `workspaceId` can be `shared` or any account ID from `accounts.json`
- Tasks are persisted to the workspace's SQLite database
- On startup, `tasks.json` is synced to the database
- Tasks created through Claude are marked as `runtime` tasks and are not overwritten or removed by `tasks.json` syncs
- Use the `scheduler_*` Claude tools to list, create, update, or delete tasks at runtime

## Multi-Account Configuration

Add multiple accounts to `accounts.json`:

```json
{
  "accounts": {
    "hr_bot": {
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "brand": "feishu",
      "enabled": true,
      "agent": {
        "systemPrompt": "You are an HR assistant. Answer in Chinese.",
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
        "systemPrompt": "You are an IT support assistant. Answer in English.",
        "model": "claude-sonnet-4-7",
        "maxTokens": 4096,
        "enabledTools": ["lark_*", "scheduler_*"]
      }
    }
  }
}
```

Each enabled account gets its own workspace, WebSocket connection, and Claude agent instance. The per-account `agent` field lets you customize the system prompt, model, max tokens, and available tools. If omitted, account falls back to the global environment variables.

`enabledTools` supports exact names and `*` wildcards (e.g. `lark_*` enables all Lark tools).

## Development

```bash
# Type check
pnpm typecheck

# Build
pnpm build

# Run tests
pnpm test

# Development mode (hot reload)
pnpm dev
```

## License

[LICENSE](./LICENSE)

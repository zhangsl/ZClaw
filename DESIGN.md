# ZClaw 设计方案

## 1. 项目定位

ZClaw 是一个**飞书-native 的 AI Agent 框架**，核心目标：

- 通过飞书接收用户消息
- 对接 Claude SDK 提供 agent 能力
- 通过飞书回复用户

与 NanoClaw 的关键差异：

| 维度 | NanoClaw | ZClaw |
|------|----------|-------|
| 支持通道 | 多通道（WhatsApp/Telegram/Slack/Discord/CLI） | 仅飞书 |
| Claude 隔离 | Docker 容器隔离，SQLite 双 DB IPC | **进程内直接调用**，无容器 |
| 飞书操作 | 无原生支持 | **原生集成** |
| 凭证管理 | OneCLI Gateway | 直接配置 |
| 架构复杂度 | 高（容器编排、三 DB 模型、心跳机制） | **低（单体进程）** |

---

## 2. 整体架构

```
+------------------+      +-------------------+      +------------------+
|   飞书客户端      |----->|   ZClaw Gateway   |----->|   Claude SDK     |
| (群聊/私聊/卡片)  |<-----|  (Node.js 进程)   |<-----| (进程内调用)      |
+------------------+      +-------------------+      +------------------+
       ^                          |
       |                          v
       +-------------------+  +-------------------+
                           |  |   lark-cli        |
                           |  | (飞书操作子进程)   |
                           |  +-------------------+
                           |
                           v
                    +-------------------+
                    |   Session Store   |
                    | (内存 / SQLite)   |
                    +-------------------+
```

### 2.1 核心组件

| 组件 | 职责 | 说明 |
|------|------|------|
| **Gateway** | HTTP Server，接收飞书事件 | Express/Fastify，处理 webhook 推送 |
| **Event Parser** | 解析飞书事件体 | 区分消息类型、提取文本/附件/mention |
| **Router** | 消息路由 | 根据 chat_id + sender 路由到对应 session |
| **Session Manager** | 会话生命周期管理 | 维护 conversation context |
| **Agent Core** | 调用 Claude SDK | 直接 import `@anthropic-ai/sdk` |
| **Reply Builder** | 构造飞书消息 | 将 Claude 输出转为飞书消息格式 |
| **lark-cli Driver** | 飞书操作封装 | 调用 lark-cli 子进程发送消息/操作飞书 |

---

## 3. 消息流转

### 3.1 入站流程

```
飞书推送事件 → Gateway 接收 → 验签 → 解析事件类型
                                              |
                    +-------------------------+
                    |
            是@bot的消息？
                    |
        +-----------+-----------+
        |                       |
      否                       是
        |                       |
   忽略/直接回复          查找/创建 Session
        |                       |
        |              组装 message + context
        |                       |
        |              调用 Claude SDK
        |                       |
        |              获取回复
        |                       |
        +--------------> 通过 lark-cli 发送
```

### 3.2 关键细节

- **验签**：飞书事件推送需要验证 signature + timestamp，防止伪造
- **@检测**：飞书群聊中需检测是否@了 bot，避免所有消息都触发
- **Session Key**：`chat_id + bot_app_id` 或 `sender_open_id + bot_app_id`（私聊）
- **Context 窗口**：维护最近 N 条对话历史，作为 Claude 的 message 参数

---

## 4. Claude SDK 集成（无容器方案）

### 4.1 为什么不需要容器

NanoClaw 使用容器隔离的主要原因是：
1. **多租户安全**：不同 agent group 之间需要文件系统隔离
2. **凭证隔离**：OneCLI 通过容器挂载注入不同凭证
3. **技能隔离**：不同 agent 安装不同 npm 包，避免冲突

ZClaw 的简化假设：
- **单租户**：部署者自己用，或信任的内网团队用
- **统一凭证**：一个 Claude API Key 服务所有会话
- **统一技能**：所有 session 共享相同工具集

### 4.2 直接调用架构

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 每个 session 维护一个 message 数组
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  messages: session.messages,  // 历史上下文
  tools: enabledTools,         // 可选：飞书操作工具
});
```

### 4.3 Tool Use（可选扩展）

可定义 tools 让 Claude 主动操作飞书：

```typescript
const tools = [
  {
    name: 'lark_send_message',
    description: '发送飞书消息',
    input_schema: { ... }
  },
  {
    name: 'lark_create_doc',
    description: '创建飞书文档',
    input_schema: { ... }
  },
  // ...
];
```

Claude 返回 `tool_use` 时，ZClaw 调用 lark-cli 执行并返回 `tool_result`。

---

## 5. 飞书集成方案

### 5.1 消息接收：事件订阅（Webhook）

**方案 A：HTTP Server 接收推送**

```
飞书开放平台 → 配置事件订阅 URL → ZClaw Gateway 接收
```

- 需要公网可访问的 HTTPS 地址（或内网穿透）
- 支持消息事件、卡片事件、用户加入群聊等
- 需要实现[事件订阅的验签逻辑](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/event-registration/verify-event-callback)

**方案 B：WebSocket 长连接（如支持）**

飞书部分能力支持 WebSocket，但消息订阅通常用 HTTP webhook。

### 5.2 消息发送：lark-cli 封装

lark-cli 是飞书官方 Go CLI，提供完整 API 访问。

**初始化认证**：
```bash
lark auth login --app-id <app_id> --app-secret <app_secret>
# 或使用 tenant_access_token
```

**发送消息**：
```bash
lark im message create --receive_id <chat_id> --msg_type text --content '{"text":"hello"}'
```

**ZClaw 中的封装**：
```typescript
class LarkCliDriver {
  async sendText(receiveId: string, text: string) {
    return execa('lark', [
      'im', 'message', 'create',
      '--receive_id', receiveId,
      '--msg_type', 'text',
      '--content', JSON.stringify({ text }),
      '--format', 'json'
    ]);
  }

  async sendMarkdown(receiveId: string, markdown: string) {
    // ...
  }
}
```

### 5.3 lark-cli 的优势与权衡

| 优势 | 权衡 |
|------|------|
| 官方维护，API 覆盖完整 | Go 二进制，需要 subprocess 调用 |
| 已处理认证、token 刷新 | 跨进程通信有开销 |
| 支持 200+ 命令 | 需要解析 stdout JSON |
| 内置 AI Agent Skills | 错误处理需封装 |

**替代方案**：使用飞书 Node.js SDK (`@larksuiteoapi/node-sdk`)
- 优势：同进程调用，TypeScript 类型完善
- 劣势：需要单独引入一个 SDK

> **待确认**：是否坚持使用 lark-cli，还是也支持 Node.js SDK？

---

## 6. 会话管理

### 6.1 Session 模型

```typescript
interface Session {
  id: string;                    // uuid
  chatId: string;                // 飞书 chat_id
  chatType: 'p2p' | 'group';     // 私聊或群聊
  senderOpenId: string;          // 发起者
  messages: Message[];           // 对话历史
  createdAt: number;
  updatedAt: number;
  metadata: {
    chatName?: string;
    senderName?: string;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
```

### 6.2 存储方案

| 方案 | 适用场景 | 特点 |
|------|----------|------|
| **内存 Map** | 开发/单实例部署 | 重启丢失，最简单 |
| **SQLite** | 生产/单实例 | 持久化，轻量 |
| **Redis** | 多实例/集群 | 共享状态，需要额外依赖 |

> **待确认**：预期的部署形态是什么？单进程长期运行，还是可能多实例？

### 6.3 Context 窗口管理

- 保留最近 **20-50 条** message 作为上下文
- 超出时进行**摘要压缩**（可选）或直接丢弃早期 message
- 单条消息长度限制（Claude 有输入上限）

---

## 7. 项目结构

```
zclaw/
├── src/
│   ├── index.ts              # 入口：启动 HTTP server
│   ├── config.ts             # 配置读取（环境变量）
│   ├── gateway.ts            # HTTP server + 飞书事件处理
│   ├── events/
│   │   ├── parser.ts         # 飞书事件解析
│   │   ├── verifier.ts       # 签名验证
│   │   └── handler.ts        # 事件分发处理
│   ├── agent/
│   │   ├── client.ts         # Claude SDK 封装
│   │   ├── session.ts        # Session 类
│   │   └── store.ts          # Session 存储（内存/SQLite）
│   ├── lark/
│   │   ├── cli-driver.ts     # lark-cli 子进程封装
│   │   ├── sender.ts         # 消息发送器
│   │   └── types.ts          # 飞书类型定义
│   └── utils/
│       └── logger.ts
├── bin/
│   └── lark-cli              # lark-cli 二进制（或软链）
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 8. 配置设计

```env
# Claude
ANTHROPIC_API_KEY=sk-ant-xxx
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_MAX_TOKENS=4096

# 飞书 Bot
LARK_APP_ID=cli_xxx
LARK_APP_SECRET=xxx
LARK_ENCRYPT_KEY=xxx          # 事件订阅加密密钥（可选）
LARK_VERIFICATION_TOKEN=xxx   # 旧版验签 token（可选）

# ZClaw
PORT=3000
SESSION_MAX_MESSAGES=20
SESSION_TTL=3600000           # session 空闲超时（ms）
LOG_LEVEL=info

# lark-cli 路径（如不在 PATH）
LARK_CLI_PATH=/usr/local/bin/lark
```

---

## 9. 关键技术决策

### 9.1 为什么不复用 NanoClaw 的容器架构

| NanoClaw 设计 | ZClaw 选择 |
|---------------|-----------|
| 容器隔离保障多租户安全 | 单进程假设下不需要 |
| SQLite 双 DB 解决跨挂载锁 | 同进程共享内存，不需要 |
| OneCLI 网关代理凭证 | 直接环境变量配置 |
| 心跳文件检测容器存活 | 进程本身存活即存活 |
| 轮询 inbound/outbound DB | 直接函数调用 |

简化的代价是**失去严格隔离**，适合个人或小型团队场景。

### 9.2 lark-cli vs 飞书 Node.js SDK

- **lark-cli**：用户明确要求考虑，官方工具，功能最全
- **Node.js SDK**：同进程更轻量，类型更好，但多了一个依赖

建议：**以 lark-cli 为主**，但抽象 `LarkSender` 接口，未来可切换实现。

---

## 10. 待确认问题

1. **Claude SDK 形式**：使用 Anthropic 官方 SDK (`@anthropic-ai/sdk`)，还是 Claude Code CLI (`claude` 命令)？
   - SDK：更轻量，纯 API 调用
   - CLI：可使用 extended thinking、artifacts 等特性

2. **飞书 App 类型**：使用**自建应用**（需要企业管理员审批）还是**商店应用**？
   - 影响权限范围和部署方式

3. **消息发送方式**：是否坚持用 `lark-cli` 子进程，还是也接受 `@larksuiteoapi/node-sdk`？

4. **会话持久化**：是否需要 SQLite 持久化，还是内存存储即可？

5. **功能范围**：
   - 仅支持文本对话？
   - 是否需要支持飞书卡片（Card）交互？
   - 是否需要支持图片/文件处理？

6. **部署环境**：本地开发、个人服务器、还是企业内网？
   - 影响公网地址/内网穿透方案

---

## 11. 迭代路线建议

### Phase 1: MVP（文本对话）
- HTTP Gateway 接收飞书消息事件
- 验签 + @检测
- 内存 session 管理
- 直接调用 Claude SDK
- lark-cli 发送文本回复

### Phase 2: 增强体验
- SQLite 持久化 session
- 支持 Markdown/富文本回复
- 支持私聊（无需@）
- 支持群聊标题/用户信息获取

### Phase 3: Agent 能力
- Tool Use（让 Claude 能操作飞书）
- 支持图片输入（Claude 多模态）
- 卡片交互（按钮、表单）
- 多 agent group 配置（类似 NanoClaw 的 container.json）

---

## 12. 参考与依赖

- **NanoClaw**: 参考其 router/session/adapter 抽象思想
- **lark-cli**: `github.com/larksuite/cli` — 飞书操作底层工具
- **Anthropic SDK**: `@anthropic-ai/sdk` — Claude API 调用
- **飞书开放文档**: https://open.feishu.cn/

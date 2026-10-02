# 夜半汤馆

一个海龟汤网站。玩家看汤面、向 AI 主持人提问，主持人只回答「是 / 不是 / 是也不是 / 无关 / 不知道」，场景会随着推理的进展发生变化。

在线体验：https://soup.bu2z.de

## 社区

本项目认可并支持 [LINUX DO](https://linux.do/) 社区。欢迎在 LINUX DO 交流反馈、分享你的推理过程（请注意不要直接剧透汤底）。

## 运行

```bash
npm install
cp .env.example .env      # 填入 LLM_API_KEY
npm run dev               # 前端 http://localhost:5173 ，后端 :8787
```

生产环境：

```bash
npm run build && npm start   # 单进程同时托管 dist/ 和 /api
```

## 部署到自己的服务器

整个服务是**一个 Node 进程**（托管前端 + API），会话在内存里，每分钟及退出时落盘到 `data/sessions.json`，发版重启不丢局。单机部署不需要数据库或 Redis。

服务器上需要能访问 `api.deepseek.com`。字体已经本地托管，页面不依赖 Google Fonts 等境外资源。

**方式一：Docker**

```bash
cp .env.example .env          # 填 LLM_API_KEY
docker compose up -d --build  # 监听 127.0.0.1:8787
```

国内服务器拉不到 Docker Hub 时，给 Docker 配一个镜像加速源，或者用方式二。

**方式二：直接跑 Node + 自动发版（线上用的就是这种）**

服务器目录结构：

```
/opt/haiguitang/
  node/               Node 22（只给本服务用）
  bin/deploy          发版脚本（deploy/server/deploy.sh）
  releases/<时间>/    每次发版一个目录，保留最近 5 个
  current -> releases/...   systemd 从这里启动
  shared/.env         LLM_API_KEY 等
  shared/data/        对局落盘
```

- **自动发版**：push 到 `main` 后，GitHub Actions（`.github/workflows/deploy.yml`）会依次执行：
  1. 类型检查 + 构建，失败就停下，不会发到服务器；
  2. 用 `deploy/pack.sh` 打出发布包，通过 SSH 送进服务器的 `bin/deploy`；
  3. 服务器解包、装生产依赖、原子切换 `current`、重启；
  4. 健康检查不过就自动回滚到上一版。
- 仓库需要配置的 secrets：`DEPLOY_HOST`、`DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS`。这把部署 key 在服务器的 `authorized_keys` 里配置成 `restrict,command="/opt/haiguitang/bin/deploy"`，只能触发发版，不能登录、不能转发端口。
- **手动发版**：`DEPLOY_HOST=<ssh 主机> deploy/push.sh`。
- **手动回滚**：`ln -sfn /opt/haiguitang/releases/<旧版本> /opt/haiguitang/current && systemctl restart haiguitang`。
- systemd 配置见 `deploy/haiguitang.service`。

**反向代理 + HTTPS**：`deploy/Caddyfile`（推荐，自动申请证书）或 `deploy/nginx.conf`。主持人思考加重试可能超过一分钟，读超时已放到 150s。走反代时必须设置 `TRUST_PROXY=1`，否则按 IP 限流会把所有人算成同一个 IP（compose 和 service 文件里已经设好）。

不填 `LLM_API_KEY` 时会使用本地的**模拟主持人**（按参考问答做关键词匹配），页面左上角会标出“模拟主持人”，仅供调试前端。

## 主持人（LLM）

- 走 OpenAI 兼容协议，默认 `deepseek-flash` + `reasoning_effort=high`，可通过 `LLM_BASE_URL / LLM_MODEL / LLM_REASONING_EFFORT` 切换。
- 提示词在 `server/prompts.ts`：通用规则与经典示例在前，具体故事资料在后，输出格式放在最后。每碗汤的系统提示词是固定文本，多用户共享前缀，能命中 DeepSeek 的上下文缓存。
- 模型输出结构化 JSON：`answer`、`note`、`milestones`（玩家已确认的关键发现）、`cue`（一次性的氛围反馈）。
- 服务端兜底：
  - `note` 和还原反馈里如果出现玩家从未说过的剧透词（`host.spoilerTerms`），整句丢弃；
  - `milestones` 和 `cue` 只接受白名单内的 id；
  - `cue` 强制冷却，两次之间至少间隔 4 问。
- 开发环境下，每问的推理摘要会打印在后端日志里（`[host] ...`），方便调整提示词。

## 并发

- 游戏状态全部在服务端（`server/sessions.ts`），前端只持有 sessionId（存在 localStorage，刷新可恢复）。
- **同一会话**：带独占锁，同时发来的第二个请求直接返回 409，不会出现两次 LLM 回调交错写入。
- **不同会话**：互不阻塞。
- **上游 LLM**：全局信号量限制在途请求数（`LLM_MAX_CONCURRENT`），超出的排队，排队超时返回 503；SDK 自带 429/5xx 退避重试。
- **限流**：按 IP 的令牌桶，分别限制提问频率和开局频率；部署在反向代理后面时设置 `TRUST_PROXY=1`。
- 当前是**单进程内存存储 + 定期落盘**（`SESSION_FILE`，默认 `data/sessions.json`）。要多实例部署（比如 Vercel 这类 Serverless），需要把 `SessionStore` 换成 Redis 实现（busy 锁对应 `SET NX PX`），限流也要挪到 Redis，接口不用改。

## 投稿新汤

欢迎投稿。剧本是一个 JSON 文件，放进 `stories/` 就能玩，不用改前端。格式、写作要点、本地自测和提 PR 的流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

注意：仓库是公开的，投进来的汤，汤底所有人都能看到。

## 《乖，别停》的布景

- 第一人称：七岁的“我”站在一号台前，手里握着爷爷的球拍。画面是生图脚本生成的写实照片（`web/src/scenes/pei-wo-da-yi-ge/art.json`），各个状态逐像素对齐，靠渐变和叠加层切换。
- 深夜的乡镇乒乓球训练馆。每问一个问题，时间就过去 18 分钟：从 23:50 走到 05:50 天亮，左上的高窗慢慢透出黎明前的灰蓝。
- 每隔几秒响一组“乒……咚”，每“乒”一下，手里的球拍就挥一下。回应越来越慢、越来越轻，天亮后只剩“乒”。记分牌记录“我 : 爷爷”的次数。
- 第 8 问（半夜两点多），右墙的门会开一次，门缝里站着一个人。
- 里程碑触发的异变：
  - 丧事：日光灯闪几下后熄灭，馆里只剩长明灯，左边出现供桌和遗像，地上有纸钱；
  - 棺材：一号台上显出棺材，握拍的手抬到棺盖的高度；
  - 求救：屏幕闪出“救”，汤面里的“球……球……”变成“救……救……”；
  - 爸爸：那扇门一直开着；
  - 轮回：棺材旁的暗处多了一个孩子。
- 点遗像、球拍、记分牌和门可以凑近看。特写也会随推理变化：遗像里的爷爷会转过眼睛看门，问出他还活着之后，盯久了他会眨一下眼。
- 所有声音都用 Web Audio 实时合成，包括空旷训练馆的混响，不需要音频素材。

## 许可证

[MIT](LICENSE)。投稿的剧本同样以 MIT 协议发布。

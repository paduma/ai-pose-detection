# AI Pose Detection Demo

一个基于 Next.js 14 的全栈学习项目，集成 MediaPipe 姿态检测和 FFmpeg.wasm 视频处理。

[在线体验](https://ai-pose-detection-psi.vercel.app/dashboard)

## 技术栈

- Next.js 14 (App Router)
- TypeScript
- MediaPipe Tasks Vision (姿态关键点检测)
- FFmpeg.wasm (浏览器端视频处理)
- MongoDB (数据存储)
- Zustand (状态管理)
- Tailwind CSS
- JWT 认证

## 功能

- 用户注册 / 登录（JWT + bcrypt）
- 摄像头实时录制 + 实时姿态检测
- 上传视频进行姿态分析（支持 MP4 / WebM）
- 基于规则引擎的动作评分（深蹲、俯卧撑、平板支撑、弓步蹲）
- 视频编辑：裁剪、压缩、缩略图提取（FFmpeg.wasm，纯浏览器端）
- 分析历史记录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 下载 MediaPipe 模型

模型文件较大，不包含在仓库中：

```bash
node scripts/download-models.js
```

这会将 `pose_landmarker_heavy.task` 下载到 `public/models/` 目录。

> 如果在国内网络环境下载失败，脚本会提示手动下载地址。

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
MONGODB_URI=mongodb://localhost:27017/pose-detection
JWT_SECRET=your-secret-key
```

### 4. 启动

```bash
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
src/
├── app/                  # Next.js App Router 页面
│   ├── (auth)/           # 登录 / 注册
│   ├── dashboard/        # 主面板、录制、编辑、历史
│   └── api/              # API Routes (auth, pose, video)
├── components/           # React 组件
│   ├── VideoRecorder     # 摄像头录制
│   ├── VideoAnalyzer     # 视频姿态分析
│   ├── VideoEditor       # FFmpeg 视频编辑
│   └── RealtimePoseAnalyzer  # 实时姿态检测
├── lib/                  # 工具库
│   ├── mediapipe.ts      # MediaPipe 封装 + 评分规则
│   ├── ffmpegClient.ts   # FFmpeg.wasm 客户端封装
│   ├── videoProcessor.ts # 服务端视频处理 (fluent-ffmpeg)
│   ├── mongodb.ts        # MongoDB 连接
│   └── auth.ts           # JWT 认证
└── store/                # Zustand 状态管理
```

## 已知限制

- 评分基于规则引擎（关节角度阈值），非 ML 模型，跨动作类型可能误判
- WebM 格式视频 seek 支持较差，分析时自动切换为播放模式采样
- MediaPipe 模型需从 Google Storage 下载，国内需代理或使用本地模型文件
- FFmpeg.wasm 首次加载较慢（~30MB WASM 文件），且需要 COOP/COEP 安全头启用 SharedArrayBuffer（已在 next.config.js 中配置）

## 技术要点

- FFmpeg.wasm 依赖 SharedArrayBuffer，浏览器要求页面返回 `Cross-Origin-Opener-Policy` 和 `Cross-Origin-Embedder-Policy` 头才能使用（Spectre 漏洞后的安全策略）
- `npm install` 的 postinstall 脚本会自动将 FFmpeg WASM 文件拷贝到 `public/ffmpeg/`，如果目录为空可手动执行 `node scripts/copy-ffmpeg.js`
- Webpack 会劫持 `@ffmpeg/ffmpeg` 内部 worker 的动态 `import()`，需在 webpack 配置中禁用对该包的 parser 解析
- MediaPipe PoseLandmarker 为单例模式，重复分析前需 reset 实例以避免 timestamp 冲突
- WebM 视频 seek 不可靠，采用双模式策略：优先 seek，超时自动切换为 2x 播放采样

## License

GPL-3.0 — You're free to use, modify, and distribute this project, but derivative works must also be open-sourced under the same license. See [LICENSE](LICENSE) for details.

# Gamepad Tests Pro

Gamepad/Controller Test Application

<!-- License: Business Source License 1.1 -->
<!-- Author: @Kezry -->

## 项目简介 / Project Description

这是一个用于测试和调试游戏手柄/控制器功能的 Web 应用程序。它支持检测、读取和可视化游戏手柄输入信号，提供专业的游戏控制器诊断工具。

This is a professional web application for testing and debugging gamepad/controller functionality. It supports detecting, reading, and visualizing game controller input signals, providing professional-grade diagnostics for gamepad testing.

## 技术栈 / Tech Stack

- **Vite** - 现代化的构建工具和开发服务器
- **TypeScript** - JavaScript 的超集，提供类型安全
- **React 18** - 用于构建用户界面的库
- **Tailwind CSS** - 用于快速构建现代 UI 的实用优先 CSS 框架
- **shadcn/ui** - 基于 Radix UI 和 Tailwind CSS 的现代 UI 组件库
- **Supabase** - 用于存储测试记录的后端即服务 (BaaS)

## 功能特性 / Features

- 游戏手柄设备检测与自动识别
- 实时输入数据可视化（按键、摇杆、陀螺仪）
- 多种手柄类型支持（Xbox、PlayStation、Nintendo Switch、通用手柄）
- 震动反馈测试
- 输入延迟测试
- 摇杆漂移检测
- 连接稳定性测试
- 测试结果排名与分享
- 中英文双语支持
- 现代化 UI 设计

## 支持的浏览器 / Browser Support

- Chrome/Chromium (推荐) / Chrome/Chromium (Recommended)
- Firefox
- Edge
- Safari (部分功能可能受限 / Some features may be limited)

## 环境变量配置 / Environment Variables

项目使用以下环境变量（参考 `.env.example`）：

```bash
# Supabase 配置 (从 Supabase 项目设置中获取)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

**注意**：`.env` 文件包含敏感凭证，已添加到 `.gitignore` 中，不会被提交到版本控制系统。

## 安装 / Installation

```bash
# 克隆仓库 / Clone the repository
git clone <YOUR_GIT_URL>

# 进入项目目录 / Navigate to project directory
cd gamepad-tests

# 安装依赖 / Install dependencies
npm install

# 启动开发服务器 / Start development server
npm run dev

# 构建生产版本 / Build for production
npm run build

# 预览生产构建 / Preview production build
npm run preview
```

## 项目结构 / Project Structure

```
src/
├── components/          # React 组件
│   ├── ui/             # shadcn/ui 基础组件
│   └── *.tsx           # 业务组件
├── contexts/           # React Context  providers
├── hooks/              # 自定义 React hooks
├── integrations/       # 第三方集成 (Supabase)
├── lib/                # 工具函数和 i18n 配置
└── pages/              # 页面组件
```

## 测试功能说明 / Testing Features

| 功能 | 说明 |
|------|------|
| 按键测试 | 检测所有按钮是否正常响应 |
| 摇杆测试 | 测试摇杆输入和漂移情况 |
| 震动测试 | 测试手柄震动反馈 |
| 场景震动 | 播放预设震动模式 |
| 延迟测试 | 测量输入响应延迟 |
| 死区测试 | 测试摇杆死区设置 |
| 陀螺仪 | 测试重力感应（支持设备） |
| 稳定性 | 长时间握持检测断连情况 |
| 排名 | 查看社区测试排名 |

## Docker 部署 / Docker Deployment

### 构建镜像 / Build Image

```bash
# 克隆仓库 / Clone the repository
git clone <YOUR_GIT_URL>
cd gamepad-tests

# 构建镜像 / Build image
docker build -t gamepad-tests:latest .
```

### 启动容器 / Run Container

```bash
# 基本启动 / Basic run
docker run -d -p 8080:80 --name gamepad-tests gamepad-tests:latest

# 指定端口 / Specify port
docker run -d -p 3000:80 --name gamepad-tests gamepad-tests:latest

# 挂载配置 / Mount configuration
docker run -d -p 8080:80 -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf --name gamepad-tests gamepad-tests:latest

# 使用主机网络 / Use host network
docker run -d -p 80:80 --name gamepad-tests --network host gamepad-tests:latest

# 完整参数示例 / Full parameters example
docker run -d \
  -p 8080:80 \
  --name gamepad-tests \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  gamepad-tests:latest
```

### 停止和删除 / Stop and Remove

```bash
# 停止容器 / Stop container
docker stop gamepad-tests

# 删除容器 / Remove container
docker rm gamepad-tests

# 删除镜像 / Remove image
docker rmi gamepad-tests:latest
```

### 常见端口 / Common Ports

- **80** - 默认 HTTP 端口 / Default HTTP port
- **8080** - 常用的备用端口 / Common alternate port
- **3001** - WebSocket 端口（C++ 客户端连接）/ WebSocket port (C++ client connection)

### 与 C++ 客户端配合使用 / With C++ Client

如果需要使用原生陀螺仪数据，Docker 部署时需额外映射 WebSocket 端口：

If using native gyroscope data, map the WebSocket port when deploying with Docker:

```bash
docker run -d -p 8080:80 -p 3001:3001 --name gamepad-tests gamepad-tests:latest
```

### 常用参数 / Common Parameters

| 参数 / Parameter | 说明 / Description |
|------------------|-------------------|
| `-p 8080:80` | 将容器 80 端口映射到主机 8080 端口 / Map container port 80 to host port 8080 |
| `-d` | 后台运行 / Run in background |
| `--name gamepad-tests` | 容器名称 / Container name |
| `--network host` | 使用主机网络模式 / Use host network |
| `--restart unless-stopped` | 自动重启策略 / Auto restart policy |
| `-e TZ=Asia/Shanghai` | 设置时区 / Set timezone |

## 安全说明 / Security Notes

- 环境变量文件 (`.env`) 包含敏感凭证，已配置不会被提交到 git
- Supabase 集成使用公开的 anon key，适合客户端使用
- 用户测试数据通过 Row Level Security (RLS) 保护
- 公开排名数据使用独立的视图，不包含敏感信息

## License

Business Source License 1.1 - 非生产用途免费，商业/生产用途需另行获得授权；自 2030-05-29 起转为 Apache License 2.0。详见 [LICENSE](LICENSE) 文件 / Non-production use is allowed; commercial or production use requires separate authorization. The project converts to Apache License 2.0 on 2030-05-29. See [LICENSE](LICENSE) for details.

---

Made with by [@Kezry](https://github.com/kezry)

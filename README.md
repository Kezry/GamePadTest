# Gamepad Tests Pro All

Gamepad Tests Pro All 是一套手柄测试工具组合，包含一个 Web 测试台和一个 Windows 原生采集客户端。Web 端负责按钮、摇杆、震动、延迟、死区、陀螺仪、稳定性和排行榜等测试；Windows 客户端负责从 HID 设备读取更底层的 IMU/陀螺仪数据，并通过本地 WebSocket 提供给 Web 页面使用。

## 项目组成

| 目录 | 说明 |
| --- | --- |
| `gamepad-tests-pro/` | React + Vite Web 应用，面向浏览器的手柄测试与可视化工具 |
| `gamepad-tests-client/` | Windows C++ 原生客户端，读取 HID/IMU 数据并启动 `ws://localhost:3001` |

两个项目可以独立运行，也可以配合使用。只做普通按钮、摇杆、震动和延迟测试时，直接打开 Web 端即可；需要更真实的手柄陀螺仪数据时，先运行 Windows 客户端，再在 Web 端切换到陀螺仪测试。

## Web 项目：gamepad-tests-pro

### 主要能力

- 使用浏览器 Gamepad API 自动检测和轮询手柄。
- 支持按钮、摇杆、震动、震动场景、输入延迟、死区、陀螺仪和连接稳定性测试。
- 支持 Xbox、PlayStation、Nintendo Switch Pro 和通用手柄的类型识别。
- 陀螺仪页面支持多种数据源：浏览器设备传感器、浏览器 GamepadPose/扩展轴、摇杆模拟、本地 C++ 客户端。
- 可将测试记录写入 Supabase，并基于公开视图展示排行榜。
- 支持中英文界面，使用 Tailwind CSS 和 shadcn/ui 组件体系。
- 提供 Docker + Nginx 部署配置。

### 技术栈

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui / Radix UI
- Supabase
- Docker / Nginx

### 本地运行

```bash
cd gamepad-tests-pro
npm install
npm run dev
```

常用命令：

```bash
npm run build
npm run preview
npm run lint
```

### 环境变量

如果需要保存测试记录和排行榜，需要配置 Supabase：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

相关表结构和 RLS 策略位于：

```text
gamepad-tests-pro/supabase/migrations/
```

### Docker 部署

```bash
cd gamepad-tests-pro
docker build -t gamepad-tests-pro:latest .
docker run -d -p 8080:80 --name gamepad-tests-pro gamepad-tests-pro:latest
```

## Windows 客户端：gamepad-tests-client

### 主要能力

- 使用 Windows 原生 HID API 枚举和读取手柄设备。
- 解析 DualShock 4、DualSense、Switch Pro Controller 以及部分 Xbox/通用 HID 报告。
- 读取陀螺仪和加速度计数据，并通过 WebSocket 广播到 `ws://localhost:3001`。
- 支持 Web 端动态调整采样率，服务端会限制最大采样率。
- 支持自动重连、连接健康检查、控制台模式和 GUI 模式。
- 针对 Switch Pro Controller 提供 USB 初始化流程，并包含 HidHide 集成逻辑以改善 Windows 蓝牙访问限制。

### 系统要求

- Windows 10 或更高版本。
- MinGW-w64 或 Visual Studio C++ 工具链。
- 编译时需要 Windows SDK 中的 `setupapi` 和 `hid` 库。

### 编译运行

快速编译示例：

```bash
cd gamepad-tests-client
g++ -std=c++17 -O2 -Wall -I src src/main.cpp src/platform/WindowsHIDDevice.cpp src/network/WebSocketServer.cpp src/utils/HidHideIntegration.cpp src/ui/GaugeWindow.cpp -o gamepad-test-client.exe -lsetupapi -lhid -lws2_32 -lcrypt32 -lgdi32 -lcomctl32
```

运行：

```bash
./gamepad-test-client.exe
```

常用参数：

```bash
./gamepad-test-client.exe --help
./gamepad-test-client.exe --list-devices
./gamepad-test-client.exe --debug
./gamepad-test-client.exe --console
./gamepad-test-client.exe --configure-hidhide
```

仓库中也包含已构建的客户端：

```text
gamepad-tests-client/client/gamepad-test-client.exe
```

## Web 与客户端联动

1. 连接手柄。
2. 启动 `gamepad-tests-client.exe`，客户端会监听 `ws://localhost:3001`。
3. 启动或打开 `gamepad-tests-pro`。
4. 进入陀螺仪测试页。
5. Web 端检测到本地客户端后，会使用客户端数据作为真实陀螺仪数据源。

完整 WebSocket 协议规范见 [WS-PROTOCOL.md](WS-PROTOCOL.md)。

WebSocket 数据格式示例：

```json
{
  "pitch": 0.0,
  "yaw": 0.0,
  "roll": 0.0,
  "ax": 0.0,
  "ay": 0.0,
  "az": 0.0,
  "timestamp": 1706409600000
}
```

Web 端可发送采样率调整命令：

```json
{
  "type": "setSampleRate",
  "sampleRate": 120
}
```

## 兼容性说明

- Chrome/Edge 等 Chromium 浏览器对 Gamepad API 和震动支持通常最好。
- Safari 和 Firefox 的手柄、震动或传感器能力可能受浏览器实现限制。
- Switch Pro Controller 在 Windows 蓝牙模式下可能无法直接暴露完整 IMU 数据，这是 Windows 蓝牙 HID 栈限制；USB 模式通常更可靠。
- HidHide 相关能力需要用户自行安装驱动并按提示配置，涉及管理员权限。

## 仓库结构

```text
.
├── gamepad-tests-pro/
│   ├── src/
│   ├── supabase/
│   ├── Dockerfile
│   └── package.json
├── gamepad-tests-client/
│   ├── src/
│   ├── client/
│   └── resources/
├── LICENSE
└── README.md
```

## 许可协议

本仓库采用 **Business Source License 1.1 (BUSL-1.1 / BSL 1.1)**。

允许非生产用途、个人学习、教育、研究、评估和本地测试；生产环境、商业分发、托管服务、SaaS、付费支持、嵌入商业产品或其他商业使用，需要另行获得版权所有者的商业授权。自 `2030-05-29` 起，本项目将按 **Apache License 2.0** 授权。

详见 [LICENSE](LICENSE)。

## 免责声明

本项目会枚举和读取本机 HID 手柄设备，用于手柄输入、陀螺仪和加速度计测试。请只在你拥有或被授权测试的设备上使用。项目按“现状”提供，不承诺适用于任何特定用途，也不对设备、驱动、系统或数据损失承担责任。

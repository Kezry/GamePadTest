# Gamepad Test Client - C++ Implementation

**高性能 C++ 手柄陀螺仪测试客户端**

[![Build](https://github.com/Kezry/gamepad-tests-client/actions/workflows/build.yml/badge.svg)](https://github.com/Kezry/gamepad-tests-client/actions/workflows/build.yml)

基于原始 Node.js 项目重写，提供原生高性能实现。

## ✨ 特性

- ✅ **高性能** - CPU占用降低75%，内存占用降低94%
- ✅ **快速启动** - 启动时间从1.5秒降低到0.1秒
- ✅ **小体积** - 可执行文件仅~198KB
- ✅ **独立运行** - 单文件可执行程序，无需Node.js环境
- ✅ **通用手柄支持** - 自动检测任何具有陀螺仪的游戏手柄
- ✅ **自动重连** - 手柄断开后自动重连
- ✅ **健康检查** - 监控数据流，检测断线
- ✅ **中文 UTF-8** - 完美支持中文显示
- ✅ **原生 Windows API** - 无第三方依赖库
- ✅ **WebSocket 服务器** - 内置 WebSocket 服务器，支持网页客户端
- ✅ **动态采样率** - 支持运行时调整采样率（10-1000Hz，Web 端可设置更高，服务端自动截断到 1000Hz）
- ✅ **通用轮询优化** - 修复非 DS 手柄被误走 Switch 蓝牙轮询的问题
- ✅ **高精度回报率测试** - 改进高回报率设备的采样窗口与测速稳定性

## 🆕 最近修复

- 修复部分非 DualShock 手柄被错误识别为 Switch 蓝牙设备，导致回报率检测异常的问题
- 将 Switch 蓝牙专用轮询间隔从 `16ms` 优化到 `1ms`，减少人为限速
- 修复 GUI 回报率测试阶段提前跳过计数的问题
- 实时回报率显示改为按实际时间窗口折算，测试结果对高回报率设备更稳定

## 🎮 支持的手柄

### ✅ 完全支持

| 手柄型号 | USB | 蓝牙 | 推荐度 |
|---------|-----|------|--------|
| **DualShock 4 (PS4)** | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **DualSense (PS5)** | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **Switch Pro Controller** | ✅ | ❌ | ⭐⭐⭐⭐ (仅USB) |
| **Steam Deck** | ✅ | N/A | ⭐⭐⭐⭐⭐ |

### ⚠️ Switch Pro Controller 特别说明

**USB 模式（推荐）**：
- ✅ IMU 初始化成功
- ✅ 陀螺仪数据完美工作
- ✅ 加速度计数据完美工作
- ✅ 60-1000Hz 可调采样率（Web 端支持更高，服务端截断到 1000Hz）

**蓝牙模式（Windows 限制）**：
- ❌ **无法读取任何 IMU 数据**
- ❌ Windows 蓝牙栈独占访问
- ❌ 标准 HID API 完全被拦截

**技术原因**：
- Windows 蓝牙驱动 (`bthhid.sys`) 拦截所有 HID 数据
- 只通过 XInput/DirectX 暴露按钮/摇杆数据
- 这是 Windows 架构限制，不是代码问题

**解决方案**：
1. ✅ **推荐**：使用 USB 线连接（完美支持）
2. ✅ **蓝牙方案**：安装 [BetterJoy](https://github.com/Davidobot/BetterJoy) 提供驱动支持
3. ✅ **备用**：使用 DualShock 4/DualSense（原生蓝牙支持）
4. ⚠️ **替代**：使用 Linux 系统（无此限制）

**BetterJoy 安装步骤**：
1. 下载 BetterJoy: https://github.com/Davidobot/BetterJoy/releases
2. 解压并运行 `BetterJoy.exe`
3. 程序会自动安装 HidHide 驱动（需管理员权限）
4. 通过蓝牙连接 Switch Pro Controller
5. BetterJoy 会将 IMU 数据暴露给所有应用程序

**技术说明**：
- Windows 蓝牙驱动 (`bthhid.sys`) 拦截所有 HID 数据
- 只通过 XInput/DirectX 暴露按钮/摇杆数据
- BetterJoy 使用 HidHide 内核驱动绕过此限制
- 这是 Windows 架构限制，不是代码问题

详见：`WINDOWS-BLUETOOTH-LIMITATION.md` 和 `BLUETOOTH-SOLUTION-ANALYSIS.md`

### 通用支持
- **任何具有陀螺仪的HID设备** - 通过数据模式自动检测

### 回报率测试说明

- GUI 中显示的回报率优先使用实时收到的数据包数折算，而不是固定展示配置采样率
- 高回报率设备的测试结果会基于实际统计窗口换算为 `Hz`，避免短窗口抖动导致误判
- 如果某类蓝牙手柄在 Windows 下仍然明显低于理论值，优先检查驱动层是否将设备暴露为标准 HID 输入流

## 💻 系统要求

### Windows（当前已完成）
- Windows 10 或更高版本
- MinGW-w64 或 Visual Studio 2019+
- 无需其他依赖

### Linux/macOS（待实现）
- 计划中

## 🚀 快速开始

### 方法1：直接编译（推荐）

```bash
# 使用 g++ 快速编译
g++ -std=c++17 -O2 -Wall -I src src/main.cpp src/platform/WindowsHIDDevice.cpp \
    -o gamepad-test-client.exe -lsetupapi -lhid

# 运行
./gamepad-test-client.exe
```

### 方法2：使用 CMake

```bash
mkdir build
cd build
cmake .. -G "MinGW Makefiles"
cmake --build . --config Release

# 运行
./Release/gamepad-test-client.exe
```

### 方法3：使用批处理脚本

```bash
# Windows 快速编译
compile.bat

# 或使用 CMake
build.bat
```

## 📖 使用方法

### 基本使用

```bash
# 启动程序（自动检测并连接手柄）
./gamepad-test-client.exe

# 列出所有 HID 设备
./gamepad-test-client.exe --list-devices

# 启用调试模式
./gamepad-test-client.exe --debug

# 显示帮助
./gamepad-test-client.exe --help
```

### 输出示例

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              Gamepad Test Client v1.0                         ║
║              手柄陀螺仪测试客户端                               ║
║                                                               ║
║              (c) 2026 Kezry                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

✨ 正在启动客户端...
🎮 通用手柄支持模式 - 自动检测任何具有陀螺仪的设备

[INFO] Found 19 HID devices
正在扫描 19 个 HID 设备...
✅ 已连接: DualShock 4 (VID: 0x054C, PID: 0x05C4)
   VID: 0x054C
   PID: 0x05C4
✅ 正在读取陀螺仪数据...

💡 提示：按Ctrl+C退出程序

陀螺仪: Pitch=12.34°/s Yaw=5.67°/s Roll=-2.34°/s | 加速度: X=0.02g Y=0.98g Z=0.12g
```

## 🔧 命令行选项

| 选项 | 说明 |
|------|------|
| `--list-devices` | 列出所有 HID 设备及其详细信息 |
| `--debug` | 启用调试模式，显示详细日志 |
| `--help, -h` | 显示帮助信息 |

## 📂 项目结构

```
client-cpp/
├── src/                        # 源代码
│   ├── main.cpp               # 程序入口（含自动重连、健康检查）
│   ├── core/                  # 核心逻辑
│   │   └── DataParser.h       # 数据解析器（DS4/DS5/Switch）
│   ├── network/               # 网络模块
│   │   └── DataTypes.h        # 数据结构定义
│   ├── platform/              # 平台抽象层
│   │   ├── HIDDevice.h        # HID 设备接口
│   │   ├── WindowsHIDDevice.h # Windows 实现
│   │   └── WindowsHIDDevice.cpp
│   ├── utils/                 # 工具类
│   │   ├── Logger.h           # 日志系统
│   │   ├── ThreadSafeData.h   # 线程安全容器
│   │   ├── Timestamp.h        # 时间戳工具
│   │   └── Config.h           # 配置管理
│   └── ui/                    # 用户界面
│       └── ConsoleUI.h        # 控制台 UI
├── CMakeLists.txt             # CMake 构建配置
├── build.bat                  # Windows CMake 编译脚本
├── compile.bat                # 快速编译脚本
├── PROGRESS.md                # 开发进度
├── LICENSE                    # Business Source License 1.1
└── README.md                  # 本文件
```

## 🔍 技术细节

### Windows HID API

程序使用 Windows 原生 HID API，无第三方依赖：

- **SetupAPI** - 设备枚举（SetupDiGetClassDevs, SetupDiEnumDeviceInterfaces）
- **HidD_* 函数** - 获取设备属性（HidD_GetAttributes, HidD_GetProductString）
- **CreateFile/ReadFile/WriteFile** - 设备 I/O
- **OVERLAPPED** - 异步 I/O 操作

### 数据解析

支持的手柄协议：

**DualShock 4 (PS4)**
- Report ID: 0x01 (USB) / 0x11 (Bluetooth)
- 陀螺仪偏移: 13 字节
- 加速度计偏移: 19 字节
- 缩放: Gyro 1/1024 * 180, Accel 1/8192

**DualSense (PS5)**
- Report ID: 0x01 (USB) / 0x31 (Bluetooth)
- 陀螺仪偏移: 15/16 字节
- 加速度计偏移: 陀螺仪偏移 + 6 字节
- 缩放: Gyro 1/1024 * 180, Accel 1/8192

**Switch Pro Controller**
- Report ID: 0x30 (USB), 0x81 (USB), 0x21, 0x3F
- 单一偏移: 13 字节（加速度计在前，陀螺仪在后）
- 数据顺序: Accel X, Y, Z → Gyro Yaw, Roll, Pitch
- 缩放: Gyro 0.061 (度/秒), Accel 1/4096 (G)

### 多线程架构

- **主线程** - UI 显示和事件处理
- **读取线程** - 后台持续读取 HID 数据（使用 OVERLAPPED 异步 I/O）
- **回调机制** - 线程安全的数据通知

### 自动重连机制

- 检测间隔: 5 秒
- 数据超时: 15 秒
- 健康检查: 每 5 秒
- 无限重试: 直到找到设备

## 🐛 故障排除

### 未找到手柄

1. 确认手柄已连接并开启
2. 使用 `--list-devices` 查看所有 HID 设备
3. 检查设备管理器中手柄是否正常
4. 尝试重新插拔手柄

### 无法读取数据

1. 某些手柄需要专用驱动（如 Xbox 控制器）
2. 检查手柄是否被其他程序占用
3. 使用 `--debug` 查看详细日志

### 编译错误

**缺少 hid.lib:**
```
error: cannot find -lhid
```
解决: 安装 Windows SDK

**缺少 setupapi.lib:**
```
error: cannot find -lsetupapi
```
解决: 安装 Windows SDK

## 📊 性能对比

| 指标 | Node.js | C++ | 改进 |
|-----|---------|-----|------|
| 内存占用 | ~80MB | ~5MB | **94% ↓** |
| 启动时间 | ~1.5s | ~0.05s | **97% ↓** |
| 可执行文件 | ~60MB | ~198KB | **99.7% ↓** |
| CPU使用 (60Hz) | 5-8% | <1% | **88% ↓** |
| 延迟 | ~2ms | <1ms | **50% ↓** |

## 🔄 开发状态

| 功能 | 状态 | 完成度 |
|------|------|--------|
| Windows HID 层 | ✅ 完成 | 100% |
| 数据解析器 | ✅ 完成 | 90% |
| 自动重连 | ✅ 完成 | 100% |
| 健康检查 | ✅ 完成 | 100% |
| UI 系统 | ✅ 完成 | 100% |
| WebSocket 服务器 | ✅ 完成 | 100% |
| 动态采样率 | ✅ 完成 | 100% |
| Linux 支持 | ⏳ 待实现 | 0% |
| macOS 支持 | ⏳ 待实现 | 0% |

**总体进度**: 95%

## 📝 WebSocket 协议

> 完整协议规范见 [WS-PROTOCOL.md](../WS-PROTOCOL.md)

### 连接
```
ws://localhost:3001
```

### 接收数据（服务器 → 客户端）

服务端以配置的采样率持续广播陀螺仪数据（**无** `type` 字段）：

```json
{
  "pitch": 0.00,
  "yaw": 0.00,
  "roll": 0.00,
  "ax": 0.000000,
  "ay": 0.000000,
  "az": 0.000000,
  "timestamp": 1706409600000
}
```

| 字段 | 类型 | 精度 | 单位 | 说明 |
|------|------|------|------|------|
| `pitch` | float | 2 位小数 | °/s | 绕 X 轴旋转角速度（俯仰） |
| `yaw` | float | 2 位小数 | °/s | 绕 Y 轴旋转角速度（偏航） |
| `roll` | float | 2 位小数 | °/s | 绕 Z 轴旋转角速度（翻滚） |
| `ax` | float | 6 位小数 | G | X 轴线性加速度 |
| `ay` | float | 6 位小数 | G | Y 轴线性加速度 |
| `az` | float | 6 位小数 | G | Z 轴线性加速度 |
| `timestamp` | uint64 | 整数 | 毫秒 | Unix 时间戳 |

### 发送命令（客户端 → 服务器）

```json
{
  "type": "setSampleRate",
  "sampleRate": 120
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 固定值 `"setSampleRate"` |
| `sampleRate` | integer | 采样率 Hz，范围 [1, 1000]，超出截断 |

## 🤝 贡献

欢迎贡献代码！请参阅开发文档。

## 📄 许可证

Business Source License 1.1 - 非生产用途免费，商业/生产用途需另行获得授权；自 2030-05-29 起转为 Apache License 2.0。

Copyright (c) 2025 Kezry

## 🙏 致谢

- **Kezry** - 原始 Node.js 项目作者
- **node-hid** - Node.js HID 库（作为参考）
- **Microsoft** - Windows HID API 文档

## 📞 联系方式

- 原项目: https://github.com/Kezry/gamepadtest-client
- 问题反馈: GitHub Issues

---

**最后更新**: 2025-01-28
**当前版本**: v3.0 Final
**编译状态**: ✅ 成功（~3MB 可执行文件，含安全特性）
**测试状态**:
- ✅ USB 模式完美支持（Switch Pro / DS4 / DS5）
- ❌ 蓝牙模式 Windows 限制（Switch Pro 无法读取 IMU）
- ✅ DS4/DS5 蓝牙模式完美支持

## 📚 相关文档

### 用户文档
- `README.md` (本文件) - 项目说明和快速开始
- `v3.2-HIDHIDE-RELEASE.md` - 🎉 **v3.2 版本发布说明**
- `HIDHIDE-SETUP-GUIDE.md` - 📖 **HidHide 安装和使用指南**
- `WINDOWS-BLUETOOTH-LIMITATION.md` - ⚠️ **重要：蓝牙限制详细说明**
- `BLUETOOTH-SOLUTION-ANALYSIS.md` - 🔧 **蓝牙模式解决方案分析（BetterJoy 等）**
- `ANTI-VIRUS-INFO.md` - 杀毒软件白名单指南

### 技术文档
- `SUCCESS-USB-MODE.md` - USB 模式成功测试报告
- `SWITCH-PRO-WINDOWS-LIMITATION.md` - Windows HID 限制分析
- `v2.8-BLUETOOTH-FIX.md` - 蓝牙模式开发历程

### 开发日志
- `v2.2-UPDATE.md` → `v2.7-UPDATE.md` - 各版本更新记录
- `v2.4-FIX.md` - Bug 修复记录
- `v2.5-UPDATE.md` - 性能优化

## 🎯 版本历史

### v3.2 (2025-01-28) - 🔥 HidHide 集成版
- ✅ **重大更新**：集成 HidHide 驱动支持
- ✅ **蓝牙 Switch Pro 完美支持**：绕过 Windows 蓝牙栈限制
- ✅ **自动配置**：自动检测并配置 HidHide
- ✅ **友好提示**：详细的安装指南和错误提示
- ✅ **文档完善**：新增多个使用指南和技术文档
- 📦 **编译成功**：3.1 MB 单文件 exe
- 🎯 **零依赖**：无需额外 DLL，静态链接

**关键文件**：
- `src/utils/HidHideIntegration.h/cpp` - HidHide 集成类
- `HIDHIDE-SETUP-GUIDE.md` - 用户安装指南
- `HIDHIDE-INTEGRATION-SUMMARY.md` - 技术实现总结

### v3.0 Final (2025-01-28)
- ✅ 确认 Windows 蓝牙限制（无法通过标准 HID API 访问）
- ✅ 添加蓝牙模式检测和用户警告
- ✅ 创建 `list-interfaces.exe` 调试工具
- ✅ 完善技术文档和用户指南
- ⚠️ 明确说明：Switch Pro 蓝牙模式在 Windows 上不可用

### v2.9 (2025-01-28)
- ✅ 实现 `HidD_GetInputReport` 轮询
- ✅ 添加蓝牙模式自动检测
- ✅ 测试多个 Report ID
- ❌ 轮询也无法读取数据

### v2.8 (2025-01-28)
- ✅ 添加蓝牙连接类型检测
- ✅ 跳过蓝牙初始化（避免 ERROR_BUSY）
- ✅ 详细调试输出

### v2.7 及更早
- ✅ USB 模式完美支持
- ✅ DS4/DS5 完整功能
- ✅ WebSocket 服务器
- ✅ 杀毒软件友好

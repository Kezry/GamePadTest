# Gamepad Test Client - 陀螺仪测试

陀螺仪测试客户端使用文档 / Gyroscope Testing Client Documentation

<!-- License: MIT -->
<!-- Author: @Kezry -->

## 功能概述 / Overview

陀螺仪测试模块是一个专业的游戏手柄陀螺仪诊断工具，支持多种数据源、实时校准和 3D 可视化。

The gyroscope testing module is a professional gamepad gyroscope diagnostic tool that supports multiple data sources, real-time calibration, and 3D visualization.

## 数据源类型 / Data Sources

### 1. 客户端陀螺仪 (Client)
通过 WebSocket 连接本地客户端，获取原生陀螺仪数据。

Connect to a local client via WebSocket to retrieve native gyroscope data.

### 2. 设备陀螺仪 (Device)
使用浏览器的 DeviceMotion API，从移动设备获取陀螺仪数据。

Uses the browser's DeviceMotion API to retrieve gyroscope data from mobile devices.

### 3. 手柄陀螺仪 (Gamepad)
使用 GamepadPose API，从支持陀螺仪的游戏手柄获取数据。

Uses the GamepadPose API to retrieve data from gyro-enabled gamepads.

### 4. 摇杆模拟 (Joystick)
使用摇杆数据模拟陀螺仪旋转，作为备用方案。

Uses joystick data to simulate gyroscope rotation as a fallback option.

## 支持的手柄类型 / Supported Gamepads

| 手柄型号 / Controller | 陀螺仪支持 / Gyro Support | API 类型 / API Type |
|----------------------|--------------------------|---------------------|
| Xbox Controller | ❌ 不支持 | 标准游戏手柄 API |
| DualSense (PS5) | ✅ 支持 | GamepadPose API |
| DualShock 4 (PS4) | ✅ 支持 | GamepadPose API |
| Nintendo Switch Pro | ✅ 支持 | GamepadPose API |

## 数据格式 / Data Format

```typescript
interface GyroData {
  pitch: number;    // X轴旋转角速度 (°/s) / X-axis angular velocity
  yaw: number;      // Y轴旋转角速度 (°/s) / Y-axis angular velocity
  roll: number;     // Z轴旋转角速度 (°/s) / Z-axis angular velocity
  ax: number;       // X轴加速度 (G) / X-axis acceleration
  ay: number;       // Y轴加速度 (G) / Y-axis acceleration
  az: number;       // Z轴加速度 (G) / Z-axis acceleration
  timestamp: number; // Unix 时间戳 (毫秒) / Unix timestamp (ms)
}
```

## 坐标系定义 / Coordinate System

采用右手坐标系：
- **X轴**: 向前 (Forward)
- **Y轴**: 向右 (Right)
- **Z轴**: 向上 (Up)

Right-hand coordinate system:
- **X-axis**: Forward
- **Y-axis**: Right
- **Z-axis**: Up

## 功能特性 / Features

### 核心功能

- 🎯 **自动检测** - 连接设备后自动识别最佳数据源
- 📊 **实时可视化** - 3D 立方体实时显示姿态
- 🔄 **一键校准** - 快速消除零点漂移
- ⚙️ **可调参数** - 灵活配置采样率和死区
- 🔗 **WebSocket 支持** - 连接本地客户端获取原生数据

### 配置参数

| 参数 / Parameter | 默认值 / Default | 说明 / Description |
|------------------|------------------|-------------------|
| `sampleRate` | 60 Hz | 数据采样率 / Data sampling rate |
| `gyroDeadzone` | 0.5 | 死区阈值，减少抖动 / Deadzone threshold to reduce jitter |
| `calibrationOffset` | `{0,0,0}` | 校准偏移量 / Calibration offset |

### 摇杆映射规则 / Joystick Mapping

当使用摇杆模拟时：
- 左摇杆 Y (Left Stick Y) → Pitch
- 左摇杆 X (Left Stick X) → Yaw
- 右摇杆 X (Right Stick X) → Roll

When using joystick simulation:
- Left Stick Y → Pitch
- Left Stick X → Yaw
- Right Stick X → Roll

## 使用指南 / Usage Guide

### 1. 启动测试 / Starting the Test

1. 连接游戏手柄或移动设备到电脑
2. 打开应用，切换到"陀螺仪"测试标签页
3. 系统将自动检测并选择最佳数据源

1. Connect your gamepad or mobile device to your computer
2. Open the app and switch to the "Gyroscope" testing tab
3. The system will automatically detect and select the best data source

### 2. 校准陀螺仪 / Calibrating the Gyroscope

在使用陀螺仪前，建议进行校准以消除零点漂移：

1. 将手柄/设备放置在平稳的水平面上
2. 点击"校准"按钮
3. 等待约 1 秒完成校准
4. 校准完成后，系统会自动应用偏移量补偿

Before using the gyroscope, it's recommended to calibrate to eliminate zero drift:

1. Place the gamepad/device on a stable, level surface
2. Click the "Calibrate" button
3. Wait approximately 1 second for calibration to complete
4. After calibration, the system will automatically apply offset compensation

### 3. 调整参数 / Adjusting Parameters

根据实际需求调整采样率和死区：

- **提高采样率**: 获得更流畅的显示，但增加 CPU 负载
- **增大死区**: 减少抖动，但降低小动作的灵敏度
- **减小死区**: 提高小动作的灵敏度，但可能增加抖动

Adjust the sample rate and deadzone based on your needs:

- **Increase sample rate**: Smoother display, but higher CPU load
- **Increase deadzone**: Reduced jitter, but lower sensitivity to small movements
- **Decrease deadzone**: Higher sensitivity to small movements, but potentially more jitter

### 4. 切换数据源 / Switching Data Sources

如果自动检测的数据源不符合需求，可以手动切换：

1. 点击数据源选择下拉框
2. 选择需要的数据源类型
3. 系统将切换到新的数据源

If the auto-detected data source doesn't meet your needs, you can manually switch:

1. Click the data source selection dropdown
2. Choose the desired data source type
3. The system will switch to the new data source

## WebSocket 客户端接口 / WebSocket Client Interface

如果使用客户端陀螺仪数据源，需要启动本地 C++ 客户端（`gamepad-test-client.exe`），它会自动启动 WebSocket 服务器。

If using the client gyroscope data source, you need to start the local C++ client (`gamepad-test-client.exe`), which automatically starts a WebSocket server.

### 连接配置 / Connection Configuration

- **默认地址**: `ws://localhost:3001`
- **支持重连**: 自动重连，间隔 3 秒
- **最大客户端数**: 100

- **Default address**: `ws://localhost:3001`
- **Auto-reconnect**: Automatic reconnection, 3-second interval
- **Max clients**: 100

### 完整协议规范 / Full Protocol Specification

详见项目根目录：[WS-PROTOCOL.md](../WS-PROTOCOL.md)

See project root: [WS-PROTOCOL.md](../WS-PROTOCOL.md)

### 服务端发送：陀螺仪数据 / Server Sends: Gyroscope Data

服务端以配置的采样率持续广播陀螺仪数据（**无** `type` 字段）：

The server continuously broadcasts gyroscope data at the configured sample rate (**no** `type` field):

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

| 字段 / Field | 类型 / Type | 精度 / Precision | 单位 / Unit | 说明 / Description |
|------|------|------|------|------|
| `pitch` | float | 2 位小数 | °/s | 绕 X 轴旋转角速度 / X-axis angular velocity |
| `yaw` | float | 2 位小数 | °/s | 绕 Y 轴旋转角速度 / Y-axis angular velocity |
| `roll` | float | 2 位小数 | °/s | 绕 Z 轴旋转角速度 / Z-axis angular velocity |
| `ax` | float | 6 位小数 | G | X 轴加速度 / X-axis acceleration |
| `ay` | float | 6 位小数 | G | Y 轴加速度 / Y-axis acceleration |
| `az` | float | 6 位小数 | G | Z 轴加速度 / Z-axis acceleration |
| `timestamp` | uint64 | 整数 | 毫秒 | Unix 时间戳 / Unix timestamp (ms) |

### 客户端发送：设置采样率 / Client Sends: Set Sample Rate

Web 端可发送采样率调整命令（仅在值变化时发送）：

Web can send a sample rate adjustment command (sent only when the value changes):

```json
{
  "type": "setSampleRate",
  "sampleRate": 120
}
```

| 字段 / Field | 类型 / Type | 必填 / Required | 说明 / Description |
|------|------|------|------|
| `type` | string | 是 / Yes | 固定值 `"setSampleRate"` / Fixed value `"setSampleRate"` |
| `sampleRate` | integer | 是 / Yes | 采样率 Hz，范围 [1, 1000]，超出截断 / Rate in Hz, range [1, 1000], clamped |

## 技术实现 / Technical Implementation

### 核心文件 / Core Files

| 文件 / File | 说明 / Description |
|-------------|-------------------|
| `src/components/GyroscopeTester.tsx` | 陀螺仪测试主组件 |
| `src/hooks/useGamepad.ts` | 游戏手柄状态管理和类型检测 |
| `src/components/TestingTabs.tsx` | 测试标签页管理 |

### GamepadPose API 读取 / GamepadPose API Reading

```typescript
// 获取角速度数据
const pose = gamepad.pose;
if (pose.angularVelocity) {
  const [vx, vy, vz] = pose.angularVelocity;
  // 转换为度/秒
  pitch = ((vx * 180) / Math.PI) * 10;
  yaw = ((vy * 180) / Math.PI) * 10;
  roll = ((vz * 180) / Math.PI) * 10;
}
```

### 扩展轴读取 / Extended Axes Reading

某些手柄通过扩展轴提供陀螺仪数据：

```typescript
if (gamepad.axes.length > 4) {
  pitch = gamepad.axes[4] * 180;   // 轴 4: Pitch
  yaw = gamepad.axes[5] * 180;     // 轴 5: Yaw
  roll = gamepad.axes[6] * 180;    // 轴 6: Roll
  ax = gamepad.axes[7] || 0;       // 轴 7: 加速度 X
  ay = gamepad.axes[8] || 0;       // 轴 8: 加速度 Y
  az = gamepad.axes[9] || 0;       // 轴 9: 加速度 Z
}
```

## 常见问题 / FAQ

### Q: 为什么手柄显示的陀螺仪数据不准确？

A: 可能的原因：
1. 手柄不支持陀螺仪（如 Xbox 手柄）
2. 浏览器不支持 GamepadPose API
3. 需要使用蓝牙连接而不是 USB
4. 陀螺仪未校准

### Q: 如何验证手柄是否支持陀螺仪？

A: 查看设备信息面板，如果显示 "Gyro: 支持" 或类似标记，则说明支持。

### Q: 摇杆模拟和真实陀螺仪有什么区别？

A:
- 摇杆模拟: 通过摇杆移动模拟旋转，无加速度数据
- 真实陀螺仪: 直接读取角速度和加速度，更精确

### Q: WebSocket 连接失败怎么办？

A:
1. 确认本地 WebSocket 服务已启动
2. 检查防火墙设置
3. 确认端口号配置正确
4. 查看浏览器控制台错误信息

### Q: Why is the gyroscope data displayed by the gamepad inaccurate?

A: Possible reasons:
1. The gamepad doesn't support gyroscope (e.g., Xbox controller)
2. Browser doesn't support GamepadPose API
3. Need to use Bluetooth connection instead of USB
4. Gyroscope not calibrated

### Q: How to verify if a gamepad supports gyroscope?

A: Check the device info panel. If it shows "Gyro: Supported" or similar, it means gyroscope is supported.

### Q: What's the difference between joystick simulation and real gyroscope?

A:
- Joystick simulation: Simulates rotation through joystick movement, no acceleration data
- Real gyroscope: Directly reads angular velocity and acceleration, more accurate

### Q: What to do if WebSocket connection fails?

A:
1. Ensure local WebSocket service is running
2. Check firewall settings
3. Confirm port number is configured correctly
4. Check browser console error messages

## 浏览器兼容性 / Browser Compatibility

| 浏览器 / Browser | GamepadPose | DeviceMotion | 备注 / Notes |
|------------------|-------------|--------------|--------------|
| Chrome 90+ | ✅ | ✅ | 推荐 / Recommended |
| Firefox 90+ | ✅ | ⚠️ 部分支持 | 可能需要权限 |
| Edge 90+ | ✅ | ✅ | 推荐 / Recommended |
| Safari 15+ | ⚠️ 有限 | ✅ | 需要用户授权 |

## 许可证 / License

MIT License - 详见 [LICENSE](LICENSE) 文件 / See [LICENSE](LICENSE) file for details

---

Made with ❤️ by [@Kezry](https://github.com/kezry)

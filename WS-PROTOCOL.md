# WebSocket 协议接口规范

WebSocket Protocol Interface Specification

> 本文档定义 **gamepad-tests-client**（C++ WebSocket Server）与 **gamepad-tests-pro**（React/TS WebSocket Client）之间的通信协议。  
> 两个模块的所有 WebSocket 交互**必须**以此文档为准。

---

## 1. 协议概述

| 项目 | 值 |
|------|-----|
| 传输协议 | WebSocket (RFC 6455) over TCP |
| 默认地址 | `ws://localhost:3001` |
| 绑定地址 | `0.0.0.0`（所有网络接口） |
| 子协议 | 无 |
| TLS / WSS | 不支持（明文传输） |
| 消息编码 | UTF-8 JSON Text Frame（opcode `0x01`） |
| 消息封装 | 无 envelope 包装，直接发送裸 JSON 对象 |
| 心跳机制 | 无应用层心跳（依赖 WebSocket 协议层 ping/pong） |
| 认证机制 | 无 |

---

## 2. 连接参数

### 2.1 服务端常量

| 常量 | 值 | 定义位置 |
|------|-----|---------|
| `WS_PORT` | `3001` | `WebSocketServer.h:77`, `main.cpp:248/566` |
| `MAX_CLIENT_COUNT` | `100` | `WebSocketServer.h:45` |
| `MAX_SAMPLE_RATE` | `1000` Hz | `WebSocketServer.h:46` |
| `DEFAULT_SAMPLE_RATE` | `60` Hz | `WebSocketServer.h:47` |
| `THREAD_POOL_SIZE` | `8` | `WebSocketServer.h:214` |
| TCP 选项 | `TCP_NODELAY` (禁用 Nagle) | `WebSocketServer.cpp:268` |

### 2.2 客户端连接行为

| 行为 | 值 | 定义位置 |
|------|-----|---------|
| 连接地址 | `ws://localhost:3001`（硬编码） | `GyroscopeTester.tsx:128` |
| 自动重连间隔 | 3000 ms | `GyroscopeTester.tsx:177` |
| 重连策略 | 断线后自动重试，无限次 | `GyroscopeTester.tsx:175-178` |
| 连接成功后行为 | 自动切换到 "client" 数据源（除非用户手动选择过其他源） | `GyroscopeTester.tsx:134` |

---

## 3. 消息格式约定

- 所有消息为 **UTF-8 编码的 JSON 文本帧**
- WebSocket 帧头使用 FIN=1, opcode=0x01（Text Frame）
- 消息无通用 envelope 包装，字段直接位于 JSON 顶层
- 浮点数精度：陀螺仪数据 2 位小数，加速度数据 6 位小数
- 时间戳为无符号 64 位整数（毫秒）

---

## 4. 消息类型总览

| 方向 | 消息类型 | `type` 字段 | 状态 |
|------|---------|-------------|------|
| Server → Client | 陀螺仪数据 | **无** `type` 字段 | 已实现 |
| Client → Server | 设置采样率 | `"setSampleRate"` | 已实现 |
| Server → Client | 错误消息 | `"error"` | **仅定义，未实现** |
| Server → Client | 成功消息 | `"success"` | **仅定义，未实现** |
| Server → Client | 初始化消息 | `"init"` | **仅定义，未实现** |

> `MessageType` 枚举在 `DataTypes.h:122-128` 中定义了 GYRO_DATA、SET_SAMPLE_RATE、ERROR、SUCCESS、INIT 五个值，但 ERROR、SUCCESS、INIT 在代码中从未被发送或处理。

---

## 5. Server → Client：陀螺仪数据

### 5.1 触发条件

服务端以配置的采样率持续广播数据到所有已连接的 WebSocket 客户端。广播由 HID 数据回调触发，内部通过时间戳节流：

```
interval = 1000 / sampleRate (毫秒)
仅当 now - lastBroadcastTime >= interval 时发送
```

### 5.2 JSON 格式

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

> **注意**：此消息**没有** `type` 字段。服务端只发送这一种消息，客户端通过 JSON 结构识别。

### 5.3 字段定义

| 字段 | 类型 | 精度 | 单位 | 说明 |
|------|------|------|------|------|
| `pitch` | float | 2 位小数 (`%.2f`) | °/s（度/秒） | 绕 X 轴旋转角速度（俯仰） |
| `yaw` | float | 2 位小数 (`%.2f`) | °/s（度/秒） | 绕 Y 轴旋转角速度（偏航） |
| `roll` | float | 2 位小数 (`%.2f`) | °/s（度/秒） | 绕 Z 轴旋转角速度（翻滚） |
| `ax` | float | 6 位小数 (`%.6f`) | G（重力加速度） | X 轴线性加速度 |
| `ay` | float | 6 位小数 (`%.6f`) | G（重力加速度） | Y 轴线性加速度 |
| `az` | float | 6 位小数 (`%.6f`) | G（重力加速度） | Z 轴线性加速度 |
| `timestamp` | uint64 | 整数 | 毫秒（Unix 时间戳） | 数据采集时间戳 |

### 5.4 C++ 序列化格式

```cpp
// WebSocketServer.cpp:148-156
snprintf(buffer, sizeof(buffer),
    "{\"pitch\":%.2f,\"yaw\":%.2f,\"roll\":%.2f,"
     "\"ax\":%.6f,\"ay\":%.6f,\"az\":%.6f,"
     "\"timestamp\":%llu}",
    pitch, yaw, roll, ax, ay, az, timestamp);
```

### 5.5 C++ 数据结构

```cpp
// DataTypes.h:34-69
struct GyroData {
    float pitch;        // 俯仰角 (度/秒), 绕 X 轴
    float yaw;          // 偏航角 (度/秒), 绕 Y 轴
    float roll;         // 翻滚角 (度/秒), 绕 Z 轴
    float ax;           // 加速度 X (G)
    float ay;           // 加速度 Y (G)
    float az;           // 加速度 Z (G)
    uint64_t timestamp; // Unix 时间戳 (毫秒)
};
```

### 5.6 客户端接收与处理

```typescript
// GyroscopeTester.tsx:141-158
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  clientDataRef.current = {
    pitch: data.pitch || 0,
    yaw: data.yaw || 0,
    roll: data.roll || 0,
    ax: data.ax || 0,
    ay: data.ay || 0,
    az: data.az || 0,
    // 注意: timestamp 字段存在于 JSON 中但未被客户端消费
  };
};
```

### 5.7 客户端轴映射

Web 端在显示时会对从 "client" 数据源接收的陀螺仪轴进行重映射：

| Web 显示轴 | 来源字段 | 说明 |
|-----------|---------|------|
| Pitch (X) | `clientDataRef.roll` | 客户端 roll → 显示 Pitch |
| Yaw (Y) | `clientDataRef.pitch` | 客户端 pitch → 显示 Yaw |
| Roll (Z) | `clientDataRef.yaw` | 客户端 yaw → 显示 Roll |

> 映射代码见 `GyroscopeTester.tsx:362-365`。

---

## 6. Client → Server：设置采样率

### 6.1 触发条件

当 Web UI 的采样率控件值变化、且 WebSocket 连接已建立时，客户端发送此消息。仅在值实际变化时发送（通过 `lastSampleRateRef` 追踪）。

### 6.2 JSON 格式

```json
{
  "type": "setSampleRate",
  "sampleRate": 120
}
```

### 6.3 字段定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定值 `"setSampleRate"` |
| `sampleRate` | integer | 是 | 期望的采样率，单位 Hz |

### 6.4 客户端发送

```typescript
// GyroscopeTester.tsx:99-103
wsRef.current.send(
  JSON.stringify({
    type: "setSampleRate",
    sampleRate: sampleRate,
  }),
);
```

### 6.5 服务端解析

服务端**不使用 JSON 解析库**，而是通过字符串匹配识别消息类型：

```cpp
// WebSocketServer.cpp:356-359
bool hasSetSampleRate =
    payload.find("\"type\":\"setSampleRate\"") != std::string::npos ||
    payload.find("type:\"setSampleRate\"") != std::string::npos ||
    payload.find("'type':'setSampleRate'") != std::string::npos ||
    payload.find("type:'setSampleRate'") != std::string::npos;
```

数值提取同样通过字符串查找 `"sampleRate"` key 后解析冒号后的整数值。

### 6.6 值域约束

| 约束 | 值 | 说明 |
|------|-----|------|
| 最小值 | `1` Hz | 下限 |
| 最大值 | `1000` Hz (`MAX_SAMPLE_RATE`) | 超出部分被截断 |
| 默认值 | `60` Hz | 服务端初始值 |

超限时服务端记录警告日志并截断到 `MAX_SAMPLE_RATE`：

```cpp
// WebSocketServer.cpp:384-387
int clampedRate = std::max(1, std::min(MAX_SAMPLE_RATE, sampleRate));
if (clampedRate != sampleRate) {
    Logger::warning("采样率已限制到: " + clampedRate + " Hz (请求: " + sampleRate + " Hz)");
}
```

### 6.7 Web UI 采样率选项

```typescript
// SampleRateControl.tsx:11
const SAMPLE_RATES = [60, 120, 240, 500, 1000, 2000, 4000, 8000];
```

> **已知问题**：Web UI 提供的 2000、4000、8000 Hz 选项超出服务端 `MAX_SAMPLE_RATE`（1000），选择后会被静默截断到 1000 Hz。

---

## 7. 坐标系定义

### 7.1 物理坐标系

采用中国标准右手坐标系：

| 轴 | 方向 | 旋转名称 |
|----|------|---------|
| X 轴 | 向前 (Forward) | Pitch（俯仰） |
| Y 轴 | 向右 (Right) | Yaw（偏航） |
| Z 轴 | 向上 (Up) | Roll（翻滚） |

### 7.2 数据方向

| 数据 | 正方向 |
|------|--------|
| `pitch > 0` | 向前抬头 |
| `yaw > 0` | 向右偏转 |
| `roll > 0` | 向右翻滚 |
| `ax > 0` | 向前加速 |
| `ay > 0` | 向右加速 |
| `az > 0` | 向上加速 |

---

## 8. WebSocket 服务端回调

服务端向应用层暴露三个回调钩子（`WebSocketServer.h:69-71`）：

| 回调 | 类型 | 触发时机 | 注册位置 |
|------|------|---------|---------|
| `sampleRateCallback_` | `std::function<void(int)>` | 收到客户端 `setSampleRate` 消息 | `main.cpp:277/597` |
| `clientConnectCallback_` | `std::function<void()>` | WebSocket 客户端握手成功 | 未使用 |
| `clientDisconnectCallback_` | `std::function<void()>` | WebSocket 客户端断开连接 | 未使用 |

---

## 9. 数据流管线

```
HID 设备 (手柄)
    │
    ▼
WindowsHIDDevice (异步读取 HID 报告)
    │
    ▼
DataParser::parseAuto() (自动检测手柄类型, 解析原始字节)
    │  支持: DS4, DS5, Switch Pro, Xbox
    ▼
GyroData 结构体
    │
    ├──▶ ThreadSafeGyroData (线程安全存储, 供 GUI 读取)
    │
    └──▶ WebSocketServer::broadcast()
            │  节流: 1000/sampleRate ms
            │  序列化: snprintf → JSON string
            │  帧封装: createFrameInto() → WebSocket text frame
            ▼
        所有已连接的 WebSocket 客户端
            │
            ▼
        GyroscopeTester.tsx (ws.onmessage)
            │  JSON.parse → clientDataRef
            │  轴映射: roll→pitch, pitch→yaw, yaw→roll
            ▼
        3D 可视化 + 数据面板
```

---

## 10. 已知问题

### 10.1 采样率上限不匹配（优先级：高）

- **现象**：Web UI 提供 2000/4000/8000 Hz 选项，服务端最大只支持 1000 Hz
- **影响**：用户选择 >1000Hz 时被静默截断，无 UI 反馈
- **涉及文件**：
  - `WebSocketServer.h:46` — `MAX_SAMPLE_RATE = 1000`
  - `SampleRateControl.tsx:11` — `SAMPLE_RATES` 数组包含 2000/4000/8000
- **建议**：要么提升服务端上限，要么从 Web UI 移除超出的选项

### 10.2 未使用的 MessageType 枚举（优先级：低）

- **现象**：`DataTypes.h` 定义了 `ERROR`、`SUCCESS`、`INIT` 三个消息类型但从未使用
- **影响**：代码无害但可能造成误解
- **建议**：明确是否计划实现这些类型，否则移除

### 10.3 服务端无 JSON 解析库（优先级：中）

- **现象**：`setSampleRate` 消息通过字符串匹配 (`payload.find()`) 解析，支持四种引号变体
- **影响**：消息格式变化时容易出错，无法处理嵌套 JSON
- **涉及文件**：`WebSocketServer.cpp:356-398`

### 10.4 timestamp 字段未被客户端使用（优先级：低）

- **现象**：服务端发送 `timestamp` 字段，客户端解析后丢弃
- **影响**：可用于延迟测量或数据同步，当前浪费

---

## 11. 源码引用索引

### 服务端 (gamepad-tests-client / C++)

| 文件 | 关键内容 |
|------|---------|
| `src/network/WebSocketServer.h` | 服务器类声明、常量定义 (MAX_CLIENT_COUNT, MAX_SAMPLE_RATE, DEFAULT_SAMPLE_RATE) |
| `src/network/WebSocketServer.cpp` | 完整服务端实现：握手 (L424-446)、帧解析 (L449-503)、帧创建 (L511-532)、广播 (L140-207)、消息处理 (L340-399) |
| `src/network/DataTypes.h` | GyroData 结构体 (L34-69)、MessageType 枚举 (L122-128)、ClientMessage 结构体 (L135-145)、Config 结构体 (L150-176) |
| `src/main.cpp` | 服务器启动 (L248/566)、回调注册 (L277/597)、广播节流 (L337-344/444-447) |
| `src/utils/Config.h` | 默认配置值 (wsPort=3001, defaultSampleRate=60) |

### 客户端 (gamepad-tests-pro / TypeScript)

| 文件 | 关键内容 |
|------|---------|
| `src/components/GyroscopeTester.tsx` | WS 连接 (L118-205)、消息发送 (L95-109)、消息接收 (L141-162)、轴映射 (L362-365) |
| `src/components/SampleRateControl.tsx` | 采样率选项定义 (L11) |

### 文档

| 文件 | 说明 |
|------|------|
| `gamepad-tests-pro/gamepad-test-client.md` | 陀螺仪测试客户端文档（需修正） |
| `gamepad-tests-client/README.md` | C++ 客户端文档 |
| `README.md` | 项目总览 |

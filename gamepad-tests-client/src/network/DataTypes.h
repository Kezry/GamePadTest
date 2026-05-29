/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    DataTypes.h
 * @brief   核心数据结构定义
 */

#pragma once

#ifdef ERROR
#undef ERROR
#endif

#include <cstdint>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include <ios>

namespace gamepad {

/**
 * @brief 陀螺仪和加速度计数据
 *
 * 对应 Node.js 版本的 gyroData 对象
 */
struct GyroData {
    float pitch;      // 俯仰角 (度/秒), 绕 X 轴旋转
    float yaw;        // 偏航角 (度/秒), 绕 Y 轴旋转
    float roll;       // 翻滚角 (度/秒), 绕 Z 轴旋转
    float ax;         // 加速度 X (G)
    float ay;         // 加速度 Y (G)
    float az;         // 加速度 Z (G)
    uint64_t timestamp; // Unix 时间戳 (毫秒)

    // 默认构造
    GyroData()
        : pitch(0.0f), yaw(0.0f), roll(0.0f)
        , ax(0.0f), ay(0.0f), az(0.0f)
        , timestamp(0) {}

    // 拷贝构造 (线程安全需要)
    GyroData(const GyroData&) = default;
    GyroData& operator=(const GyroData&) = default;

    // 移动构造
    GyroData(GyroData&&) = default;
    GyroData& operator=(GyroData&&) = default;

    // 重置为零
    void reset() {
        pitch = yaw = roll = 0.0f;
        ax = ay = az = 0.0f;
        timestamp = 0;
    }

    // 检查是否有效 (非零)
    bool isValid() const {
        return pitch != 0.0f || yaw != 0.0f || roll != 0.0f ||
               ax != 0.0f || ay != 0.0f || az != 0.0f;
    }
};

/**
 * @brief HID 设备信息
 */
struct DeviceInfo {
    std::string path;           // 设备路径 (平台特定)
    uint16_t vendorId;          // 厂商 ID
    uint16_t productId;         // 产品 ID
    std::string manufacturer;   // 制造商名称
    std::string product;        // 产品名称
    uint16_t usagePage;         // HID Usage Page
    uint16_t usage;             // HID Usage

    DeviceInfo()
        : vendorId(0), productId(0)
        , usagePage(0), usage(0) {}

    // 检查是否匹配 VID/PID
    bool matches(uint16_t vid, uint16_t pid) const {
        return vendorId == vid && productId == pid;
    }

    // 获取显示名称（包含PID）
    std::string getDisplayName() const {
        std::ostringstream oss;
        oss << product;
        if (productId != 0) {
            oss << " (VID: 0x"
                << std::hex << std::setw(4) << std::setfill('0') << vendorId
                << ", PID: 0x"
                << std::setw(4) << productId << ")"
                << std::dec;
        }
        return oss.str();
    }
};

/**
 * @brief 设备类型枚举
 */
enum class DeviceType : uint8_t {
    DS4,        // DualShock 4
    DS5,        // DualSense (PS5)
    SWITCH_PRO, // Nintendo Switch Pro Controller
    XBOX,       // Xbox Controller
    GENERIC,    // 通用设备（自动检测）
    UNKNOWN
};

/**
 * @brief WebSocket 消息类型
 */
enum class MessageType : uint8_t {
    GYRO_DATA,          // 陀螺仪数据 (服务器 -> 客户端)
    SET_SAMPLE_RATE,    // 设置采样率 (客户端 -> 服务器)
    ERROR,              // 错误消息
    SUCCESS,            // 成功消息
    INIT                // 初始化消息 (服务器 -> 客户端)
};

/**
 * @brief 客户端消息 (客户端 -> 服务器)
 *
 * JSON 格式: { "type": "setSampleRate", "sampleRate": 60 }
 */
struct ClientMessage {
    MessageType type;
    int sampleRate;  // 仅当 type == SET_SAMPLE_RATE 时有效

    ClientMessage() : type(MessageType::GYRO_DATA), sampleRate(0) {}

    // 验证
    bool isValid() const {
        return type == MessageType::SET_SAMPLE_RATE && sampleRate > 0;
    }
};

/**
 * @brief 配置结构
 */
struct Config {
    // WebSocket 配置
    int wsPort = 3001;
    std::string wsHost = "0.0.0.0";

    // 广播配置
    int defaultSampleRate = 60;
    int minSampleRate = 10;
    int maxSampleRate = 240;

    // 设备配置
    bool autoReconnect = true;
    int reconnectInterval = 5000;     // 毫秒
    int reconnectMaxAttempts = -1;    // -1 = 无限

    // 健康检查配置
    int healthCheckInterval = 5000;   // 毫秒
    int dataTimeout = 15000;          // 毫秒

    // 调试配置
    bool debugMode = false;
    bool listDevices = false;
    bool noUi = false;

    // 从命令行解析
    static Config fromCommandLine(int argc, char* argv[]);
};

} // namespace gamepad

/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    Config.h
 * @brief   配置管理
 */

#pragma once

#include <string>
#include <vector>

namespace gamepad {

/**
 * @brief 应用程序配置
 */
class Config {
public:
    // WebSocket 配置
    int wsPort = 3001;
    std::string wsHost = "0.0.0.0";

    // 数据采样配置
    int defaultSampleRate = 60;
    int minSampleRate = 10;
    int maxSampleRate = 240;

    // 重连配置
    bool autoReconnect = true;
    int reconnectInterval = 5000;      // 毫秒
    int maxReconnectAttempts = -1;     // -1 = 无限重试

    // 健康检查配置
    int healthCheckInterval = 5000;    // 毫秒
    int dataTimeout = 15000;           // 毫秒

    // 调试配置
    bool debugMode = false;
    bool verboseMode = false;

    // UI 配置
    bool showTimestamp = true;
    bool showDataRate = true;

    // 单例模式
    static Config& instance() {
        static Config config;
        return config;
    }

    // 禁止拷贝
    Config(const Config&) = delete;
    Config& operator=(const Config&) = delete;

private:
    Config() = default;
};

} // namespace gamepad

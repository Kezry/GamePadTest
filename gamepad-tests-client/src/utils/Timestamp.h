/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    Timestamp.h
 * @brief   时间戳工具
 */

#pragma once

#include <chrono>
#include <cstdint>

namespace gamepad {

/**
 * @brief 获取当前时间戳（毫秒）
 * 
 * 使用 steady_clock 以获得更稳定的时间测量，不受系统时间调整影响
 */
inline uint64_t getCurrentTimestampMs() {
    auto now = std::chrono::steady_clock::now();
    auto duration = now.time_since_epoch();
    return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
}

/**
 * @brief 获取当前时间戳（微秒）
 * 
 * 使用 system_clock 因为需要与外部时间同步（WebSocket 时间戳）
 */
inline uint64_t getCurrentTimestampUs() {
    auto now = std::chrono::system_clock::now();
    auto duration = now.time_since_epoch();
    return std::chrono::duration_cast<std::chrono::microseconds>(duration).count();
}

} // namespace gamepad

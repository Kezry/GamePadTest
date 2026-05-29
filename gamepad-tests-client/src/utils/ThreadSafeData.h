/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    ThreadSafeData.h
 * @brief   线程安全的数据容器
 */

#pragma once

#include "network/DataTypes.h"
#include "utils/Timestamp.h"
#include <shared_mutex>
#include <atomic>
#include <mutex>

namespace gamepad {

/**
 * @brief 线程安全的陀螺仪数据容器
 *
 * 设计原则:
 * - 支持多读单写 (Reader-Writer Lock)
 * - 读操作用 shared_lock (并发)
 * - 写操作用 unique_lock (独占)
 * - 使用 C++17 的 shared_mutex
 */
class ThreadSafeGyroData {
public:
    ThreadSafeGyroData() = default;

    // 更新数据 (写锁)
    void update(const GyroData& newData) {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        data_ = newData;
    }

    // 读取数据 (读锁)
    GyroData read() const {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return data_;  // 返回副本
    }

    // 仅读取时间戳 (无锁，原子操作)
    uint64_t getTimestamp() const {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        return data_.timestamp;
    }

    // 检查数据是否过期
    bool isExpired(uint64_t timeoutMs) const {
        uint64_t now = getCurrentTimestampMs();
        uint64_t last = getTimestamp();
        return (now - last) > timeoutMs;
    }

private:
    GyroData data_;
    mutable std::shared_mutex mutex_;
};

} // namespace gamepad

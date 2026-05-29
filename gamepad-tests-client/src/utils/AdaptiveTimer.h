/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    AdaptiveTimer.h
 * @brief   自适应定时器（支持动态调整间隔）
 */

#pragma once

#include <thread>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <functional>
#include <chrono>

namespace gamepad {

/**
 * @brief 自适应定时器
 *
 * 支持在运行时动态调整定时间隔，无需停止和重启
 */
class AdaptiveTimer {
public:
    using Callback = std::function<void()>;

    AdaptiveTimer()
        : running_(false)
        , intervalMs_(16)
        , callback_(nullptr) {}

    ~AdaptiveTimer() {
        stop();
    }

    /**
     * @brief 启动定时器
     * @param callback 回调函数
     * @param intervalMs 初始间隔（毫秒）
     */
    void start(Callback callback, int intervalMs) {
        std::lock_guard<std::mutex> lock(mutex_);

        if (running_.load()) {
            return;  // 已经在运行
        }

        callback_ = std::move(callback);
        intervalMs_.store(intervalMs);
        running_.store(true);

        thread_ = std::thread([this]() {
            timerLoop();
        });
    }

    /**
     * @brief 停止定时器
     */
    void stop() {
        running_.store(false);
        cv_.notify_all();

        if (thread_.joinable()) {
            thread_.join();
        }
    }

    /**
     * @brief 更新定时间隔
     * @param newIntervalMs 新的间隔（毫秒）
     *
     * 可以在运行时调用，立即生效
     */
    void updateInterval(int newIntervalMs) {
        intervalMs_.store(newIntervalMs);
        cv_.notify_all();  // 唤醒线程以应用新间隔
    }

    /**
     * @brief 获取当前间隔
     */
    int getInterval() const {
        return intervalMs_.load();
    }

private:
    void timerLoop() {
        while (running_.load()) {
            auto interval = std::chrono::milliseconds(intervalMs_.load());
            auto nextFire = std::chrono::steady_clock::now() + interval;

            std::unique_lock<std::mutex> lock(mutex_);
            cv_.wait_until(lock, nextFire, [this]() {
                return !running_.load();
            });

            if (!running_.load()) break;

            // 执行回调
            if (callback_) {
                callback_();
            }
        }
    }

    std::thread thread_;
    std::atomic<bool> running_;
    std::atomic<int> intervalMs_;
    Callback callback_;

    std::mutex mutex_;
    std::condition_variable cv_;
};

} // namespace gamepad

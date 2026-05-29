/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    Logger.h
 * @brief   日志系统
 */

#pragma once

#include <string>
#include <sstream>
#include <iostream>
#include <chrono>
#include <iomanip>
#include <mutex>

namespace gamepad {

/**
 * @brief 简单的日志系统
 */
class Logger {
public:
    enum Level {
        DEBUG,
        INFO,
        WARNING,
        ERR
    };

    static Logger& instance() {
        static Logger logger;
        return logger;
    }

    void setLevel(Level level) {
        level_ = level;
    }

    void debug(const std::string& message) {
        if (level_ <= DEBUG) {
            log("[DEBUG]", message);
        }
    }

    void info(const std::string& message) {
        if (level_ <= INFO) {
            log("[INFO]", message);
        }
    }

    void warning(const std::string& message) {
        if (level_ <= WARNING) {
            log("[WARNING]", message);
        }
    }

    void error(const std::string& message) {
        if (level_ <= ERR) {
            log("[ERROR]", message);
        }
    }

private:
    Logger() : level_(INFO) {}

    void log(const char* level, const std::string& message) {
        std::lock_guard<std::mutex> lock(mutex_);

        auto now = std::chrono::system_clock::now();
        auto time = std::chrono::system_clock::to_time_t(now);
        std::tm tm = *std::localtime(&time);

        std::ostringstream oss;
        oss << '[' << std::put_time(&tm, "%H:%M:%S") << "] "
            << level << " " << message;

        std::cout << oss.str() << std::endl;
    }

    Level level_;
    std::mutex mutex_;
};

} // namespace gamepad

/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    ConsoleUI.h
 * @brief   控制台UI系统
 */

#pragma once

#include <string>
#include <vector>
#include <sstream>
#include <iostream>
#include <iomanip>
#include <chrono>

#ifdef _WIN32
    #include <windows.h>
#endif

namespace gamepad {

/**
 * @brief 控制台UI管理器
 *
 * 职责:
 * - 显示固定的ASCII艺术字header
 * - 管理滚动日志缓冲区
 * - 处理控制台重绘
 */
class ConsoleUI {
public:
    static ConsoleUI& instance() {
        static ConsoleUI instance;
        return instance;
    }

    /**
     * @brief 初始化UI
     */
    void initialize() {
#ifdef _WIN32
        // Windows: 设置UTF-8代码页
        SetConsoleOutputCP(CP_UTF8);
        SetConsoleCP(CP_UTF8);

        // 启用虚拟终端处理（ANSI颜色支持）
        HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
        if (hOut != INVALID_HANDLE_VALUE) {
            DWORD dwMode = 0;
            GetConsoleMode(hOut, &dwMode);
            dwMode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;
            SetConsoleMode(hOut, dwMode);
        }
#endif

        // 清空日志缓冲区
        logBuffer_.clear();
    }

    /**
     * @brief 显示程序header（固定在顶部）
     */
    void displayHeader() const {
        std::cout << R"(
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              Gamepad Test Client v1.0                         ║
║              手柄陀螺仪测试客户端                             ║
║                                                               ║
║              (c) 2026 @Kezry                                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
)" << std::flush;
    }

    /**
     * @brief 刷新显示（标题 + 日志）
     */
    void refresh() const {
        // 清屏
        std::cout << "\033[2J\033[H";  // ANSI清屏并移动光标到左上角

        // 显示固定标题
        displayHeader();

        // 显示日志缓冲区（最多显示最近15条）
        size_t start = 0;
        if (logBuffer_.size() > 15) {
            start = logBuffer_.size() - 15;
        }

        for (size_t i = start; i < logBuffer_.size(); ++i) {
            std::cout << logBuffer_[i] << std::endl;
        }

        std::cout << std::flush;
    }

    /**
     * @brief 写入日志（带时间戳）并刷新显示
     */
    void log(const std::string& message) {
        auto now = std::chrono::system_clock::now();
        auto time = std::chrono::system_clock::to_time_t(now);
        std::tm tm = *std::localtime(&time);

        std::ostringstream oss;
        oss << '[' << std::put_time(&tm, "%H:%M:%S") << "] " << message;

        // 添加到日志缓冲区
        logBuffer_.push_back(oss.str());

        // 限制缓冲区大小（保留最近50条）
        if (logBuffer_.size() > 50) {
            logBuffer_.erase(logBuffer_.begin());
        }

        // 刷新显示（标题 + 日志）
        refresh();
    }

    /**
     * @brief 写入错误日志
     */
    void error(const std::string& message) {
        log("❌ " + message);
    }

    /**
     * @brief 写入成功日志
     */
    void success(const std::string& message) {
        log("✅ " + message);
    }

    /**
     * @brief 写入警告日志
     */
    void warning(const std::string& message) {
        log("⚠️  " + message);
    }

    /**
     * @brief 写入信息日志
     */
    void info(const std::string& message) {
        log("ℹ️  " + message);
    }

    /**
     * @brief 清空日志缓冲区并刷新显示
     */
    void clearLogs() {
        logBuffer_.clear();
        refresh();
    }

    /**
     * @brief 仅显示header，不显示日志
     */
    void showHeaderOnly() const {
        std::cout << "\033[2J\033[H";
        displayHeader();
        std::cout << std::flush;
    }

private:
    ConsoleUI() = default;

    std::vector<std::string> logBuffer_;  // 日志缓冲区
};

} // namespace gamepad

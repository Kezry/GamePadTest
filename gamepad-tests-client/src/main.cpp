/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    main.cpp
 * @brief   程序入口
 */

#ifdef ERROR
#undef ERROR
#endif

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <iostream>
#include <csignal>
#include <memory>
#include <atomic>
#include <functional>

#include "platform/WindowsHIDDevice.h"
#include "network/DataTypes.h"
#include "network/WebSocketServer.h"
#include "core/DataParser.h"
#include "core/GamepadDatabase.h"
#include "utils/Logger.h"
#include "utils/ThreadSafeData.h"
#include "ui/ConsoleUI.h"
#include "ui/GaugeWindow.h"

#ifdef _WIN32
#include "utils/HidHideIntegration.h"
#include <windows.h>
#include <io.h>
#include <fcntl.h>
#endif

using namespace std;
using namespace gamepad;

// 全局变量
atomic<bool> shouldStop(false);

/**
 * @brief 信号处理 - 优雅退出
 */
void signalHandler(int signal) {
    cout << endl;
    cout << "正在关闭..." << endl;

    shouldStop.store(true);

    cout << "再见！" << endl;
    exit(0);
}

/**
 * @brief 将整数转换为十六进制字符串
 */
static string intToHex(uint16_t value) {
    ostringstream oss;
    oss << hex << setw(4) << setfill('0') << uppercase << value;
    return oss.str();
}

/**
 * @brief 将单字节转换为十六进制字符串
 */
static string intToHex(uint8_t value) {
    ostringstream oss;
    oss << hex << setw(2) << setfill('0') << uppercase << (int)value;
    return oss.str();
}

/**
 * @brief 显示帮助信息
 */
void showHelp(const char* programName) {
    cout << "用法: " << programName << " [选项]" << endl;
    cout << endl;
    cout << "选项:" << endl;
    cout << "  --list-devices        列出所有HID设备" << endl;
    cout << "  --configure-hidhide   配置 HidHide 驱动（需先安装）" << endl;
    cout << "  --debug               启用调试模式" << endl;
    cout << "  --help, -h            显示此帮助信息" << endl;
    cout << endl;
    cout << "蓝牙 Switch Pro 支持:" << endl;
    cout << "  1. 以管理员身份运行 install-hidhide.bat 安装驱动" << endl;
    cout << "  2. 连接蓝牙 Switch Pro Controller" << endl;
    cout << "  3. 运行 " << programName << endl;
    cout << endl;
    cout << "USB Switch Pro 支持无需驱动!" << endl;
    cout << endl;
    cout << "示例:" << endl;
    cout << "  " << programName << endl;
    cout << "  " << programName << " --debug" << endl;
    cout << "  " << programName << " --configure-hidhide" << endl;
}

/**
 * @brief 列出所有HID设备
 */
void listAllDevices() {
    ConsoleUI& ui = ConsoleUI::instance();
    ui.initialize();

    ui.log("正在枚举所有HID设备...");

    auto devices = HIDDevice::enumerateDevices();

    cout << "\n找到 " << devices.size() << " 个HID设备:\n" << endl;

    for (size_t i = 0; i < devices.size(); ++i) {
        const auto& d = devices[i];
        cout << "设备 " << (i + 1) << ":" << endl;
        cout << "  厂商ID (VID): 0x" << hex << setw(4) << setfill('0') << d.vendorId << dec << endl;
        cout << "  产品ID (PID): 0x" << hex << setw(4) << setfill('0') << d.productId << dec << endl;
        cout << "  产品名称: " << (d.product.empty() ? "Unknown" : d.product) << endl;
        cout << "  制造商: " << (d.manufacturer.empty() ? "Unknown" : d.manufacturer) << endl;
        cout << "  路径: " << d.path << endl;
        cout << endl;
    }
}

/**
 * @brief 尝试连接手柄
 */
bool connectGamepad(unique_ptr<HIDDevice>& device, string& connectedName) {
    ConsoleUI& ui = ConsoleUI::instance();

    // 枚举所有 HID 设备
    auto allDevices = HIDDevice::enumerateDevices();

    if (allDevices.empty()) {
        ui.error("未找到任何 HID 设备");
        return false;
    }

    Logger::instance().debug("找到 " + to_string(allDevices.size()) + " 个 HID 设备");

    // 使用游戏手柄数据库过滤
    auto gamepads = GamepadDatabase::filterGamepads(allDevices);

    if (gamepads.empty()) {
        ui.error("未找到支持的游戏手柄");
        ui.log("");
        ui.log("💡 提示: 确保手柄已连接并开启");
        ui.log("💡 提示: 某些手柄需要按特定按钮进入配对模式");
        return false;
    }

    ui.log("找到 " + to_string(gamepads.size()) + " 个可能的游戏手柄");

    // 优先尝试已知手柄
    for (const auto& devInfo : gamepads) {
        if (GamepadDatabase::isKnownGamepad(devInfo.vendorId, devInfo.productId)) {
            GamepadInfo info = GamepadDatabase::getGamepadInfo(devInfo.vendorId, devInfo.productId);

            Logger::instance().debug("尝试连接: " + info.name);

            if (device->open(devInfo.path)) {
                DataParser::resetParserCache();
                connectedName = info.name + " (" + devInfo.getDisplayName() + ")";
                ui.success("已连接: " + connectedName);
                ui.log("   VID: 0x" + intToHex(devInfo.vendorId));
                ui.log("   PID: 0x" + intToHex(devInfo.productId));

                // 检测蓝牙 Switch Pro Controller
                bool isSwitchProBluetooth = (info.name == "Switch Pro Controller" &&
                                             devInfo.product.find("Wireless") != std::string::npos);

                // 初始化设备（发送启用陀螺仪的命令）
                device->initializeDevice(devInfo.vendorId, devInfo.productId);

                // 强制刷新输出
                cout << "[DEBUG] Switch Pro 初始化完成" << endl;
                cout.flush();

                if (isSwitchProBluetooth) {
                    ui.warning("");
                    ui.warning("═══════════════════════════════════════");
                    ui.warning("⚠️  蓝牙模式限制提示");
                    ui.warning("═══════════════════════════════════════");
                    ui.warning("Windows 蓝牙栈无法访问 Switch Pro 的 IMU 数据");
                    ui.warning("");
                    ui.warning("推荐方案：");
                    ui.warning("  1. 使用 USB 线连接（完美支持陀螺仪）");
                    ui.warning("  2. 或使用 DualShock 4/DualSense（蓝牙支持）");
                    ui.warning("");
                    ui.warning("详细说明：WINDOWS-BLUETOOTH-LIMITATION.md");
                    ui.warning("═══════════════════════════════════════");
                    ui.warning("");
                } else if (info.hasGyroscope) {
                    ui.log("   ✅ 支持陀螺仪");
                } else {
                    ui.warning("   ⚠️ 不支持陀螺仪（数据可能不可用）");
                }

                return true;
            }
        }
    }

    // 如果没有已知手柄，尝试其他候选设备
    for (const auto& devInfo : gamepads) {
        if (!GamepadDatabase::isKnownGamepad(devInfo.vendorId, devInfo.productId)) {
            Logger::instance().debug("尝试连接未知设备: " + devInfo.getDisplayName());

            if (device->open(devInfo.path)) {
                DataParser::resetParserCache();
                connectedName = devInfo.getDisplayName();
                ui.warning("已连接: " + connectedName);
                ui.log("   VID: 0x" + intToHex(devInfo.vendorId));
                ui.log("   PID: 0x" + intToHex(devInfo.productId));
                ui.log("   ℹ️ 这是未知设备，可能无法正常工作");

                // 尝试初始化设备（即使未知也尝试）
                device->initializeDevice(devInfo.vendorId, devInfo.productId);

                return true;
            }
        }
    }

    return false;
}

/**
 * @brief 连接并读取手柄数据（含自动重连和 WebSocket）
 */
void connectAndReadGamepad() {
    ConsoleUI& ui = ConsoleUI::instance();
    ui.initialize();
    ui.displayHeader();

    ui.log("✨ 正在启动客户端...");
    ui.log("🎮 通用手柄支持模式 - 自动检测任何具有陀螺仪的设备");
    ui.log("");
    ui.log("🌐 网页测试站: https://gamepad-test-pro.molecbot.com");
    ui.log("");

    // 创建 WebSocket 服务器
    unique_ptr<WebSocketServer> wsServer = make_unique<WebSocketServer>(3001);
    if (wsServer->start()) {
        ui.success("WebSocket 服务器已启动 (端口: 3001)");
    }

    unique_ptr<HIDDevice> device = HIDDevice::create();
    string connectedName;
    atomic<bool> isConnected{false};
    atomic<bool> shouldRetry{true};

    // 数据存储
    ThreadSafeGyroData gyroData;
    atomic<int> dataCount{0};
    atomic<uint64_t> lastDataTime{0};

    // 动态采样率配置
    atomic<int> sampleRate{60};  // 默认 60Hz
    atomic<uint64_t> lastBroadcastTime{0};

    // 健康检查配置
    const uint64_t HEALTH_CHECK_INTERVAL = 5000;  // 5秒
    const uint64_t DATA_TIMEOUT = 15000;          // 15秒无数据视为断开
    auto lastHealthCheck = getCurrentTimestampMs();

    // 重连配置
    const int RETRY_INTERVAL = 5000;  // 5秒重试一次
    auto lastRetryTime = getCurrentTimestampMs();

    // 设置采样率变化回调
    wsServer->setSampleRateCallback([&](int newRate) {
        sampleRate.store(newRate);
        ui.log("🔄 采样率已调整为 " + to_string(newRate) + " Hz");
    });

    // 初始连接尝试
    if (connectGamepad(device, connectedName)) {
        isConnected.store(true);

        // 设置数据回调
        device->setDataCallback([&](const vector<uint8_t>& data) {
            // 静态计数器，限制输出频率
            static int recvCount = 0;
            static int parseSuccessCount = 0;
            static auto lastOutputTime = getCurrentTimestampMs();
            static bool firstData = true;

            recvCount++;

            // 第一次接收数据时输出完整的原始数据
            if (firstData && data.size() > 0) {
                // 使用 stderr 输出，避免被 ConsoleUI 覆盖
                cerr << endl;
                cerr << "========== Switch Pro 原始数据 ==========" << endl;
                cerr << "数据大小: " << data.size() << " 字节" << endl;
                cerr << "ReportID: 0x" << hex << setw(2) << setfill('0') << (int)data[0] << dec << endl;
                cerr << "完整数据 (十六进制):" << endl;

                // 输出所有数据，每行16字节
                for (size_t i = 0; i < data.size(); i += 16) {
                    cerr << "  ";
                    for (size_t j = 0; j < 16 && i + j < data.size(); j++) {
                        cerr << hex << setw(2) << setfill('0') << (int)data[i + j] << " " << dec;
                    }
                    // 同时显示 ASCII
                    cerr << "  |";
                    for (size_t j = 0; j < 16 && i + j < data.size(); j++) {
                        uint8_t c = data[i + j];
                        if (c >= 32 && c <= 126) {
                            cerr << (char)c;
                        } else {
                            cerr << ".";
                        }
                    }
                    cerr << "|" << endl;
                }
                cerr << "=====================================" << endl;
                cerr << endl;
                cerr.flush();
                firstData = false;
            }

            GyroData gyro;
            if (DataParser::parseAuto(data, gyro)) {
                gyroData.update(gyro);
                dataCount++;
                lastDataTime.store(getCurrentTimestampMs());
                parseSuccessCount++;

                // 直接在回调中广播（消除主循环 10ms 延迟瓶颈）
                // WebSocketServer::broadcast 内部已有 clientCount_ 原子快速路径
                uint64_t now = getCurrentTimestampMs();
                uint64_t interval = 1000 / sampleRate.load();
                if (interval < 1) interval = 1;
                if (now - lastBroadcastTime.load() >= interval) {
                    wsServer->broadcast(gyro);
                    lastBroadcastTime.store(now);
                }

                // 调试：输出解析后的数据
                Logger::instance().debug("解析: P=" + to_string(gyro.pitch) +
                                          " Y=" + to_string(gyro.yaw) +
                                          " R=" + to_string(gyro.roll));
            } else {
                // 解析失败 - 每秒输出一次调试信息和原始数据前几个字节
                auto now = getCurrentTimestampMs();
                if (now - lastOutputTime >= 1000 && data.size() > 0) {
                    cerr << "[DEBUG] ReportID=0x" << hex << setw(2) << (int)data[0] << dec
                         << " Size=" << data.size()
                         << " 总接收=" << recvCount
                         << " 解析成功=" << parseSuccessCount << endl;
                    cerr.flush();
                    lastOutputTime = now;
                }
            }
        });

        // 设置断开回调
        device->setDisconnectCallback([&]() {
            ui.warning("手柄已断开连接");
            isConnected.store(false);
            device->close();
        });

        ui.success("正在读取陀螺仪数据...");
        ui.log("");
        ui.log("💡 提示：移动手柄以查看数据输出");
        ui.log("💡 按Ctrl+C退出程序");
        ui.log("");
    } else {
        ui.warning("未找到支持的手柄");
        ui.log("");
        ui.log("💡 提示: 确保手柄已连接并开启");
        ui.log("💡 提示: 支持的手柄: DualShock 4/5, Switch Pro, Steam Deck");
        ui.log("");
        ui.log("⏳ 等待手柄连接... (每5秒自动检测)");
        ui.log("");
        ui.log("💡 提示：按Ctrl+C退出程序");
        ui.log("");
    }

    // 主循环
    bool wasConnected = isConnected.load();  // 跟踪连接状态变化
    bool lastHadWsClient = false;  // 跟踪是否有WS客户端
    bool linkDisplayed = false;  // 跟踪是否已显示网站链接
    auto lastDisplayUpdateTime = getCurrentTimestampMs();
    const uint64_t DISPLAY_UPDATE_INTERVAL = 100;  // 100ms更新一次显示

    while (!shouldStop.load()) {
        auto now = getCurrentTimestampMs();

        // 检测手柄连接状态变化
        bool currentlyConnected = isConnected.load();
        if (wasConnected && !currentlyConnected) {
            // 手柄刚断开，回到首页
            ui.clearLogs();
            ui.showHeaderOnly();
            ui.log("✨ 客户端运行中...");
            ui.log("🌐 网页测试站: https://gamepad-test-pro.molecbot.com");
            ui.log("");
            ui.log("⏳ 等待手柄连接... (每5秒自动检测)");
            ui.log("");
        }
        wasConnected = currentlyConnected;

        // 健康检查
        if (now - lastHealthCheck >= HEALTH_CHECK_INTERVAL) {
            if (isConnected.load()) {
                uint64_t lastUpdate = lastDataTime.load();
                if (lastUpdate > 0 && (now - lastUpdate > DATA_TIMEOUT)) {
                    ui.warning("检测到手柄数据停止，可能已断开连接");
                    isConnected.store(false);
                    device->close();
                }
            }
            lastHealthCheck = now;
        }

        // 自动重连
        if (!isConnected.load() && shouldRetry.load()) {
            if (now - lastRetryTime >= RETRY_INTERVAL) {
                ui.log("🔍 正在检测手柄...");
                if (connectGamepad(device, connectedName)) {
                    isConnected.store(true);

                    // 重新设置回调（包含直接广播）
                    device->setDataCallback([&](const vector<uint8_t>& data) {
                        GyroData gyro;
                        if (DataParser::parseAuto(data, gyro)) {
                            gyroData.update(gyro);
                            dataCount++;
                            lastDataTime.store(getCurrentTimestampMs());

                            // 直接在回调中广播
                            uint64_t now2 = getCurrentTimestampMs();
                            uint64_t interval = 1000 / sampleRate.load();
                            if (interval < 1) interval = 1;
                            if (now2 - lastBroadcastTime.load() >= interval) {
                                wsServer->broadcast(gyro);
                                lastBroadcastTime.store(now2);
                            }

                            // 调试：输出解析后的数据
                            Logger::instance().debug("解析: P=" + to_string(gyro.pitch) +
                                                      " Y=" + to_string(gyro.yaw) +
                                                      " R=" + to_string(gyro.roll));
                        } else {
                            // 解析失败 - 记录详细信息
                            if (data.size() > 0) {
                                Logger::instance().debug("解析失败: ReportID=0x" + intToHex(data[0]) +
                                                          " Size=" + to_string(data.size()));
                            }
                        }
                    });

                    device->setDisconnectCallback([&]() {
                        ui.warning("⚠️ 手柄已断开连接");
                        isConnected.store(false);
                        device->close();
                    });

                    ui.success("✅ 手柄已连接！正在读取陀螺仪数据...");
                    ui.log("");
                    ui.log("💡 提示：移动手柄以查看数据输出");
                    ui.log("");
                } else {
                    // 静默重试，不刷屏
                    Logger::instance().debug("未找到手柄，等待下次检测...");
                }
                lastRetryTime = now;
            }
        }

        // WebSocket 数据广播已在数据回调中直接执行，消除主循环延迟瓶颈

        // 显示数据
        size_t currentClientCount = wsServer->getClientCount();
        bool hasWsClient = (currentClientCount > 0);
        bool clientStateChanged = (hasWsClient != lastHadWsClient);

        GyroData data = gyroData.read();

        // 只有在数据有效且手柄连接时才显示陀螺仪数据
        if (data.isValid() && isConnected.load()) {
            if (now - lastDisplayUpdateTime >= DISPLAY_UPDATE_INTERVAL || clientStateChanged) {
                // 使用 \r 回到行首，然后覆盖输出
                cout << "\r\033[K";  // 清除当前行

                // 始终显示陀螺仪数据
                cout << "陀螺仪: "
                     << "Pitch=" << fixed << setprecision(2) << data.pitch << "°/s "
                     << "Yaw=" << data.yaw << "°/s "
                     << "Roll=" << data.roll << "°/s | "
                     << "加速度: X=" << data.ax << "g Y=" << data.ay << "g Z=" << data.az << "g"
                     << " | 采样率: " << sampleRate.load() << "Hz";

                // 根据是否有WS客户端显示不同信息
                if (hasWsClient) {
                    cout << " | WS客户端: " << currentClientCount;
                } else {
                    // 没有WS客户端，显示网站链接
                    cout << " | "
                         << "\033]8;;https://gamepad-test-pro.molecbot.com\033\\"  // ANSI超链接
                         << "\033[36m\033[4m网页测试站\033[0m"
                         << "\033]8;;\033\\";
                }

                cout << "                              " << flush;  // 填充空格清除旧数据

                lastDisplayUpdateTime = now;
                linkDisplayed = false;  // 手柄连接后，清除链接显示标记
            }
        } else if (!isConnected.load() && !linkDisplayed) {
            // 没有手柄连接且链接未显示过，显示一次网站链接（固定显示）
            cout << "\033[K"  // 清除当前行
                 << "\033]8;;https://gamepad-test-pro.molecbot.com\033\\"  // ANSI超链接开始
                 << "\033[36m\033[4m🌐 网页测试站: https://gamepad-test-pro.molecbot.com\033[0m"  // 青色下划线
                 << "\033]8;;\033\\"  // ANSI超链接结束
                 << endl;
            linkDisplayed = true;
        }

        lastHadWsClient = hasWsClient;

        this_thread::sleep_for(chrono::milliseconds(2));
    }

    // 清理
    wsServer->stop();
    cout << endl;
}

/**
 * @brief GUI 模式主函数
 */
#ifdef _WIN32
int runGuiMode(bool debugMode) {
    // 创建控制台窗口（用于显示日志和调试信息）
    if (!AttachConsole(ATTACH_PARENT_PROCESS)) {
        AllocConsole();
    }
    
    // 设置控制台为UTF-8模式
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    
    // 重定向标准输出到控制台
    FILE* fp;
    freopen_s(&fp, "CONOUT$", "w", stdout);
    freopen_s(&fp, "CONOUT$", "w", stderr);
    
    // 设置日志级别
    if (debugMode) {
        Logger::instance().setLevel(Logger::DEBUG);
    } else {
        Logger::instance().setLevel(Logger::WARNING);
    }

    // 创建 WebSocket 服务器
    unique_ptr<WebSocketServer> wsServer = make_unique<WebSocketServer>(3001);
    if (wsServer->start()) {
        Logger::instance().info("WebSocket Server started on port 3001");
    }

    unique_ptr<HIDDevice> device = HIDDevice::create();
    string connectedName;
    atomic<bool> isConnected{false};
    atomic<bool> shouldRetry{true};

    // 数据存储
    ThreadSafeGyroData gyroData;
    atomic<int> sampleRate{60};

    // 创建 GUI 窗口
    GaugeWindow gui;
    if (!gui.create(GetModuleHandle(nullptr), SW_SHOW)) {
        Logger::instance().error("Failed to create GUI window");
        return 1;
    }

    // 连接并运行消息循环
    auto lastRetryTime = getCurrentTimestampMs();
    const int RETRY_INTERVAL = 2000;

    // 先尝试连接一次
    if (connectGamepad(device, connectedName)) {
        isConnected.store(true);
    }

    // 设置采样率变化回调（用于GUI同步）
    wsServer->setSampleRateCallback([&](int newRate) {
        sampleRate.store(newRate);
    });

    // 测试参数
    const int TEST_RATES[] = {500, 1000, 2000, 4000, 8000};
    const int TEST_STAGES = 5;
    const int TEST_DURATION_MS = 2000;  // 2 秒窗口，兼顾稳定性和响应速度
    const int COUNT_THRESHOLD_PCT = 80;
    atomic<int> testStage{0};
    atomic<int> testCount{0};
    atomic<int> testRate{1000};
    atomic<bool> testRunning{false};
    atomic<bool> testActive{false};
    atomic<bool> testWindowOpen{false};  // 跟踪测试窗口是否打开
    std::chrono::steady_clock::time_point testStart;
    std::chrono::steady_clock::time_point lastProcess;
    const auto MIN_PROCESS_INTERVAL = std::chrono::microseconds(250);
    const auto RATE_UPDATE_INTERVAL = std::chrono::milliseconds(250);

    // 实时回报率统计
    atomic<int> packetsPerSec{0};
    std::chrono::steady_clock::time_point rateWindowStart;
    atomic<int> rateWindowCount{0};
    
    // 回报率测试统计
    const int MAX_RATE_HISTORY = 5;
    std::vector<int> rateHistory;
    int maxRateInTest = 0;
    int avgRateInTest = 0;

    // 设置数据回调
    auto setupDataCallback = [&](HIDDevice& dev) {
        dev.setDataCallback([&](const vector<uint8_t>& data) {
            auto now = std::chrono::steady_clock::now();

            // 始终统计收到的包数（不管是什么手柄）
            rateWindowCount.fetch_add(1);

            // 调试：显示收到的第一个数据包
            static int debugCount = 0;
            if (debugCount < 3) {
                cerr << "[CALLBACK] 收到数据: size=" << data.size();
                if (data.size() > 0) {
                    cerr << " first byte=0x" << hex << (int)data[0] << dec;
                }
                cerr << endl;
                debugCount++;
            }

            if (testStage.load() > 0) {
                testCount.fetch_add(1);
            }

            // 测试模式下暂停解析和广播，但仍然保留计数。
            if (testActive.load()) {
                return;
            }

            // 非测试模式下节流
            if (now - lastProcess < MIN_PROCESS_INTERVAL) {
                return;
            }
            lastProcess = now;

            GyroData gyro;
            if (DataParser::parseAuto(data, gyro)) {
                gyroData.update(gyro);
                wsServer->broadcast(gyro);
            }
        });
    };

    setupDataCallback(*device);

    // 设置测试回调 - 打开测试窗口
    gui.setTestCallback([&]() {
        testActive.store(true);
        testWindowOpen.store(true);
        testStage.store(1);
        testCount.store(0);
        testRate.store(TEST_RATES[0]);
        testStart = std::chrono::steady_clock::now();
        rateWindowStart = std::chrono::steady_clock::now();
        rateWindowCount.store(0);
        packetsPerSec.store(0);
        rateHistory.clear();
        maxRateInTest = 0;
        avgRateInTest = 0;
        gui.getTestWindow().updateProgress("\u6D4B\u8BD5\u4E2D 500Hz...");
        gui.getTestWindow().updateResult("");
        gui.getTestWindow().show();
    });

    // 设置测试窗口关闭回调
    gui.getTestWindow().setCloseCallback([&]() {
        testActive.store(false);
        testStage.store(0);
        testWindowOpen.store(false);
        gui.getTestWindow().hide();
    });

    while (gui.processMessages()) {
        auto now = getCurrentTimestampMs();

        // 更新实时回报率显示（每秒更新一次）
        auto rateNow = std::chrono::steady_clock::now();
        auto rateElapsed = std::chrono::duration_cast<std::chrono::milliseconds>(rateNow - rateWindowStart).count();
        if (rateElapsed >= RATE_UPDATE_INTERVAL.count()) {
            int packetCount = rateWindowCount.exchange(0);
            int pps = 0;
            if (rateElapsed > 0) {
                pps = static_cast<int>((static_cast<long long>(packetCount) * 1000LL + rateElapsed / 2) / rateElapsed);
            }
            packetsPerSec.store(pps);

            if (testStage.load() > 0) {
                // 更新最高和平均回报率统计
                if (pps > maxRateInTest) {
                    maxRateInTest = pps;
                }
                rateHistory.push_back(pps);
                if ((int)rateHistory.size() > MAX_RATE_HISTORY) {
                    rateHistory.erase(rateHistory.begin());
                }
                int sum = 0;
                for (int r : rateHistory) sum += r;
                avgRateInTest = sum / (int)rateHistory.size();

                gui.getTestWindow().updateRate(testRate.load(), pps, maxRateInTest, avgRateInTest);
            }

            rateWindowStart = rateNow;
        }

        // 检查测试进度
        if (testStage.load() > 0) {
            auto testElapsed = std::chrono::duration_cast<std::chrono::milliseconds>(rateNow - testStart).count();

            if (testElapsed >= TEST_DURATION_MS) {
                int count = testCount.load();
                int stage = testStage.load() - 1;

                char result[128];

                // 计算实际测出的回报率
                int measuredRate = 0;
                if (testElapsed > 0) {
                    measuredRate = static_cast<int>((static_cast<long long>(count) * 1000LL + testElapsed / 2) / testElapsed);
                }
                
                // 更新最高回报率记录
                if (measuredRate > maxRateInTest) {
                    maxRateInTest = measuredRate;
                }

                // 继续测试下一档，直到最后一档
                if (stage < TEST_STAGES - 1) {
                    // 测试下一档
                    testStage.store(stage + 2);
                    testCount.store(0);
                    testRate.store(TEST_RATES[stage + 1]);
                    testStart = rateNow;
                    char progress[128];
                    snprintf(progress, sizeof(progress), "\u6D4B\u8BD5\u4E2D %dHz...", TEST_RATES[stage + 1]);
                    gui.getTestWindow().updateProgress(progress);
                } else {
                    // 所有档位测试完成，显示最终结果
                    snprintf(result, sizeof(result), "\u6D4B\u8BD5\u5B8C\u6210! \u6700\u9AD8: %dHz", maxRateInTest);
                    gui.getTestWindow().updateResult(result);
                    sampleRate.store(maxRateInTest);
                    testStage.store(0);
                    // 不设置 testActive = false，保持陀螺仪暂停直到用户关闭窗口
                }
            }
        }

        // 检查连接状态
        if ((!isConnected.load() || !device->isOpen()) && (now - lastRetryTime) > RETRY_INTERVAL) {
            if (connectGamepad(device, connectedName)) {
                isConnected.store(true);
                setupDataCallback(*device);
            } else {
                device = HIDDevice::create();
                setupDataCallback(*device);
            }
            lastRetryTime = now;
        }

        // 更新 GUI
        GyroData data = gyroData.read();
        int displayRate = packetsPerSec.load();
        if (displayRate <= 0) {
            displayRate = sampleRate.load();
        }
        gui.update(data, static_cast<float>(displayRate), isConnected.load(), wsServer->hasClients());

        this_thread::sleep_for(chrono::milliseconds(2));
    }

    shouldStop.store(true);
    wsServer->stop();
    device->close();

    return 0;
}
#endif

/**
 * @brief 主函数
 */
int main(int argc, char* argv[]) {
    // 解析命令行参数
    bool listDevices = false;
    bool debugMode = false;
    bool configureHidHide = false;
    bool consoleMode = false;

    for (int i = 1; i < argc; ++i) {
        string arg = argv[i];

        if (arg == "--list-devices" || arg == "--list-all-devices") {
            listDevices = true;
        } else if (arg == "--debug") {
            debugMode = true;
        } else if (arg == "--configure-hidhide") {
            configureHidHide = true;
        } else if (arg == "--console") {
            consoleMode = true;
        } else if (arg == "--help" || arg == "-h") {
            showHelp(argv[0]);
            return 0;
        }
    }

#ifdef _WIN32
    // 默认使用 GUI 模式，除非指定 --console
    if (!listDevices && !configureHidHide && !consoleMode) {
        return runGuiMode(debugMode);
    }
#endif

    // 设置日志级别
    if (debugMode) {
        Logger::instance().setLevel(Logger::DEBUG);
    } else {
        Logger::instance().setLevel(Logger::INFO);
    }

    // 设置信号处理
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);

#ifdef _WIN32
    signal(SIGBREAK, signalHandler);
#endif

    // 执行请求的操作
    if (listDevices) {
        listAllDevices();
        return 0;
    }

    // 配置 HidHide
    if (configureHidHide) {
        cout << "========================================" << endl;
        cout << "配置 HidHide 驱动" << endl;
        cout << "========================================" << endl;
        cout << endl;

#ifdef _WIN32
        // 检查驱动是否已安装
        if (!HidHideIntegration::isDriverInstalled()) {
            cout << "[错误] HidHide 驱动未安装！" << endl;
            cout << endl;
            cout << "请先运行 install-hidhide.bat 安装驱动" << endl;
            return 1;
        }

        cout << "[✓] HidHide 驱动已安装" << endl;

        // 添加当前应用到白名单
        cout << "[1/2] 添加当前应用到白名单..." << endl;
        if (HidHideIntegration::addCurrentAppToWhitelist()) {
            cout << "[✓] 成功添加到白名单" << endl;
        } else {
            cout << "[×] 添加失败: " << HidHideIntegration::getLastErrorText() << endl;
            return 1;
        }

        // 启用设备隐藏
        cout << "[2/2] 启用设备隐藏..." << endl;
        if (!HidHideIntegration::isDeviceHidingActive()) {
            if (HidHideIntegration::setDeviceHidingActive(true)) {
                cout << "[✓] 设备隐藏已启用" << endl;
            } else {
                cout << "[×] 启用失败: " << HidHideIntegration::getLastErrorText() << endl;
                return 1;
            }
        } else {
            cout << "[✓] 设备隐藏已处于启用状态" << endl;
        }

        cout << endl;
        cout << "========================================" << endl;
        cout << "配置完成！" << endl;
        cout << "========================================" << endl;
        cout << endl;
        cout << "现在可以使用蓝牙 Switch Pro 的陀螺仪了" << endl;
#else
        cout << "[错误] HidHide 仅支持 Windows 平台" << endl;
        return 1;
#endif

        return 0;
    }

    // 连接手柄并读取数据
    connectAndReadGamepad();

    return 0;
}

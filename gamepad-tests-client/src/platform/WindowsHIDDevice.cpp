/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    WindowsHIDDevice.cpp
 * @brief   Windows平台HID设备实现（使用原生Windows API）
 */

#include "WindowsHIDDevice.h"
#include "utils/Logger.h"
#include "utils/HidHideIntegration.h"
#include "ui/ConsoleUI.h"
#include <windows.h>
#include <setupapi.h>

extern "C" {
#include <hidsdi.h>
}
#include <initguid.h>
#include <devguid.h>
#include <vector>
#include <sstream>
#include <algorithm>

namespace gamepad {

namespace {

bool isSwitchFamilyDevice(uint16_t vid, uint16_t pid) {
    if (vid != 0x057E) {
        return false;
    }

    switch (pid) {
    case 0x2006:
    case 0x2007:
    case 0x2008:
    case 0x2009:
    case 0x2017:
        return true;
    default:
        return false;
    }
}

bool isBluetoothConnectionName(const std::string& productName) {
    std::string productLower = productName;
    std::transform(productLower.begin(), productLower.end(), productLower.begin(), ::tolower);
    return productLower.find("wireless") != std::string::npos;
}

} // namespace

WindowsHIDDevice::WindowsHIDDevice()
    : deviceHandle_(nullptr)
    , isOpen_(false)
    , shouldStop_(false) {
}

WindowsHIDDevice::~WindowsHIDDevice() {
    close();
}

bool WindowsHIDDevice::open(const std::string& path) {
    if (isOpen_.load()) {
        return false;
    }

    // 将路径转换为宽字符
    // 这是标准的Windows文件路径转换
    int widePathLength = MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, nullptr, 0);
    if (widePathLength <= 0) {
        Logger::instance().error("Failed to convert device path to wide character");
        return false;
    }

    std::vector<wchar_t> widePath(widePathLength);
    MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, widePath.data(), widePathLength);

    // 打开游戏手柄HID设备
    // GENERIC_READ | GENERIC_WRITE 是读取游戏手柄数据所必需的
    // 这个程序只读取手柄的陀螺仪和按钮数据，不记录键盘输入
    HANDLE handle = CreateFileW(
        widePath.data(),
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        nullptr,
        OPEN_EXISTING,
        FILE_FLAG_OVERLAPPED,
        nullptr
    );

    if (handle == INVALID_HANDLE_VALUE) {
        DWORD error = GetLastError();
        Logger::instance().error("Failed to open device: " + std::to_string(error));
        return false;
    }

    deviceHandle_ = handle;

    // 检查 HID 缓冲区大小
    ULONG bufferSize = 0;
    if (HidD_GetNumInputBuffers(handle, &bufferSize)) {
        std::cerr << "[DEBUG] HID 输入缓冲 区大小: " << bufferSize << std::endl;
    }

    // 获取设备信息（用于检测USB vs 蓝牙连接）
    HIDD_ATTRIBUTES attributes;
    attributes.Size = sizeof(HIDD_ATTRIBUTES);
    if (HidD_GetAttributes(handle, &attributes)) {
        deviceInfo_.vendorId = attributes.VendorID;
        deviceInfo_.productId = attributes.ProductID;
    }

    // 获取产品名称（用于检测连接类型）
    wchar_t productBuffer[256] = {0};
    if (HidD_GetProductString(handle, productBuffer, sizeof(productBuffer))) {
        deviceInfo_.product = wideToUtf8(productBuffer);
    }

    // 配置 HidHide（如果需要）- 针对蓝牙 Switch Pro
    if (!configureHidHide()) {
        // 配置失败，但仍然尝试继续
        Logger::instance().warning("HidHide configuration failed or not available");
    }

    // 不在这里启动读取线程，而是在setDataCallback中启动
    // 这样可以确保回调已经设置好才开始读取数据

    isOpen_.store(true);
    Logger::instance().debug("Device opened successfully: " + deviceInfo_.product);
    return true;
}

void WindowsHIDDevice::close() {
    if (!isOpen_.load()) {
        return;
    }

    shouldStop_.store(true);

    if (readThread_.joinable()) {
        if (readThread_.get_id() == std::this_thread::get_id()) {
            readThread_.detach();
        } else {
            readThread_.join();
        }
    }

    if (deviceHandle_ != nullptr && deviceHandle_ != INVALID_HANDLE_VALUE) {
        CloseHandle(static_cast<HANDLE>(deviceHandle_));
        deviceHandle_ = nullptr;
    }

    isOpen_.store(false);
    Logger::instance().debug("Device closed");
}

bool WindowsHIDDevice::write(const std::vector<uint8_t>& data) {
    if (!isOpen_.load() || deviceHandle_ == nullptr) {
        Logger::instance().error("Write failed: Device not open");
        return false;
    }

    HANDLE handle = static_cast<HANDLE>(deviceHandle_);

    // 调试：显示要发送的数据
    std::ostringstream oss;
    oss << "Writing " << data.size() << " bytes: ";
    for (size_t i = 0; i < std::min(size_t(12), data.size()); ++i) {
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)data[i] << " ";
    }
    Logger::instance().debug(oss.str());

    // 创建重叠结构用于异步操作
    OVERLAPPED overlapped = {0};
    overlapped.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);

    DWORD bytesWritten = 0;
    BOOL result = WriteFile(
        handle,
        data.data(),
        static_cast<DWORD>(data.size()),
        &bytesWritten,
        &overlapped
    );

    if (!result) {
        DWORD error = GetLastError();
        if (error == ERROR_IO_PENDING) {
            // 等待操作完成
            DWORD waitResult = WaitForSingleObject(overlapped.hEvent, 1000);
            if (waitResult == WAIT_OBJECT_0) {
                GetOverlappedResult(handle, &overlapped, &bytesWritten, FALSE);
            } else {
                Logger::instance().error("WriteFile timeout or error: " + std::to_string(waitResult));
                CloseHandle(overlapped.hEvent);
                return false;
            }
        } else {
            Logger::instance().error("WriteFile failed: " + std::to_string(error));
            CloseHandle(overlapped.hEvent);
            return false;
        }
    }

    CloseHandle(overlapped.hEvent);

    bool success = (bytesWritten == data.size());
    Logger::instance().debug("Write result: " + std::string(success ? "SUCCESS" : "FAILED") +
                             ", bytes written: " + std::to_string(bytesWritten));
    return success;
}

bool WindowsHIDDevice::isOpen() const {
    return isOpen_.load();
}

bool WindowsHIDDevice::setOutputReport(const std::vector<uint8_t>& data) {
    if (!isOpen_.load() || deviceHandle_ == nullptr) {
        Logger::instance().error("setOutputReport failed: Device not open");
        return false;
    }

    HANDLE handle = static_cast<HANDLE>(deviceHandle_);

    // HidD_SetOutputReport 需要 report buffer
    std::vector<uint8_t> reportBuffer;
    reportBuffer.reserve(data.size() + 1);

    // 如果第一个字节不是 Report ID，添加 0x00
    if (data.empty() || data[0] == 0x00) {
        reportBuffer.push_back(0x00);  // Report ID
        reportBuffer.insert(reportBuffer.end(), data.begin(), data.end());
    } else {
        reportBuffer.insert(reportBuffer.end(), data.begin(), data.end());
    }

    // 调试：显示要发送的数据
    std::ostringstream oss;
    oss << "setOutputReport " << reportBuffer.size() << " bytes: ";
    for (size_t i = 0; i < std::min(size_t(12), reportBuffer.size()); ++i) {
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)reportBuffer[i] << " ";
    }
    Logger::instance().debug(oss.str());

    // 使用 HidD_SetOutputReport
    BOOL result = HidD_SetOutputReport(
        handle,
        reportBuffer.data(),
        static_cast<DWORD>(reportBuffer.size())
    );

    if (!result) {
        DWORD error = GetLastError();
        Logger::instance().error("HidD_SetOutputReport failed: " + std::to_string(error));
        return false;
    }

    Logger::instance().debug("HidD_SetOutputReport: SUCCESS");
    return true;
}

bool WindowsHIDDevice::getInputReport(uint8_t reportId, uint8_t* buffer, DWORD bufferSize) {
    if (!isOpen_.load() || deviceHandle_ == nullptr) {
        return false;
    }

    HANDLE handle = static_cast<HANDLE>(deviceHandle_);

    // 设置 Report ID 作为第一个字节
    buffer[0] = reportId;

    // 使用 HidD_GetInputReport 主动请求数据
    BOOL result = HidD_GetInputReport(
        handle,
        buffer,
        bufferSize
    );

    if (!result) {
        DWORD error = GetLastError();
        // 静默失败，避免日志刷屏
        return false;
    }

    return true;
}

void WindowsHIDDevice::initializeDevice(uint16_t vid, uint16_t pid) {
    // Switch Pro Controller 初始化
    if (isSwitchFamilyDevice(vid, pid)) {
        Logger::instance().info("========== Switch Pro Controller ==========");

        // 检测连接类型（通过产品名称）
        bool isBluetooth = isBluetoothConnectionName(deviceInfo_.product);

        if (isBluetooth) {
            Logger::instance().info("连接方式: 蓝牙 (Bluetooth)");
            std::cerr << "[INFO] 连接方式: 蓝牙 (Bluetooth)" << std::endl;
            std::cerr.flush();

            Logger::instance().info("⚠️  Windows 蓝牙栈独占设备，初始化命令将失败");

            // === 检测 HidHide 驱动 ===
            std::cerr << "[INFO] 检测 HidHide 驱动..." << std::endl;
            std::cerr.flush();

            bool hidHideInstalled = HidHideIntegration::isDriverInstalled();

            std::cerr << "[DEBUG] HidHide 驱动状态: " << (hidHideInstalled ? "已安装" : "未安装") << std::endl;
            std::cerr.flush();

            if (hidHideInstalled) {
                Logger::instance().info("✅ HidHide 驱动已安装！");

                // 获取驱动版本
                std::string version = HidHideIntegration::getDriverVersion();
                if (!version.empty()) {
                    Logger::instance().info("HidHide 版本: " + version);
                }

                // 尝试配置 HidHide
                Logger::instance().info("配置 HidHide...");

                // 1. 添加当前应用到白名单
                if (HidHideIntegration::addCurrentAppToWhitelist()) {
                    Logger::instance().info("✅ 已添加当前应用到 HidHide 白名单");
                } else {
                    Logger::instance().error("❌ 添加应用到白名单失败: " +
                        HidHideIntegration::getLastErrorText());
                }

                // 2. 添加设备到黑名单（需要设备实例 ID）
                // 暂时跳过，因为需要设备实例 ID
                // if (HidHideIntegration::addDeviceToBlacklist(...))

                // 3. 启用设备隐藏
                bool wasActive = HidHideIntegration::isDeviceHidingActive();
                if (!wasActive) {
                    Logger::instance().info("启用 HidHide 设备隐藏...");
                    if (HidHideIntegration::setDeviceHidingActive(true)) {
                        Logger::instance().info("✅ HidHide 设备隐藏已启用");
                    } else {
                        Logger::instance().error("❌ 启用设备隐藏失败: " +
                            HidHideIntegration::getLastErrorText());
                    }
                } else {
                    Logger::instance().info("HidHide 设备隐藏已处于启用状态");
                }

                // 重新打开设备（现在应该绕过了 bthhid.sys）
                Logger::instance().info("重新打开设备...");
                close();
                std::this_thread::sleep_for(std::chrono::milliseconds(100));

                if (open(deviceInfo_.path)) {
                    Logger::instance().info("✅ 设备重新打开成功！现在可以发送初始化命令");
                } else {
                    Logger::instance().error("❌ 设备重新打开失败");
                }
            } else {
                Logger::instance().warning("⚠️  HidHide 驱动未安装");
                Logger::instance().info("提示：安装 HidHide 驱动可以解决蓝牙陀螺仪问题");
                Logger::instance().info("下载地址: https://github.com/nefarius/HidHide/releases");
            }

            Logger::instance().info("使用 SDL 兼容的初始化序列");

            // === 蓝牙模式：不需要握手，直接使用子命令 ===
            // 参考 SDL 实现：蓝牙模式跳过 Handshake，直接请求设备信息

            // 蓝牙数据包长度：49 字节
            const size_t packetSize = 49;

            // 步骤 1: 请求设备信息 (子命令 0x02)
            std::vector<uint8_t> requestInfo(packetSize, 0);
            requestInfo[0] = 0x01;   // Report ID: Rumble and subcommand
            requestInfo[1] = 0x00;   // Packet number
            requestInfo[10] = 0x02;  // Subcommand: Request device info
            bool result1 = setOutputReport(requestInfo);
            if (result1) {
                Logger::instance().info("蓝牙 - 步骤 1 (请求设备信息): 成功 ✅");
            } else {
                Logger::instance().warning("蓝牙 - 步骤 1 (请求设备信息): 失败 ⚠️ (ERROR_BUSY 170 = 正常，需要 HidHide)");
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(50));

            // 步骤 2: 设置输入报告模式 (子命令 0x03)
            // 蓝牙模式使用 Simple Controller State (0x3F) 作为默认
            std::vector<uint8_t> setInputMode(packetSize, 0);
            setInputMode[0] = 0x01;
            setInputMode[1] = 0x01;   // Packet number
            setInputMode[10] = 0x03; // Subcommand: Set input report mode
            setInputMode[11] = 0x3F; // Simple mode (0x3F) for Bluetooth
            bool result2 = setOutputReport(setInputMode);
            if (result2) {
                Logger::instance().info("蓝牙 - 步骤 2 (设置输入模式 0x3F): 成功 ✅");
            } else {
                Logger::instance().warning("蓝牙 - 步骤 2 (设置输入模式): 失败 ⚠️");
            }

            // 步骤 3: 启用 IMU (子命令 0x40)
            std::vector<uint8_t> enableIMU(packetSize, 0);
            enableIMU[0] = 0x01;
            enableIMU[1] = 0x02;   // Packet number
            enableIMU[10] = 0x40; // Subcommand: Enable IMU
            enableIMU[11] = 0x01; // Enable
            bool result3 = setOutputReport(enableIMU);
            if (result3) {
                Logger::instance().info("蓝牙 - 步骤 3 (启用 IMU): 成功 ✅");
            } else {
                Logger::instance().warning("蓝牙 - 步骤 3 (启用 IMU): 失败 ⚠️");
            }

            // 总结
            if (!result1 && !result2 && !result3) {
                Logger::instance().warning("========================================");
                Logger::instance().warning("所有初始化命令失败 (ERROR_BUSY 170)");
                Logger::instance().warning("这是 Windows 蓝牙栈的正常行为");
                Logger::instance().warning("");
                Logger::instance().warning("解决方案：");
                Logger::instance().warning("1. 安装 HidHide 驱动: https://github.com/nefarius/HidHide/releases");
                Logger::instance().warning("2. 使用 HidHide Configuration Tool 将此程序添加到白名单");
                Logger::instance().warning("3. 将 Switch Pro Controller 添加到黑名单");
                Logger::instance().warning("========================================");
            }

            Logger::instance().info("蓝牙初始化完成，尝试读取数据...");
            return;
        }

        // === USB 模式：需要握手序列 ===
        Logger::instance().info("连接方式: USB (有线连接)");
        Logger::instance().info("使用 SDL 兼容的 USB 握手序列");

        // USB 数据包长度：64 字节
        const size_t packetSize = 64;

        // 步骤 1: 发送 Handshake 命令（专有命令 0x02）
        std::vector<uint8_t> handshake(packetSize, 0);
        handshake[0] = 0x80;  // Proprietary output
        handshake[1] = 0x02;  // Handshake command
        bool result0 = write(handshake);
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
        if (result0) {
            Logger::instance().info("USB - Handshake #1: 成功 ✅");
        } else {
            Logger::instance().warning("USB - Handshake #1: 失败 ⚠️");
        }

        // 步骤 2: 发送 High Speed 命令（专有命令 0x03）
        std::vector<uint8_t> highSpeed(packetSize, 0);
        highSpeed[0] = 0x80;
        highSpeed[1] = 0x03;
        bool resultHS = write(highSpeed);
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
        // 某些设备不响应此命令，所以不标记为失败

        // 步骤 3: 再次发送 Handshake
        bool result1 = write(handshake);
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
        if (result1) {
            Logger::instance().info("USB - Handshake #2: 成功 ✅");
        }

        // 步骤 4: 强制 USB 模式（专有命令 0x04）
        std::vector<uint8_t> forceUSB(packetSize, 0);
        forceUSB[0] = 0x80;
        forceUSB[1] = 0x04;
        bool result2 = write(forceUSB);
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
        if (result2) {
            Logger::instance().info("USB - Force USB: 成功 ✅");
        }

        // 步骤 5: 启用 IMU (子命令 0x40)
        std::vector<uint8_t> enableIMU(packetSize, 0);
        enableIMU[0] = 0x01;   // Report ID
        enableIMU[1] = 0x00;   // Packet number
        enableIMU[10] = 0x40;  // Subcommand: Enable IMU
        enableIMU[11] = 0x01;  // Enable
        bool result3 = setOutputReport(enableIMU);
        if (result3) {
            Logger::instance().info("USB - 启用 IMU: 成功 ✅");
        } else {
            Logger::instance().warning("USB - 启用 IMU: 失败 ⚠️");
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(50));

        // 步骤 6: 设置输入报告模式 (子命令 0x03)
        std::vector<uint8_t> setInputMode(packetSize, 0);
        setInputMode[0] = 0x01;
        setInputMode[1] = 0x01;   // Packet number
        setInputMode[10] = 0x03; // Subcommand: Set input report mode
        setInputMode[11] = 0x30; // Full mode (0x30) for USB
        bool result4 = setOutputReport(setInputMode);
        if (result4) {
            Logger::instance().info("USB - 设置输入模式 0x30: 成功 ✅");
        } else {
            Logger::instance().warning("USB - 设置输入模式: 失败 ⚠️");
        }

        Logger::instance().info("USB 初始化完成，尝试读取数据...");
    }
}

void WindowsHIDDevice::setDataCallback(DataCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    dataCallback_ = std::move(callback);

    // 如果读取线程还没启动，现在启动它
    if (!readThread_.joinable() && isOpen_.load()) {
        // Xbox 360 等标准 HID 手柄会在 USB 中断端点自动发送数据
        // 不需要发送任何初始化命令
        
        shouldStop_.store(false);
        readThread_ = std::thread(&WindowsHIDDevice::readThreadLoop, this);
    }
}

void WindowsHIDDevice::setErrorCallback(ErrorCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    errorCallback_ = std::move(callback);
}

void WindowsHIDDevice::setDisconnectCallback(DisconnectCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    disconnectCallback_ = std::move(callback);
}

void WindowsHIDDevice::readThreadLoop() {
    HANDLE handle = static_cast<HANDLE>(deviceHandle_);

    const bool isSwitchBluetooth =
        isSwitchFamilyDevice(deviceInfo_.vendorId, deviceInfo_.productId) &&
        isBluetoothConnectionName(deviceInfo_.product);

    // HID 报告缓冲区（典型最大值为 64 字节）
    constexpr size_t BUFFER_SIZE = 256;
    std::vector<uint8_t> buffer(BUFFER_SIZE);

    // 创建重叠结构用于异步读取
    OVERLAPPED overlapped = {0};
    overlapped.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);

    DWORD bytesRead = 0;

    // 调试：读取计数器
    static int readCount = 0;
    static int timeoutCount = 0;
    static auto lastDebugTime = std::chrono::steady_clock::now();

    if (isSwitchBluetooth) {
        std::cerr << "[READ THREAD] 蓝牙模式（Switch）：使用 HidD_GetInputReport 轮询" << std::endl;
    } else {
        std::cerr << "[READ THREAD] 通用模式：使用 ReadFile 异步读取" << std::endl;
    }
    std::cerr << "[READ THREAD] VID=" << std::hex << deviceInfo_.vendorId << " PID=" << deviceInfo_.productId << std::dec << std::endl;
    std::cerr.flush();

    while (!shouldStop_.load()) {
        // 只有 Switch 系蓝牙连接走主动轮询，其他手柄统一使用异步读取。
        if (isSwitchBluetooth) {
            // === Switch Pro 蓝牙模式：使用 HidD_GetInputReport 轮询 ===
            // 尝试不同的 Report ID
            std::vector<uint8_t> reportIds = {0x30, 0x21, 0x3F, 0x81, 0x01};

            for (uint8_t reportId : reportIds) {
                if (getInputReport(reportId, buffer.data(), static_cast<DWORD>(buffer.size()))) {
                    readCount++;

                    // 调试：第一次成功读取时输出数据
                    if (readCount == 1) {
                        std::cerr << "[SWITCH BT] 成功读取数据! ReportID=0x" << std::hex << (int)reportId << std::dec
                                  << " Size=" << buffer.size() << std::endl;
                        std::cerr.flush();
                    }

                    // 触发数据回调
                    DataCallback dataCallback;
                    {
                        std::lock_guard<std::mutex> lock(callbackMutex_);
                        dataCallback = dataCallback_;
                    }
                    if (dataCallback) {
                        dataCallback(buffer);
                    }
                    break;
                }
            }

            // 调试：每5秒输出一次统计
            auto now = std::chrono::steady_clock::now();
            auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastDebugTime).count();

            if (elapsed >= 5000) {
                std::cerr << "[DEBUG] 蓝牙轮询: 已读取 " << readCount << " 次" << std::endl;
                std::cerr.flush();
                lastDebugTime = now;
            }

            // 轮询间隔压到 1ms，避免把高回报率设备人为限死在约 60Hz。
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        } else {
            // === USB/DS4/Xbox 模式：使用 ReadFile 异步读取 ===
            // USB HID 设备需要主机不断轮询，每次 ReadFile 请求一个数据包
            // 回报率 = 1秒内收到的数据包数量
            
            // 重置重叠结构
            ResetEvent(overlapped.hEvent);
            overlapped.Internal = 0;
            overlapped.InternalHigh = 0;
            overlapped.Offset = 0;
            overlapped.OffsetHigh = 0;

            // 开始异步读取
            BOOL result = ReadFile(
                handle,
                buffer.data(),
                static_cast<DWORD>(buffer.size()),
                &bytesRead,
                &overlapped
            );

            if (!result) {
                DWORD error = GetLastError();

                if (error == ERROR_IO_PENDING) {
                    // 等待数据到达 - 使用较长的超时时间
                    DWORD waitResult = WaitForSingleObject(overlapped.hEvent, 500);
                    
                    if (waitResult == WAIT_OBJECT_0) {
                        // 数据到达
                        if (GetOverlappedResult(handle, &overlapped, &bytesRead, FALSE) && bytesRead > 0) {
                            readCount++;

                            // 调试：每5秒输出一次读取统计
                            auto now = std::chrono::steady_clock::now();
                            auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastDebugTime).count();

                            if (elapsed >= 5000) {
                                std::cerr << "[DEBUG] USB读取: 已读取 " << readCount << " 次, 超时 " << timeoutCount << " 次" << std::endl;
                                std::cerr.flush();
                                lastDebugTime = now;
                            }

                            // 调整数据大小为实际读取的字节数
                            buffer.resize(bytesRead);

                            // 调试：显示第一个数据包
                            static int firstReadDebug = 0;
                            if (firstReadDebug < 3) {
                                std::cerr << "[READ] 读取到数据: size=" << bytesRead;
                                if (bytesRead > 0) {
                                    std::cerr << " first=0x" << std::hex << (int)buffer[0] << std::dec;
                                }
                                std::cerr << std::endl;
                                firstReadDebug++;
                            }

                            // 触发数据回调
                            DataCallback dataCallback;
                            {
                                std::lock_guard<std::mutex> lock(callbackMutex_);
                                dataCallback = dataCallback_;
                            }
                            if (dataCallback) {
                                dataCallback(buffer);
                            } else {
                                // 没有设置回调！
                                std::cout << "[ERROR] 数据回调未设置！" << std::endl;
                                std::cout.flush();
                            }

                            // 恢复缓冲区大小
                            buffer.resize(BUFFER_SIZE);
                        }
                    } else if (waitResult == WAIT_TIMEOUT) {
                        // 超时 - 某些设备在无操作时可能不发送数据
                        timeoutCount++;
                        // 继续循环，重新发起读取请求
                        continue;
                    } else {
                        // 错误或断开连接
                        DisconnectCallback disconnectCallback;
                        {
                            std::lock_guard<std::mutex> lock(callbackMutex_);
                            disconnectCallback = disconnectCallback_;
                        }
                        if (disconnectCallback) {
                            disconnectCallback();
                        }
                        break;
                    }
                } else {
                    // ReadFile 失败（不是 ERROR_IO_PENDING）
                    DWORD err = GetLastError();
                    static int errorDebug = 0;
                    if (errorDebug < 5) {
                        std::cerr << "[READ ERROR] ReadFile failed: " << err << std::endl;
                        errorDebug++;
                    }
                    std::this_thread::sleep_for(std::chrono::milliseconds(1));
                    continue;
                }
            } else {
                // ReadFile 立即完成（同步模式）
                if (bytesRead > 0) {
                    readCount++;
                    
                    buffer.resize(bytesRead);

                    // 触发数据回调
                    DataCallback dataCallback;
                    {
                        std::lock_guard<std::mutex> lock(callbackMutex_);
                        dataCallback = dataCallback_;
                    }
                    if (dataCallback) {
                        dataCallback(buffer);
                    }

                    buffer.resize(BUFFER_SIZE);
                }
            }
        }
    }

    CloseHandle(overlapped.hEvent);
}

std::vector<DeviceInfo> WindowsHIDDevice::enumerateDevices() {
    std::vector<DeviceInfo> devices;

    // 获取 HID 设备集合的 GUID
    // 注意：这是标准的Windows API调用，用于枚举HID设备
    // 仅用于查找游戏手柄设备，不是键盘记录器
    GUID hidGuid;
    HidD_GetHidGuid(&hidGuid);

    // 获取所有 HID 设备的信息集
    HDEVINFO deviceInfoSet = SetupDiGetClassDevsA(
        &hidGuid,
        nullptr,
        nullptr,
        DIGCF_PRESENT | DIGCF_DEVICEINTERFACE
    );

    if (deviceInfoSet == INVALID_HANDLE_VALUE) {
        Logger::instance().error("Failed to get device info set");
        return devices;
    }

    // 枚举所有设备
    SP_DEVICE_INTERFACE_DATA deviceInterfaceData;
    deviceInterfaceData.cbSize = sizeof(SP_DEVICE_INTERFACE_DATA);

    for (DWORD deviceIndex = 0; ; deviceIndex++) {
        if (!SetupDiEnumDeviceInterfaces(
            deviceInfoSet,
            nullptr,
            &hidGuid,
            deviceIndex,
            &deviceInterfaceData
        )) {
            if (GetLastError() == ERROR_NO_MORE_ITEMS) {
                break;
            }
            continue;
        }

        // 获取设备接口详细信息
        DWORD requiredSize = 0;
        SetupDiGetDeviceInterfaceDetailA(
            deviceInfoSet,
            &deviceInterfaceData,
            nullptr,
            0,
            &requiredSize,
            nullptr
        );

        if (requiredSize == 0) {
            continue;
        }

        std::vector<BYTE> buffer(requiredSize);
        PSP_DEVICE_INTERFACE_DETAIL_DATA_A detailData =
            reinterpret_cast<PSP_DEVICE_INTERFACE_DETAIL_DATA_A>(buffer.data());

        detailData->cbSize = sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_A);

        if (!SetupDiGetDeviceInterfaceDetailA(
            deviceInfoSet,
            &deviceInterfaceData,
            detailData,
            requiredSize,
            nullptr,
            nullptr
        )) {
            continue;
        }

        // 打开设备以获取属性（只读，用于查询设备信息）
        // 这是标准的Windows HID设备查询方法
        // 仅用于获取设备名称和厂商信息，不会读取任何输入数据
        HANDLE deviceHandle = CreateFileA(
            detailData->DevicePath,
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            nullptr,
            OPEN_EXISTING,
            0,
            nullptr
        );

        if (deviceHandle == INVALID_HANDLE_VALUE) {
            continue;
        }

        // 获取设备属性
        HIDD_ATTRIBUTES attributes;
        attributes.Size = sizeof(HIDD_ATTRIBUTES);

        DeviceInfo info;
        info.path = detailData->DevicePath;

        if (HidD_GetAttributes(deviceHandle, &attributes)) {
            info.vendorId = attributes.VendorID;
            info.productId = attributes.ProductID;
        }

        // 获取制造商字符串
        wchar_t manufacturerBuffer[256] = {0};
        if (HidD_GetManufacturerString(deviceHandle, manufacturerBuffer, sizeof(manufacturerBuffer))) {
            info.manufacturer = wideToUtf8(manufacturerBuffer);
        }

        // 获取产品字符串
        wchar_t productBuffer[256] = {0};
        if (HidD_GetProductString(deviceHandle, productBuffer, sizeof(productBuffer))) {
            info.product = wideToUtf8(productBuffer);
        }

        CloseHandle(deviceHandle);

        devices.push_back(info);
    }

    SetupDiDestroyDeviceInfoList(deviceInfoSet);

    Logger::instance().info("Found " + std::to_string(devices.size()) + " HID devices");

    return devices;
}

std::string WindowsHIDDevice::wideToUtf8(const wchar_t* wstr) {
    if (!wstr) {
        return "";
    }

    int size = WideCharToMultiByte(CP_UTF8, 0, wstr, -1,
                                   nullptr, 0, nullptr, nullptr);

    if (size <= 0) {
        return "";
    }

    std::string result(size - 1, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr, -1,
                       &result[0], size, nullptr, nullptr);

    return result;
}

// HidHide 配置
bool WindowsHIDDevice::configureHidHide() {
    // 检查是否是 Switch Pro Controller
    if (deviceInfo_.vendorId != 0x057E) {
        return true; // 不是 Switch，不需要配置
    }

    // 检查是否是蓝牙模式
    std::string productLower = deviceInfo_.product;
    std::transform(productLower.begin(), productLower.end(),
                  productLower.begin(), ::tolower);

    bool isBluetooth = (productLower.find("wireless") != std::string::npos);

    if (!isBluetooth) {
        return true; // USB 模式不需要 HidHide
    }

    // 蓝牙 Switch Pro - 尝试配置 HidHide
    Logger::instance().info("检测到蓝牙 Switch Pro Controller");

    // 检查 HidHide 驱动是否已安装（静默检测）
    if (!HidHideIntegration::isDriverInstalled()) {
        // 驱动未安装，静默跳过，不显示提示
        Logger::instance().debug("HidHide 驱动未安装，跳过蓝牙配置");
        return false;
    }

    // 获取设备实例 ID
    // 从设备路径提取（需要从 SetupAPI 获取完整设备实例 ID）
    // 简化处理：使用 VID/PID 作为标识
    std::ostringstream deviceId;
    deviceId << "HID\\VID_" << std::hex << std::setw(4) << std::setfill('0')
             << std::uppercase << deviceInfo_.vendorId
             << "&PID_" << std::setw(4) << deviceInfo_.productId
             << std::dec;

    // 尝试配置 HidHide
    Logger::instance().info("正在配置 HidHide...");

    if (!HidHideIntegration::configureDevice(deviceId.str())) {
        Logger::instance().error("HidHide 配置失败: " +
                                 HidHideIntegration::getLastErrorText());
        return false;
    }

    ConsoleUI& ui = ConsoleUI::instance();
    ui.success("✅ HidHide 配置成功！");
    ui.log("   设备已添加到黑名单（隐藏）");
    ui.log("   当前应用已添加到白名单（可访问）");
    ui.log("");

    return true;
}

// HIDDevice::create 的实现
std::unique_ptr<HIDDevice> HIDDevice::create() {
    return std::make_unique<WindowsHIDDevice>();
}

// HIDDevice::enumerateDevices 的实现
std::vector<DeviceInfo> HIDDevice::enumerateDevices() {
    return WindowsHIDDevice::enumerateDevices();
}

} // namespace gamepad

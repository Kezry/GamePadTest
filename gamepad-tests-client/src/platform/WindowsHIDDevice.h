/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    WindowsHIDDevice.h
 * @brief   Windows平台HID设备实现
 */

#pragma once

#include "platform/HIDDevice.h"
#include <thread>
#include <atomic>
#include <mutex>
#include <vector>
#include <winsock2.h>
#include <windows.h>

// 前向声明设备句柄类型
struct HIDDeviceHandle_ {
    void* handle;
};

namespace gamepad {

/**
 * @brief Windows 平台 HID 设备实现
 *
 * 使用 Windows 原生 HID API
 */
class WindowsHIDDevice : public HIDDevice {
public:
    WindowsHIDDevice();
    ~WindowsHIDDevice() override;

    bool open(const std::string& path) override;
    void close() override;
    bool write(const std::vector<uint8_t>& data) override;
    bool isOpen() const override;

    /**
     * @brief 初始化设备（发送启用陀螺仪的命令）
     * @param vid 厂商ID
     * @param pid 产品ID
     */
    void initializeDevice(uint16_t vid, uint16_t pid);

    /**
     * @brief 使用 HID SetOutputReport 发送数据
     * @param data 要发送的数据
     * @return 成功返回 true
     */
    bool setOutputReport(const std::vector<uint8_t>& data);

    /**
     * @brief 使用 HID GetInputReport 轮询读取数据（用于蓝牙设备）
     * @param reportId Report ID
     * @param buffer 输出缓冲区
     * @param bufferSize 缓冲区大小
     * @return 成功返回 true
     */
    bool getInputReport(uint8_t reportId, uint8_t* buffer, DWORD bufferSize);

    void setDataCallback(DataCallback callback) override;
    void setErrorCallback(ErrorCallback callback) override;
    void setDisconnectCallback(DisconnectCallback callback) override;

    static std::vector<DeviceInfo> enumerateDevices();

    /**
     * @brief 配置 HidHide（针对蓝牙 Switch Pro）
     *
     * 检查是否需要使用 HidHide，如果需要则自动配置
     * @return true 如果配置成功或不需要配置
     */
    bool configureHidHide();

private:
    /**
     * @brief 后台读取线程
     *
     * 持续从设备读取数据并触发回调
     */
    void readThreadLoop();

    /**
     * @brief 将宽字符转换为 UTF-8
     *
     * Windows API 返回 wchar_t*
     */
    static std::string wideToUtf8(const wchar_t* wstr);

    void* deviceHandle_;                      // 设备句柄
    std::atomic<bool> isOpen_;                 // 设备是否打开
    std::atomic<bool> shouldStop_;             // 停止标志
    DeviceInfo deviceInfo_;                    // 设备信息（用于检测连接类型）

    std::thread readThread_;                   // 读取线程
    DataCallback dataCallback_;
    ErrorCallback errorCallback_;
    DisconnectCallback disconnectCallback_;

    mutable std::mutex callbackMutex_;         // 保护回调函数
};

} // namespace gamepad

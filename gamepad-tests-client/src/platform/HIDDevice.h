/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    HIDDevice.h
 * @brief   HID设备抽象接口
 */

#pragma once

#include "network/DataTypes.h"
#include <vector>
#include <string>
#include <functional>
#include <memory>

namespace gamepad {

/**
 * @brief HID 设备回调类型
 */
using DataCallback = std::function<void(const std::vector<uint8_t>&)>;
using ErrorCallback = std::function<void(const std::string&)>;
using DisconnectCallback = std::function<void()>;

/**
 * @brief HID 设备抽象接口
 *
 * 封装底层 hidapi，提供面向对象的设备访问接口
 *
 * 设计原则:
 * - RAII 资源管理
 * - 异常安全
 * - 线程安全
 * - 平台无关
 */
class HIDDevice {
public:
    virtual ~HIDDevice() = default;

    // 禁止拷贝
    HIDDevice(const HIDDevice&) = delete;
    HIDDevice& operator=(const HIDDevice&) = delete;

    /**
     * @brief 打开设备
     * @param path 设备路径 (来自 DeviceInfo)
     * @return 成功返回 true
     */
    virtual bool open(const std::string& path) = 0;

    /**
     * @brief 关闭设备
     */
    virtual void close() = 0;

    /**
     * @brief 写入数据到设备
     * @param data 要写入的字节数组
     * @return 成功返回 true
     *
     * 注意: Windows 上可能失败 (权限限制)
     */
    virtual bool write(const std::vector<uint8_t>& data) = 0;

    /**
     * @brief 检查设备是否已打开
     */
    virtual bool isOpen() const = 0;

    /**
     * @brief 初始化设备（发送启用陀螺仪的命令）
     * @param vid 厂商ID
     * @param pid 产品ID
     */
    virtual void initializeDevice(uint16_t vid, uint16_t pid) = 0;

    /**
     * @brief 设置数据接收回调
     *
     * 回调在后台线程中调用
     */
    virtual void setDataCallback(DataCallback callback) = 0;

    /**
     * @brief 设置错误回调
     */
    virtual void setErrorCallback(ErrorCallback callback) = 0;

    /**
     * @brief 设置断开连接回调
     */
    virtual void setDisconnectCallback(DisconnectCallback callback) = 0;

    /**
     * @brief 枚举所有 HID 设备
     * @return 设备列表
     *
     * 静态方法，不需要实例
     */
    static std::vector<DeviceInfo> enumerateDevices();

    /**
     * @brief 创建 HID 设备实例
     *
     * 工厂方法，返回平台特定的实现
     */
    static std::unique_ptr<HIDDevice> create();

protected:
    HIDDevice() = default;
};

} // namespace gamepad

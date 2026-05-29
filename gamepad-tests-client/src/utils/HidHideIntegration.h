/*
 * HidHide Integration for Gamepad Test Client
 *
 * Copyright (c) 2025
 * MIT License
 *
 * @file    HidHideIntegration.h
 * @brief   HidHide 驱动集成，用于绕过 Windows 蓝牙 HID 限制
 */

#ifndef HIDHIDE_INTEGRATION_H
#define HIDHIDE_INTEGRATION_H

#include <string>
#include <vector>
#include <windows.h>

namespace gamepad {

/**
 * @brief HidHide 驱动集成类
 *
 * 功能：
 * - 检测 HidHide 驱动是否已安装
 * - 将设备添加到黑名单（隐藏设备）
 * - 将应用添加到白名单（允许访问）
 * - 启用/禁用设备隐藏功能
 */
class HidHideIntegration {
public:
    /**
     * @brief 检查 HidHide 驱动是否已安装
     * @return true 如果驱动已安装
     */
    static bool isDriverInstalled();

    /**
     * @brief 获取 HidHide 驱动版本
     * @return 版本字符串，如果未安装返回空字符串
     */
    static std::string getDriverVersion();

    /**
     * @brief 获取当前可执行文件的完整路径（DOS 设备路径格式）
     * @return 路径字符串
     */
    static std::string getCurrentExecutablePath();

    /**
     * @brief 将当前应用程序添加到 HidHide 白名单
     * @return true 如果成功
     */
    static bool addCurrentAppToWhitelist();

    /**
     * @brief 将设备添加到黑名单（隐藏设备）
     * @param deviceInstanceId 设备实例 ID（例如 "HID\VID_057E&PID_2009..."）
     * @return true 如果成功
     */
    static bool addDeviceToBlacklist(const std::string& deviceInstanceId);

    /**
     * @brief 启用设备隐藏功能
     * @param active true 启用，false 禁用
     * @return true 如果成功
     */
    static bool setDeviceHidingActive(bool active);

    /**
     * @brief 检查设备隐藏是否已启用
     * @return true 如果已启用
     */
    static bool isDeviceHidingActive();

    /**
     * @brief 获取所有被隐藏的设备列表
     * @return 设备实例 ID 列表
     */
    static std::vector<std::string> getBlacklistedDevices();

    /**
     * @brief 获取所有白名单应用列表
     * @return 应用路径列表
     */
    static std::vector<std::string> getWhitelistedApps();

    /**
     * @brief 完整配置流程：
     * 1. 检查驱动是否安装
     * 2. 将当前应用添加到白名单
     * 3. 将设备添加到黑名单
     * 4. 启用设备隐藏
     *
     * @param deviceInstanceId 设备实例 ID
     * @return true 如果所有步骤都成功
     */
    static bool configureDevice(const std::string& deviceInstanceId);

    /**
     * @brief 获取最后的错误信息
     * @return 错误信息字符串
     */
    static std::string getLastErrorText();

private:
    /**
     * @brief 打开 HidHide 控制设备
     * @return 设备句柄，如果失败返回 INVALID_HANDLE_VALUE
     */
    static HANDLE openControlDevice();

    /**
     * @brief IOCTL 代码定义
     */
    static constexpr DWORD IOCTL_GET_BLACKLIST = 0x80002000;
    static constexpr DWORD IOCTL_SET_BLACKLIST = 0x80002004;
    static constexpr DWORD IOCTL_GET_WHITELIST = 0x80002008;
    static constexpr DWORD IOCTL_SET_WHITELIST = 0x8000200C;
    static constexpr DWORD IOCTL_GET_ACTIVE    = 0x80002010;
    static constexpr DWORD IOCTL_SET_ACTIVE    = 0x80002014;

    static std::string lastError_;
};

} // namespace gamepad

#endif // HIDHIDE_INTEGRATION_H

/*
 * HidHide Integration for Gamepad Test Client
 *
 * Copyright (c) 2025
 * MIT License
 *
 * @file    HidHideIntegration.cpp
 * @brief   HidHide 驱动集成实现
 */

#include "HidHideIntegration.h"
#include <iostream>
#include <sstream>
#include <vector>
#include <windows.h>

using namespace std;

namespace gamepad {

std::string HidHideIntegration::lastError_;

// ===== 驱动检测 =====

bool HidHideIntegration::isDriverInstalled() {
    // 方法1: 尝试打开控制设备
    HANDLE hDevice = openControlDevice();
    if (hDevice != INVALID_HANDLE_VALUE) {
        CloseHandle(hDevice);
        return true;
    }

    // 方法2: 检查注册表
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_CLASSES_ROOT,
        "Installer\\Dependencies\\NSS.Drivers.HidHide.x64",
        0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        RegCloseKey(hKey);
        return true;
    }

    return false;
}

string HidHideIntegration::getDriverVersion() {
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_CLASSES_ROOT,
        "Installer\\Dependencies\\NSS.Drivers.HidHide.x64",
        0, KEY_READ, &hKey) != ERROR_SUCCESS) {
        return "";
    }

    char version[256] = {0};
    DWORD size = sizeof(version);
    DWORD type = REG_SZ;

    if (RegQueryValueExA(hKey, "Version", nullptr, &type,
        (LPBYTE)version, &size) != ERROR_SUCCESS) {
        RegCloseKey(hKey);
        return "";
    }

    RegCloseKey(hKey);
    return string(version);
}

// ===== 路径获取 =====

string HidHideIntegration::getCurrentExecutablePath() {
    char buffer[MAX_PATH];
    GetModuleFileNameA(nullptr, buffer, MAX_PATH);

    // 转换为 DOS 设备路径格式（\??\C:\...）
    string path(buffer);
    // 确保是完整的绝对路径
    return path;
}

// ===== 设备控制 =====

HANDLE HidHideIntegration::openControlDevice() {
    HANDLE hDevice = CreateFileA(
        "\\\\.\\HidHide",
        GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        nullptr,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL,
        nullptr
    );

    if (hDevice == INVALID_HANDLE_VALUE) {
        DWORD error = GetLastError();
        ostringstream oss;
        oss << "无法打开 HidHide 控制设备，错误码: " << error;
        lastError_ = oss.str();
    }

    return hDevice;
}

// ===== 错误信息 =====

std::string HidHideIntegration::getLastErrorText() {
    return lastError_;
}

// ===== 白名单管理 =====

bool HidHideIntegration::addCurrentAppToWhitelist() {
    string appPath = getCurrentExecutablePath();

    HANDLE hDevice = openControlDevice();
    if (hDevice == INVALID_HANDLE_VALUE) {
        return false;
    }

    // 获取当前白名单
    vector<wchar_t> buffer(4096, 0);
    DWORD bytesReturned = 0;

    // 先查询需要的缓冲区大小
    DeviceIoControl(hDevice, IOCTL_GET_WHITELIST,
        nullptr, 0,
        buffer.data(), static_cast<DWORD>(buffer.size() * sizeof(wchar_t)),
        &bytesReturned, nullptr);

    // 将现有白名单转换为字符串列表
    vector<wstring> whitelist;
    const wchar_t* ptr = buffer.data();
    while (*ptr) {
        wstring entry(ptr);
        whitelist.push_back(entry);
        ptr += entry.length() + 1;
    }

    // 检查是否已存在
    wstring wideAppPath;
    int size_needed = MultiByteToWideChar(CP_UTF8, 0, appPath.c_str(), -1, nullptr, 0);
    wideAppPath.resize(size_needed);
    MultiByteToWideChar(CP_UTF8, 0, appPath.c_str(), -1, &wideAppPath[0], size_needed);

    for (const auto& entry : whitelist) {
        if (entry == wideAppPath) {
            CloseHandle(hDevice);
            return true; // 已存在
        }
    }

    // 添加到白名单
    whitelist.push_back(wideAppPath);

    // 构建双 null 结尾的宽字符串
    vector<wchar_t> newBuffer;
    for (const auto& entry : whitelist) {
        newBuffer.insert(newBuffer.end(), entry.begin(), entry.end());
        newBuffer.push_back(L'\0');
    }
    newBuffer.push_back(L'\0'); // 双 null 结尾

    // 发送新白名单
    BOOL result = DeviceIoControl(
        hDevice, IOCTL_SET_WHITELIST,
        newBuffer.data(), static_cast<DWORD>(newBuffer.size() * sizeof(wchar_t)),
        nullptr, 0,
        &bytesReturned, nullptr
    );

    CloseHandle(hDevice);

    if (!result) {
        DWORD error = GetLastError();
        ostringstream oss;
        oss << "添加应用到白名单失败，错误码: " << error;
        lastError_ = oss.str();
        return false;
    }

    return true;
}

vector<string> HidHideIntegration::getWhitelistedApps() {
    vector<string> apps;

    HANDLE hDevice = openControlDevice();
    if (hDevice == INVALID_HANDLE_VALUE) {
        return apps;
    }

    vector<wchar_t> buffer(65536, 0);
    DWORD bytesReturned = 0;

    BOOL result = DeviceIoControl(
        hDevice, IOCTL_GET_WHITELIST,
        nullptr, 0,
        buffer.data(), static_cast<DWORD>(buffer.size() * sizeof(wchar_t)),
        &bytesReturned, nullptr
    );

    CloseHandle(hDevice);

    if (result) {
        const wchar_t* ptr = buffer.data();
        while (*ptr) {
            wstring wideEntry(ptr);
            // 转换为 UTF-8
            int size_needed = WideCharToMultiByte(CP_UTF8, 0,
                wideEntry.c_str(), -1, nullptr, 0, nullptr, nullptr);
            string entry(size_needed, 0);
            WideCharToMultiByte(CP_UTF8, 0,
                wideEntry.c_str(), -1, &entry[0], size_needed, nullptr, nullptr);
            apps.push_back(entry);
            ptr += wideEntry.length() + 1;
        }
    }

    return apps;
}

// ===== 黑名单管理 =====

bool HidHideIntegration::addDeviceToBlacklist(const string& deviceInstanceId) {
    HANDLE hDevice = openControlDevice();
    if (hDevice == INVALID_HANDLE_VALUE) {
        return false;
    }

    // 获取当前黑名单
    vector<wchar_t> buffer(65536, 0);
    DWORD bytesReturned = 0;

    DeviceIoControl(hDevice, IOCTL_GET_BLACKLIST,
        nullptr, 0,
        buffer.data(), static_cast<DWORD>(buffer.size() * sizeof(wchar_t)),
        &bytesReturned, nullptr);

    // 转换为字符串列表
    vector<wstring> blacklist;
    const wchar_t* ptr = buffer.data();
    while (*ptr) {
        wstring entry(ptr);
        blacklist.push_back(entry);
        ptr += entry.length() + 1;
    }

    // 转换设备 ID 为宽字符串
    wstring wideDeviceId;
    int size_needed = MultiByteToWideChar(CP_UTF8, 0,
        deviceInstanceId.c_str(), -1, nullptr, 0);
    wideDeviceId.resize(size_needed);
    MultiByteToWideChar(CP_UTF8, 0,
        deviceInstanceId.c_str(), -1, &wideDeviceId[0], size_needed);

    // 检查是否已存在
    for (const auto& entry : blacklist) {
        if (entry == wideDeviceId) {
            CloseHandle(hDevice);
            return true; // 已存在
        }
    }

    // 添加到黑名单
    blacklist.push_back(wideDeviceId);

    // 构建双 null 结尾的宽字符串
    vector<wchar_t> newBuffer;
    for (const auto& entry : blacklist) {
        newBuffer.insert(newBuffer.end(), entry.begin(), entry.end());
        newBuffer.push_back(L'\0');
    }
    newBuffer.push_back(L'\0');

    // 发送新黑名单
    BOOL result = DeviceIoControl(
        hDevice, IOCTL_SET_BLACKLIST,
        newBuffer.data(), static_cast<DWORD>(newBuffer.size() * sizeof(wchar_t)),
        nullptr, 0,
        &bytesReturned, nullptr
    );

    CloseHandle(hDevice);

    if (!result) {
        DWORD error = GetLastError();
        ostringstream oss;
        oss << "添加设备到黑名单失败，错误码: " << error;
        lastError_ = oss.str();
        return false;
    }

    return true;
}

vector<string> HidHideIntegration::getBlacklistedDevices() {
    vector<string> devices;

    HANDLE hDevice = openControlDevice();
    if (hDevice == INVALID_HANDLE_VALUE) {
        return devices;
    }

    vector<wchar_t> buffer(65536, 0);
    DWORD bytesReturned = 0;

    BOOL result = DeviceIoControl(
        hDevice, IOCTL_GET_BLACKLIST,
        nullptr, 0,
        buffer.data(), static_cast<DWORD>(buffer.size() * sizeof(wchar_t)),
        &bytesReturned, nullptr
    );

    CloseHandle(hDevice);

    if (result) {
        const wchar_t* ptr = buffer.data();
        while (*ptr) {
            wstring wideEntry(ptr);
            // 转换为 UTF-8
            int size_needed = WideCharToMultiByte(CP_UTF8, 0,
                wideEntry.c_str(), -1, nullptr, 0, nullptr, nullptr);
            string entry(size_needed, 0);
            WideCharToMultiByte(CP_UTF8, 0,
                wideEntry.c_str(), -1, &entry[0], size_needed, nullptr, nullptr);
            devices.push_back(entry);
            ptr += wideEntry.length() + 1;
        }
    }

    return devices;
}

// ===== 启用/禁用控制 =====

bool HidHideIntegration::setDeviceHidingActive(bool active) {
    HANDLE hDevice = openControlDevice();
    if (hDevice == INVALID_HANDLE_VALUE) {
        return false;
    }

    BOOLEAN value = active ? TRUE : FALSE;
    DWORD bytesReturned = 0;

    BOOL result = DeviceIoControl(
        hDevice, IOCTL_SET_ACTIVE,
        &value, sizeof(BOOLEAN),
        nullptr, 0,
        &bytesReturned, nullptr
    );

    CloseHandle(hDevice);

    if (!result) {
        DWORD error = GetLastError();
        ostringstream oss;
        oss << "设置设备隐藏状态失败，错误码: " << error;
        lastError_ = oss.str();
        return false;
    }

    return true;
}

bool HidHideIntegration::isDeviceHidingActive() {
    HANDLE hDevice = openControlDevice();
    if (hDevice == INVALID_HANDLE_VALUE) {
        return false;
    }

    BOOLEAN value = FALSE;
    DWORD bytesReturned = 0;

    BOOL result = DeviceIoControl(
        hDevice, IOCTL_GET_ACTIVE,
        nullptr, 0,
        &value, sizeof(BOOLEAN),
        &bytesReturned, nullptr
    );

    CloseHandle(hDevice);

    return result && (value != FALSE);
}

// ===== 完整配置流程 =====

bool HidHideIntegration::configureDevice(const string& deviceInstanceId) {
    // 1. 检查驱动
    if (!isDriverInstalled()) {
        lastError_ = "HidHide 驱动未安装";
        return false;
    }

    // 2. 添加应用到白名单
    if (!addCurrentAppToWhitelist()) {
        return false;
    }

    // 3. 添加设备到黑名单
    if (!addDeviceToBlacklist(deviceInstanceId)) {
        return false;
    }

    // 4. 启用设备隐藏
    if (!setDeviceHidingActive(true)) {
        return false;
    }

    return true;
}

} // namespace gamepad

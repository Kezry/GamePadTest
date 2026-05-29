/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    GamepadDatabase.h
 * @brief   游戏手柄数据库
 */

#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include "network/DataTypes.h"

namespace gamepad {

/**
 * @brief 游戏手柄信息
 */
struct GamepadInfo {
    std::string name;
    DeviceType type;
    bool hasGyroscope;
    bool hasAccelerometer;

    GamepadInfo()
        : type(DeviceType::UNKNOWN)
        , hasGyroscope(false)
        , hasAccelerometer(false) {}

    GamepadInfo(const std::string& n, DeviceType t, bool gyro, bool accel)
        : name(n), type(t), hasGyroscope(gyro), hasAccelerometer(accel) {}
};

/**
 * @brief 游戏手柄数据库
 *
 * 包含已知游戏手柄的 VID/PID 列表
 */
class GamepadDatabase {
public:
    /**
     * @brief 检查设备是否是已知游戏手柄
     * @param vid 厂商 ID
     * @param pid 产品 ID
     * @return 如果是已知手柄返回 true
     */
    static bool isKnownGamepad(uint16_t vid, uint16_t pid) {
        auto key = makeKey(vid, pid);
        return database().count(key) > 0;
    }

    /**
     * @brief 获取游戏手柄信息
     * @param vid 厂商 ID
     * @param pid 产品 ID
     * @return 手柄信息
     */
    static GamepadInfo getGamepadInfo(uint16_t vid, uint16_t pid) {
        auto key = makeKey(vid, pid);
        auto it = database().find(key);
        if (it != database().end()) {
            return it->second;
        }
        return GamepadInfo();
    }

    /**
     * @brief 获取所有已知手柄的名称列表
     */
    static std::vector<std::string> getSupportedGamepads() {
        std::vector<std::string> list;
        for (const auto& entry : database()) {
            list.push_back(entry.second.name);
        }
        return list;
    }

    /**
     * @brief 过滤 HID 设备列表，返回可能是游戏手柄的设备
     * @param devices 所有 HID 设备
     * @return 过滤后的设备列表
     */
    static std::vector<DeviceInfo> filterGamepads(const std::vector<DeviceInfo>& devices) {
        std::vector<DeviceInfo> gamepads;

        for (const auto& device : devices) {
            // 过滤掉明显不是手柄的设备
            if (isLikelyNotGamepad(device)) {
                continue;
            }

            // 如果在已知手柄列表中，直接添加
            if (isKnownGamepad(device.vendorId, device.productId)) {
                gamepads.push_back(device);
                continue;
            }

            // 检查 Usage Page 和 Usage
            // 游戏手柄通常使用:
            // - Usage Page 0x01 (Generic Desktop)
            // - Usage 0x04 (Joystick), 0x05 (Game Pad)
            if (device.usagePage == 0x01) {
                if (device.usage == 0x04 || device.usage == 0x05 || device.usage == 0x08) {
                    gamepads.push_back(device);
                }
            }
        }

        return gamepads;
    }

private:
    /**
     * @brief 检查设备是否明显不是游戏手柄
     */
    static bool isLikelyNotGamepad(const DeviceInfo& device) {
        // 键盘
        if (device.usagePage == 0x01 && device.usage == 0x06) {
            return true;
        }

        // 鼠标
        if (device.usagePage == 0x01 && device.usage == 0x02) {
            return true;
        }

        // 通过产品名称过滤一些明显不是手柄的设备
        std::string productLower = device.product;
        std::transform(productLower.begin(), productLower.end(), productLower.begin(), ::tolower);

        if (productLower.find("keyboard") != std::string::npos) return true;
        if (productLower.find("mouse") != std::string::npos) return true;
        if (productLower.find("touchpad") != std::string::npos) return true;
        if (productLower.find("hub") != std::string::npos) return true;
        if (productLower.find("bluetooth") != std::string::npos && productLower.find("dongle") != std::string::npos) return true;

        // Apple 设备（通常是键盘、触摸板等）
        if (device.vendorId == 0x05ac) {  // Apple
            return true;
        }

        // Realtek 设备（通常是蓝牙适配器）
        if (device.vendorId == 0x0bda) {
            return true;
        }

        return false;
    }

    /**
     * @brief 创建 VID/PID 键
     */
    static uint32_t makeKey(uint16_t vid, uint16_t pid) {
        return (static_cast<uint32_t>(vid) << 16) | pid;
    }

    /**
     * @brief 初始化游戏手柄数据库
     */
    static const std::unordered_map<uint32_t, GamepadInfo>& database() {
        static std::unordered_map<uint32_t, GamepadInfo> db = initializeDatabase();
        return db;
    }

    /**
     * @brief 初始化数据库
     */
    static std::unordered_map<uint32_t, GamepadInfo> initializeDatabase() {
        std::unordered_map<uint32_t, GamepadInfo> db;

        // ========== Sony PlayStation ==========

        // DualShock 4 (PS4)
        db[makeKey(0x054c, 0x05c4)] = GamepadInfo("DualShock 4 v1", DeviceType::DS4, true, true);
        db[makeKey(0x054c, 0x09cc)] = GamepadInfo("DualShock 4 v2", DeviceType::DS4, true, true);
        db[makeKey(0x054c, 0x0ba0)] = GamepadInfo("DualShock 4 USB Wireless Adapter", DeviceType::DS4, true, true);

        // DualSense (PS5)
        db[makeKey(0x054c, 0x0ce6)] = GamepadInfo("DualSense", DeviceType::DS5, true, true);
        db[makeKey(0x054c, 0x0df2)] = GamepadInfo("DualSense Edge", DeviceType::DS5, true, true);

        // ========== Nintendo ==========

        // Switch Pro Controller
        db[makeKey(0x057e, 0x2009)] = GamepadInfo("Switch Pro Controller", DeviceType::SWITCH_PRO, true, true);

        // Joy-Con (L/R)
        db[makeKey(0x057e, 0x2006)] = GamepadInfo("Joy-Con (L)", DeviceType::SWITCH_PRO, true, true);
        db[makeKey(0x057e, 0x2007)] = GamepadInfo("Joy-Con (R)", DeviceType::SWITCH_PRO, true, true);
        db[makeKey(0x057e, 0x2017)] = GamepadInfo("Nintendo Switch Pro Controller", DeviceType::SWITCH_PRO, true, true);

        // ========== Microsoft Xbox ==========

        // Xbox One
        db[makeKey(0x045e, 0x02d1)] = GamepadInfo("Xbox One Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x02dd)] = GamepadInfo("Xbox One Controller (Firmware 2015)", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x02e0)] = GamepadInfo("Xbox One S Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x02ea)] = GamepadInfo("Xbox One S Controller (Bluetooth)", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x02fd)] = GamepadInfo("Xbox One S Controller (Bluetooth)", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x02ff)] = GamepadInfo("Xbox One Elite Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x0b00)] = GamepadInfo("Xbox One Elite Series 2", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x0b05)] = GamepadInfo("Xbox Elite Series 2", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x0b12)] = GamepadInfo("Xbox Series X|S Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x0b13)] = GamepadInfo("Xbox Series X|S Controller (Bluetooth)", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x0b22)] = GamepadInfo("Xbox Series X|S Controller (2023)", DeviceType::XBOX, false, false);

        // Xbox 360
        db[makeKey(0x045e, 0x028e)] = GamepadInfo("Xbox 360 Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x045e, 0x028f)] = GamepadInfo("Xbox 360 Wireless Receiver", DeviceType::XBOX, false, false);
        db[makeKey(0x0738, 0x4716)] = GamepadInfo("Xbox 360 Controller (Mad Catz)", DeviceType::XBOX, false, false);

        // 第三方 Xbox 兼容手柄
        db[makeKey(0x045e, 0x0719)] = GamepadInfo("Xbox 360 Wireless Adapter", DeviceType::XBOX, false, false);
        db[makeKey(0x0e6f, 0x0139)] = GamepadInfo("Afterglow Xbox 360 Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x0e6f, 0x0146)] = GamepadInfo("Rock Candy Xbox 360 Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x0f0d, 0x0067)] = GamepadInfo("Hori Xbox 360 Controller", DeviceType::XBOX, false, false);
        db[makeKey(0x1bad, 0xf02a)] = GamepadInfo("Xbox 360 Controller (Pyramid)", DeviceType::XBOX, false, false);
        db[makeKey(0x1bad, 0xf901)] = GamepadInfo("Xbox 360 Controller (Gamestop)", DeviceType::XBOX, false, false);
        db[makeKey(0x1bad, 0xf903)] = GamepadInfo("Xbox 360 Controller (Trison)", DeviceType::XBOX, false, false);
        db[makeKey(0x24c6, 0x5300)] = GamepadInfo("Xbox 360 Controller (PowerA)", DeviceType::XBOX, false, false);
        db[makeKey(0x24c6, 0x541a)] = GamepadInfo("Xbox 360 Controller (Rock Candy)", DeviceType::XBOX, false, false);
        db[makeKey(0x24c6, 0x542a)] = GamepadInfo("Xbox 360 Controller (Kolkata)", DeviceType::XBOX, false, false);
        db[makeKey(0x24c6, 0x5430)] = GamepadInfo("Xbox 360 Controller (PowerA Mini)", DeviceType::XBOX, false, false);
        db[makeKey(0x3537, 0x10b9)] = GamepadInfo("Xbox 360 Controller for Windows", DeviceType::XBOX, false, false);

        // ========== Valve ==========

        db[makeKey(0x28de, 0x1102)] = GamepadInfo("Steam Controller", DeviceType::GENERIC, true, true);
        db[makeKey(0x28de, 0x1142)] = GamepadInfo("Steam Controller (BLE)", DeviceType::GENERIC, true, true);
        db[makeKey(0x28de, 0x1205)] = GamepadInfo("Steam Deck", DeviceType::GENERIC, true, true);

        // ========== 其他 ==========

        // 8BitDo
        db[makeKey(0x045e, 0x02d1)] = GamepadInfo("8BitDo Adapter", DeviceType::GENERIC, true, true);
        db[makeKey(0x2dc8, 0x3106)] = GamepadInfo("8BitDo Pro 2", DeviceType::GENERIC, true, true);
        db[makeKey(0x0f0d, 0x00c1)] = GamepadInfo("8BitDo SNES Pro", DeviceType::GENERIC, true, true);

        // Logitech
        db[makeKey(0x046d, 0xc216)] = GamepadInfo("Logitech F310", DeviceType::GENERIC, false, false);
        db[makeKey(0x046d, 0xc218)] = GamepadInfo("Logitech F510", DeviceType::GENERIC, false, false);
        db[makeKey(0x046d, 0xc219)] = GamepadInfo("Logitech F710", DeviceType::GENERIC, false, false);
        db[makeKey(0x046d, 0xc21d)] = GamepadInfo("Logitech F520", DeviceType::GENERIC, false, false);

        // Thrustmaster
        db[makeKey(0x044f, 0xb326)] = GamepadInfo("Thrustmaster Gamepad", DeviceType::GENERIC, false, false);
        db[makeKey(0x044f, 0xd108)] = GamepadInfo("Thrustmaster T.Flight Stick", DeviceType::GENERIC, false, false);

        // Nintendo GameCube
        db[makeKey(0x057e, 0x0337)] = GamepadInfo("Nintendo GameCube Adapter", DeviceType::GENERIC, false, false);

        // PS2/PS3 adapters
        db[makeKey(0x054c, 0x0268)] = GamepadInfo("DualShock 3", DeviceType::DS4, true, true);
        db[makeKey(0x054c, 0x0302)] = GamepadInfo("Sixaxis", DeviceType::DS4, true, true);

        return db;
    }
};

} // namespace gamepad

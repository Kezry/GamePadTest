/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    DataParser.h
 * @brief   HID数据解析器
 */

#pragma once

#include "network/DataTypes.h"
#include "utils/Timestamp.h"
#include <vector>
#include <cstdint>

namespace gamepad {

/**
 * @brief 字节缓冲区辅助类
 *
 * 简化 HID 报告数据的读取操作
 */
class ByteBuffer {
public:
    explicit ByteBuffer(const std::vector<uint8_t>& data)
        : data_(data), position_(0) {}

    // 读取小端序 16 位整数
    int16_t readInt16LE(size_t offset) const {
        if (offset + 2 > data_.size()) {
            return 0;
        }

        return static_cast<int16_t>(
            data_[offset] | (data_[offset + 1] << 8)
        );
    }

    // 获取 Report ID
    uint8_t getReportId() const {
        if (data_.empty()) {
            return 0;
        }
        return data_[0];
    }

    // 获取数据大小
    size_t size() const {
        return data_.size();
    }

    // 获取原始数据
    const std::vector<uint8_t>& data() const {
        return data_;
    }

private:
    const std::vector<uint8_t>& data_;
    size_t position_;
};

/**
 * @brief 数据解析器
 *
 * 支持多种手柄的数据格式
 */
class DataParser {
public:
    /**
     * @brief 尝试解析 DS4 报告
     */
    static bool parseDS4(const std::vector<uint8_t>& data, GyroData& output) {
        if (data.size() < 25) {
            return false;
        }

        uint8_t reportId = data[0];

        // DS4: Report ID 0x01 (USB) 或 0x11 (Bluetooth)
        if (reportId != 0x01 && reportId != 0x11) {
            return false;
        }

        const size_t gyroOffset = 13;
        const size_t accelOffset = 19;

        // 复用 ByteBuffer 实例避免重复创建
        ByteBuffer buf(data);

        // 读取陀螺仪数据
        // DS4 HID 规范:
        // data[13-14]: Gyro X (pitch rate)
        // data[15-16]: Gyro Y (yaw rate)
        // data[17-18]: Gyro Z (roll rate)
        int16_t gyroX = buf.readInt16LE(gyroOffset + 0);  // pitch
        int16_t gyroY = buf.readInt16LE(gyroOffset + 2);  // yaw
        int16_t gyroZ = buf.readInt16LE(gyroOffset + 4);  // roll

        // 读取加速度计数据
        int16_t accelX = buf.readInt16LE(accelOffset + 0);
        int16_t accelY = buf.readInt16LE(accelOffset + 2);
        int16_t accelZ = buf.readInt16LE(accelOffset + 4);

        // 转换为标准单位 (预计算值避免运行时运算)
        constexpr float GYRO_SCALE = 0.17578125f;   // 180.0f / 1024.0f
        constexpr float ACCEL_SCALE = 0.0001220703125f;  // 1.0f / 8192.0f

        output.pitch = gyroX * GYRO_SCALE;
        output.yaw = gyroY * GYRO_SCALE;
        output.roll = gyroZ * GYRO_SCALE;
        output.ax = accelX * ACCEL_SCALE;
        output.ay = accelY * ACCEL_SCALE;
        output.az = accelZ * ACCEL_SCALE;
        output.timestamp = getCurrentTimestampMs();

        return true;
    }

    /**
     * @brief 尝试解析 DS5 报告
     */
    static bool parseDS5(const std::vector<uint8_t>& data, GyroData& output) {
        if (data.size() < 30) {
            return false;
        }

        uint8_t reportId = data[0];

        // DS5: Report ID 0x01 (USB) 或 0x31 (Bluetooth)
        if (reportId != 0x01 && reportId != 0x31) {
            return false;
        }

        // DS5 的偏移量根据 Report ID 不同
        size_t gyroOffset = (reportId == 0x01) ? 15 : 16;
        size_t accelOffset = gyroOffset + 6;

        // 复用 ByteBuffer 实例避免重复创建
        ByteBuffer buf(data);

        // 读取陀螺仪数据
        int16_t gyroYaw = buf.readInt16LE(gyroOffset + 0);
        int16_t gyroPitch = buf.readInt16LE(gyroOffset + 2);
        int16_t gyroRoll = buf.readInt16LE(gyroOffset + 4);

        // 读取加速度计数据
        int16_t accelX = buf.readInt16LE(accelOffset + 0);
        int16_t accelY = buf.readInt16LE(accelOffset + 2);
        int16_t accelZ = buf.readInt16LE(accelOffset + 4);

        // 转换为标准单位 (预计算值避免运行时运算)
        constexpr float GYRO_SCALE = 0.17578125f;
        constexpr float ACCEL_SCALE = 0.0001220703125f;

        output.yaw = gyroYaw * GYRO_SCALE;
        output.pitch = gyroPitch * GYRO_SCALE;
        output.roll = gyroRoll * GYRO_SCALE;
        output.ax = accelX * ACCEL_SCALE;
        output.ay = accelY * ACCEL_SCALE;
        output.az = accelZ * ACCEL_SCALE;
        output.timestamp = getCurrentTimestampMs();

        return true;
    }

    /**
     * @brief 尝试解析 Switch Pro Controller 报告
     */
    static bool parseSwitch(const std::vector<uint8_t>& data, GyroData& output) {
        // Switch Pro Controller 支持多种 Report ID
        // USB 模式: 0x30, 0x81
        // 蓝牙模式: 0x21, 0x3F, 0x30
        // 简单模式: 0x3F (无 IMU 数据)
        if (data.size() < 25) {
            return false;
        }

        uint8_t reportId = data[0];

        // Switch: Report ID 0x30, 0x81, 0x21, 0x3F
        if (reportId != 0x30 && reportId != 0x81 && reportId != 0x21 && reportId != 0x3F) {
            return false;
        }

        // Switch Pro Controller 数据格式
        // 参考: https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering
        // 参考: Node.js 实现 (src/index.js parseSwitchReport)
        //
        // 偏移量 (包含 Report ID):
        // 0: Report ID
        // 1-2: 按钮状态
        // 3-4: 左摇杆
        // 5-6: 右摇杆
        // 7-12: 振动/其他数据
        // 13-18: 加速度计 (3轴 x 2字节) - 注意：加速度计在前！
        // 19-24: 陀螺仪 (3轴 x 2字节)
        //
        // 关键：加速度计先于陀螺仪

        const size_t offset = 13;  // 从Report ID后第13个字节开始

        // 复用 ByteBuffer 实例避免重复创建
        ByteBuffer buf(data);

        // 读取加速度计数据 (Switch先发送加速度计)
        int16_t accelX = buf.readInt16LE(offset + 0);
        int16_t accelY = buf.readInt16LE(offset + 2);
        int16_t accelZ = buf.readInt16LE(offset + 4);

        // 读取陀螺仪数据
        int16_t gyroYaw = buf.readInt16LE(offset + 6);
        int16_t gyroRoll = buf.readInt16LE(offset + 8);
        int16_t gyroPitch = buf.readInt16LE(offset + 10);

        // 转换为标准单位 (预计算值避免运行时运算)
        constexpr float GYRO_SCALE = 0.06103515625f;  // 度/秒
        constexpr float ACCEL_SCALE = 0.000244140625f;  // 1.0f / 4096.0f

        output.yaw = gyroYaw * GYRO_SCALE;
        output.roll = gyroRoll * GYRO_SCALE;
        output.pitch = gyroPitch * GYRO_SCALE;
        output.ax = accelX * ACCEL_SCALE;
        output.ay = accelY * ACCEL_SCALE;
        output.az = accelZ * ACCEL_SCALE;
        output.timestamp = getCurrentTimestampMs();

        return true;
    }

    /**
     * @brief 尝试解析 Xbox One/Series X|S 手柄报告
     */
    static bool parseXbox(const std::vector<uint8_t>& data, GyroData& output) {
        if (data.size() < 32) {
            return false;
        }

        uint8_t reportId = data[0];

        // Xbox One (USB): Report ID 0x01
        // Xbox Series X|S (USB): Report ID 0x01
        // Xbox One S (Bluetooth): Report ID 0x01, 0x02
        // 只处理已知的数据包大小
        if (reportId != 0x01 && reportId != 0x02 && reportId != 0x03 && reportId != 0x30) {
            return false;
        }

        // Xbox 手柄的陀螺仪数据通常在扩展报告中
        // 由于 Xbox 手柄的 HID 描述符可能不包含陀螺仪数据，
        // 我们只能尝试解析，如果偏移量不合适就返回 false
        
        // 检查是否是 IMU 数据包（通常较大且有特定偏移）
        if (data.size() >= 48) {
            // 尝试解析 IMU 数据
            // Xbox IMU 数据格式（推测）：
            // 偏移量可能与 DS4/DS5 不同
            
            // 尝试常见的偏移量
            for (size_t offset = 0; offset <= 16; offset += 8) {
                ByteBuffer buf(data);
                
                // 读取陀螺仪数据
                int16_t gyroYaw = buf.readInt16LE(4 + offset);
                int16_t gyroPitch = buf.readInt16LE(6 + offset);
                int16_t gyroRoll = buf.readInt16LE(8 + offset);
                
                // 检查数值是否在合理范围内（陀螺仪通常在 -2000 到 2000 deg/s）
                if (abs(gyroYaw) > 20000 || abs(gyroPitch) > 20000 || abs(gyroRoll) > 20000) {
                    continue;  // 数值不合理，尝试下一个偏移
                }
                
                // 读取加速度计数据
                int16_t accelX = buf.readInt16LE(10 + offset);
                int16_t accelY = buf.readInt16LE(12 + offset);
                int16_t accelZ = buf.readInt16LE(14 + offset);
                
                constexpr float GYRO_SCALE = 0.17578125f;
                constexpr float ACCEL_SCALE = 0.0001220703125f;

                output.yaw = gyroYaw * GYRO_SCALE;
                output.pitch = gyroPitch * GYRO_SCALE;
                output.roll = gyroRoll * GYRO_SCALE;
                output.ax = accelX * ACCEL_SCALE;
                output.ay = accelY * ACCEL_SCALE;
                output.az = accelZ * ACCEL_SCALE;
                output.timestamp = getCurrentTimestampMs();

                return true;
            }
        }

        // 如果没有找到有效的 IMU 数据，返回 false
        // 但这不一定是错误，可能是普通输入报告
        return false;
    }

    /**
     * @brief 重置解析器缓存（设备重连时调用）
     */
    static void resetParserCache() {
        cachedParser_ = ParserType::UNKNOWN;
        debugInitialized_ = false;
    }

    /**
     * @brief 通用解析 - 自动检测格式
     *
     * 首次调用时尝试所有解析器，成功后缓存结果。
     * 后续调用直接使用缓存的解析器，跳过不必要的尝试。
     */
    static bool parseAuto(const std::vector<uint8_t>& data, GyroData& output) {
        // 调试统计（仅在首次初始化）
        if (!debugInitialized_) {
            debugInitialized_ = true;
            lastDebugTime_ = std::chrono::steady_clock::now();
        }

        totalCount_++;

        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastDebugTime_).count();

        if (elapsed >= 1000 && totalCount_ > 0) {
            std::cerr << "[DEBUG] 总接收=" << totalCount_
                      << " 解析成功=" << parseSuccessCount_
                      << " ReportID=0x" << std::hex << (int)(data.size() > 0 ? data[0] : 0) << std::dec
                      << " Size=" << data.size() << std::endl;
            std::cerr.flush();
            lastDebugTime_ = now;
        }

        // 快速路径：使用缓存的解析器
        if (cachedParser_ != ParserType::UNKNOWN) {
            bool success = false;
            switch (cachedParser_) {
            case ParserType::DS4:     success = parseDS4(data, output); break;
            case ParserType::DS5:     success = parseDS5(data, output); break;
            case ParserType::SWITCH:  success = parseSwitch(data, output); break;
            case ParserType::XBOX:    success = parseXbox(data, output); break;
            default: break;
            }
            if (success) {
                parseSuccessCount_++;
                return true;
            }
            // 缓存的解析器失败了（设备可能切换了报告格式），回退到全量检测
            cachedParser_ = ParserType::UNKNOWN;
        }

        // 慢速路径：尝试所有解析器并缓存结果
        if (parseDS4(data, output))    { cachedParser_ = ParserType::DS4;     parseSuccessCount_++; return true; }
        if (parseDS5(data, output))    { cachedParser_ = ParserType::DS5;     parseSuccessCount_++; return true; }
        if (parseSwitch(data, output)) { cachedParser_ = ParserType::SWITCH;  parseSuccessCount_++; return true; }
        if (parseXbox(data, output))   { cachedParser_ = ParserType::XBOX;    parseSuccessCount_++; return true; }

        return false;
    }

private:
    enum class ParserType : uint8_t {
        UNKNOWN,
        DS4,
        DS5,
        SWITCH,
        XBOX
    };

    // 解析器缓存 - 避免每帧都尝试所有格式
    static inline ParserType cachedParser_ = ParserType::UNKNOWN;
    static inline int totalCount_ = 0;
    static inline int parseSuccessCount_ = 0;
    static inline bool debugInitialized_ = false;
    static inline std::chrono::steady_clock::time_point lastDebugTime_;
};

} // namespace gamepad

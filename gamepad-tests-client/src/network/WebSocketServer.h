/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    WebSocketServer.h
 * @brief   WebSocket 服务器
 */

#pragma once

#ifdef _WIN32
#include <winsock2.h>
#include <windows.h>
#include <wincrypt.h>
typedef int socklen_t;
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <unistd.h>
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
typedef int SOCKET;
#endif

#include <string>
#include <vector>
#include <functional>
#include <memory>
#include <mutex>
#include <thread>
#include <queue>
#include <condition_variable>
#include <atomic>
#include "network/DataTypes.h"

namespace gamepad {

constexpr size_t MAX_CLIENT_COUNT = 100;
constexpr int MAX_SAMPLE_RATE = 1000;
constexpr int DEFAULT_SAMPLE_RATE = 60;

/**
 * @brief WebSocket 客户端连接
 */
struct WebSocketClient {
    SOCKET socket;
    std::string address;
    bool connected;

    WebSocketClient() : socket(INVALID_SOCKET), connected(false) {}
};

/**
 * @brief WebSocket 服务器
 *
 * 简单的 WebSocket 服务器实现
 * 支持数据广播和采样率调整
 */
class WebSocketServer {
public:
    // 回调函数类型
    using SampleRateCallback = std::function<void(int newSampleRate)>;
    using ClientConnectCallback = std::function<void()>;
    using ClientDisconnectCallback = std::function<void()>;

    /**
     * @brief 构造函数
     * @param port 监听端口
     */
    explicit WebSocketServer(int port = 3001);

    /**
     * @brief 析构函数
     */
    ~WebSocketServer();

    /**
     * @brief 启动服务器
     * @return 成功返回 true
     */
    bool start();

    /**
     * @brief 停止服务器
     */
    void stop();

    /**
     * @brief 广播数据到所有客户端
     * @param data 陀螺仪数据
     */
    void broadcast(const GyroData& data);

    /**
     * @brief 设置采样率变化回调
     * @param callback 回调函数
     */
    void setSampleRateCallback(SampleRateCallback callback);

    /**
     * @brief 设置客户端连接回调
     * @param callback 回调函数
     */
    void setClientConnectCallback(ClientConnectCallback callback);

    /**
     * @brief 设置客户端断开回调
     * @param callback 回调函数
     */
    void setClientDisconnectCallback(ClientDisconnectCallback callback);

    /**
     * @brief 获取连接的客户端数量
     */
    size_t getClientCount() const;

    /**
     * @brief 检查是否有客户端连接
     */
    bool hasClients() const;

private:
    /**
     * @brief 服务器线程主循环
     */
    void serverThreadLoop();

    /**
     * @brief 处理客户端连接
     * @param clientSocket 客户端套接字
     */
    void handleClient(SOCKET clientSocket);

    /**
     * @brief 解析 WebSocket 握手
     * @param data 接收的数据
     * @return 成功返回 true
     */
    bool parseHandshake(const std::string& data);

    /**
     * @brief 生成 WebSocket 握手响应
     * @param key 客户端提供的 Sec-WebSocket-Key
     * @return 握手响应
     */
    std::string generateHandshakeResponse(const std::string& key);

    /**
     * @brief 解析 WebSocket 帧
     * @param data 接收的数据
     * @param payload 解析后的负载数据
     * @return 成功返回 true
     */
    bool parseFrame(const std::vector<uint8_t>& data, std::string& payload);

    /**
     * @brief 创建 WebSocket 帧
     * @param data 要发送的数据
     * @return WebSocket 帧
     */
    std::vector<uint8_t> createFrame(const std::string& data);

    /**
     * @brief 创建 WebSocket 帧到已有缓冲区（避免分配）
     * @param data 要发送的数据
     * @param out 输出缓冲区
     */
    void createFrameInto(const std::string& data, std::vector<uint8_t>& out);

    /**
     * @brief Base64 解码
     * @param encoded Base64 编码的字符串
     * @return 解码后的数据
     */
    static std::vector<uint8_t> base64Decode(const std::string& encoded);

    /**
     * @brief Base64 编码
     * @param data 要编码的数据
     * @return Base64 编码的字符串
     */
    static std::string base64Encode(const std::vector<uint8_t>& data);

    /**
     * @brief SHA1 哈希
     * @param data 输入数据
     * @return SHA1 哈希值
     */
    static std::vector<uint8_t> sha1(const std::vector<uint8_t>& data);

    int port_;
    SOCKET serverSocket_;
    bool running_;
    int currentSampleRate_;
    std::vector<std::unique_ptr<WebSocketClient>> clients_;
    std::mutex clientsMutex_;
    std::atomic<int> clientCount_{0};
    SampleRateCallback sampleRateCallback_;
    ClientConnectCallback clientConnectCallback_;
    ClientDisconnectCallback clientDisconnectCallback_;

    // 线程池
    std::vector<std::thread> workerThreads_;
    std::queue<SOCKET> pendingClients_;
    std::mutex pendingMutex_;
    std::condition_variable pendingCV_;
    static constexpr size_t THREAD_POOL_SIZE = 8;

    // 服务器线程
    std::thread serverThread_;

    void processClientFromQueue();
};

} // namespace gamepad

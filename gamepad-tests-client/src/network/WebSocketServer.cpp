/*
 * Gamepad Test Client - C++ Implementation
 *
 * Based on the original Node.js project by Kezry
 * Copyright (c) 2025 Kezry
 *
 * MIT License
 * Refer to LICENSE file for full text
 *
 * @file    WebSocketServer.cpp
 * @brief   WebSocket 服务器实现
 */

#include "WebSocketServer.h"
#include "utils/Logger.h"
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cstring>

#ifdef _WIN32
#pragma comment(lib, "ws2_32.lib")
#endif

namespace gamepad {

// Base64 编码表
static const char BASE64_CHARS[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789+/";

WebSocketServer::WebSocketServer(int port)
    : port_(port)
    , serverSocket_(INVALID_SOCKET)
    , running_(false)
    , currentSampleRate_(DEFAULT_SAMPLE_RATE) {
}

WebSocketServer::~WebSocketServer() {
    stop();
}

bool WebSocketServer::start() {
#ifdef _WIN32
    // 初始化 Winsock
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        Logger::instance().error("WSAStartup failed");
        return false;
    }
#endif

    // 创建套接字
    serverSocket_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket_ == INVALID_SOCKET) {
        Logger::instance().error("Failed to create socket");
        return false;
    }

    // 设置套接字选项
    int opt = 1;
    setsockopt(serverSocket_, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));

    // 绑定地址
    sockaddr_in serverAddr;
    std::memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(port_);

    if (bind(serverSocket_, (sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        Logger::instance().error("Failed to bind socket");
        closesocket(serverSocket_);
        return false;
    }

    // 开始监听
    if (listen(serverSocket_, SOMAXCONN) == SOCKET_ERROR) {
        Logger::instance().error("Failed to listen on socket");
        closesocket(serverSocket_);
        return false;
    }

    running_ = true;

    // 创建线程池
    workerThreads_.reserve(THREAD_POOL_SIZE);
    for (size_t i = 0; i < THREAD_POOL_SIZE; ++i) {
        workerThreads_.emplace_back(&WebSocketServer::processClientFromQueue, this);
    }

    // 启动服务器线程
    serverThread_ = std::thread(&WebSocketServer::serverThreadLoop, this);

    Logger::instance().info("WebSocket server started on port " + std::to_string(port_));
    return true;
}

void WebSocketServer::stop() {
    running_ = false;

    // 通知所有线程退出
    pendingCV_.notify_all();

    // 等待线程池结束
    for (auto& t : workerThreads_) {
        if (t.joinable()) {
            t.join();
        }
    }
    workerThreads_.clear();

    // 关闭所有客户端连接
    std::lock_guard<std::mutex> lock(clientsMutex_);
    for (auto& client : clients_) {
        if (client->socket != INVALID_SOCKET) {
            closesocket(client->socket);
        }
    }
    clients_.clear();
    clientCount_.store(0, std::memory_order_relaxed);

    // 关闭服务器套接字
    if (serverSocket_ != INVALID_SOCKET) {
        closesocket(serverSocket_);
        serverSocket_ = INVALID_SOCKET;
    }

    // 等待服务器线程结束
    if (serverThread_.joinable()) {
        serverThread_.join();
    }

#ifdef _WIN32
    WSACleanup();
#endif
}

void WebSocketServer::broadcast(const GyroData& data) {
    // 快速检查：无客户端时直接返回（原子读，无锁）
    if (clientCount_.load(std::memory_order_relaxed) == 0) {
        return;
    }

    // 使用固定大小缓冲区替代 ostringstream，提高性能
    char buffer[256];
    int len = snprintf(buffer, sizeof(buffer),
        "{\"pitch\":%.2f,\"yaw\":%.2f,\"roll\":%.2f,\"ax\":%.6f,\"ay\":%.6f,\"az\":%.6f,\"timestamp\":%llu}",
        static_cast<double>(data.pitch),
        static_cast<double>(data.yaw),
        static_cast<double>(data.roll),
        static_cast<double>(data.ax),
        static_cast<double>(data.ay),
        static_cast<double>(data.az),
        static_cast<unsigned long long>(data.timestamp));

    std::string message(buffer, len);

    // 使用 thread-local 缓冲区避免每次广播都分配新 vector
    thread_local std::vector<uint8_t> frameBuf;
    frameBuf.clear();
    createFrameInto(message, frameBuf);

    // 收集有效客户端套接字，单次加锁
    thread_local std::vector<SOCKET> clientsToSend;
    clientsToSend.clear();

    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        for (const auto& client : clients_) {
            if (client->connected && client->socket != INVALID_SOCKET) {
                clientsToSend.push_back(client->socket);
            }
        }
    }

    if (clientsToSend.empty()) {
        return;
    }

    // 在锁外发送数据，减少锁竞争
    std::vector<SOCKET> failedSockets;
    for (SOCKET sock : clientsToSend) {
        int sent = send(sock, (const char*)frameBuf.data(), static_cast<int>(frameBuf.size()), 0);
        if (sent == SOCKET_ERROR) {
            failedSockets.push_back(sock);
        }
    }

    // 批量移除失败的客户端（一次性加锁处理所有失败的）
    if (!failedSockets.empty()) {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        for (SOCKET sock : failedSockets) {
            clients_.erase(
                std::remove_if(clients_.begin(), clients_.end(),
                    [sock](const std::unique_ptr<WebSocketClient>& c) {
                        return c->socket == sock;
                    }),
                clients_.end()
            );
            closesocket(sock);
            Logger::instance().info("Client removed (send error)");
        }
        clientCount_.store(static_cast<int>(clients_.size()), std::memory_order_relaxed);
    }
}

void WebSocketServer::setSampleRateCallback(SampleRateCallback callback) {
    sampleRateCallback_ = std::move(callback);
}

void WebSocketServer::setClientConnectCallback(ClientConnectCallback callback) {
    clientConnectCallback_ = std::move(callback);
}

void WebSocketServer::setClientDisconnectCallback(ClientDisconnectCallback callback) {
    clientDisconnectCallback_ = std::move(callback);
}

size_t WebSocketServer::getClientCount() const {
    return static_cast<size_t>(clientCount_.load(std::memory_order_relaxed));
}

bool WebSocketServer::hasClients() const {
    return clientCount_.load(std::memory_order_relaxed) > 0;
}

void WebSocketServer::serverThreadLoop() {
    while (running_) {
        fd_set readSet;
        FD_ZERO(&readSet);
        FD_SET(serverSocket_, &readSet);

        timeval timeout;
        timeout.tv_sec = 0;
        timeout.tv_usec = 100000;  // 100ms 超时

        int selectResult = select(static_cast<int>(serverSocket_) + 1, &readSet, nullptr, nullptr, &timeout);

        if (selectResult == SOCKET_ERROR) {
            if (running_) {
                Logger::instance().error("select() failed");
            }
            break;
        }

        if (selectResult > 0 && FD_ISSET(serverSocket_, &readSet)) {
            sockaddr_in clientAddr;
            socklen_t addrLen = sizeof(clientAddr);
            SOCKET clientSocket = accept(serverSocket_, (sockaddr*)&clientAddr, &addrLen);

            if (clientSocket != INVALID_SOCKET) {
                // 将客户端套接字放入队列，由线程池处理
                {
                    std::lock_guard<std::mutex> lock(pendingMutex_);
                    pendingClients_.push(clientSocket);
                }
                pendingCV_.notify_one();
            }
        }
    }
}

void WebSocketServer::handleClient(SOCKET clientSocket) {
    // 禁用 Nagle 算法，减少高频数据流的延迟
    int noDelay = 1;
    setsockopt(clientSocket, IPPROTO_TCP, TCP_NODELAY, (const char*)&noDelay, sizeof(noDelay));

    // 检查最大连接数
    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        if (clients_.size() >= MAX_CLIENT_COUNT) {
            Logger::instance().warning("最大连接数已达上限，拒绝连接");
            closesocket(clientSocket);
            return;
        }
    }

    // 接收握手
    char buffer[4096];
    int received = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);

    if (received <= 0) {
        closesocket(clientSocket);
        return;
    }

    buffer[received] = '\0';
    std::string handshake(buffer);

    // 解析握手
    if (!parseHandshake(handshake)) {
        closesocket(clientSocket);
        return;
    }

    // 提取 Sec-WebSocket-Key
    size_t keyPos = handshake.find("Sec-WebSocket-Key:");
    if (keyPos == std::string::npos) {
        closesocket(clientSocket);
        return;
    }

    keyPos += 19;
    size_t keyEnd = handshake.find("\r\n", keyPos);
    if (keyEnd == std::string::npos) {
        closesocket(clientSocket);
        return;
    }

    std::string key = handshake.substr(keyPos, keyEnd - keyPos);
    // 去除空格
    key.erase(0, key.find_first_not_of(" \t"));
    key.erase(key.find_last_not_of(" \t") + 1);

    // 发送握手响应
    std::string response = generateHandshakeResponse(key);
    send(clientSocket, response.c_str(), static_cast<int>(response.length()), 0);

    // 添加到客户端列表
    auto client = std::make_unique<WebSocketClient>();
    client->socket = clientSocket;
    client->connected = true;

    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        clients_.push_back(std::move(client));
        clientCount_.store(static_cast<int>(clients_.size()), std::memory_order_relaxed);
    }

    Logger::instance().info("WebSocket client connected");

    // 触发客户端连接回调
    if (clientConnectCallback_) {
        clientConnectCallback_();
    }

    // 接收消息循环
    while (running_) {
        received = recv(clientSocket, buffer, sizeof(buffer), 0);

        if (received <= 0) {
            break;
        }

        std::vector<uint8_t> data(buffer, buffer + received);
        std::string payload;

        if (parseFrame(data, payload)) {
            // 调试：记录收到的消息
            Logger::instance().debug("收到消息: " + payload);

            // 解析 JSON 消息
            // 支持两种格式：{"type":"setSampleRate"} 和 {type:"setSampleRate"}
            bool hasSetSampleRate = payload.find("\"type\":\"setSampleRate\"") != std::string::npos ||
                                   payload.find("type:\"setSampleRate\"") != std::string::npos ||
                                   payload.find("'type':'setSampleRate'") != std::string::npos ||
                                   payload.find("type:'setSampleRate'") != std::string::npos;

            if (hasSetSampleRate) {
                // 查找 sampleRate
                size_t ratePos = payload.find("sampleRate");
                if (ratePos != std::string::npos) {
                    // 查找冒号
                    size_t colonPos = payload.find(':', ratePos);
                    if (colonPos != std::string::npos) {
                        // 跳过冒号和可能的空格
                        size_t valueStart = colonPos + 1;
                        while (valueStart < payload.size() && (payload[valueStart] == ' ' || payload[valueStart] == '\t')) {
                            valueStart++;
                        }

                        // 查找数字结束位置
                        size_t valueEnd = payload.find_first_not_of("0123456789", valueStart);
                        if (valueEnd == std::string::npos) {
                            valueEnd = payload.size();
                        }

                        std::string rateStr = payload.substr(valueStart, valueEnd - valueStart);
                        try {
                            int sampleRate = std::stoi(rateStr);
                            // 应用服务器端最大采样率限制
                            int clampedRate = std::max(1, std::min(MAX_SAMPLE_RATE, sampleRate));
                            if (clampedRate != sampleRate) {
                                Logger::instance().warning("采样率已限制到: " + std::to_string(clampedRate) + " Hz (请求: " + std::to_string(sampleRate) + " Hz)");
                            }
                            currentSampleRate_ = clampedRate;
                            if (sampleRateCallback_) {
                                sampleRateCallback_(clampedRate);
                            }
                            Logger::instance().info("采样率已更改为: " + std::to_string(clampedRate) + " Hz");
                        } catch (const std::exception& e) {
                            Logger::instance().error("解析采样率失败: " + std::string(e.what()));
                        }
                    }
                }
            }
        }
    }

    // 移除客户端
    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        clients_.erase(
            std::remove_if(clients_.begin(), clients_.end(),
                [clientSocket](const std::unique_ptr<WebSocketClient>& c) {
                    return c->socket == clientSocket;
                }),
            clients_.end()
        );
        clientCount_.store(static_cast<int>(clients_.size()), std::memory_order_relaxed);
    }

    closesocket(clientSocket);
    Logger::instance().info("WebSocket client disconnected");

    // 触发客户端断开回调
    if (clientDisconnectCallback_) {
        clientDisconnectCallback_();
    }
}

bool WebSocketServer::parseHandshake(const std::string& data) {
    return data.find("Upgrade: websocket") != std::string::npos &&
           data.find("Connection:") != std::string::npos;
}

std::string WebSocketServer::generateHandshakeResponse(const std::string& key) {
    // 添加 magic string
    std::string acceptKey = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    // 计算 SHA1 哈希
    std::vector<uint8_t> hash = sha1(std::vector<uint8_t>(acceptKey.begin(), acceptKey.end()));

    // Base64 编码
    std::string encodedKey = base64Encode(hash);

    std::ostringstream oss;
    oss << "HTTP/1.1 101 Switching Protocols\r\n"
        << "Upgrade: websocket\r\n"
        << "Connection: Upgrade\r\n"
        << "Sec-WebSocket-Accept: " << encodedKey << "\r\n"
        << "\r\n";

    return oss.str();
}

bool WebSocketServer::parseFrame(const std::vector<uint8_t>& data, std::string& payload) {
    if (data.size() < 2) {
        return false;
    }

    uint8_t firstByte = data[0];
    uint8_t secondByte = data[1];

    bool fin = (firstByte & 0x80) != 0;
    uint8_t opcode = firstByte & 0x0F;
    bool masked = (secondByte & 0x80) != 0;
    uint64_t payloadLen = secondByte & 0x7F;

    size_t offset = 2;

    // 扩展载荷长度
    if (payloadLen == 126) {
        if (data.size() < offset + 2) return false;
        payloadLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
    } else if (payloadLen == 127) {
        if (data.size() < offset + 8) return false;
        payloadLen = 0;
        for (int i = 0; i < 8; i++) {
            payloadLen = (payloadLen << 8) | data[offset + i];
        }
        offset += 8;
    }

    // 掩码密钥
    uint8_t mask[4] = {0};
    if (masked) {
        if (data.size() < offset + 4) return false;
        for (int i = 0; i < 4; i++) {
            mask[i] = data[offset + i];
        }
        offset += 4;
    }

    // 载荷数据
    if (data.size() < offset + payloadLen) return false;

    payload.clear();
    payload.reserve(payloadLen);

    for (uint64_t i = 0; i < payloadLen; i++) {
        uint8_t byte = data[offset + i];
        if (masked) {
            byte ^= mask[i % 4];
        }
        payload += byte;
    }

    return true;
}

std::vector<uint8_t> WebSocketServer::createFrame(const std::string& data) {
    std::vector<uint8_t> frame;
    createFrameInto(data, frame);
    return frame;
}

void WebSocketServer::createFrameInto(const std::string& data, std::vector<uint8_t>& out) {
    out.clear();

    uint8_t firstByte = 0x81;  // FIN + Text frame
    out.push_back(firstByte);

    size_t dataLen = data.length();
    if (dataLen < 126) {
        out.push_back(static_cast<uint8_t>(dataLen));
    } else if (dataLen < 65536) {
        out.push_back(126);
        out.push_back((dataLen >> 8) & 0xFF);
        out.push_back(dataLen & 0xFF);
    } else {
        out.push_back(127);
        for (int i = 7; i >= 0; i--) {
            out.push_back((dataLen >> (i * 8)) & 0xFF);
        }
    }

    out.insert(out.end(), data.begin(), data.end());
}

std::string WebSocketServer::base64Encode(const std::vector<uint8_t>& data) {
    std::string result;
    size_t i = 0;

    for (i = 0; i + 2 < data.size(); i += 3) {
        uint32_t value = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        result += BASE64_CHARS[(value >> 18) & 0x3F];
        result += BASE64_CHARS[(value >> 12) & 0x3F];
        result += BASE64_CHARS[(value >> 6) & 0x3F];
        result += BASE64_CHARS[value & 0x3F];
    }

    if (i < data.size()) {
        uint32_t value = data[i] << 16;
        if (i + 1 < data.size()) {
            value |= data[i + 1] << 8;
        }
        result += BASE64_CHARS[(value >> 18) & 0x3F];
        result += BASE64_CHARS[(value >> 12) & 0x3F];
        result += (i + 1 < data.size()) ? BASE64_CHARS[(value >> 6) & 0x3F] : '=';
        result += '=';
    }

    return result;
}

std::vector<uint8_t> WebSocketServer::base64Decode(const std::string& encoded) {
    std::vector<uint8_t> result;
    // 简化实现，仅用于完整性
    return result;
}

std::vector<uint8_t> WebSocketServer::sha1(const std::vector<uint8_t>& data) {
    // 简化的 SHA1 实现
    // 在生产环境中应该使用加密库
    #ifdef _WIN32
    // 使用 Windows Cryptographic API
    HCRYPTPROV hProv = 0;
    HCRYPTHASH hHash = 0;
    DWORD hashLen = 20;
    std::vector<uint8_t> hash(20);

    if (CryptAcquireContext(&hProv, nullptr, nullptr, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) {
        if (CryptCreateHash(hProv, CALG_SHA1, 0, 0, &hHash)) {
            CryptHashData(hHash, data.data(), data.size(), 0);
            CryptGetHashParam(hHash, HP_HASHVAL, hash.data(), &hashLen, 0);
            CryptDestroyHash(hHash);
        }
        CryptReleaseContext(hProv, 0);
    }

    return hash;
    #else
    // 对于其他平台，返回一个简单的哈希（不安全但用于演示）
    std::vector<uint8_t> hash(20, 0);
    for (size_t i = 0; i < data.size(); i++) {
        hash[i % 20] ^= data[i];
    }
    return hash;
    #endif
}

void WebSocketServer::processClientFromQueue() {
    while (running_) {
        SOCKET clientSocket = INVALID_SOCKET;
        
        {
            std::unique_lock<std::mutex> lock(pendingMutex_);
            pendingCV_.wait(lock, [this] {
                return !running_ || !pendingClients_.empty();
            });
            
            if (!running_ && pendingClients_.empty()) {
                break;
            }
            
            if (!pendingClients_.empty()) {
                clientSocket = pendingClients_.front();
                pendingClients_.pop();
            }
        }
        
        if (clientSocket != INVALID_SOCKET) {
            handleClient(clientSocket);
        }
    }
}

} // namespace gamepad

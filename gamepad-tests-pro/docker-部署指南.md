# Docker 部署指南 - 内网容器部署

## 1. 镜像位置

编译好的镜像已存在于本地 Docker 中：

```bash
docker images gamepad-tests-pro
```

**镜像信息：**
- 镜像名：`gamepad-tests-pro:latest`
- 镜像 ID：`5979e7e9075d`
- 大小：93.3 MB (磁盘占用)

## 2. 手动传到内网容器的方法

### 方法一：导出为文件并传输

#### 2.1 导出镜像为 tar 文件
```bash
# 导出镜像到文件
docker save -o gamepad-tests-pro-latest.tar gamepad-tests-pro:latest

# 查看文件大小
ls -lh gamepad-tests-pro-latest.tar
```

#### 2.2 传输到内网服务器
使用以下方式之一传输 tar 文件到内网服务器：

**方式 A：使用 SCP (如果服务器支持 SSH)**
```bash
# Windows 到 Linux 服务器
scp gamepad-tests-pro-latest.tar username@server-ip:/path/to/save/

# Linux 到 Linux 服务器
scp gamepad-tests-pro-latest.tar username@server-ip:/path/to/save/
```

**方式 B：使用文件共享**
1. 将 `.tar` 文件拷贝到 U 盘或网络共享文件夹
2. 在内网服务器上从共享文件夹复制

**方式 C：使用 rsync**
```bash
# Windows 需要安装 WSL 或其他 rsync 客户端
rsync -avz gamepad-tests-pro-latest.tar username@server-ip:/path/to/save/
```

#### 2.3 在内网服务器上导入镜像
```bash
# 登录到内网服务器
ssh username@server-ip

# 导入镜像
docker load -i gamepad-tests-pro-latest.tar

# 验证导入
docker images gamepad-tests-pro
```

### 方法二：直接推送到内网镜像仓库

#### 2.1 标记镜像为内网仓库地址
```bash
# 将现有镜像标记为内网仓库地址
docker tag gamepad-tests-pro:latest your-internal-registry:5000/gamepad-tests-pro:latest

# 标记最新版本
docker tag gamepad-tests-pro:latest your-internal-registry:5000/gamepad-tests-pro:v1.0.0
```

#### 2.2 推送到内网仓库（如果可以访问外网）
```bash
# 登录到内网仓库
docker login your-internal-registry:5000

# 推送镜像
docker push your-internal-registry:5000/gamepad-tests-pro:latest

# 推送版本标签
docker push your-internal-registry:5000/gamepad-tests-pro:v1.0.0
```

### 方法三：使用 Docker 客户端同步（如果内网有外网访问）

#### 2.1 在内网服务器上拉取镜像
```bash
# 如果内网服务器可以访问外网 Docker Hub
docker pull gamepad-tests-pro:latest
```

## 3. 内网服务器部署步骤

### 3.1 导入镜像后启动容器

```bash
# 方法 1：基本启动
docker run -d -p 80:80 -p 3001:3001 --name gamepad-tests-pro gamepad-tests-pro:latest

# 方法 2：指定端口
docker run -d -p 3000:80 -p 3001:3001 --name gamepad-tests-pro gamepad-tests-pro:latest

# 方法 3：生产环境推荐配置
docker run -d \
  -p 8080:80 \
  -p 3001:3001 \
  --name gamepad-tests-pro \
  --restart unless-stopped \
  --network bridge \
  --memory 512m \
  --cpus 1.0 \
  gamepad-tests-pro:latest
```

### 3.2 端口映射说明
- `-p 8080:80`：将容器的 80 端口映射到主机的 8080 端口
- `-p 80:80`：将容器端口直接映射到主机 80 端口（需要 root 权限）
- `-p 3001:3001`：WebSocket 端口，用于 C++ 客户端（gamepad-test-client.exe）连接

### 3.3 高级配置选项

```bash
# 带资源限制的启动
docker run -d \
  -p 8080:80 \
  --name gamepad-tests-pro \
  --restart unless-stopped \
  --memory 512m \
  --cpus 1.0 \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  gamepad-tests-pro:latest

# 使用主机网络（性能更好，但安全性较低）
docker run -d \
  -p 80:80 \
  --name gamepad-tests-pro \
  --network host \
  --restart unless-stopped \
  gamepad-tests-pro:latest
```

## 4. 验证部署

```bash
# 查看容器运行状态
docker ps

# 查看容器日志
docker logs gamepad-tests-pro

# 测试服务是否正常
curl http://localhost:8080

# 或者在浏览器中访问
http://server-ip:8080
```

## 5. 管理命令

### 5.1 停止和删除
```bash
# 停止容器
docker stop gamepad-tests-pro

# 删除容器
docker rm gamepad-tests-pro

# 删除镜像
docker rmi gamepad-tests-pro:latest
```

### 5.2 更新部署
```bash
# 停止旧容器
docker stop gamepad-tests-pro
docker rm gamepad-tests-pro

# 导入新镜像
docker load -i gamepad-tests-pro-new.tar

# 启动新容器
docker run -d -p 8080:80 --name gamepad-tests-pro gamepad-tests-pro:latest
```

### 5.3 监控
```bash
# 查看实时日志
docker logs -f gamepad-tests-pro

# 查看资源使用
docker stats gamepad-tests-pro

# 查看容器详细信息
docker inspect gamepad-tests-pro
```

## 6. 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -tulpn | grep :8080

   # 更换端口
   docker run -d -p 8081:80 --name gamepad-tests-pro gamepad-tests-pro:latest
   ```

2. **容器启动失败**
   ```bash
   # 查看错误日志
   docker logs gamepad-tests-pro

   # 检查镜像是否存在
   docker images gamepad-tests-pro
   ```

3. **内存不足**
   ```bash
   # 查看系统资源
   free -h

   # 限制容器内存使用
   docker run -d -p 8080:80 --memory 256m gamepad-tests-pro:latest
   ```

## 7. 自动化脚本（可选）

### 7.1 一键部署脚本 (deploy.sh)
```bash
#!/bin/bash

# 部署游戏手柄测试应用
DEPLOY_NAME="gamepad-tests-pro"
PORT="8080"
IMAGE="gamepad-tests-pro:latest"

# 停止旧容器
docker stop $DEPLOY_NAME 2>/dev/null || true
docker rm $DEPLOY_NAME 2>/dev/null || true

# 启动新容器
docker run -d \
  -p ${PORT}:80 \
  --name $DEPLOY_NAME \
  --restart unless-stopped \
  $IMAGE

echo "部署完成！访问地址：http://localhost:${PORT}"
```

### 7.2 Windows 批处理脚本 (deploy.bat)
```batch
@echo off
set DEPLOY_NAME=gamepad-tests-pro
set PORT=8080

echo 停止旧容器...
docker stop %DEPLOY_NAME% 2>nul
docker rm %DEPLOY_NAME% 2>nul

echo 启动新容器...
docker run -d -p %PORT%:80 --name %DEPLOY_NAME% --restart unless-stopped gamepad-tests-pro:latest

echo 部署完成！访问地址：http://localhost:%PORT%
pause
```

## 8. 配置 Nginx 反向代理（可选）

如果需要 Nginx 反向代理，可以创建以下配置文件：

### nginx.conf
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 注意事项

1. **安全性**：
   - 生产环境建议使用非 root 用户运行
   - 考虑使用 HTTPS（443端口）
   - 定期更新镜像

2. **性能优化**：
   - 根据服务器资源调整内存和 CPU 限制
   - 使用合适的网络模式

3. **监控**：
   - 设置日志轮转
   - 监控容器资源使用情况
   - 定期检查服务可用性

---

**完成！** 使用以上方法即可将编译好的镜像部署到内网容器环境中。
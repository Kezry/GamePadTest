// 全局变量
let gamepad = null;
let gamepadIndex = null;
let requestId = null;
let monitoringInterval = null;
let samplingData = {};
let powerBars = {}; // 蓄力条
let isMonitoring = false;
let samplingRate = 60;
let lastTimestamp = {};
let buttonPressStartTime = {}; // 记录按键开始按下的时间
let disconnectCounts = {}; // 记录断开次数
let maxPowerTime = 5 * 60 * 1000; // 5分钟蓄力时间（毫秒）

// 按钮映射和位置
const buttonConfig = [
    { name: 'A', label: 'A', x: 600, y: 220, type: 'button' },
    { name: 'B', label: 'B', x: 630, y: 190, type: 'button' },
    { name: 'X', label: 'X', x: 570, y: 190, type: 'button' },
    { name: 'Y', label: 'Y', x: 600, y: 160, type: 'button' },
    { name: 'LB', label: 'LB', x: 200, y: 120, type: 'button' },
    { name: 'RB', label: 'RB', x: 600, y: 120, type: 'button' },
    { name: 'LT', label: 'LT', x: 200, y: 80, type: 'trigger' },
    { name: 'RT', label: 'RT', x: 600, y: 80, type: 'trigger' },
    { name: 'Back', label: '⮌', x: 330, y: 220, type: 'button' },
    { name: 'Start', label: '☰', x: 470, y: 220, type: 'button' },
    { name: 'LS', label: 'LS', x: 200, y: 200, type: 'stick' },
    { name: 'RS', label: 'RS', x: 500, y: 300, type: 'stick' },
    { name: 'DPadUp', label: '↑', x: 190, y: 300, type: 'dpad', direction: 'up' },
    { name: 'DPadRight', label: '→', x: 220, y: 330, type: 'dpad', direction: 'right' },
    { name: 'DPadDown', label: '↓', x: 190, y: 360, type: 'dpad', direction: 'down' },
    { name: 'DPadLeft', label: '←', x: 160, y: 330, type: 'dpad', direction: 'left' },
    { name: 'Guide', label: 'Xbox', x: 400, y: 220, type: 'button' },
    // 添加L5、R5按键和背键
    { name: 'L5', label: 'L5', x: 150, y: 150, type: 'button' },
    { name: 'R5', label: 'R5', x: 650, y: 150, type: 'button' },
    { name: 'Back1', label: 'B1', x: 250, y: 400, type: 'button' },
    { name: 'Back2', label: 'B2', x: 550, y: 400, type: 'button' }
];

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    // 创建控制器界面元素
    createControllerElements();
    
    // 设置震动控制
    setupVibrationControls();
    
    // 设置监测控制
    setupMonitoringControls();
    
    // 开始游戏手柄检测
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
    
    // 检查是否已经连接了手柄
    checkGamepads();
    
    // 开始动画循环
    requestId = requestAnimationFrame(updateStatus);
});

// 创建控制器界面元素
function createControllerElements() {
    const controller = document.getElementById('controller');
    
    // 首先创建D-pad容器
    const dpadContainer = document.createElement('div');
    dpadContainer.className = 'dpad';
    controller.appendChild(dpadContainer);
    
    buttonConfig.forEach(btn => {
        if (btn.type === 'button') {
            const button = document.createElement('div');
            button.className = 'button';
            button.id = btn.name;
            button.textContent = btn.label;
            button.style.left = `${btn.x - 15}px`;
            button.style.top = `${btn.y - 15}px`;
            controller.appendChild(button);
        } else if (btn.type === 'stick') {
            const stick = document.createElement('div');
            stick.className = 'stick';
            stick.id = `${btn.name}-base`;
            stick.style.left = `${btn.x - 30}px`;
            stick.style.top = `${btn.y - 30}px`;
            
            const dot = document.createElement('div');
            dot.className = 'stick-dot';
            dot.id = btn.name;
            stick.appendChild(dot);
            controller.appendChild(stick);
        } else if (btn.type === 'trigger') {
            const trigger = document.createElement('div');
            trigger.className = 'trigger';
            trigger.id = btn.name;
            trigger.textContent = btn.label;
            trigger.style.left = `${btn.x - 20}px`;
            trigger.style.top = `${btn.y - 7.5}px`;
            controller.appendChild(trigger);
        } else if (btn.type === 'dpad') {
            const dpadButton = document.createElement('div');
            dpadButton.className = `dpad-button dpad-${btn.direction}`;
            dpadButton.id = btn.name;
            dpadButton.textContent = btn.label;
            dpadContainer.appendChild(dpadButton);
        }
    });
}

// 设置震动控制
function setupVibrationControls() {
    const leftMotor = document.getElementById('leftMotor');
    const rightMotor = document.getElementById('rightMotor');
    const leftTrigger = document.getElementById('leftTrigger');
    const rightTrigger = document.getElementById('rightTrigger');
    const leftMotorValue = document.getElementById('leftMotorValue');
    const rightMotorValue = document.getElementById('rightMotorValue');
    const leftTriggerValue = document.getElementById('leftTriggerValue');
    const rightTriggerValue = document.getElementById('rightTriggerValue');
    const applyVibration = document.getElementById('applyVibration');
    const stopVibration = document.getElementById('stopVibration');
    
    leftMotor.addEventListener('input', () => {
        leftMotorValue.textContent = leftMotor.value;
    });
    
    rightMotor.addEventListener('input', () => {
        rightMotorValue.textContent = rightMotor.value;
    });
    
    leftTrigger.addEventListener('input', () => {
        leftTriggerValue.textContent = leftTrigger.value;
    });
    
    rightTrigger.addEventListener('input', () => {
        rightTriggerValue.textContent = rightTrigger.value;
    });
    
    applyVibration.addEventListener('click', () => {
        if (gamepad && gamepad.vibrationActuator) {
            // 标准震动
            const weakMagnitude = parseFloat(leftMotor.value);
            const strongMagnitude = parseFloat(rightMotor.value);
            
            gamepad.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: 1000,
                weakMagnitude,
                strongMagnitude
            });
            
            // 尝试扳机震动 (Xbox One 手柄的扳机震动需要特殊支持)
            try {
                if (gamepad.hapticActuators && gamepad.hapticActuators.length >= 2) {
                    const leftTriggerValue = parseFloat(leftTrigger.value);
                    const rightTriggerValue = parseFloat(rightTrigger.value);
                    
                    // 假设第一个和第二个触觉执行器是左右扳机
                    gamepad.hapticActuators[0].pulse(leftTriggerValue, 1000);
                    gamepad.hapticActuators[1].pulse(rightTriggerValue, 1000);
                }
            } catch (e) {
                console.log('扳机震动不受支持:', e);
            }
        }
    });
    
    stopVibration.addEventListener('click', () => {
        if (gamepad && gamepad.vibrationActuator) {
            gamepad.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: 1,
                weakMagnitude: 0,
                strongMagnitude: 0
            });
            
            try {
                if (gamepad.hapticActuators && gamepad.hapticActuators.length >= 2) {
                    gamepad.hapticActuators[0].pulse(0, 10);
                    gamepad.hapticActuators[1].pulse(0, 10);
                }
            } catch (e) {
                console.log('停止扳机震动失败:', e);
            }
        }
    });
}

// 设置监测控制
function setupMonitoringControls() {
    const startMonitoring = document.getElementById('startMonitoring');
    const stopMonitoring = document.getElementById('stopMonitoring');
    const samplingRateInput = document.getElementById('samplingRate');
    const exportData = document.getElementById('exportData');
    const clearData = document.getElementById('clearData');
    const resetPowerProgress = document.getElementById('resetPowerProgress');
    const monitorStatus = document.getElementById('monitorStatus');
    const buttonPressStatus = document.getElementById('buttonPressStatus');
    const oscilloscope = document.getElementById('oscilloscope');
    
    // 清除蓄力条和数据
function clearPowerBarsAndData() {
    // 清除蓄力条
    oscilloscope.innerHTML = '';
    powerBars = {};
    
    // 清除底部蓄力进度条
    const powerProgressContainer = document.getElementById('powerProgressContainer');
    if (powerProgressContainer) {
        powerProgressContainer.innerHTML = '';
    }
    
    // 清除数据
    samplingData = {};
    lastTimestamp = {};
    buttonPressStartTime = {};
    disconnectCounts = {};
    
    buttonPressStatus.textContent = '未检测到按键';
}
    
    startMonitoring.addEventListener('click', () => {
        if (isMonitoring) return;
        
        samplingRate = parseInt(samplingRateInput.value) || 60;
        if (samplingRate < 1) samplingRate = 1;
        if (samplingRate > 1000) samplingRate = 1000;
        samplingRateInput.value = samplingRate;
        
        // 清除之前的数据
        clearPowerBarsAndData();
        
        // 为每个按钮创建数据结构
        buttonConfig.forEach(btn => {
            samplingData[btn.name] = [];
            lastTimestamp[btn.name] = Date.now();
            disconnectCounts[btn.name] = 0;
        });
        
        // 开始监测
        const interval = 1000 / samplingRate;
        monitoringInterval = setInterval(recordButtonStates, interval);
        isMonitoring = true;
        monitorStatus.textContent = `正在监测 (采样率: ${samplingRate}Hz, 蓄力时间: 5分钟)`;
    });
    
    stopMonitoring.addEventListener('click', () => {
        if (!isMonitoring) return;
        
        clearInterval(monitoringInterval);
        isMonitoring = false;
        monitorStatus.textContent = `监测已停止 (采集了 ${Object.values(samplingData)[0]?.length || 0} 个样本)`;
    });
    
    clearData.addEventListener('click', () => {
        clearPowerBarsAndData();
        monitorStatus.textContent = '数据已清除';
    });
    
    resetPowerProgress.addEventListener('click', () => {
        // 清除底部蓄力进度条
        const powerProgressContainer = document.getElementById('powerProgressContainer');
        if (powerProgressContainer) {
            powerProgressContainer.innerHTML = '';
        }
        
        // 重置蓄力数据但保留采样数据
        buttonPressStartTime = {};
        
        // 重置所有蓄力条宽度
        for (const button in powerBars) {
            const powerBar = powerBars[button];
            if (powerBar) {
                powerBar.style.width = '0%';
                
                // 重新创建底部蓄力进度条
                createPowerProgressBar(button);
            }
        }
        
        buttonPressStatus.textContent = '蓄力数据已重置';
    });
    
    exportData.addEventListener('click', () => {
        if (Object.keys(samplingData).length === 0) {
            alert('没有可导出的数据');
            return;
        }
        
        let csv = '按键,采样率,时间戳,按下状态,是否断开,断开次数,蓄力百分比\n';
        
        for (const [button, samples] of Object.entries(samplingData)) {
            samples.forEach((sample, index) => {
                // 计算蓄力百分比
                let powerPercentage = 0;
                if (sample.value > 0 && buttonPressStartTime[button]) {
                    const pressedTime = sample.timestamp - buttonPressStartTime[button];
                    powerPercentage = Math.min(100, (pressedTime / maxPowerTime) * 100);
                }
                
                csv += `${button},${samplingRate},${sample.timestamp},${sample.value},${sample.disconnected},${disconnectCounts[button] || 0},${powerPercentage.toFixed(2)}\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `gamepad_data_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// 记录按钮状态
function recordButtonStates() {
    // 存储上一次的按钮状态，用于检测断开
    const prevButtonStates = {};
    for (const button in samplingData) {
        const lastSample = samplingData[button][samplingData[button].length - 1];
        prevButtonStates[button] = lastSample ? lastSample.value > 0 : false;
    }
    
    if (!gamepad) {
        // 如果手柄断开，记录断开状态并增加断开计数
        for (const button in samplingData) {
            samplingData[button].push({
                timestamp: Date.now(),
                value: 0,
                disconnected: true
            });
            
            // 如果上一次按钮状态为按下，则增加断开计数
            if (prevButtonStates[button]) {
                disconnectCounts[button] = (disconnectCounts[button] || 0) + 1;
            }
            
            // 断开时重置蓄力
            resetPowerBar(button);
        }
        return;
    }
    
    // 更新手柄状态
    gamepad = navigator.getGamepads()[gamepadIndex];
    
    if (!gamepad) {
        // 如果手柄断开，记录断开状态并增加断开计数
        for (const button in samplingData) {
            samplingData[button].push({
                timestamp: Date.now(),
                value: 0,
                disconnected: true
            });
            
            // 如果上一次按钮状态为按下，则增加断开计数
            if (prevButtonStates[button]) {
                disconnectCounts[button] = (disconnectCounts[button] || 0) + 1;
            }
            
            // 断开时重置蓄力
            resetPowerBar(button);
        }
        return;
    }
    
    const now = Date.now();
    
    // 记录所有按钮
    const allButtons = [
        'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
        'Back', 'Start', 'LS', 'RS', 'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight', 'Guide',
        'L5', 'R5', 'Back1', 'Back2'
    ];
    
    const buttonIndexMap = {
        'A': 0, 'B': 1, 'X': 2, 'Y': 3,
        'LB': 4, 'RB': 5, 'LT': 6, 'RT': 7,
        'Back': 8, 'Start': 9, 'LS': 10, 'RS': 11,
        'DPadUp': 12, 'DPadDown': 13, 'DPadLeft': 14, 'DPadRight': 15,
        'Guide': 16,
        // 扩展按钮映射 - 这些索引可能需要根据实际控制器调整
        'L5': 17, 'R5': 18, 'Back1': 19, 'Back2': 20
    };
    
    allButtons.forEach(button => {
        const index = buttonIndexMap[button];
        if (index !== undefined && index < gamepad.buttons.length) {
            const value = gamepad.buttons[index].value;
            
            // 获取上一次的按钮状态
            const lastSample = samplingData[button] && samplingData[button].length > 0 ? 
                samplingData[button][samplingData[button].length - 1] : null;
            const wasPressed = lastSample && lastSample.value > 0;
            const isPressed = value > 0;
            
            // 检测按键断开：之前是按下状态，现在不是按下状态
            if (wasPressed && !isPressed) {
                // 增加断开计数
                disconnectCounts[button] = (disconnectCounts[button] || 0) + 1;
            }
            
            samplingData[button].push({
                timestamp: now,
                value: value,
                disconnected: false
            });
            
            // 更新蓄力条
            updatePowerBar(button, value);
        }
    });
}

// 更新蓄力条显示
function updatePowerBar(button, value) {
    // 获取蓄力条元素
    let powerBar = powerBars[button];
    if (!powerBar) {
        // 如果蓄力条不存在，创建一个
        powerBar = document.createElement('div');
        powerBar.className = 'power-bar';
        powerBar.id = `power-${button}`;
        powerBar.style.width = '0%';
        powerBar.style.backgroundColor = getButtonColor(button);
        
        // 创建标签
        const label = document.createElement('div');
        label.className = 'power-bar-label';
        label.textContent = button;
        powerBar.appendChild(label);
        
        // 添加到容器
        const oscilloscope = document.getElementById('oscilloscope');
        oscilloscope.appendChild(powerBar);
        powerBars[button] = powerBar;
        
        // 初始化断开计数
        disconnectCounts[button] = 0;
        
        // 在底部面板创建蓝色蓄力进度条
        createPowerProgressBar(button);
    }
    
    const now = Date.now();
    
    // 处理按键按下和释放逻辑
    if (value > 0) {
        // 按键按下
        if (!buttonPressStartTime[button]) {
            // 首次按下，记录时间
            buttonPressStartTime[button] = now;
        }
        
        // 计算已按下时间
        const pressedTime = now - buttonPressStartTime[button];
        // 计算蓄力百分比（最大5分钟）
        const powerPercentage = Math.min(100, (pressedTime / maxPowerTime) * 100);
        
        // 更新蓄力条
        powerBar.style.width = `${powerPercentage}%`;
        
        // 更新底部蓄力进度条
        updatePowerProgressBar(button, powerPercentage);
        
        // 更新按键状态显示
        const buttonPressStatus = document.getElementById('buttonPressStatus');
        const minutes = Math.floor(pressedTime / 60000);
        const seconds = Math.floor((pressedTime % 60000) / 1000);
        buttonPressStatus.textContent = `${button}键已按下 ${minutes}分${seconds}秒 (蓄力: ${powerPercentage.toFixed(1)}%, 断开次数: ${disconnectCounts[button] || 0})`;
    } else {
        // 按键释放，重置蓄力
        resetPowerBar(button);
        
        // 更新状态显示
        const buttonPressStatus = document.getElementById('buttonPressStatus');
        if (buttonPressStatus.textContent.includes(`${button}键已按下`)) {
            buttonPressStatus.textContent = `${button}键已释放，蓄力已重置 (断开次数: ${disconnectCounts[button] || 0})`;
        }
    }
}

// 重置蓄力条
function resetPowerBar(button) {
    // 重置按下开始时间
    buttonPressStartTime[button] = null;
    
    // 重置蓄力条宽度
    const powerBar = powerBars[button];
    if (powerBar) {
        powerBar.style.width = '0%';
    }
    
    // 重置底部蓄力进度条
    updatePowerProgressBar(button, 0);
}

// 创建底部蓄力进度条
function createPowerProgressBar(button) {
    const container = document.getElementById('powerProgressContainer');
    if (!container) return;
    
    // 检查是否已存在
    if (document.getElementById(`progress-${button}`)) return;
    
    // 创建蓄力进度条
    const progressBar = document.createElement('div');
    progressBar.className = 'power-progress-bar';
    progressBar.id = `progress-${button}`;
    
    // 创建标签
    const label = document.createElement('div');
    label.className = 'power-progress-label';
    label.textContent = `${button} 蓄力: 0%`;
    progressBar.appendChild(label);
    
    // 添加到容器
    container.appendChild(progressBar);
}

// 更新底部蓄力进度条
function updatePowerProgressBar(button, percentage) {
    const progressBar = document.getElementById(`progress-${button}`);
    if (!progressBar) return;
    
    // 更新宽度
    progressBar.style.width = `${percentage}%`;
    
    // 更新标签
    const label = progressBar.querySelector('.power-progress-label');
    if (label) {
        label.textContent = `${button} 蓄力: ${percentage.toFixed(1)}%`;
    }
    
    // 更新右侧信息（蓄力进度秒数和断开次数）
    let infoElement = progressBar.querySelector('.power-progress-info');
    if (!infoElement) {
        infoElement = document.createElement('div');
        infoElement.className = 'power-progress-info';
        progressBar.appendChild(infoElement);
    }
    
    // 计算蓄力时间
    let timeInfo = '未按下';
    if (percentage > 0 && buttonPressStartTime[button]) {
        const pressedTime = Date.now() - buttonPressStartTime[button];
        const minutes = Math.floor(pressedTime / 60000);
        const seconds = Math.floor((pressedTime % 60000) / 1000);
        timeInfo = `${minutes}分${seconds}秒`;
    }
    
    infoElement.textContent = `${timeInfo} | 断开: ${disconnectCounts[button] || 0}次`;
}

// 获取按钮颜色
function getButtonColor(button) {
    // 为不同按钮设置不同颜色
    const colorMap = {
        'A': '#FF0000', // 红色
        'B': '#00FF00', // 绿色
        'X': '#0000FF', // 蓝色
        'Y': '#FFFF00', // 黄色
        'LB': '#FF00FF', // 紫色
        'RB': '#00FFFF', // 青色
        'LT': '#FFA500', // 橙色
        'RT': '#800080', // 紫色
        'L5': '#FF1493', // 粉色
        'R5': '#32CD32', // 绿色
        'Back1': '#8A2BE2', // 蓝紫色
        'Back2': '#FF8C00', // 深橙色
    };
    
    return colorMap[button] || getRandomColor();
}

// 处理手柄连接事件
function handleGamepadConnected(event) {
    gamepadIndex = event.gamepad.index;
    gamepad = event.gamepad;
    document.getElementById('buttonStatus').textContent = 
        `已连接: ${gamepad.id} (索引: ${gamepadIndex})`;
}

// 处理手柄断开事件
function handleGamepadDisconnected(event) {
    if (event.gamepad.index === gamepadIndex) {
        gamepadIndex = null;
        gamepad = null;
        document.getElementById('buttonStatus').textContent = '手柄已断开';
    }
}

// 检查是否已经连接了手柄
function checkGamepads() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            gamepadIndex = i;
            gamepad = gamepads[i];
            document.getElementById('buttonStatus').textContent = 
                `已连接: ${gamepad.id} (索引: ${gamepadIndex})`;
            break;
        }
    }
}

// 更新状态
function updateStatus() {
    if (gamepadIndex !== null) {
        gamepad = navigator.getGamepads()[gamepadIndex];
        
        if (gamepad) {
            updateButtonStatus();
            updateAxisStatus();
        }
    }
    
    requestId = requestAnimationFrame(updateStatus);
}

// 更新按钮状态
function updateButtonStatus() {
    const buttonElements = document.querySelectorAll('.button, .trigger, .dpad-button');
    
    // 映射按钮索引到元素ID
    const buttonMapping = {
        0: 'A', 1: 'B', 2: 'X', 3: 'Y',
        4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
        8: 'Back', 9: 'Start',
        10: 'LS', 11: 'RS',
        12: 'DPadUp', 13: 'DPadDown', 14: 'DPadLeft', 15: 'DPadRight',
        16: 'Guide',
        // 扩展按钮映射
        17: 'L5', 18: 'R5', 19: 'Back1', 20: 'Back2'
    };
    
    // 更新按钮状态
    for (let i = 0; i < gamepad.buttons.length; i++) {
        const elementId = buttonMapping[i];
        if (elementId) {
            // 查找元素，无论是直接在document中还是在dpad容器中
            let element = document.getElementById(elementId);
            
            // 如果没有找到元素，可能是D-pad按钮，尝试在dpad容器中查找
            if (!element && (elementId === 'DPadUp' || elementId === 'DPadDown' || 
                             elementId === 'DPadLeft' || elementId === 'DPadRight')) {
                element = document.querySelector(`#${elementId}`);
            }
            
            if (element) {
                const pressed = gamepad.buttons[i].pressed;
                const value = gamepad.buttons[i].value;
                
                if (pressed) {
                    element.classList.add('pressed');
                } else {
                    element.classList.remove('pressed');
                }
                
                // 对于扳机键，根据按压程度调整显示
                if (elementId === 'LT' || elementId === 'RT') {
                    element.style.opacity = 0.3 + value * 0.7;
                }
            }
        }
    }
}

// 更新摇杆状态
function updateAxisStatus() {
    // 左摇杆
    const leftStick = document.getElementById('LS');
    if (leftStick && gamepad.axes.length >= 2) {
        const x = gamepad.axes[0];
        const y = gamepad.axes[1];
        leftStick.style.transform = `translate(${x * 15}px, ${y * 15}px)`;
        
        // 如果摇杆移动超过阈值，添加激活样式
        if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) {
            leftStick.classList.add('active');
        } else {
            leftStick.classList.remove('active');
        }
    }
    
    // 右摇杆
    const rightStick = document.getElementById('RS');
    if (rightStick && gamepad.axes.length >= 4) {
        const x = gamepad.axes[2];
        const y = gamepad.axes[3];
        rightStick.style.transform = `translate(${x * 15}px, ${y * 15}px)`;
        
        // 如果摇杆移动超过阈值，添加激活样式
        if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) {
            rightStick.classList.add('active');
        } else {
            rightStick.classList.remove('active');
        }
    }
}

// 生成随机颜色
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// 清理函数
window.addEventListener('beforeunload', () => {
    if (requestId) {
        cancelAnimationFrame(requestId);
    }
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    // 停止所有震动
    if (gamepad && gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 1,
            weakMagnitude: 0,
            strongMagnitude: 0
        });
    }
});
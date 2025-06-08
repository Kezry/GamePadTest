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
    
    // 设置高级测试功能（添加测试状态初始化）
let advancedTestActive = false;
setupAdvancedTests();
    
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
    const vibrationPreset = document.getElementById('vibrationPreset');
    const applyPreset = document.getElementById('applyPreset');
    
    // 震动预设配置
    const presets = {
        custom: null, // 自定义，不做任何改变
        weak: {
            leftMotor: 0.2,
            rightMotor: 0.1,
            leftTrigger: 0,
            rightTrigger: 0,
            duration: 1000
        },
        medium: {
            leftMotor: 0.5,
            rightMotor: 0.3,
            leftTrigger: 0.2,
            rightTrigger: 0.2,
            duration: 1000
        },
        strong: {
            leftMotor: 1.0,
            rightMotor: 0.8,
            leftTrigger: 0.5,
            rightTrigger: 0.5,
            duration: 1000
        },
        pulse: {
            type: 'pulse',
            intensity: 0.8,
            pulseCount: 3,
            pulseDuration: 200,
            pauseDuration: 100
        },
        alternating: {
            type: 'alternating',
            leftRight: true,
            intensity: 0.7,
            switchDuration: 200,
            totalDuration: 2000
        },
        trigger: {
            type: 'trigger',
            leftTrigger: 0.8,
            rightTrigger: 0.8,
            duration: 1000
        }
    };
    
    // 震动效果定时器
    let vibrationEffectTimer = null;
    
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
    
    // 应用震动函数 - 基础版本
    function applyVibrationEffect(strongMag = null, weakMag = null, leftTrig = null, rightTrig = null, duration = 1000) {
        if (!gamepad || !gamepad.vibrationActuator) return;
        
        // 使用传入的值或从滑块获取值
        const strongMagnitude = strongMag !== null ? strongMag : parseFloat(leftMotor.value);
        const weakMagnitude = weakMag !== null ? weakMag : parseFloat(rightMotor.value);
        const leftTriggerMag = leftTrig !== null ? leftTrig : parseFloat(leftTrigger.value);
        const rightTriggerMag = rightTrig !== null ? rightTrig : parseFloat(rightTrigger.value);
        
        // 应用马达震动
    if (gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: duration,
            weakMagnitude,
            strongMagnitude
        });
    }

    // 优化扳机震动逻辑（优先使用hapticActuators并指定左右位置）
    if (gamepad.hapticActuators?.length >= 2) {
        gamepad.hapticActuators[0].pulse(leftTriggerMag, duration); // 左扳机
        gamepad.hapticActuators[1].pulse(rightTriggerMag, duration); // 右扳机
    } else if (typeof gamepad.setTriggerVibration === 'function') {
        gamepad.setTriggerVibration(leftTriggerMag, rightTriggerMag, duration);
    }
    }
    
    // 扳机震动专用函数
    function applyTriggerVibration(leftMag, rightMag, duration = 1000) {
        if (!gamepad) {
            console.log('未检测到游戏手柄，无法触发震动');
            return;
        }
        
        try {
            // 校验输入范围（Xbox手柄强度需在0-1之间）
            const clampedLeft = Math.max(0, Math.min(1, leftMag));
            const clampedRight = Math.max(0, Math.min(1, rightMag));

            // 优先使用Xbox官方推荐的setTriggerVibration API（微软文档要求）<mcreference link="https://learn.microsoft.com/en-us/gaming/input/xbox-gamepad/" index="1"></mcreference>
            if (typeof gamepad.setTriggerVibration === 'function') {
                gamepad.setTriggerVibration(clampedLeft, clampedRight, duration);
                console.log(`已成功调用Xbox官方API: 左强度${clampedLeft.toFixed(2)}, 右强度${clampedRight.toFixed(2)}, 持续时间${duration}ms`);
                return;
            }

            // 明确hapticActuators的左右对应关系（部分手柄索引可能不同）
            if (gamepad.hapticActuators?.length >= 2) {
                const leftActuator = gamepad.hapticActuators.find(a => a.type === 'left-trigger');
                const rightActuator = gamepad.hapticActuators.find(a => a.type === 'right-trigger');
                if (leftActuator && rightActuator) {
                    leftActuator.pulse(clampedLeft, duration);
                    rightActuator.pulse(clampedRight, duration);
                    console.log(`通过hapticActuators精准触发: 左扳机${clampedLeft.toFixed(2)}, 右扳机${clampedRight.toFixed(2)}`);
                    return;
                }
            }

            // 兼容其他设备的vibrationActuators（保留原逻辑）
            if (gamepad.vibrationActuators?.length > 0) {
                gamepad.vibrationActuators.forEach((actuator, index) => {
                    if (actuator.type === 'trigger') {
                        const mag = index === 0 ? clampedLeft : clampedRight;
                        actuator.playEffect('dual-rumble', {
                            startDelay: 0,
                            duration: duration,
                            strongMagnitude: mag
                        });
                    }
                });
                console.log(`已通过vibrationActuators触发震动: 左强度${leftMag}, 右强度${rightMag}, 持续时间${duration}ms`);
                return;
            }
            
            console.log('当前设备不支持任何扳机震动API');
        } catch (e) {
            console.error('扳机震动执行失败:', e);
        }
    }
    
    // 应用脉冲震动
    function applyPulseEffect(preset) {
        if (!gamepad || !gamepad.vibrationActuator) return;
        
        let pulseCount = 0;
        const maxPulses = preset.pulseCount || 3;
        
        function doPulse() {
            if (pulseCount >= maxPulses) {
                clearTimeout(vibrationEffectTimer);
                vibrationEffectTimer = null;
                return;
            }
            
            // 应用震动
            applyVibrationEffect(preset.intensity, preset.intensity, 0, 0, preset.pulseDuration);
            
            pulseCount++;
            
            // 设置下一次脉冲
            vibrationEffectTimer = setTimeout(doPulse, preset.pulseDuration + preset.pauseDuration);
        }
        
        // 开始脉冲序列
        doPulse();
    }
    
    // 应用交替震动
    function applyAlternatingEffect(preset) {
        if (!gamepad || !gamepad.vibrationActuator) return;
        
        let isLeft = true;
        const startTime = Date.now();
        
        function doAlternate() {
            // 检查是否已经达到总持续时间
            if (Date.now() - startTime >= preset.totalDuration) {
                clearTimeout(vibrationEffectTimer);
                vibrationEffectTimer = null;
                return;
            }
            
            if (preset.leftRight) {
                // 左右交替
                if (isLeft) {
                    applyVibrationEffect(preset.intensity, 0, 0, 0, preset.switchDuration);
                } else {
                    applyVibrationEffect(0, preset.intensity, 0, 0, preset.switchDuration);
                }
            } else {
                // 强弱交替
                if (isLeft) {
                    applyVibrationEffect(preset.intensity, preset.intensity/2, 0, 0, preset.switchDuration);
                } else {
                    applyVibrationEffect(preset.intensity/2, preset.intensity, 0, 0, preset.switchDuration);
                }
            }
            
            isLeft = !isLeft;
            
            // 设置下一次切换
            vibrationEffectTimer = setTimeout(doAlternate, preset.switchDuration);
        }
        
        // 开始交替序列
        doAlternate();
    }
    
    // 停止所有震动
    function stopAllVibration() {
        if (!gamepad) return;
        
        // 清除任何正在进行的震动效果定时器
        if (vibrationEffectTimer) {
            clearTimeout(vibrationEffectTimer);
            vibrationEffectTimer = null;
        }
        
        // 停止标准震动
        if (gamepad.vibrationActuator) {
            gamepad.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: 1,
                weakMagnitude: 0,
                strongMagnitude: 0
            });
        }
        
        try {
            // 停止所有可能的震动执行器
            if (gamepad.hapticActuators) {
                for (let i = 0; i < gamepad.hapticActuators.length; i++) {
                    gamepad.hapticActuators[i].pulse(0, 10);
                }
            }
            
            if (gamepad.vibrationActuators) {
                for (let i = 0; i < gamepad.vibrationActuators.length; i++) {
                    gamepad.vibrationActuators[i].playEffect('dual-rumble', {
                        startDelay: 0,
                        duration: 1,
                        weakMagnitude: 0,
                        strongMagnitude: 0
                    });
                }
            }
            
            // 尝试使用触发器特定API (如果存在)
            if (typeof gamepad.setTriggerVibration === 'function') {
                gamepad.setTriggerVibration(0, 0, 10);
            }
            
            // 尝试使用DualSense特定API (如果存在)
            if (typeof gamepad.setDualSenseTriggerEffect === 'function') {
                gamepad.setDualSenseTriggerEffect('off', {});
            }
        } catch (e) {
            console.log('停止震动失败:', e);
        }
    }
    
    // 应用预设
    function applyPresetEffect(presetName) {
        // 先停止所有震动
        stopAllVibration();
        
        const preset = presets[presetName];
        if (!preset) return; // 自定义模式或无效预设
        
        // 根据预设类型应用不同的震动效果
        switch (presetName) {
            case 'weak':
            case 'medium':
            case 'strong':
                // 更新滑块值
                leftMotor.value = preset.leftMotor;
                rightMotor.value = preset.rightMotor;
                leftTrigger.value = preset.leftTrigger;
                rightTrigger.value = preset.rightTrigger;
                
                // 更新显示值
                leftMotorValue.textContent = preset.leftMotor;
                rightMotorValue.textContent = preset.rightMotor;
                leftTriggerValue.textContent = preset.leftTrigger;
                rightTriggerValue.textContent = preset.rightTrigger;
                
                // 应用震动
                applyVibrationEffect(
                    preset.leftMotor,
                    preset.rightMotor,
                    preset.leftTrigger,
                    preset.rightTrigger,
                    preset.duration
                );
                break;
                
            case 'pulse':
                applyPulseEffect(preset);
                break;
                
            case 'alternating':
                applyAlternatingEffect(preset);
                break;
                
            case 'trigger':
                // 更新滑块值
                leftTrigger.value = preset.leftTrigger;
                rightTrigger.value = preset.rightTrigger;
                
                // 更新显示值
                leftTriggerValue.textContent = preset.leftTrigger;
                rightTriggerValue.textContent = preset.rightTrigger;
                
                // 应用扳机震动
                applyTriggerVibration(preset.leftTrigger, preset.rightTrigger, preset.duration);
                break;
        }
    }
    
    // 应用震动按钮点击事件
    applyVibration.addEventListener('click', () => {
        // 停止之前的震动效果
        stopAllVibration();
        
        // 应用自定义震动
        applyVibrationEffect();
    });
    
    // 应用预设按钮点击事件
    applyPreset.addEventListener('click', () => {
        const selectedPreset = vibrationPreset.value;
        applyPresetEffect(selectedPreset);
    });
    
    // 停止震动按钮点击事件
    stopVibration.addEventListener('click', stopAllVibration);
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
    if (!navigator.getGamepads) {
        document.getElementById('buttonStatus').textContent = '当前浏览器不支持 Gamepad API，请使用最新版 Chrome/Edge/Firefox。';
        return;
    }
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!gamepads) {
        document.getElementById('buttonStatus').textContent = '无法获取手柄信息，请检查浏览器设置或系统权限。';
        return;
    }
    let found = false;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            gamepadIndex = i;
            gamepad = gamepads[i];
            document.getElementById('buttonStatus').textContent = 
                `已连接: ${gamepad.id} (索引: ${gamepadIndex})`;
            found = true;
            break;
        }
    }
    if (!found) {
        gamepadIndex = null;
        gamepad = null;
        document.getElementById('buttonStatus').textContent = '未检测到手柄，请插入手柄并按任意键唤醒。';
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
        12: 'DPadUp', 13: 'DPadDown', 14: 'DPadLeft', 15: 'DPadRight', // 确认手柄实际DPad索引是否匹配，若方向仍错需交换索引值（如12↔13）
        16: 'Guide',
        // 扩展按钮映射
        // 调整为实际检测到的Xbox手柄背键索引（示例值，需根据实际日志调整）
        17: 'L5', 18: 'R5', 19: 'Back1', 20: 'Back2' // 注意：请通过控制台日志确认实际按钮索引后修改
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
            
            // 如果仍然没有找到元素，可能是特殊按钮（L5、R5、Back1、Back2），尝试使用querySelector
            if (!element && (elementId === 'L5' || elementId === 'R5' || 
                           elementId === 'Back1' || elementId === 'Back2')) {
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
        const y = -gamepad.axes[1]; // 反转Y轴方向解决上下颠倒
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

// 摇杆死区测试
let deadzoneTestActive = false;
let deadzoneAnimationId = null;

function setupDeadzoneTest() {
    const startDeadzoneTest = document.getElementById('startDeadzoneTest');
    const stopDeadzoneTest = document.getElementById('stopDeadzoneTest');
    const deadzoneStatus = document.getElementById('deadzoneStatus');
    const leftStickCanvas = document.getElementById('leftStickCanvas');
    const rightStickCanvas = document.getElementById('rightStickCanvas');
    const leftStickInfo = document.getElementById('leftStickInfo');
    const rightStickInfo = document.getElementById('rightStickInfo');
    const leftTrajectoryCanvas = document.getElementById('leftTrajectoryCanvas');
    const rightTrajectoryCanvas = document.getElementById('rightTrajectoryCanvas');
    const leftTrajectoryRateInput = document.getElementById('leftTrajectoryRate');
    const rightTrajectoryRateInput = document.getElementById('rightTrajectoryRate');
    const leftTrajectoryClear = document.getElementById('leftTrajectoryClear');
    const rightTrajectoryClear = document.getElementById('rightTrajectoryClear');
    const leftTrajectoryFullscreen = document.getElementById('leftTrajectoryFullscreen');
    const rightTrajectoryFullscreen = document.getElementById('rightTrajectoryFullscreen');

    function requestFullscreen(element) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    leftTrajectoryFullscreen.addEventListener('click', () => {
        requestFullscreen(leftTrajectoryCanvas);
    });

    rightTrajectoryFullscreen.addEventListener('click', () => {
        requestFullscreen(rightTrajectoryCanvas);
    });

    
    // 初始化画布上下文
    const leftCtx = leftStickCanvas.getContext('2d');
    const rightCtx = rightStickCanvas.getContext('2d');
    const leftTrajectoryCtx = leftTrajectoryCanvas.getContext('2d');
    const rightTrajectoryCtx = rightTrajectoryCanvas.getContext('2d');
    let leftTrajectory = [];
    let rightTrajectory = [];
    let leftTrajectoryTimer = null;
    let rightTrajectoryTimer = null;

    function drawTrajectory(ctx, trajectory, width, height) {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        
        // 绘制背景网格
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        
        // 绘制垂直线
        for (let x = 0; x <= width; x += width/10) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // 绘制水平线
        for (let y = 0; y <= height; y += height/10) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 绘制中心十字线
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width/2, 0);
        ctx.lineTo(width/2, height);
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.stroke();
        
        // 绘制采样点
        if (trajectory.length > 0) {
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < trajectory.length; i++) {
                const {x, y} = trajectory[i];
                const px = width/2 + x * (width/2 - 10);
                const py = height/2 + y * (height/2 - 10); // 修改为加号，使Y轴向下为正
                ctx.beginPath();
                const pointSize = document.fullscreenElement ? 3 : 2; // 全屏时增大点的大小
                ctx.arc(px, py, pointSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function startTrajectorySampling() {
        stopTrajectorySampling();
        leftTrajectory = [];
        rightTrajectory = [];
        const leftRate = Math.max(1, Math.min(2000, parseInt(leftTrajectoryRateInput.value) || 500));
        const rightRate = Math.max(1, Math.min(2000, parseInt(rightTrajectoryRateInput.value) || 500));
        leftTrajectoryTimer = setInterval(() => {
            if (!gamepad) return;
            const lx = gamepad.axes[0];
            const ly = gamepad.axes[1];
            leftTrajectory.push({x: lx, y: ly});
            if (leftTrajectory.length > 1000) leftTrajectory.shift();
            drawTrajectory(leftTrajectoryCtx, leftTrajectory, leftTrajectoryCanvas.width, leftTrajectoryCanvas.height);
        }, 1000 / leftRate);
        rightTrajectoryTimer = setInterval(() => {
            if (!gamepad) return;
            const rx = gamepad.axes[2];
            const ry = gamepad.axes[3];
            rightTrajectory.push({x: rx, y: ry});
            if (rightTrajectory.length > 1000) rightTrajectory.shift();
            drawTrajectory(rightTrajectoryCtx, rightTrajectory, rightTrajectoryCanvas.width, rightTrajectoryCanvas.height);
        }, 1000 / rightRate);
    }
    function stopTrajectorySampling() {
        if (leftTrajectoryTimer) { clearInterval(leftTrajectoryTimer); leftTrajectoryTimer = null; }
        if (rightTrajectoryTimer) { clearInterval(rightTrajectoryTimer); rightTrajectoryTimer = null; }
    }
    leftTrajectoryClear.addEventListener('click', () => {
        leftTrajectory = [];
        drawTrajectory(leftTrajectoryCtx, leftTrajectory, leftTrajectoryCanvas.width, leftTrajectoryCanvas.height);
    });
    rightTrajectoryClear.addEventListener('click', () => {
        rightTrajectory = [];
        drawTrajectory(rightTrajectoryCtx, rightTrajectory, rightTrajectoryCanvas.width, rightTrajectoryCanvas.height);
    });
    
    // 绘制摇杆位置的函数
    function drawStickPosition(ctx, x, y, width, height) {
        y = -y;
        // 清除画布
        ctx.clearRect(0, 0, width, height);
        
        // 绘制背景网格
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // 绘制网格线
        for (let i = 0; i <= 10; i++) {
            const pos = i * (width / 10);
            
            // 垂直线
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, height);
            ctx.stroke();
            
            // 水平线
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(width, pos);
            ctx.stroke();
        }
        
        // 绘制中心十字线
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        
        // 垂直中心线
        ctx.beginPath();
        ctx.moveTo(width/2, 0);
        ctx.lineTo(width/2, height);
        ctx.stroke();
        
        // 水平中心线
        ctx.beginPath();
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.stroke();
        
        // 绘制死区圆
        ctx.strokeStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(width/2, height/2, width/20, 0, Math.PI * 2);
        ctx.stroke();
        
        // 绘制最大范围圆
        ctx.strokeStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(width/2, height/2, width/2 - 10, 0, Math.PI * 2);
        ctx.stroke();
        
        // 计算摇杆位置
        const stickX = width/2 + x * (width/2 - 10);
        const stickY = height/2 - y * (height/2 - 10); // Y轴反转，向上为正
        
        // 绘制摇杆点
        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.arc(stickX, stickY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制轨迹点
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(stickX, stickY, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 更新摇杆测试
    function updateDeadzoneTest() {
        if (!gamepad || !deadzoneTestActive) return;
        
        // 获取最新的手柄状态
        gamepad = navigator.getGamepads()[gamepadIndex];
        
        if (gamepad) {
            // 获取摇杆值
            const leftX = gamepad.axes[0];
            const leftY = gamepad.axes[1];
            const rightX = gamepad.axes[2];
            const rightY = gamepad.axes[3];
            
            // 更新信息显示
            leftStickInfo.textContent = `X: ${leftX.toFixed(3)}, Y: ${leftY.toFixed(3)}`;
            rightStickInfo.textContent = `X: ${rightX.toFixed(3)}, Y: ${rightY.toFixed(3)}`;
            
            // 绘制摇杆位置
            drawStickPosition(leftCtx, leftX, leftY, leftStickCanvas.width, leftStickCanvas.height);
            drawStickPosition(rightCtx, rightX, rightY, rightStickCanvas.width, rightStickCanvas.height);
            
            // 检测死区问题
            const leftMagnitude = Math.sqrt(leftX * leftX + leftY * leftY);
            const rightMagnitude = Math.sqrt(rightX * rightX + rightY * rightY);
            
            if (leftMagnitude < 0.05 && rightMagnitude < 0.05) {
                deadzoneStatus.textContent = '摇杆居中 - 正常';
                deadzoneStatus.style.color = '#4CAF50';
            } else if (leftMagnitude < 0.05) {
                deadzoneStatus.textContent = '左摇杆居中 - 右摇杆偏移';
                deadzoneStatus.style.color = '#FFC107';
            } else if (rightMagnitude < 0.05) {
                deadzoneStatus.textContent = '右摇杆居中 - 左摇杆偏移';
                deadzoneStatus.style.color = '#FFC107';
            } else {
                deadzoneStatus.textContent = '两个摇杆都偏移 - 可能需要校准';
                deadzoneStatus.style.color = '#FF5252';
            }
        }
        
        deadzoneAnimationId = requestAnimationFrame(updateDeadzoneTest);
    }
    
    // 开始测试按钮
    startDeadzoneTest.addEventListener('click', () => {
        if (!gamepad) {
            deadzoneStatus.textContent = '未检测到手柄';
            deadzoneStatus.style.color = '#FF5252';
            return;
        }
        
        deadzoneTestActive = true;
        deadzoneStatus.textContent = '测试中...';
        deadzoneStatus.style.color = '#FFFFFF';
        
        // 初始化画布
        leftCtx.clearRect(0, 0, leftStickCanvas.width, leftStickCanvas.height);
        rightCtx.clearRect(0, 0, rightStickCanvas.width, rightStickCanvas.height);
        leftTrajectoryCtx.clearRect(0, 0, leftTrajectoryCanvas.width, leftTrajectoryCanvas.height);
        rightTrajectoryCtx.clearRect(0, 0, rightTrajectoryCanvas.width, rightTrajectoryCanvas.height);
        
        // 开始轨迹采样
        startTrajectorySampling();
        
        // 开始更新
        updateDeadzoneTest();
    });

// 此处多余的 if 语句块已删除，修复了函数结构和大括号闭合问题。
    
    // 停止测试按钮
    stopDeadzoneTest.addEventListener('click', () => {
        deadzoneTestActive = false;
        if (deadzoneAnimationId) {
            cancelAnimationFrame(deadzoneAnimationId);
            deadzoneAnimationId = null;
        }
        
        // 停止轨迹采样
        stopTrajectorySampling();
        
        deadzoneStatus.textContent = '测试已停止';
        deadzoneStatus.style.color = '#FFFFFF';
    });
}

// 按键响应时间测试
let responseTestActive = false;
let buttonResponseTimes = {};
let lastButtonStates = {};

function setupResponseTest() {
    const startResponseTest = document.getElementById('startResponseTest');
    const stopResponseTest = document.getElementById('stopResponseTest');
    const responseStatus = document.getElementById('responseStatus');
    const responseResults = document.getElementById('responseResults');
    
    // 开始测试
    startResponseTest.addEventListener('click', () => {
        if (!gamepad) {
            responseStatus.textContent = '未检测到手柄';
            return;
        }
        
        responseTestActive = true;
        buttonResponseTimes = {};
        lastButtonStates = {};
        responseResults.innerHTML = '';
        responseStatus.textContent = '按下任意按键开始测试';
    });
    
    // 停止测试
    stopResponseTest.addEventListener('click', () => {
        responseTestActive = false;
        responseStatus.textContent = '测试已停止';
    });
    
    // 更新响应时间测试
    function updateResponseTest() {
        if (!gamepad || !responseTestActive) return;
        
        // 获取最新的手柄状态
        gamepad = navigator.getGamepads()[gamepadIndex];
        
        if (gamepad) {
            // 检查按钮状态
            for (let i = 0; i < gamepad.buttons.length; i++) {
                const buttonName = getButtonName(i);
                const pressed = gamepad.buttons[i].pressed;
                
                // 如果按钮状态发生变化
                if (lastButtonStates[i] !== pressed) {
                    if (pressed) {
                        // 按钮被按下，记录时间
                        buttonResponseTimes[i] = {
                            startTime: performance.now(),
                            endTime: null
                        };
                        responseStatus.textContent = `检测到按键: ${buttonName} - 测量中...`;
                    } else if (buttonResponseTimes[i] && buttonResponseTimes[i].startTime) {
                        // 按钮被释放，计算响应时间
                        buttonResponseTimes[i].endTime = performance.now();
                        const responseTime = buttonResponseTimes[i].endTime - buttonResponseTimes[i].startTime;
                        
                        // 显示结果
                        const resultElement = document.createElement('div');
                        resultElement.className = 'response-result';
                        resultElement.textContent = `${buttonName}: ${responseTime.toFixed(2)}ms`;
                        
                        // 根据响应时间设置颜色
                        if (responseTime < 20) {
                            resultElement.style.color = '#4CAF50'; // 绿色 - 非常好
                        } else if (responseTime < 50) {
                            resultElement.style.color = '#8BC34A'; // 浅绿色 - 好
                        } else if (responseTime < 100) {
                            resultElement.style.color = '#FFC107'; // 黄色 - 一般
                        } else {
                            resultElement.style.color = '#FF5252'; // 红色 - 差
                        }
                        
                        responseResults.appendChild(resultElement);
                        responseStatus.textContent = '按下任意按键继续测试';
                    }
                    
                    // 更新按钮状态
                    lastButtonStates[i] = pressed;
                }
            }
        }
    }
    
    // 获取按钮名称
    function getButtonName(index) {
        const buttonMapping = {
            0: 'A', 1: 'B', 2: 'X', 3: 'Y',
            4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
            8: 'Back', 9: 'Start',
            10: 'LS', 11: 'RS',
            12: 'DPadUp', 13: 'DPadDown', 14: 'DPadLeft', 15: 'DPadRight', // 确认手柄实际DPad索引是否匹配，若方向仍错需交换索引值（如12↔13）
            16: 'Guide',
            // 调整为实际检测到的Xbox手柄背键索引（示例值，需根据实际日志调整）
        17: 'L5', 18: 'R5', 19: 'Back1', 20: 'Back2' // 注意：请通过控制台日志确认实际按钮索引后修改
        };
        
        return buttonMapping[index] || `按钮${index}`;
    }
    
    // 添加到更新循环
    const originalUpdateStatus = window.updateStatus;
    window.updateStatus = function() {
        originalUpdateStatus();
        if (responseTestActive) {
            updateResponseTest();
        }
    };
}

// 十字键八向测试
let dpadTestActive = false;
let dpadAnimationId = null;

function setupDpadTest() {
    const startDpadTest = document.getElementById('startDpadTest');
    const stopDpadTest = document.getElementById('stopDpadTest');
    const dpadCanvas = document.getElementById('dpadCanvas');
    const dpadInfo = document.getElementById('dpadInfo');
    
    const ctx = dpadCanvas.getContext('2d');
    const width = dpadCanvas.width;
    const height = dpadCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 绘制十字键方向
    function drawDpadDirection(direction) {
        // 清除画布
        ctx.clearRect(0, 0, width, height);
        
        // 绘制背景圆
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(centerX, centerY, width/2 - 10, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制八个方向区域
        const directions = [
             'right', 'downright', 
            'down', 'downleft', 'left', 'upleft'
            ,'up', 'upright'
        ];
        
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const startAngle = angle - Math.PI / 8;
            const endAngle = angle + Math.PI / 8;
            
            ctx.fillStyle = directions[i] === direction ? '#4CAF50' : '#555';
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, width/2 - 20, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();
            
            // 绘制方向标签
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const labelRadius = width/2 - 40;
            const labelX = centerX + Math.sin(angle) * labelRadius;
            const labelY = centerY - Math.cos(angle) * labelRadius;
            
            let label;
            switch(directions[i]) {
                case 'up': label = '↑'; break;
                case 'upright': label = '↗'; break;
                case 'right': label = '→'; break;
                case 'downright': label = '↘'; break;
                case 'down': label = '↓'; break;
                case 'downleft': label = '↙'; break;
                case 'left': label = '←'; break;
                case 'upleft': label = '↖'; break;
                default: label = '';
            }
            
            ctx.fillText(label, labelX, labelY);
        }
        
        // 绘制中心点
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 获取十字键方向
    function getDpadDirection() {
        if (!gamepad) return 'none';
        
        const up = gamepad.buttons[12].pressed;
        const down = gamepad.buttons[13].pressed;
        const left = gamepad.buttons[14].pressed;
        const right = gamepad.buttons[15].pressed;
        
        if (up && right) return 'upright';
        if (down && right) return 'downright';
        if (down && left) return 'downleft';
        if (up && left) return 'upleft';
        if (up) return 'up';
        if (right) return 'right';
        if (down) return 'down';
        if (left) return 'left';
        
        return 'none';
    }
    
    // 更新十字键测试
    function updateDpadTest() {
        if (!gamepad || !dpadTestActive) return;
        
        // 获取最新的手柄状态
        gamepad = navigator.getGamepads()[gamepadIndex];
        
        if (gamepad) {
            const direction = getDpadDirection();
            drawDpadDirection(direction);
            
            // 更新方向信息
            if (direction === 'none') {
                dpadInfo.textContent = '方向: 无';
            } else {
                const directionMap = {
                    'up': '上',
                    'upright': '右上',
                    'right': '右',
                    'downright': '右下',
                    'down': '下',
                    'downleft': '左下',
                    'left': '左',
                    'upleft': '左上'
                };
                
                dpadInfo.textContent = `方向: ${directionMap[direction]}`;
            }
        }
        
        dpadAnimationId = requestAnimationFrame(updateDpadTest);
    }
    
    // 开始测试按钮
    startDpadTest.addEventListener('click', () => {
        if (!gamepad) {
            dpadInfo.textContent = '未检测到手柄';
            return;
        }
        
        dpadTestActive = true;
        drawDpadDirection('none');
        updateDpadTest();
    });
    
    // 停止测试按钮
    stopDpadTest.addEventListener('click', () => {
        dpadTestActive = false;
        if (dpadAnimationId) {
            cancelAnimationFrame(dpadAnimationId);
            dpadAnimationId = null;
        }
        dpadInfo.textContent = '测试已停止';
    });
}

// 手柄连接稳定性测试
let stabilityTestActive = false;
let stabilityInterval = null;
let connectionTimes = [];
let lastConnectionTime = null;
let disconnectCount = 0;

function setupStabilityTest() {
    const startStabilityTest = document.getElementById('startStabilityTest');
    const stopStabilityTest = document.getElementById('stopStabilityTest');
    const stabilityStatus = document.getElementById('stabilityStatus');
    const stabilityDuration = document.getElementById('stabilityDuration');
    const disconnectCountElement = document.getElementById('disconnectCount');
    const maxConnectTimeElement = document.getElementById('maxConnectTime');
    const minConnectTimeElement = document.getElementById('minConnectTime');
    const avgConnectTimeElement = document.getElementById('avgConnectTime');
    
    // 开始测试
    startStabilityTest.addEventListener('click', () => {
        if (!gamepad) {
            stabilityStatus.textContent = '未检测到手柄';
            return;
        }
        
        // 重置数据
        stabilityTestActive = true;
        connectionTimes = [];
        lastConnectionTime = Date.now();
        disconnectCount = 0;
        
        // 更新UI
        disconnectCountElement.textContent = '0';
        maxConnectTimeElement.textContent = '0秒';
        minConnectTimeElement.textContent = '0秒';
        avgConnectTimeElement.textContent = '0秒';
        
        // 获取测试时长（分钟）
        const durationMinutes = parseInt(stabilityDuration.value) || 5;
        const durationMs = durationMinutes * 60 * 1000;
        
        // 更新状态
        stabilityStatus.textContent = `测试中... (剩余: ${durationMinutes}分钟)`;
        
        // 设置定时器更新剩余时间
        const startTime = Date.now();
        stabilityInterval = setInterval(() => {
            const elapsedMs = Date.now() - startTime;
            const remainingMs = durationMs - elapsedMs;
            
            if (remainingMs <= 0) {
                // 测试完成
                clearInterval(stabilityInterval);
                stabilityTestActive = false;
                stabilityStatus.textContent = '测试完成';
                updateStabilityResults();
                return;
            }
            
            // 更新剩余时间
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            stabilityStatus.textContent = `测试中... (剩余: ${remainingMinutes}分钟)`;
            
            // 检查手柄连接状态
            checkControllerConnection();
        }, 1000);
    });
    
    // 停止测试按钮
    stopStabilityTest.addEventListener('click', () => {
        if (stabilityInterval) {
            clearInterval(stabilityInterval);
            stabilityInterval = null;
        }
        stabilityTestActive = false;
        stabilityStatus.textContent = '测试已停止';
        updateStabilityResults();
    });
    
    // 检查手柄连接状态
    function checkControllerConnection() {
        const currentGamepad = navigator.getGamepads()[gamepadIndex];
        const now = Date.now();
        
        if (!currentGamepad && gamepad) {
            // 手柄断开连接
            disconnectCount++;
            disconnectCountElement.textContent = disconnectCount;
            
            // 记录连接时间
            const connectionDuration = now - lastConnectionTime;
            connectionTimes.push(connectionDuration);
            
            // 更新结果
            updateStabilityResults();
        } else if (currentGamepad && !gamepad) {
            // 手柄重新连接
            lastConnectionTime = now;
        }
        
        // 更新当前手柄状态
        gamepad = currentGamepad;
    }
    
    // 更新稳定性测试结果
    function updateStabilityResults() {
        if (connectionTimes.length === 0) return;
        
        // 计算最长、最短和平均连接时间
        const maxTime = Math.max(...connectionTimes);
        const minTime = Math.min(...connectionTimes);
        const avgTime = connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length;
        
        // 更新UI
        maxConnectTimeElement.textContent = formatTime(maxTime);
        minConnectTimeElement.textContent = formatTime(minTime);
        avgConnectTimeElement.textContent = formatTime(avgTime);
    }
    
    // 格式化时间
    function formatTime(ms) {
        if (ms < 1000) return `${ms}毫秒`;
        
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}秒`;
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}分${remainingSeconds}秒`;
    }
}

// 初始化新测试功能
function setupAdvancedTests() {
    setupDeadzoneTest();
    setupResponseTest();
    setupDpadTest();
    setupStabilityTest();
}

// 在DOMContentLoaded事件中添加新测试功能的初始化
const originalDOMContentLoaded = window.addEventListener;
window.addEventListener = function(event, callback) {
    if (event === 'DOMContentLoaded') {
        const originalCallback = callback;
        callback = function() {
            originalCallback();
            setupAdvancedTests();
        };
    }
    originalDOMContentLoaded.call(window, event, callback);
};

// 清理函数
window.addEventListener('beforeunload', () => {
    if (requestId) {
        cancelAnimationFrame(requestId);
    }
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    if (deadzoneAnimationId) {
        cancelAnimationFrame(deadzoneAnimationId);
    }
    
    if (dpadAnimationId) {
        cancelAnimationFrame(dpadAnimationId);
    }
    
    if (stabilityInterval) {
        clearInterval(stabilityInterval);
    }
    
    // 清除震动效果定时器
    if (vibrationEffectTimer) {
        clearTimeout(vibrationEffectTimer);
        vibrationEffectTimer = null;
    }
    
    // 停止所有震动
    if (gamepad) {
        stopAllVibration();
    }
});

// 生成随机颜色
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// 摇杆死区测试

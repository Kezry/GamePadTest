export type Language = 'en' | 'zh';

export const translations = {
  en: {
    // Header
    title: 'Gamepad',
    titleAccent: 'Tester',
    subtitle: 'Professional Controller Diagnostics',
    
    // Connection Status
    connectionStatus: 'Connection Status',
    devicesConnected: '{count} device{plural} connected',
    connected: 'Connected',
    waitingForDevice: 'Waiting for device...',
    noControllerDetected: 'No Controller Detected',
    connectInstructions: 'Connect a gamepad via USB or Bluetooth',
    pressButtonHint: '👆 Press & hold ANY BUTTON on your controller now!',
    pressButtonHintSub: 'Browsers require a button press before detecting gamepads.',
    clickToActivate: 'I pressed a button',
    troubleshootTitle: 'Still not detected?',
    troubleshootStep1: '1. Check if your OS recognizes the controller (Windows: Settings → Devices)',
    troubleshootStep2: '2. Try a different USB port or cable',
    troubleshootStep3: '3. Some controllers need XInput mode (hold specific button combo)',
    troubleshootStep4: '4. Try refreshing the page after connecting',
    iframeNotice: 'Gamepad detection may be blocked in the embedded preview. Please open in a new tab to test.',
    openInNewTab: 'Open in new tab',
    gamepadNotSupportedTitle: 'Gamepad API not available',
    gamepadNotSupportedDesc: 'Your current browser/environment does not support the Web Gamepad API. Please use Chrome/Edge and avoid in-app browsers.',
    copyDebug: 'Copy debug info',
    copied: 'Copied',
    debugTitle: 'Debug info',
    debugDesc: 'If not detected, copy this info and send it here.',
    usbWired: 'USB Wired',
    bluetooth: 'Bluetooth',
    vibration: 'Vibration',
    gyro: 'Gyro',
    buttons: 'Buttons',
    axes: 'Axes',
    index: 'Index',
    standard: 'Standard',
    multipleControllersDetected: 'Multiple controllers detected:',
    controller: 'Controller',
    
    // Controller Types
    xboxController: 'Xbox Controller',
    xboxEliteController: 'Xbox Elite Controller',
    dualSenseController: 'DualSense Controller',
    dualShock4Controller: 'DualShock 4 Controller',
    switchProController: 'Nintendo Switch Pro Controller',
    genericGamepad: 'Generic Gamepad',
    xbox: 'Xbox',
    playstation: 'PlayStation',
    switch: 'Switch',
    generic: 'Generic',
    
    // Testing Tabs
    buttonsTab: 'Buttons',
    joysticksTab: 'Joysticks',
    vibrationTab: 'Vibration',
    latencyTab: 'Latency',
    deadzoneTab: 'Deadzone',
    rankingsTab: 'Rankings',
    
    // Button Tester
    buttonTest: 'Button Test',
    connectToTestButtons: 'Connect a controller to test buttons',
    pressed: 'pressed',
    recentInputs: 'Recent Inputs',
    pressAnyButton: 'Press any button...',
    
    // Joystick Tester
    joystickTest: 'Joystick Test',
    connectToTestJoysticks: 'Connect a controller to test joysticks',
    leftStick: 'Left Stick',
    rightStick: 'Right Stick',
    leftDrift: 'Left Drift',
    rightDrift: 'Right Drift',
    leftMagnitude: 'Left Magnitude',
    rightMagnitude: 'Right Magnitude',
    
    // Vibration Tester
    vibrationTest: 'Vibration Test',
    connectToTestVibration: 'Connect a controller to test vibration',
    notSupported: 'Not supported',
    intensity: 'Intensity',
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    duration: 'Duration',
    testVibration: 'Test Vibration',
    vibrating: 'Vibrating...',
    didYouFeel: 'Did you feel the vibration?',
    yes: 'Yes',
    no: 'No',
    vibrationPatterns: 'Vibration Patterns',
    patternHeartbeat: 'Heartbeat',
    patternEngine: 'Engine',
    patternRoadBump: 'Bump',
    patternRumbleStrip: 'Rumble',
    patternExplosion: 'Explosion',
    patternRainDrop: 'Rain',
    patternGunshot: 'Gunshot',
    patternNotification: 'Alert',
    patternDrifting: 'Drift',
    patternLowHealth: 'Low HP',
    patternPowerUp: 'Power Up',
    patternEarthquake: 'Quake',
    patternWind: 'Wind',
    patternMusic: 'Music',
    patternCustom: 'Custom',
    loopCount: 'Loop Count',
    
    // Latency Tester
    latencyTest: 'Input Latency',
    connectToTest: 'Connect a controller to test',
    sampleRate: 'Sample Rate',
    latencyInstructions: 'Press Start to begin the latency test. React as fast as you can when prompted!',
    latencyDescription: 'Measures the polling interval between gamepad input updates. Move joysticks or press buttons continuously for accurate readings.',
    latencyInstructions2: 'Click Start then move joysticks or press buttons',
    samples: 'Samples',
    pressNow: 'PRESS NOW',
    pressAnyButtonQuick: 'Press any button as fast as you can!',
    waitForPrompt: 'Wait for prompt',
    test: 'Test',
    avgLatency: 'Average',
    minLatency: 'Min',
    maxLatency: 'Max',
    pollRate: 'Poll Rate',
    jitter: 'Jitter',
    stalls: 'Stalls',
    stability: 'Stability',
    startLatencyTest: 'Start Test',
    stopTest: 'Stop',
    cancel: 'Cancel',
    
    // Gyroscope Tester
    gyroTest: 'Gyroscope Test',
    gyroTab: 'Gyroscope',
    calibrate: 'Calibrate',
    gyroNotDetected: 'No gyroscope detected. Using joystick simulation.',
    gyroActive: 'Gyroscope active',
    gyroSimulated: 'Simulated with joysticks',
    rotation: 'Rotation',
    acceleration: 'Acceleration',
    
    // Connection Stability Tester
    stabilityTest: 'Stability Test',
    stabilityTab: 'Stability',
    stabilityDescription: 'Test button hold stability. Press and hold a button to detect disconnections.',
    targetDuration: 'Target Duration',
    testing: 'Testing',
    disconnects: 'Disconnects',
    testResults: 'Test Results',
    patterns: 'patterns',
    
    // Deadzone Tester
    deadzoneTest: 'Deadzone Test',
    deadzoneInstructions: 'Leave your joysticks in neutral position. The red box shows detected drift range.',
    customDeadzone: 'Custom Deadzone',
    driftRange: 'Drift',
    suggested: 'Suggested',
    
    // Rankings
    controllerRankings: 'Controller Rankings',
    tierRanking: 'Tier Ranking',
    recentTests: 'Recent Tests',
    noTestRecords: 'No test records yet',
    beTheFirst: 'Be the first to submit a test!',
    score: 'Score',
    tested: 'Tested',
    tests: 'tests',
    avgScore: 'Avg Score',
    bestScore: 'Best Score',
    
    // Save Test
    saveTest: 'Save Test',
    testSaved: 'Test Saved!',
    saving: 'Saving...',
    saveTestResult: 'Save Test Result',
    testSavedSuccess: 'Your test has been recorded for the rankings',
    
    // Compatibility
    compatibility: 'Compatibility',
    supportedBrowsers: 'Supported Browsers',
    supportedControllers: 'Supported Controllers',
    note: 'Note',
    compatibilityNote: 'This tool uses the Web Gamepad API. For best results, use a Chromium-based browser and connect your controller via USB.',
    
    // Footer
    footerTitle: 'Gamepad Tests Pro — Professional controller diagnostics for all platforms',
    footerSubtitle: 'Built with Web Gamepad API • No plugins required',
    
    // Coming Soon
    industrialGradeTesting: 'Industrial-Grade Testing',
    comingSoon: 'Coming Soon',
    comingSoonDesc: 'Advanced latency measurement, deadzone analysis, and connection stability testing will be available in a future update.',
    
    // Language
    language: 'Language',
    english: 'English',
    chinese: '中文',
  },
  
  zh: {
    // Header
    title: '手柄',
    titleAccent: '测试器',
    subtitle: '专业手柄诊断工具',
    
    // Connection Status
    connectionStatus: '连接状态',
    devicesConnected: '已连接 {count} 台设备',
    connected: '已连接',
    waitingForDevice: '等待设备连接...',
    noControllerDetected: '未检测到手柄',
    connectInstructions: '通过USB或蓝牙连接手柄',
    pressButtonHint: '👆 现在按住手柄上的任意按键！',
    pressButtonHintSub: '浏览器只有在检测到按键后才会识别手柄。',
    clickToActivate: '我已按下按键',
    troubleshootTitle: '还是无法识别？',
    troubleshootStep1: '1. 检查系统是否识别手柄（Windows: 设置 → 设备）',
    troubleshootStep2: '2. 尝试更换USB接口或数据线',
    troubleshootStep3: '3. 某些手柄需要切换到 XInput 模式（按住特定组合键）',
    troubleshootStep4: '4. 尝试连接后刷新页面',
    iframeNotice: '在内嵌预览里手柄检测可能被浏览器禁用，请在新标签页打开后再测试。',
    openInNewTab: '在新标签页打开',
    gamepadNotSupportedTitle: '当前环境不支持手柄检测',
    gamepadNotSupportedDesc: '当前浏览器/环境不支持 Web Gamepad API。请使用 Chrome/Edge，并尽量不要在微信/QQ等内置浏览器中打开。',
    copyDebug: '复制调试信息',
    copied: '已复制',
    debugTitle: '调试信息',
    debugDesc: '如果仍不识别，请复制这段信息发给我。',
    usbWired: 'USB有线',
    bluetooth: '蓝牙',
    vibration: '振动',
    gyro: '陀螺仪',
    buttons: '按键',
    axes: '轴向',
    index: '索引',
    standard: '标准',
    multipleControllersDetected: '检测到多个手柄:',
    controller: '手柄',
    
    // Controller Types
    xboxController: 'Xbox 手柄',
    xboxEliteController: 'Xbox Elite 精英手柄',
    dualSenseController: 'DualSense 手柄',
    dualShock4Controller: 'DualShock 4 手柄',
    switchProController: 'Switch Pro 手柄',
    genericGamepad: '通用手柄',
    xbox: 'Xbox',
    playstation: 'PlayStation',
    switch: 'Switch',
    generic: '通用',
    
    // Testing Tabs
    buttonsTab: '按键测试',
    joysticksTab: '摇杆测试',
    vibrationTab: '振动测试',
    latencyTab: '延迟测试',
    deadzoneTab: '死区测试',
    rankingsTab: '排行榜',
    
    // Button Tester
    buttonTest: '按键测试',
    connectToTestButtons: '请连接手柄以测试按键',
    pressed: '已按下',
    recentInputs: '最近输入',
    pressAnyButton: '按任意按键...',
    
    // Joystick Tester
    joystickTest: '摇杆测试',
    connectToTestJoysticks: '请连接手柄以测试摇杆',
    leftStick: '左摇杆',
    rightStick: '右摇杆',
    leftDrift: '左侧漂移',
    rightDrift: '右侧漂移',
    leftMagnitude: '左摇杆幅度',
    rightMagnitude: '右摇杆幅度',
    
    // Vibration Tester
    vibrationTest: '振动测试',
    connectToTestVibration: '请连接手柄以测试振动',
    notSupported: '不支持',
    intensity: '强度',
    weak: '弱',
    medium: '中',
    strong: '强',
    duration: '时长',
    testVibration: '测试振动',
    vibrating: '振动中...',
    didYouFeel: '是否感受到振动？',
    yes: '是',
    no: '否',
    vibrationPatterns: '振动模式',
    patternHeartbeat: '心跳',
    patternEngine: '引擎',
    patternRoadBump: '减速带',
    patternRumbleStrip: '路肩',
    patternExplosion: '爆炸',
    patternRainDrop: '雨滴',
    patternGunshot: '枪击',
    patternNotification: '提醒',
    patternDrifting: '漂移',
    patternLowHealth: '低血量',
    patternPowerUp: '升级',
    patternEarthquake: '地震',
    patternWind: '风声',
    patternMusic: '节奏',
    patternCustom: '自定义',
    loopCount: '循环次数',
    
    // Latency Tester
    latencyTest: '输入延迟',
    connectToTest: '请连接手柄以测试',
    sampleRate: '采样率',
    latencyInstructions: '点击开始测试后，看到提示立刻按下任意按键！',
    latencyDescription: '测量手柄输入的轮询间隔。持续移动摇杆或按按键以获得准确读数。',
    latencyInstructions2: '点击开始，然后移动摇杆或按按键',
    samples: '采样数',
    pressNow: '立即按下',
    pressAnyButtonQuick: '以最快速度按下任意按键！',
    waitForPrompt: '等待提示',
    test: '测试',
    avgLatency: '平均',
    minLatency: '最低',
    maxLatency: '最高',
    pollRate: '轮询频率',
    jitter: '抖动',
    stalls: '卡顿',
    stability: '稳定性',
    startLatencyTest: '开始测试',
    stopTest: '停止',
    cancel: '取消',
    
    // Gyroscope Tester
    gyroTest: '陀螺仪测试',
    gyroTab: '陀螺仪',
    calibrate: '校准',
    gyroNotDetected: '未检测到陀螺仪，使用摇杆模拟。',
    gyroActive: '陀螺仪已激活',
    gyroSimulated: '摇杆模拟',
    rotation: '旋转',
    acceleration: '加速度',
    
    // Connection Stability Tester
    stabilityTest: '稳定性测试',
    stabilityTab: '稳定性',
    stabilityDescription: '测试按键长按稳定性。按住按钮以检测断连情况。',
    targetDuration: '目标时长',
    testing: '正在测试',
    disconnects: '断连',
    testResults: '测试结果',
    patterns: '种模式',
    
    // Deadzone Tester
    deadzoneTest: '死区测试',
    deadzoneInstructions: '将摇杆保持在中心位置不动。红色方框显示检测到的漂移范围。',
    customDeadzone: '自定义死区',
    driftRange: '漂移',
    suggested: '建议值',
    
    // Rankings
    controllerRankings: '手柄排行榜',
    tierRanking: '天梯排名',
    recentTests: '最近测试',
    noTestRecords: '暂无测试记录',
    beTheFirst: '成为第一个提交测试的人！',
    score: '分数',
    tested: '测试时间',
    tests: '次测试',
    avgScore: '平均分',
    bestScore: '最高分',
    
    // Save Test
    saveTest: '保存测试',
    testSaved: '已保存！',
    saving: '保存中...',
    saveTestResult: '保存测试结果',
    testSavedSuccess: '您的测试已被记录到排行榜',
    
    // Compatibility
    compatibility: '兼容性',
    supportedBrowsers: '支持的浏览器',
    supportedControllers: '支持的手柄',
    note: '注意',
    compatibilityNote: '本工具使用 Web Gamepad API。为获得最佳效果，请使用基于 Chromium 的浏览器并通过 USB 连接手柄。',
    
    // Footer
    footerTitle: 'Gamepad Tests Pro — 全平台专业手柄诊断工具',
    footerSubtitle: '基于 Web Gamepad API 构建 • 无需插件',
    
    // Coming Soon
    industrialGradeTesting: '工业级测试',
    comingSoon: '即将推出',
    comingSoonDesc: '高级延迟测量、死区分析和连接稳定性测试将在后续更新中提供。',
    
    // Language
    language: '语言',
    english: 'English',
    chinese: '中文',
  },
};

export const useTranslation = (lang: Language) => {
  const t = (key: keyof typeof translations.en, params?: Record<string, string | number>): string => {
    let text = translations[lang][key] || translations.en[key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(`{${paramKey}}`, String(value));
      });
    }
    
    return text;
  };
  
  return { t };
};

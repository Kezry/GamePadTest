import { useState, useEffect, useRef, useCallback } from 'react';
import { GamepadState, GamepadInfo } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RotateCcw, Square, AlertTriangle, Check, Infinity as InfinityIcon, ChevronDown, ChevronUp } from 'lucide-react';

interface ConnectionStabilityTesterProps {
  gamepad: GamepadState | null;
  gamepadInfo: GamepadInfo | null;
  sampleRate: number;
}

interface ButtonTestState {
  buttonIndex: number;
  buttonName: string;
  startTime: number;
  currentHoldTime: number;
  disconnectCount: number;
  wasHeld: boolean;
}

interface ButtonTestResult {
  buttonIndex: number;
  buttonName: string;
  holdDuration: number;
  disconnectCount: number;
  maxHoldTime: number;
  status: 'passed' | 'failed';
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ConnectionStabilityTester = ({ gamepad, gamepadInfo, sampleRate }: ConnectionStabilityTesterProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [isTesting, setIsTesting] = useState(false);
  const [activeButtons, setActiveButtons] = useState<Map<number, ButtonTestState>>(new Map());
  const [testResults, setTestResults] = useState<ButtonTestResult[]>([]);
  const [targetDuration, setTargetDuration] = useState(5);
  const [isInfiniteMode, setIsInfiniteMode] = useState(false);
  const [waitingForPress, setWaitingForPress] = useState(false);
  const [showCompletedResults, setShowCompletedResults] = useState(true);
  const [connectionLost, setConnectionLost] = useState(false);

  const lastUpdateRef = useRef<number>(0);
  const activeButtonsRef = useRef<Map<number, ButtonTestState>>(new Map());
  const lastUIUpdateRef = useRef<number>(0);

  const getButtonName = useCallback((index: number) => {
    const psNames = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS', 'Touch'];
    const xboxNames = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', '↑', '↓', '←', '→', 'Xbox'];
    const names = gamepadInfo?.type === 'playstation' ? psNames : xboxNames;
    return names[index] || `B${index}`;
  }, [gamepadInfo?.type]);

  const startWaitingForButton = useCallback(() => {
    setWaitingForPress(true);
    setActiveButtons(new Map());
    activeButtonsRef.current = new Map();
  }, []);

  const stopTest = useCallback(() => {
    activeButtonsRef.current.forEach((state, buttonIndex) => {
      if (state.currentHoldTime > 0) {
        const result: ButtonTestResult = {
          buttonIndex,
          buttonName: state.buttonName,
          holdDuration: state.currentHoldTime,
          disconnectCount: state.disconnectCount,
          maxHoldTime: isInfiniteMode ? Infinity : targetDuration,
          status: state.disconnectCount === 0 ? 'passed' : 'failed',
        };
        setTestResults(prev => [...prev.filter(r => r.buttonIndex !== buttonIndex), result]);
      }
    });

    setIsTesting(false);
    setWaitingForPress(false);
    setActiveButtons(new Map());
    activeButtonsRef.current = new Map();
  }, [targetDuration, isInfiniteMode]);

  const resetAll = useCallback(() => {
    setIsTesting(false);
    setWaitingForPress(false);
    setActiveButtons(new Map());
    activeButtonsRef.current = new Map();
    setTestResults([]);
  }, []);

  // Monitor real connection loss via gamepaddisconnected event
  useEffect(() => {
    const handleDisconnect = (e: GamepadEvent) => {
      if (isTesting && gamepad && e.gamepad.index === gamepad.index) {
        setConnectionLost(true);
        // Record disconnection as a "disconnect" for all active buttons
        const currentMap = new Map(activeButtonsRef.current);
        currentMap.forEach((state, buttonIndex) => {
          currentMap.set(buttonIndex, {
            ...state,
            disconnectCount: state.disconnectCount + 1,
            wasHeld: false,
          });
        });
        activeButtonsRef.current = currentMap;
        setActiveButtons(new Map(currentMap));
      }
    };

    const handleReconnect = (e: GamepadEvent) => {
      if (gamepad && e.gamepad.index === gamepad.index) {
        setConnectionLost(false);
      }
    };

    window.addEventListener('gamepaddisconnected', handleDisconnect);
    window.addEventListener('gamepadconnected', handleReconnect);
    return () => {
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      window.removeEventListener('gamepadconnected', handleReconnect);
    };
  }, [isTesting, gamepad]);

  // Monitor button press states during testing
  useEffect(() => {
    if (!gamepad || !isTesting) return;

    let animationId: number;
    const interval = 1000 / sampleRate;

    const checkButtons = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= interval) {
        lastUpdateRef.current = timestamp;
        const now = performance.now();

        const currentMap = new Map(activeButtonsRef.current);
        let hasStructuralChange = false;

        for (let i = 0; i < gamepad.buttons.length; i++) {
          const isPressed = gamepad.buttons[i]?.pressed;
          const existingState = currentMap.get(i);

          if (isPressed) {
            if (!existingState) {
              currentMap.set(i, {
                buttonIndex: i,
                buttonName: getButtonName(i),
                startTime: now,
                currentHoldTime: 0,
                disconnectCount: 0,
                wasHeld: true,
              });
              hasStructuralChange = true;
            } else if (!existingState.wasHeld) {
              currentMap.set(i, {
                ...existingState,
                disconnectCount: existingState.disconnectCount + 1,
                wasHeld: true,
              });
              hasStructuralChange = true;
            } else {
              const elapsed = (now - existingState.startTime) / 1000;
              currentMap.set(i, {
                ...existingState,
                currentHoldTime: elapsed,
              });

              // Auto-complete in finite mode when target reached with no disconnects
              if (!isInfiniteMode && elapsed >= targetDuration && existingState.disconnectCount === 0) {
                const result: ButtonTestResult = {
                  buttonIndex: i,
                  buttonName: existingState.buttonName,
                  holdDuration: elapsed,
                  disconnectCount: 0,
                  maxHoldTime: targetDuration,
                  status: 'passed',
                };
                setTestResults(prev => [...prev.filter(r => r.buttonIndex !== i), result]);
                currentMap.delete(i);
                hasStructuralChange = true;
              }
            }
          } else if (existingState?.wasHeld) {
            currentMap.set(i, {
              ...existingState,
              wasHeld: false,
            });
            hasStructuralChange = true;
          }
        }

        activeButtonsRef.current = currentMap;

        // Update UI on structural changes or every 250ms for hold time display
        if (hasStructuralChange || now - lastUIUpdateRef.current >= 250) {
          lastUIUpdateRef.current = now;
          setActiveButtons(new Map(currentMap));
        }
      }

      animationId = requestAnimationFrame(checkButtons);
    };

    animationId = requestAnimationFrame(checkButtons);
    return () => cancelAnimationFrame(animationId);
  }, [gamepad, isTesting, sampleRate, targetDuration, isInfiniteMode, getButtonName]);

  // Detect initial button presses to start the test
  useEffect(() => {
    if (!gamepad || !waitingForPress) return;

    for (let i = 0; i < gamepad.buttons.length; i++) {
      if (gamepad.buttons[i]?.pressed) {
        const initialMap = new Map<number, ButtonTestState>();
        initialMap.set(i, {
          buttonIndex: i,
          buttonName: getButtonName(i),
          startTime: performance.now(),
          currentHoldTime: 0,
          disconnectCount: 0,
          wasHeld: true,
        });
        activeButtonsRef.current = initialMap;
        setActiveButtons(initialMap);
        setWaitingForPress(false);
        setIsTesting(true);
        break;
      }
    }
  }, [gamepad, waitingForPress, getButtonName]);

  if (!gamepad) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {t('stabilityTest')}
        </h3>
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          {t('connectToTest')}
        </div>
      </div>
    );
  }

  const activeButtonsArray = Array.from(activeButtons.values());

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          {t('stabilityTest')}
        </h3>
        <button
          onClick={resetAll}
          className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground mb-6">
        <p className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning" />
          {language === 'zh'
            ? '支持同时测试多个按键。按住按键检测是否会断连，可同时按多个按键进行测试。'
            : 'Test multiple buttons simultaneously. Hold buttons to detect disconnections.'}
        </p>
      </div>

      {/* Target Duration + Infinite Toggle */}
      <div className="mb-6">
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-muted-foreground">{t('targetDuration')}</span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-primary">
              {isInfiniteMode ? '∞' : `${targetDuration}s`}
            </span>
            <button
              onClick={() => setIsInfiniteMode(!isInfiniteMode)}
              disabled={isTesting || waitingForPress}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                isInfiniteMode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                (isTesting || waitingForPress) && "opacity-50 cursor-not-allowed"
              )}
            >
              <InfinityIcon className="w-3.5 h-3.5" />
              {language === 'zh' ? '无限' : 'Infinite'}
            </button>
          </div>
        </div>
        <input
          type="range"
          min={3}
          max={300}
          value={targetDuration}
          onChange={(e) => setTargetDuration(Number(e.target.value))}
          disabled={isTesting || waitingForPress || isInfiniteMode}
          className={cn(
            "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full",
            (isTesting || waitingForPress || isInfiniteMode) && "opacity-50 cursor-not-allowed"
          )}
        />
        {!isInfiniteMode && (
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>3s</span>
            <span>30s</span>
            <span>60s</span>
            <span>300s</span>
          </div>
        )}
      </div>

      {/* Waiting for button press */}
      {waitingForPress && (
        <div className="mb-6 bg-warning/10 border border-warning/30 rounded-xl p-6 text-center">
          <div className="text-lg font-medium text-warning mb-2">
            {t('pressAnyButton')}
          </div>
          <div className="text-sm text-muted-foreground">
            {language === 'zh' ? '按住任意按键开始稳定性测试（支持多按键）' : 'Hold any button to start (multi-button supported)'}
          </div>
          <button
            onClick={() => setWaitingForPress(false)}
            className="mt-4 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-all"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {/* Connection Lost Warning */}
      {isTesting && connectionLost && (
        <div className="mb-6 bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
          <div className="text-sm font-medium text-destructive">
            {language === 'zh' ? '⚠ 检测到控制器断开连接!' : '⚠ Controller disconnected!'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {language === 'zh' ? '已记录为断连事件，等待重连...' : 'Recorded as disconnect event, waiting for reconnect...'}
          </div>
        </div>
      )}

      {/* Active Buttons Progress */}
      {isTesting && activeButtonsArray.length > 0 && (
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-3">
            {language === 'zh' ? `正在测试 ${activeButtonsArray.length} 个按键` : `Testing ${activeButtonsArray.length} button(s)`}
          </div>
          <div className={cn(
            "grid gap-3",
            activeButtonsArray.length === 1 && "grid-cols-1",
            activeButtonsArray.length === 2 && "grid-cols-2",
            activeButtonsArray.length >= 3 && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
          )}>
            {activeButtonsArray.map((state) => (
              <div
                key={state.buttonIndex}
                className={cn(
                  "border rounded-xl p-3 transition-all",
                  state.disconnectCount > 0
                    ? "bg-destructive/10 border-destructive/50 animate-[flash_1s_ease-in-out_2]"
                    : "bg-primary/10 border-primary/30 animate-[breathe_2s_ease-in-out_infinite]"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-primary">{state.buttonName}</span>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold">
                      {formatDuration(state.currentHoldTime)}
                    </div>
                    {!isInfiniteMode && (
                      <div className="text-xs text-muted-foreground">
                        / {targetDuration}s
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar - finite mode: target progress, infinite mode: pulse indicator */}
                {isInfiniteMode ? (
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        state.disconnectCount > 0 ? "bg-destructive" : "bg-gradient-to-r from-primary/60 to-primary animate-pulse"
                      )}
                      style={{ width: `${Math.min(100, (state.currentHoldTime / 60) * 100)}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={cn(
                        "h-full transition-all",
                        state.disconnectCount > 0 ? "bg-destructive" : "bg-gradient-to-r from-primary to-primary/70"
                      )}
                      style={{ width: `${Math.min(100, (state.currentHoldTime / targetDuration) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Disconnect counter */}
                <div className={cn(
                  "text-center py-0.5 rounded text-xs font-mono",
                  state.disconnectCount > 0 ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
                )}>
                  {t('disconnects')}: {state.disconnectCount}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={stopTest}
            className="w-full py-3 mt-4 bg-destructive/20 text-destructive rounded-lg font-medium hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center justify-center gap-2"
          >
            <Square className="w-4 h-4" />
            {t('stopTest')}
          </button>
        </div>
      )}

      {/* Start Test Button */}
      {!isTesting && !waitingForPress && (
        <button
          onClick={startWaitingForButton}
          className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all mb-6"
        >
          {language === 'zh' ? '开始测试 - 支持多按键同时按' : 'Start Test - Multi-button Supported'}
        </button>
      )}

      {/* Completed Results During Testing (collapsible) */}
      {isTesting && testResults.length > 0 && (
        <div className="mb-6 border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCompletedResults(!showCompletedResults)}
            className="w-full flex items-center justify-between p-3 bg-muted/30 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-all"
          >
            <span>
              {language === 'zh' ? `已完成 ${testResults.length} 项` : `${testResults.length} completed`}
            </span>
            {showCompletedResults ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showCompletedResults && (
            <div className="p-3 space-y-2">
              {testResults.map((result, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-sm",
                    result.status === 'passed' ? "bg-success/10" : "bg-destructive/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {result.status === 'passed' ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="font-mono font-bold">{result.buttonName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-mono">{formatDuration(result.holdDuration)}</span>
                    <span className={cn(
                      "font-mono",
                      result.disconnectCount > 0 ? "text-destructive" : "text-success"
                    )}>
                      {result.disconnectCount} {t('disconnects')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test Results Summary (after test stops) */}
      {testResults.length > 0 && !isTesting && !waitingForPress && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">{t('testResults')}</h4>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-success flex items-center gap-1">
                <Check className="w-3 h-3" />
                {testResults.filter(r => r.status === 'passed').length} {language === 'zh' ? '通过' : 'Passed'}
              </span>
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {testResults.filter(r => r.status === 'failed').length} {language === 'zh' ? '失败' : 'Failed'}
              </span>
            </div>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {testResults.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg text-sm",
                  result.status === 'passed' ? "bg-success/10 border border-success/30" : "bg-destructive/10 border border-destructive/30"
                )}
              >
                <div className="flex items-center gap-3">
                  {result.status === 'passed' ? (
                    <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-success" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                  )}
                  <div>
                    <span className="font-mono text-lg font-bold">{result.buttonName}</span>
                    <span className={cn(
                      "ml-2 text-xs px-1.5 py-0.5 rounded",
                      result.status === 'passed' ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                    )}>
                      {result.status === 'passed' ? (language === 'zh' ? '通过' : 'PASSED') : (language === 'zh' ? '失败' : 'FAILED')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <div className="text-muted-foreground text-xs">{language === 'zh' ? '持续时长' : 'Duration'}</div>
                    <div className={cn(
                      "font-mono font-medium",
                      result.status === 'passed' ? "text-success" : "text-foreground"
                    )}>{formatDuration(result.holdDuration)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground text-xs">{language === 'zh' ? '断开次数' : 'Disconnects'}</div>
                    <div className={cn(
                      "font-mono font-medium",
                      result.disconnectCount > 0 ? "text-destructive" : "text-success"
                    )}>
                      {result.disconnectCount}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Summary */}
          {testResults.length > 0 && (
            <div className={cn(
              "mt-4 p-4 rounded-lg border",
              testResults.every(r => r.status === 'passed')
                ? "bg-success/10 border-success/30"
                : testResults.some(r => r.status === 'passed')
                  ? "bg-warning/10 border-warning/30"
                  : "bg-destructive/10 border-destructive/30"
            )}>
              <div className="flex items-center gap-2">
                {testResults.every(r => r.status === 'passed') ? (
                  <Check className="w-5 h-5 text-success" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning" />
                )}
                <span className="font-medium">
                  {testResults.every(r => r.status === 'passed')
                    ? (language === 'zh' ? '所有按键测试通过！连接稳定' : 'All buttons passed! Connection stable')
                    : (language === 'zh' ? '部分按键存在问题，请检查连接' : 'Some buttons have issues, check connection')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

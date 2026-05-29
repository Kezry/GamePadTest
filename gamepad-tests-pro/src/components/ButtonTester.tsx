import { useEffect, useState, useRef } from 'react';
import { GamepadState, GamepadInfo } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ButtonTesterProps {
  gamepad: GamepadState | null;
  gamepadInfo: GamepadInfo | null;
  sampleRate?: number;
  onButtonsUpdate?: (tested: number, passed: number) => void;
}

interface ButtonLayout {
  name: string;
  index: number;
  x: number;
  y: number;
  size?: 'small' | 'normal' | 'large';
  shape?: 'circle' | 'pill' | 'dpad';
  color?: string;
}

// Standard Gamepad mapping: https://w3c.github.io/gamepad/#remapping
// Index 12: D-pad Up, 13: D-pad Down, 14: D-pad Left, 15: D-pad Right
const xboxLayout: ButtonLayout[] = [
  { name: 'A', index: 0, x: 78, y: 52, color: 'text-success' },
  { name: 'B', index: 1, x: 85, y: 42, color: 'text-destructive' },
  { name: 'X', index: 2, x: 71, y: 42, color: 'text-primary' },
  { name: 'Y', index: 3, x: 78, y: 32, color: 'text-warning' },
  { name: 'LB', index: 4, x: 20, y: 12, shape: 'pill' },
  { name: 'RB', index: 5, x: 80, y: 12, shape: 'pill' },
  { name: 'LT', index: 6, x: 20, y: 3, shape: 'pill', size: 'large' },
  { name: 'RT', index: 7, x: 80, y: 3, shape: 'pill', size: 'large' },
  { name: 'Back', index: 8, x: 42, y: 40, size: 'small' },
  { name: 'Start', index: 9, x: 58, y: 40, size: 'small' },
  { name: 'LS', index: 10, x: 30, y: 50 },
  { name: 'RS', index: 11, x: 62, y: 65 },
  { name: '↑', index: 12, x: 15, y: 55, shape: 'dpad' },
  { name: '↓', index: 13, x: 15, y: 70, shape: 'dpad' },
  { name: '←', index: 14, x: 8, y: 62, shape: 'dpad' },
  { name: '→', index: 15, x: 22, y: 62, shape: 'dpad' },
  { name: 'Xbox', index: 16, x: 50, y: 30, size: 'large' },
];

const playstationLayout: ButtonLayout[] = [
  { name: '✕', index: 0, x: 78, y: 55, color: 'text-primary' },
  { name: '○', index: 1, x: 85, y: 45, color: 'text-destructive' },
  { name: '□', index: 2, x: 71, y: 45, color: 'text-pink-400' },
  { name: '△', index: 3, x: 78, y: 35, color: 'text-success' },
  { name: 'L1', index: 4, x: 20, y: 12, shape: 'pill' },
  { name: 'R1', index: 5, x: 80, y: 12, shape: 'pill' },
  { name: 'L2', index: 6, x: 20, y: 3, shape: 'pill', size: 'large' },
  { name: 'R2', index: 7, x: 80, y: 3, shape: 'pill', size: 'large' },
  { name: 'Share', index: 8, x: 40, y: 40, size: 'small' },
  { name: 'Options', index: 9, x: 60, y: 40, size: 'small' },
  { name: 'L3', index: 10, x: 35, y: 65 },
  { name: 'R3', index: 11, x: 65, y: 65 },
  { name: '↑', index: 12, x: 15, y: 40, shape: 'dpad' },
  { name: '↓', index: 13, x: 15, y: 55, shape: 'dpad' },
  { name: '←', index: 14, x: 8, y: 47, shape: 'dpad' },
  { name: '→', index: 15, x: 22, y: 47, shape: 'dpad' },
  { name: 'PS', index: 16, x: 50, y: 72, size: 'large' },
  { name: 'Touch', index: 17, x: 50, y: 28, size: 'large' },
];

export const ButtonTester = ({ gamepad, gamepadInfo, sampleRate = 60, onButtonsUpdate }: ButtonTesterProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [pressHistory, setPressHistory] = useState<{ name: string; timestamp: number; index: number }[]>([]);
  const [testedButtons, setTestedButtons] = useState<Set<number>>(new Set());
  const [triggerValues, setTriggerValues] = useState({ lt: 0, rt: 0 });
  
  // Track which buttons were pressed in last frame
  const prevButtonStates = useRef<boolean[]>([]);
  const lastUpdateRef = useRef<number>(0);
  
  // 3D rotation based on gyroscope simulation from joystick
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = gamepadInfo?.type === 'playstation' ? playstationLayout : xboxLayout;

  // Synced animation loop with sample rate
  useEffect(() => {
    if (!gamepad) return;
    
    let animationId: number;
    const interval = 1000 / sampleRate;
    
    const update = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= interval) {
        lastUpdateRef.current = timestamp;
        
        const rx = gamepad.axes[2] || 0;
        const ry = gamepad.axes[3] || 0;
        const lx = gamepad.axes[0] || 0;
        
        setRotation({
          x: ry * 25,
          y: rx * 25,
          z: lx * 15,
        });
        
        // Update trigger values synced to sample rate
        setTriggerValues({
          lt: gamepad.buttons[6]?.value || 0,
          rt: gamepad.buttons[7]?.value || 0,
        });
      }
      
      animationId = requestAnimationFrame(update);
    };
    
    animationId = requestAnimationFrame(update);
    
    return () => cancelAnimationFrame(animationId);
  }, [gamepad, sampleRate]);

  // Detect new button presses
  useEffect(() => {
    if (!gamepad) return;

    const currentStates = gamepad.buttons.map(b => b.pressed);
    
    gamepad.buttons.forEach((button, index) => {
      const wasPressed = prevButtonStates.current[index] || false;
      const isPressed = button.pressed;
      
      // Only trigger on new press (wasn't pressed before, now is pressed)
      if (isPressed && !wasPressed) {
        const buttonInfo = layout.find(b => b.index === index);
        if (buttonInfo) {
          setPressHistory(prev => [
            { name: buttonInfo.name, timestamp: Date.now(), index },
            ...prev.slice(0, 29) // Keep 30 entries max
          ]);
          setTestedButtons(prev => new Set([...prev, index]));
        }
      }
    });

    prevButtonStates.current = currentStates;
  }, [gamepad, layout]);

  useEffect(() => {
    if (onButtonsUpdate && gamepad) {
      onButtonsUpdate(testedButtons.size, testedButtons.size);
    }
  }, [testedButtons, onButtonsUpdate, gamepad]);

  if (!gamepad) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {t('buttonTest')}
        </h3>
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          {t('connectToTestButtons')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          {t('buttonTest')}
        </h3>
        <div className="text-sm text-muted-foreground font-mono">
          {gamepad.buttons.filter(b => b.pressed).length} {t('pressed')}
        </div>
      </div>

      {/* 3D Gamepad Visualization */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-[2/1] mb-6 perspective-1000"
        style={{ perspective: '1000px' }}
      >
        <div 
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Gamepad Body */}
          <div className="absolute inset-4 rounded-[40%] bg-gradient-to-b from-muted/60 to-muted/90 border-2 border-border shadow-2xl">
            {/* Inner glow */}
            <div className="absolute inset-2 rounded-[38%] bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
            
            {/* Grip shadows */}
            <div className="absolute left-0 top-1/4 w-1/4 h-1/2 bg-gradient-to-r from-black/20 to-transparent rounded-l-[40%]" />
            <div className="absolute right-0 top-1/4 w-1/4 h-1/2 bg-gradient-to-l from-black/20 to-transparent rounded-r-[40%]" />
          </div>

          {/* Left Joystick Visual */}
          <div
            className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-muted to-muted/80 border-2 border-border/50 shadow-lg flex items-center justify-center"
            style={{
              left: '30%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div 
              className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 shadow-inner"
              style={{
                transform: `translate(${(gamepad.axes[0] || 0) * 8}px, ${(gamepad.axes[1] || 0) * 8}px)`,
              }}
            >
              <div className="absolute inset-2 rounded-full bg-muted/50" />
            </div>
          </div>

          {/* Right Joystick Visual */}
          <div
            className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-muted to-muted/80 border-2 border-border/50 shadow-lg flex items-center justify-center"
            style={{
              left: '62%',
              top: '65%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div 
              className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 shadow-inner"
              style={{
                transform: `translate(${(gamepad.axes[2] || 0) * 8}px, ${(gamepad.axes[3] || 0) * 8}px)`,
              }}
            >
              <div className="absolute inset-2 rounded-full bg-muted/50" />
            </div>
          </div>

          {/* Buttons */}
          {layout.map((button) => {
            const isPressed = gamepad.buttons[button.index]?.pressed;
            const value = gamepad.buttons[button.index]?.value || 0;
            const isTested = testedButtons.has(button.index);
            
            return (
              <div
                key={button.index}
                className={cn(
                  "absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-[50ms]",
                  button.shape === 'pill' 
                    ? "px-4 py-2 rounded-full" 
                    : button.shape === 'dpad'
                      ? "w-7 h-7 rounded-md"
                      : button.size === 'small'
                        ? "w-7 h-7 rounded-full"
                        : button.size === 'large'
                          ? "w-12 h-12 rounded-full"
                          : "w-10 h-10 rounded-full",
                  isPressed 
                    ? "bg-primary text-primary-foreground scale-90 shadow-[0_0_20px_rgba(var(--primary-rgb),0.6)]" 
                    : isTested
                      ? "bg-success/30 border-2 border-success text-success shadow-md"
                      : "bg-muted/80 border-2 border-border/50 text-foreground hover:bg-muted shadow-md",
                  button.color && !isPressed && !isTested && button.color
                )}
                style={{ 
                  left: `${button.x}%`, 
                  top: `${button.y}%`,
                  opacity: value > 0 && value < 1 ? 0.5 + value * 0.5 : undefined,
                  transform: `translate(-50%, -50%) ${isPressed ? 'scale(0.9) translateZ(-4px)' : 'translateZ(4px)'}`,
                }}
              >
                <span className={cn(
                  "font-bold",
                  button.size === 'small' ? "text-[10px]" : "text-sm"
                )}>
                  {button.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trigger Bars - synced to sample rate */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">LT / L2</span>
            <span className="font-mono text-primary">
              {(triggerValues.lt * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 shadow-md"
              style={{ width: `${triggerValues.lt * 100}%` }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">RT / R2</span>
            <span className="font-mono text-primary">
              {(triggerValues.rt * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 shadow-md"
              style={{ width: `${triggerValues.rt * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recent Inputs - Scrollable with fixed height */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t('recentInputs')}</h4>
          {pressHistory.length > 0 && (
            <button 
              onClick={() => setPressHistory([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              清除
            </button>
          )}
        </div>
        <div className="h-16 overflow-y-auto border border-border/50 rounded-lg p-2 bg-muted/20">
          <div className="flex flex-wrap gap-1.5">
            {pressHistory.length === 0 ? (
              <span className="text-sm text-muted-foreground/50">{t('pressAnyButton')}</span>
            ) : (
              pressHistory.map((press, idx) => (
                <span 
                  key={`${press.timestamp}-${press.index}-${idx}`}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-mono inline-block",
                    idx === 0 
                      ? "bg-primary text-primary-foreground animate-fade-in" 
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {press.name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
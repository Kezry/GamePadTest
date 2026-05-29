import { useEffect, useRef, useState, useCallback } from 'react';
import { GamepadState } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RotateCcw, TrendingUp, Target } from 'lucide-react';

interface JoystickTesterProps {
  gamepad: GamepadState | null;
  sampleRate?: number;
  onDriftUpdate?: (left: number, right: number) => void;
}

interface JoystickData {
  x: number;
  y: number;
  magnitude: number;
  angle: number;
  // Advanced data
  rawX: number;
  rawY: number;
  velocity: number;
  acceleration: number;
  distanceFromCenter: number;
  quadrant: number;
}

interface JoystickHistory {
  positions: { x: number; y: number; timestamp: number }[];
  maxMagnitude: number;
  totalDistance: number;
  avgVelocity: number;
  directionChanges: number;
}

const DEADZONE = 0.05;

export const JoystickTester = ({ gamepad, sampleRate = 60, onDriftUpdate }: JoystickTesterProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [leftStick, setLeftStick] = useState<JoystickData>({ 
    x: 0, y: 0, magnitude: 0, angle: 0, rawX: 0, rawY: 0, velocity: 0, acceleration: 0, distanceFromCenter: 0, quadrant: 0 
  });
  const [rightStick, setRightStick] = useState<JoystickData>({ 
    x: 0, y: 0, magnitude: 0, angle: 0, rawX: 0, rawY: 0, velocity: 0, acceleration: 0, distanceFromCenter: 0, quadrant: 0 
  });
  const [driftWarning, setDriftWarning] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const [leftHistory, setLeftHistory] = useState<JoystickHistory>({ positions: [], maxMagnitude: 0, totalDistance: 0, avgVelocity: 0, directionChanges: 0 });
  const [rightHistory, setRightHistory] = useState<JoystickHistory>({ positions: [], maxMagnitude: 0, totalDistance: 0, avgVelocity: 0, directionChanges: 0 });
  const [showAdvanced, setShowAdvanced] = useState(true);
  
  const lastUpdateRef = useRef<number>(0);
  const lastPositionRef = useRef<{ left: { x: number; y: number }; right: { x: number; y: number } }>({ 
    left: { x: 0, y: 0 }, right: { x: 0, y: 0 } 
  });
  const lastVelocityRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  const calculateStickData = (x: number, y: number, prevX: number, prevY: number, prevVelocity: number): JoystickData => {
    const magnitude = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x) * (180 / Math.PI);
    const distance = Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2));
    const velocity = distance * sampleRate;
    const acceleration = (velocity - prevVelocity) * sampleRate;
    const quadrant = x >= 0 ? (y >= 0 ? 1 : 4) : (y >= 0 ? 2 : 3);
    
    return {
      x: Math.abs(x) < DEADZONE ? 0 : x,
      y: Math.abs(y) < DEADZONE ? 0 : y,
      rawX: x,
      rawY: y,
      magnitude: Math.min(magnitude, 1),
      angle: magnitude > DEADZONE ? angle : 0,
      velocity,
      acceleration,
      distanceFromCenter: magnitude,
      quadrant,
    };
  };

  const reset = useCallback(() => {
    setLeftHistory({ positions: [], maxMagnitude: 0, totalDistance: 0, avgVelocity: 0, directionChanges: 0 });
    setRightHistory({ positions: [], maxMagnitude: 0, totalDistance: 0, avgVelocity: 0, directionChanges: 0 });
    lastPositionRef.current = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    lastVelocityRef.current = { left: 0, right: 0 };
  }, []);

  // Use RAF loop synced to sample rate for smooth updates
  useEffect(() => {
    if (!gamepad) return;

    let animationId: number;
    const interval = 1000 / sampleRate;

    const update = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= interval) {
        lastUpdateRef.current = timestamp;
        const now = Date.now();
        
        const lx = gamepad.axes[0] || 0;
        const ly = gamepad.axes[1] || 0;
        const rx = gamepad.axes[2] || 0;
        const ry = gamepad.axes[3] || 0;
        
        const newLeft = calculateStickData(lx, ly, lastPositionRef.current.left.x, lastPositionRef.current.left.y, lastVelocityRef.current.left);
        const newRight = calculateStickData(rx, ry, lastPositionRef.current.right.x, lastPositionRef.current.right.y, lastVelocityRef.current.right);
        
        setLeftStick(newLeft);
        setRightStick(newRight);
        
        // Update history
        setLeftHistory(prev => {
          const positions = [...prev.positions.slice(-200), { x: lx, y: ly, timestamp: now }];
          const distance = Math.sqrt(Math.pow(lx - lastPositionRef.current.left.x, 2) + Math.pow(ly - lastPositionRef.current.left.y, 2));
          return {
            positions,
            maxMagnitude: Math.max(prev.maxMagnitude, newLeft.magnitude),
            totalDistance: prev.totalDistance + distance,
            avgVelocity: (prev.avgVelocity * prev.positions.length + newLeft.velocity) / (prev.positions.length + 1),
            directionChanges: prev.directionChanges + (newLeft.quadrant !== leftStick.quadrant ? 1 : 0),
          };
        });
        
        setRightHistory(prev => {
          const positions = [...prev.positions.slice(-200), { x: rx, y: ry, timestamp: now }];
          const distance = Math.sqrt(Math.pow(rx - lastPositionRef.current.right.x, 2) + Math.pow(ry - lastPositionRef.current.right.y, 2));
          return {
            positions,
            maxMagnitude: Math.max(prev.maxMagnitude, newRight.magnitude),
            totalDistance: prev.totalDistance + distance,
            avgVelocity: (prev.avgVelocity * prev.positions.length + newRight.velocity) / (prev.positions.length + 1),
            directionChanges: prev.directionChanges + (newRight.quadrant !== rightStick.quadrant ? 1 : 0),
          };
        });

        lastPositionRef.current = { left: { x: lx, y: ly }, right: { x: rx, y: ry } };
        lastVelocityRef.current = { left: newLeft.velocity, right: newRight.velocity };

        const isSmallDrift = (x: number, y: number) => {
          const mag = Math.sqrt(x * x + y * y);
          return mag > DEADZONE && mag < 0.15;
        };

        const leftDrift = isSmallDrift(lx, ly);
        const rightDrift = isSmallDrift(rx, ry);

        setDriftWarning({ left: leftDrift, right: rightDrift });

        if (onDriftUpdate) {
          onDriftUpdate(newLeft.magnitude, newRight.magnitude);
        }
      }
      
      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamepad, sampleRate, onDriftUpdate, leftStick.quadrant, rightStick.quadrant]);

  const drawJoystick = (
    canvas: HTMLCanvasElement | null, 
    data: JoystickData,
    hasDrift: boolean
  ) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 20;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(220, 15%, 12%)';
    ctx.fill();
    ctx.strokeStyle = 'hsl(220, 15%, 20%)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'hsl(220, 15%, 18%)';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(center - radius, center);
    ctx.lineTo(center + radius, center);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(center, center - radius);
    ctx.lineTo(center, center + radius);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius * DEADZONE, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsl(220, 15%, 25%)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const trailX = center + data.x * radius;
    const trailY = center + data.y * radius;

    if (data.magnitude > DEADZONE) {
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(trailX, trailY);
      ctx.strokeStyle = hasDrift ? 'hsl(0, 70%, 55%)' : 'hsl(185, 70%, 50%)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const posX = center + data.x * radius;
    const posY = center + data.y * radius;

    if (data.magnitude > DEADZONE) {
      const gradient = ctx.createRadialGradient(posX, posY, 0, posX, posY, 20);
      gradient.addColorStop(0, hasDrift ? 'hsla(0, 70%, 55%, 0.5)' : 'hsla(185, 70%, 50%, 0.5)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(posX - 20, posY - 20, 40, 40);
    }

    ctx.beginPath();
    ctx.arc(posX, posY, 12, 0, Math.PI * 2);
    ctx.fillStyle = hasDrift ? 'hsl(0, 70%, 55%)' : 'hsl(185, 70%, 50%)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(posX, posY, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(220, 20%, 8%)';
    ctx.fill();
  };

  useEffect(() => {
    drawJoystick(leftCanvasRef.current, leftStick, driftWarning.left);
    drawJoystick(rightCanvasRef.current, rightStick, driftWarning.right);
  }, [leftStick, rightStick, driftWarning]);

  if (!gamepad) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {t('joystickTest')}
        </h3>
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          {t('connectToTestJoysticks')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          {t('joystickTest')}
        </h3>
        <div className="flex items-center gap-2">
          {driftWarning.left && (
            <span className="px-2 py-1 bg-destructive/20 text-destructive rounded text-xs font-medium">
              {t('leftDrift')}
            </span>
          )}
          {driftWarning.right && (
            <span className="px-2 py-1 bg-destructive/20 text-destructive rounded text-xs font-medium">
              {t('rightDrift')}
            </span>
          )}
          <button
            onClick={reset}
            className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t('leftStick')} (L3)</h4>
            <span className={cn(
              "text-xs font-mono",
              gamepad.buttons[10]?.pressed ? "text-primary" : "text-muted-foreground"
            )}>
              {gamepad.buttons[10]?.pressed ? "PRESSED" : "—"}
            </span>
          </div>
          <div className="flex justify-center">
            <canvas 
              ref={leftCanvasRef} 
              width={180} 
              height={180}
              className="rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/30 rounded px-3 py-2">
              <span className="text-muted-foreground">X:</span>
              <span className={cn(
                "ml-2 font-mono",
                Math.abs(leftStick.x) > DEADZONE ? "text-primary" : "text-muted-foreground"
              )}>
                {leftStick.rawX.toFixed(4)}
              </span>
            </div>
            <div className="bg-muted/30 rounded px-3 py-2">
              <span className="text-muted-foreground">Y:</span>
              <span className={cn(
                "ml-2 font-mono",
                Math.abs(leftStick.y) > DEADZONE ? "text-primary" : "text-muted-foreground"
              )}>
                {leftStick.rawY.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t('rightStick')} (R3)</h4>
            <span className={cn(
              "text-xs font-mono",
              gamepad.buttons[11]?.pressed ? "text-primary" : "text-muted-foreground"
            )}>
              {gamepad.buttons[11]?.pressed ? "PRESSED" : "—"}
            </span>
          </div>
          <div className="flex justify-center">
            <canvas 
              ref={rightCanvasRef} 
              width={180} 
              height={180}
              className="rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/30 rounded px-3 py-2">
              <span className="text-muted-foreground">X:</span>
              <span className={cn(
                "ml-2 font-mono",
                Math.abs(rightStick.x) > DEADZONE ? "text-primary" : "text-muted-foreground"
              )}>
                {rightStick.rawX.toFixed(4)}
              </span>
            </div>
            <div className="bg-muted/30 rounded px-3 py-2">
              <span className="text-muted-foreground">Y:</span>
              <span className={cn(
                "ml-2 font-mono",
                Math.abs(rightStick.y) > DEADZONE ? "text-primary" : "text-muted-foreground"
              )}>
                {rightStick.rawY.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-muted/20 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">{t('leftMagnitude')}</span>
            <span className="text-sm font-mono font-bold text-primary">
              {(leftStick.magnitude * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70"
              style={{ width: `${leftStick.magnitude * 100}%` }}
            />
          </div>
        </div>
        <div className="bg-muted/20 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">{t('rightMagnitude')}</span>
            <span className="text-sm font-mono font-bold text-primary">
              {(rightStick.magnitude * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70"
              style={{ width: `${rightStick.magnitude * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Advanced Stats */}
      {showAdvanced && (
        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'zh' ? '高级数据' : 'Advanced Data'}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Left Stick Advanced */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">{t('leftStick')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '角度' : 'Angle'}</span>
                  <span className="font-mono text-primary">{leftStick.angle.toFixed(1)}°</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '象限' : 'Quadrant'}</span>
                  <span className="font-mono text-primary">Q{leftStick.quadrant}</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '速度' : 'Velocity'}</span>
                  <span className="font-mono text-primary">{leftStick.velocity.toFixed(2)}</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '加速度' : 'Accel'}</span>
                  <span className={cn("font-mono", leftStick.acceleration > 0 ? "text-success" : leftStick.acceleration < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {leftStick.acceleration.toFixed(1)}
                  </span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '最大幅度' : 'Max Mag'}</span>
                  <span className="font-mono text-primary">{(leftHistory.maxMagnitude * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '总距离' : 'Distance'}</span>
                  <span className="font-mono text-primary">{leftHistory.totalDistance.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Right Stick Advanced */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">{t('rightStick')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '角度' : 'Angle'}</span>
                  <span className="font-mono text-primary">{rightStick.angle.toFixed(1)}°</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '象限' : 'Quadrant'}</span>
                  <span className="font-mono text-primary">Q{rightStick.quadrant}</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '速度' : 'Velocity'}</span>
                  <span className="font-mono text-primary">{rightStick.velocity.toFixed(2)}</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '加速度' : 'Accel'}</span>
                  <span className={cn("font-mono", rightStick.acceleration > 0 ? "text-success" : rightStick.acceleration < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {rightStick.acceleration.toFixed(1)}
                  </span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '最大幅度' : 'Max Mag'}</span>
                  <span className="font-mono text-primary">{(rightHistory.maxMagnitude * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '总距离' : 'Distance'}</span>
                  <span className="font-mono text-primary">{rightHistory.totalDistance.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

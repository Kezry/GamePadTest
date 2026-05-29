import { useState, useEffect, useRef, useCallback } from 'react';
import { GamepadState } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RotateCcw, TrendingUp, AlertTriangle, Check } from 'lucide-react';

interface DeadzoneTesterProps {
  gamepad: GamepadState | null;
  sampleRate: number;
}

interface DeadzoneData {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  samples: { x: number; y: number; timestamp: number }[];
  // Advanced metrics
  avgDrift: number;
  maxDrift: number;
  driftDirection: number; // angle in degrees
  stability: number; // 0-100
  responseTime: number; // ms to reach 90% deflection
  returnTime: number; // ms to return to center
  circularError: number; // deviation from perfect circle at full deflection
}

interface AdvancedStats {
  totalSamples: number;
  testDuration: number;
  jitterCount: number;
  deadzoneCoverage: number;
  linearityScore: number;
}

export const DeadzoneTester = ({ gamepad, sampleRate }: DeadzoneTesterProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const [leftData, setLeftData] = useState<DeadzoneData>({ 
    minX: 0, maxX: 0, minY: 0, maxY: 0, samples: [],
    avgDrift: 0, maxDrift: 0, driftDirection: 0, stability: 100,
    responseTime: 0, returnTime: 0, circularError: 0
  });
  const [rightData, setRightData] = useState<DeadzoneData>({ 
    minX: 0, maxX: 0, minY: 0, maxY: 0, samples: [],
    avgDrift: 0, maxDrift: 0, driftDirection: 0, stability: 100,
    responseTime: 0, returnTime: 0, circularError: 0
  });
  const [suggestedDeadzone, setSuggestedDeadzone] = useState<{ left: number; right: number }>({ left: 0.05, right: 0.05 });
  const [customDeadzone, setCustomDeadzone] = useState(0.1);
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats>({
    totalSamples: 0, testDuration: 0, jitterCount: 0, deadzoneCoverage: 0, linearityScore: 100
  });
  const [showAdvanced, setShowAdvanced] = useState(true);
  
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const testStartRef = useRef<number>(Date.now());
  const lastDeflectionRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const responseStartRef = useRef<{ left: number | null; right: number | null }>({ left: null, right: null });

  // For high DPI displays
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const canvasLogicalSize = 280;
  const canvasPhysicalSize = canvasLogicalSize * dpr;

  // Refs for RAF loop data (avoids stale closures and unnecessary re-renders)
  const leftDataRef = useRef<DeadzoneData>({
    minX: 0, maxX: 0, minY: 0, maxY: 0, samples: [],
    avgDrift: 0, maxDrift: 0, driftDirection: 0, stability: 100,
    responseTime: 0, returnTime: 0, circularError: 0
  });
  const rightDataRef = useRef<DeadzoneData>({
    minX: 0, maxX: 0, minY: 0, maxY: 0, samples: [],
    avgDrift: 0, maxDrift: 0, driftDirection: 0, stability: 100,
    responseTime: 0, returnTime: 0, circularError: 0
  });
  const advancedStatsRef = useRef<AdvancedStats>({
    totalSamples: 0, testDuration: 0, jitterCount: 0, deadzoneCoverage: 0, linearityScore: 100
  });
  const lastUIUpdateRef = useRef<number>(0);

  const reset = () => {
    const emptyData: DeadzoneData = { minX: 0, maxX: 0, minY: 0, maxY: 0, samples: [], avgDrift: 0, maxDrift: 0, driftDirection: 0, stability: 100, responseTime: 0, returnTime: 0, circularError: 0 };
    setLeftData(emptyData);
    setRightData(emptyData);
    leftDataRef.current = { ...emptyData };
    rightDataRef.current = { ...emptyData };
    setSuggestedDeadzone({ left: 0.05, right: 0.05 });
    setAdvancedStats({ totalSamples: 0, testDuration: 0, jitterCount: 0, deadzoneCoverage: 0, linearityScore: 100 });
    advancedStatsRef.current = { totalSamples: 0, testDuration: 0, jitterCount: 0, deadzoneCoverage: 0, linearityScore: 100 };
    testStartRef.current = Date.now();
    lastDeflectionRef.current = { left: 0, right: 0 };
    responseStartRef.current = { left: null, right: null };
  };

  // Sample joystick data using requestAnimationFrame for smoothness
  const lastSampleRef = useRef<number>(0);
  const sampleRateRef = useRef(sampleRate);
  const gamepadRef = useRef(gamepad);
  sampleRateRef.current = sampleRate;
  gamepadRef.current = gamepad;

  useEffect(() => {
    if (!gamepad) return;

    const interval = 1000 / sampleRate;
    let animationId: number;

    const sample = (timestamp: number) => {
      if (timestamp - lastSampleRef.current >= interval) {
        lastSampleRef.current = timestamp;
        const now = Date.now();
        const currentSampleRate = sampleRateRef.current;

        const gp = gamepadRef.current;
        if (!gp) { animationId = requestAnimationFrame(sample); return; }

        const lx = gp.axes[0] || 0;
        const ly = gp.axes[1] || 0;
        const rx = gp.axes[2] || 0;
        const ry = gp.axes[3] || 0;

        const lMag = Math.sqrt(lx * lx + ly * ly);
        const rMag = Math.sqrt(rx * rx + ry * ry);

        // Track response time
        if (lMag > 0.9 && responseStartRef.current.left === null) {
          responseStartRef.current.left = now;
        }
        if (rMag > 0.9 && responseStartRef.current.right === null) {
          responseStartRef.current.right = now;
        }

        // Update left data in ref
        const lPrev = leftDataRef.current;
        const maxSamples = Math.min(2000, currentSampleRate * 3);
        const lSamples = [...lPrev.samples.slice(-maxSamples), { x: lx, y: ly, timestamp: now }];
        const lDrifts = lSamples.filter(s => Math.sqrt(s.x * s.x + s.y * s.y) < 0.15).map(s => Math.sqrt(s.x * s.x + s.y * s.y));
        const lAvgDrift = lDrifts.length > 0 ? lDrifts.reduce((a, b) => a + b, 0) / lDrifts.length : 0;
        const lMaxDrift = Math.max(Math.abs(lPrev.minX), Math.abs(lPrev.maxX), Math.abs(lPrev.minY), Math.abs(lPrev.maxY));
        const lDriftDir = Math.atan2(lSamples.slice(-20).reduce((a, s) => a + s.y, 0) / 20, lSamples.slice(-20).reduce((a, s) => a + s.x, 0) / 20) * (180 / Math.PI);
        const lRecent = lSamples.slice(-50);
        const lVariance = lRecent.length > 1 ? lRecent.reduce((acc, s, i) => i === 0 ? 0 : acc + Math.sqrt(Math.pow(s.x - lRecent[i-1].x, 2) + Math.pow(s.y - lRecent[i-1].y, 2)), 0) / lRecent.length : 0;
        const lStability = Math.max(0, Math.min(100, 100 - lVariance * 500));
        const lFullDefl = lSamples.filter(s => Math.sqrt(s.x * s.x + s.y * s.y) > 0.9);
        const lCircErr = lFullDefl.length > 0 ? lFullDefl.reduce((acc, s) => acc + Math.abs(Math.sqrt(s.x * s.x + s.y * s.y) - 1), 0) / lFullDefl.length * 100 : 0;
        const lSuggested = lMaxDrift * 1.2;

        leftDataRef.current = {
          minX: Math.min(lPrev.minX, lx), maxX: Math.max(lPrev.maxX, lx),
          minY: Math.min(lPrev.minY, ly), maxY: Math.max(lPrev.maxY, ly),
          samples: lSamples, avgDrift: lAvgDrift, maxDrift: lMaxDrift, driftDirection: lDriftDir,
          stability: lStability, responseTime: responseStartRef.current.left ? now - responseStartRef.current.left : 0,
          returnTime: lPrev.returnTime, circularError: lCircErr,
        };

        // Update right data in ref
        const rPrev = rightDataRef.current;
        const rSamples = [...rPrev.samples.slice(-maxSamples), { x: rx, y: ry, timestamp: now }];
        const rDrifts = rSamples.filter(s => Math.sqrt(s.x * s.x + s.y * s.y) < 0.15).map(s => Math.sqrt(s.x * s.x + s.y * s.y));
        const rAvgDrift = rDrifts.length > 0 ? rDrifts.reduce((a, b) => a + b, 0) / rDrifts.length : 0;
        const rMaxDrift = Math.max(Math.abs(rPrev.minX), Math.abs(rPrev.maxX), Math.abs(rPrev.minY), Math.abs(rPrev.maxY));
        const rDriftDir = Math.atan2(rSamples.slice(-20).reduce((a, s) => a + s.y, 0) / 20, rSamples.slice(-20).reduce((a, s) => a + s.x, 0) / 20) * (180 / Math.PI);
        const rRecent = rSamples.slice(-50);
        const rVariance = rRecent.length > 1 ? rRecent.reduce((acc, s, i) => i === 0 ? 0 : acc + Math.sqrt(Math.pow(s.x - rRecent[i-1].x, 2) + Math.pow(s.y - rRecent[i-1].y, 2)), 0) / rRecent.length : 0;
        const rStability = Math.max(0, Math.min(100, 100 - rVariance * 500));
        const rFullDefl = rSamples.filter(s => Math.sqrt(s.x * s.x + s.y * s.y) > 0.9);
        const rCircErr = rFullDefl.length > 0 ? rFullDefl.reduce((acc, s) => acc + Math.abs(Math.sqrt(s.x * s.x + s.y * s.y) - 1), 0) / rFullDefl.length * 100 : 0;
        const rSuggested = rMaxDrift * 1.2;

        rightDataRef.current = {
          minX: Math.min(rPrev.minX, rx), maxX: Math.max(rPrev.maxX, rx),
          minY: Math.min(rPrev.minY, ry), maxY: Math.max(rPrev.maxY, ry),
          samples: rSamples, avgDrift: rAvgDrift, maxDrift: rMaxDrift, driftDirection: rDriftDir,
          stability: rStability, responseTime: responseStartRef.current.right ? now - responseStartRef.current.right : 0,
          returnTime: rPrev.returnTime, circularError: rCircErr,
        };

        // Update advanced stats in ref
        const aPrev = advancedStatsRef.current;
        advancedStatsRef.current = {
          totalSamples: aPrev.totalSamples + 1,
          testDuration: (now - testStartRef.current) / 1000,
          jitterCount: aPrev.jitterCount + (Math.abs(lMag - lastDeflectionRef.current.left) > 0.1 ? 1 : 0),
          deadzoneCoverage: ((lSamples.length + rSamples.length) / (maxSamples * 2)) * 100,
          linearityScore: Math.max(0, 100 - (lCircErr + rCircErr) / 2),
        };

        lastDeflectionRef.current = { left: lMag, right: rMag };

        // Throttle UI state updates to 10fps (every 100ms)
        if (now - lastUIUpdateRef.current >= 100) {
          lastUIUpdateRef.current = now;
          setLeftData({ ...leftDataRef.current });
          setRightData({ ...rightDataRef.current });
          setSuggestedDeadzone({ left: Math.max(0.02, Math.min(lSuggested, 0.3)), right: Math.max(0.02, Math.min(rSuggested, 0.3)) });
          setAdvancedStats({ ...advancedStatsRef.current });
        }
      }

      animationId = requestAnimationFrame(sample);
    };

    animationId = requestAnimationFrame(sample);

    return () => cancelAnimationFrame(animationId);
  }, [gamepad, sampleRate]);

  // Draw deadzone visualization with high DPI support
  const drawDeadzoneMap = useCallback((
    canvas: HTMLCanvasElement | null,
    data: DeadzoneData,
    currentX: number,
    currentY: number
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvasPhysicalSize;
    const center = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Background with gradient
    const bgGradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    bgGradient.addColorStop(0, 'hsl(220, 15%, 14%)');
    bgGradient.addColorStop(1, 'hsl(220, 15%, 8%)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, size, size);

    // Grid - finer lines
    ctx.strokeStyle = 'hsl(220, 15%, 18%)';
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i <= 20; i++) {
      const pos = (size / 20) * i;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // Center lines
    ctx.strokeStyle = 'hsl(220, 15%, 25%)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();

    // Outer circle (max range)
    ctx.beginPath();
    ctx.arc(center, center, center - 10 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsl(220, 15%, 30%)';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // Custom deadzone circle
    ctx.beginPath();
    ctx.arc(center, center, customDeadzone * (center - 10 * dpr), 0, Math.PI * 2);
    ctx.strokeStyle = 'hsl(185, 70%, 50%)';
    ctx.lineWidth = 3 * dpr;
    ctx.setLineDash([8 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Fill deadzone area
    ctx.beginPath();
    ctx.arc(center, center, customDeadzone * (center - 10 * dpr), 0, Math.PI * 2);
    ctx.fillStyle = 'hsla(185, 70%, 50%, 0.1)';
    ctx.fill();

    // Sample points with trail effect
    const trailLength = Math.min(data.samples.length, 200);
    for (let i = data.samples.length - trailLength; i < data.samples.length; i++) {
      if (i < 0) continue;
      const sample = data.samples[i];
      const alpha = 0.05 + ((i - (data.samples.length - trailLength)) / trailLength) * 0.4;
      ctx.fillStyle = `hsla(185, 70%, 50%, ${alpha})`;
      const px = center + sample.x * (center - 10 * dpr);
      const py = center + sample.y * (center - 10 * dpr);
      ctx.beginPath();
      ctx.arc(px, py, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Drift zone rectangle
    if (data.minX !== 0 || data.maxX !== 0 || data.minY !== 0 || data.maxY !== 0) {
      const driftX = center + data.minX * (center - 10 * dpr);
      const driftY = center + data.minY * (center - 10 * dpr);
      const driftW = (data.maxX - data.minX) * (center - 10 * dpr);
      const driftH = (data.maxY - data.minY) * (center - 10 * dpr);
      ctx.strokeStyle = 'hsl(0, 70%, 55%)';
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(driftX, driftY, driftW, driftH);
      ctx.fillStyle = 'hsla(0, 70%, 55%, 0.1)';
      ctx.fillRect(driftX, driftY, driftW, driftH);
    }

    // Current position with glow
    const posX = center + currentX * (center - 10 * dpr);
    const posY = center + currentY * (center - 10 * dpr);
    
    // Glow
    const glowGradient = ctx.createRadialGradient(posX, posY, 0, posX, posY, 20 * dpr);
    glowGradient.addColorStop(0, 'hsla(185, 70%, 50%, 0.5)');
    glowGradient.addColorStop(1, 'hsla(185, 70%, 50%, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(posX, posY, 20 * dpr, 0, Math.PI * 2);
    ctx.fill();
    
    // Main dot
    ctx.beginPath();
    ctx.arc(posX, posY, 10 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(185, 70%, 50%)';
    ctx.fill();
    ctx.strokeStyle = 'hsl(185, 70%, 70%)';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // Crosshair at current position
    ctx.strokeStyle = 'hsla(185, 70%, 50%, 0.5)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(posX, 0);
    ctx.lineTo(posX, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, posY);
    ctx.lineTo(size, posY);
    ctx.stroke();
  }, [customDeadzone, canvasPhysicalSize, dpr]);

  useEffect(() => {
    if (!gamepad) return;
    drawDeadzoneMap(leftCanvasRef.current, leftData, gamepad.axes[0] || 0, gamepad.axes[1] || 0);
    drawDeadzoneMap(rightCanvasRef.current, rightData, gamepad.axes[2] || 0, gamepad.axes[3] || 0);
  }, [leftData, rightData, gamepad, drawDeadzoneMap]);

  if (!gamepad) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {t('deadzoneTest')}
        </h3>
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          {t('connectToTest')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          {t('deadzoneTest')}
        </h3>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground font-mono">
            {sampleRate >= 1000 ? `${sampleRate/1000}k` : sampleRate} Hz
          </div>
          <button
            onClick={reset}
            className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        {t('deadzoneInstructions')}
      </p>

      {/* Deadzone slider */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">{t('customDeadzone')}</span>
          <span className="font-mono text-primary">{(customDeadzone * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          value={customDeadzone * 100}
          onChange={(e) => setCustomDeadzone(Number(e.target.value) / 100)}
          className={cn(
            "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left Stick */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-center">{t('leftStick')}</h4>
          <div className="flex justify-center">
            <canvas
              ref={leftCanvasRef}
              width={canvasPhysicalSize}
              height={canvasPhysicalSize}
              style={{ width: canvasLogicalSize, height: canvasLogicalSize }}
              className="rounded-xl shadow-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <span className="text-muted-foreground block mb-1">{t('driftRange')}</span>
              <span className="font-mono text-destructive text-lg">
                {(Math.max(Math.abs(leftData.minX), Math.abs(leftData.maxX), Math.abs(leftData.minY), Math.abs(leftData.maxY)) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <span className="text-muted-foreground block mb-1">{t('suggested')}</span>
              <span className="font-mono text-primary text-lg">
                {(suggestedDeadzone.left * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Right Stick */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-center">{t('rightStick')}</h4>
          <div className="flex justify-center">
            <canvas
              ref={rightCanvasRef}
              width={canvasPhysicalSize}
              height={canvasPhysicalSize}
              style={{ width: canvasLogicalSize, height: canvasLogicalSize }}
              className="rounded-xl shadow-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <span className="text-muted-foreground block mb-1">{t('driftRange')}</span>
              <span className="font-mono text-destructive text-lg">
                {(Math.max(Math.abs(rightData.minX), Math.abs(rightData.maxX), Math.abs(rightData.minY), Math.abs(rightData.maxY)) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <span className="text-muted-foreground block mb-1">{t('suggested')}</span>
              <span className="font-mono text-primary text-lg">
                {(suggestedDeadzone.right * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Statistics */}
      {showAdvanced && (
        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {language === 'zh' ? '高级数据分析' : 'Advanced Analytics'}
            </h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Left Stick Advanced */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">{t('leftStick')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '平均漂移' : 'Avg Drift'}</span>
                  <span className="font-mono text-primary">{(leftData.avgDrift * 100).toFixed(2)}%</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '稳定性' : 'Stability'}</span>
                  <span className={cn("font-mono", leftData.stability > 80 ? "text-success" : leftData.stability > 50 ? "text-warning" : "text-destructive")}>
                    {leftData.stability.toFixed(0)}%
                  </span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '漂移方向' : 'Drift Dir'}</span>
                  <span className="font-mono text-foreground">{leftData.driftDirection.toFixed(0)}°</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '圆形误差' : 'Circle Err'}</span>
                  <span className={cn("font-mono", leftData.circularError < 5 ? "text-success" : "text-warning")}>
                    {leftData.circularError.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Right Stick Advanced */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">{t('rightStick')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '平均漂移' : 'Avg Drift'}</span>
                  <span className="font-mono text-primary">{(rightData.avgDrift * 100).toFixed(2)}%</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '稳定性' : 'Stability'}</span>
                  <span className={cn("font-mono", rightData.stability > 80 ? "text-success" : rightData.stability > 50 ? "text-warning" : "text-destructive")}>
                    {rightData.stability.toFixed(0)}%
                  </span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '漂移方向' : 'Drift Dir'}</span>
                  <span className="font-mono text-foreground">{rightData.driftDirection.toFixed(0)}°</span>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground block">{language === 'zh' ? '圆形误差' : 'Circle Err'}</span>
                  <span className={cn("font-mono", rightData.circularError < 5 ? "text-success" : "text-warning")}>
                    {rightData.circularError.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-primary/10 rounded-lg p-2 text-center">
              <span className="text-muted-foreground block">{language === 'zh' ? '采样数' : 'Samples'}</span>
              <span className="font-mono text-primary text-sm">{advancedStats.totalSamples}</span>
            </div>
            <div className="bg-primary/10 rounded-lg p-2 text-center">
              <span className="text-muted-foreground block">{language === 'zh' ? '测试时长' : 'Duration'}</span>
              <span className="font-mono text-primary text-sm">{advancedStats.testDuration.toFixed(0)}s</span>
            </div>
            <div className="bg-primary/10 rounded-lg p-2 text-center">
              <span className="text-muted-foreground block">{language === 'zh' ? '抖动次数' : 'Jitters'}</span>
              <span className={cn("font-mono text-sm", advancedStats.jitterCount > 50 ? "text-warning" : "text-success")}>
                {advancedStats.jitterCount}
              </span>
            </div>
            <div className="bg-primary/10 rounded-lg p-2 text-center">
              <span className="text-muted-foreground block">{language === 'zh' ? '线性度' : 'Linearity'}</span>
              <span className={cn("font-mono text-sm", advancedStats.linearityScore > 90 ? "text-success" : "text-warning")}>
                {advancedStats.linearityScore.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Health Assessment */}
          <div className="mt-4 p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-2">
              {leftData.maxDrift < 0.05 && rightData.maxDrift < 0.05 ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning" />
              )}
              <span className="text-sm font-medium">
                {language === 'zh' ? '摇杆健康评估' : 'Joystick Health Assessment'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {leftData.maxDrift < 0.05 && rightData.maxDrift < 0.05 ? (
                language === 'zh' ? '摇杆状态良好，无明显漂移问题' : 'Joysticks are in good condition, no significant drift detected'
              ) : leftData.maxDrift > 0.15 || rightData.maxDrift > 0.15 ? (
                language === 'zh' ? '检测到明显漂移，建议调整死区或维修' : 'Significant drift detected, recommend adjusting deadzone or repair'
              ) : (
                language === 'zh' ? '轻微漂移，可通过增加死区解决' : 'Minor drift detected, can be fixed by increasing deadzone'
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
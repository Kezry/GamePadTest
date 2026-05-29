import { useState, useEffect, useRef, useCallback } from 'react';
import { GamepadState } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Activity, Play, RotateCcw, Zap } from 'lucide-react';

interface LatencyTesterProps {
  gamepad: GamepadState | null;
  activeGamepad: number | null;
  sampleRate: number; // 60–8000 Hz, configurable via SampleRateControl
}

interface LatencySample {
  timestamp: number;
  interval: number;
}

const WINDOW_SIZE = 200;

/** Compute median of a sorted array */
const median = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Filter outliers using IQR method */
const filterOutliers = (values: number[]): number[] => {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = median(sorted.slice(0, Math.floor(sorted.length / 2)));
  const q3 = median(sorted.slice(Math.ceil(sorted.length / 2)));
  const iqr = q3 - q1;
  const lower = q1 - 3 * iqr;
  const upper = q3 + 3 * iqr;
  return values.filter(v => v >= lower && v <= upper);
};

export const LatencyTester = ({ gamepad, activeGamepad, sampleRate }: LatencyTesterProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [isTesting, setIsTesting] = useState(false);
  const [samples, setSamples] = useState<LatencySample[]>([]);
  const [currentInterval, setCurrentInterval] = useState<number | null>(null);
  const [pollRate, setPollRate] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [stallCount, setStallCount] = useState(0);
  const [stability, setStability] = useState<number>(100);

  const lastTimestampRef = useRef<number>(0);
  const lastPollTimeRef = useRef<number>(0);
  const rawIntervalsRef = useRef<number[]>([]);
  const stallCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredSamples = filterOutliers(samples.map(s => s.interval));
  const avgInterval = filteredSamples.length > 0
    ? filteredSamples.reduce((a, b) => a + b, 0) / filteredSamples.length
    : null;
  const minInterval = filteredSamples.length > 0 ? Math.min(...filteredSamples) : null;
  const maxInterval = filteredSamples.length > 0 ? Math.max(...filteredSamples) : null;

  const cleanup = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetStats = useCallback(() => {
    setSamples([]);
    setCurrentInterval(null);
    setPollRate(null);
    setJitter(null);
    setStallCount(0);
    setStability(100);
    lastTimestampRef.current = 0;
    lastPollTimeRef.current = 0;
    rawIntervalsRef.current = [];
    stallCountRef.current = 0;
  }, []);

  const startTest = useCallback(() => {
    resetStats();
    setIsTesting(true);
  }, [resetStats]);

  const stopTest = useCallback(() => {
    setIsTesting(false);
    cleanup();
  }, [cleanup]);

  const resetTest = useCallback(() => {
    stopTest();
    resetStats();
  }, [stopTest, resetStats]);

  // High-frequency polling loop
  useEffect(() => {
    if (!isTesting || activeGamepad === null) return;

    // sampleRate 60–8000 Hz → interval 1ms (for >=1kHz) to 16ms (for 60Hz)
    const pollInterval = Math.max(1, Math.floor(1000 / sampleRate));

    const handleVisibility = () => {
      if (document.hidden) {
        cleanup();
        lastTimestampRef.current = 0;
        lastPollTimeRef.current = 0;
      } else {
        if (isTesting && intervalRef.current === null) {
          intervalRef.current = setInterval(pollFn, pollInterval);
        }
      }
    };

    const pollFn = () => {
      const gps = navigator.getGamepads();
      const gp = gps[activeGamepad];
      if (!gp) return;

      const now = performance.now();
      const gpTs = gp.timestamp;

      if (gpTs !== lastTimestampRef.current) {
        if (lastPollTimeRef.current > 0) {
          const interval = now - lastPollTimeRef.current;

          // Reject obvious garbage (negative or > 500ms)
          if (interval > 0 && interval < 500) {
            rawIntervalsRef.current.push(interval);
            if (rawIntervalsRef.current.length > WINDOW_SIZE) {
              rawIntervalsRef.current = rawIntervalsRef.current.slice(-WINDOW_SIZE);
            }

            // Detect stall: interval > 3x median of recent window
            const recent = rawIntervalsRef.current;
            if (recent.length >= 10) {
              const sorted = [...recent].sort((a, b) => a - b);
              const med = median(sorted);
              if (interval > med * 3) {
                stallCountRef.current++;
                setStallCount(stallCountRef.current);
              }
            }

            // Update rolling stats
            const valid = filterOutliers(rawIntervalsRef.current);
            const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
            const variance = valid.reduce((sum, v) => sum + (v - avg) ** 2, 0) / valid.length;
            const std = Math.sqrt(variance);

            setCurrentInterval(Math.round(interval * 100) / 100);
            setPollRate(Math.round(1000 / avg));
            setJitter(Math.round(std * 100) / 100);
            setStability(Math.round(Math.max(0, 100 - (std / avg) * 100)));

            setSamples(prev => {
              const next = [...prev, { timestamp: Date.now(), interval: Math.round(interval * 100) / 100 }];
              return next.slice(-WINDOW_SIZE);
            });
          }
        }

        lastTimestampRef.current = gpTs;
        lastPollTimeRef.current = now;
      }
    };

    intervalRef.current = setInterval(pollFn, pollInterval);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isTesting, activeGamepad, sampleRate, cleanup]);

  if (!gamepad) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {t('latencyTest')}
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
          {t('latencyTest')}
        </h3>
      </div>

      <div className="space-y-6">
        {/* Info */}
        <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <Zap className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
            {t('latencyDescription')}
          </p>
        </div>

        {/* Primary Display: Poll Rate + Current Interval */}
        <div
          className={cn(
            "h-40 rounded-xl border-2 flex items-center justify-center transition-all duration-100",
            isTesting
              ? "bg-primary/20 border-primary"
              : "bg-muted/30 border-border"
          )}
        >
          {!isTesting ? (
            <div className="text-center">
              <Activity className="w-16 h-16 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{t('latencyInstructions2')}</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-6">
                <div>
                  <div className="text-5xl font-mono font-bold text-primary">
                    {pollRate ?? '--'}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('pollRate')} (Hz)</div>
                </div>
                <div className="w-px h-12 bg-border" />
                <div>
                  <div className="text-5xl font-mono font-bold text-foreground">
                    {currentInterval !== null ? currentInterval.toFixed(1) : '--'}
                  </div>
                  <div className="text-sm text-muted-foreground">ms</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{t('samples')}: {samples.length}</span>
                {jitter !== null && (
                  <span className={cn(
                    "font-medium",
                    jitter < 1 ? "text-success" : jitter < 3 ? "text-warning" : "text-destructive"
                  )}>
                    {t('jitter')}: {jitter}ms
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Statistics Grid */}
        {samples.length > 5 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">{t('avgLatency')}</div>
              <div className="text-2xl font-mono font-bold text-primary">
                {avgInterval !== null ? avgInterval.toFixed(1) : '--'}
              </div>
              <div className="text-xs text-muted-foreground">ms</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">{t('jitter')}</div>
              <div className={cn(
                "text-2xl font-mono font-bold",
                jitter !== null && jitter < 1 ? "text-success"
                  : jitter !== null && jitter < 3 ? "text-warning"
                  : "text-destructive"
              )}>
                {jitter ?? '--'}
              </div>
              <div className="text-xs text-muted-foreground">ms</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">{t('stalls')}</div>
              <div className={cn(
                "text-2xl font-mono font-bold",
                stallCount === 0 ? "text-success" : stallCount < 5 ? "text-warning" : "text-destructive"
              )}>
                {stallCount}
              </div>
              <div className="text-xs text-muted-foreground">{t('stability')}: {stability}%</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">{t('minLatency')} / {t('maxLatency')}</div>
              <div className="text-lg font-mono font-bold">
                <span className="text-success">{minInterval !== null ? minInterval.toFixed(1) : '--'}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-warning">{maxInterval !== null ? maxInterval.toFixed(1) : '--'}</span>
              </div>
              <div className="text-xs text-muted-foreground">ms</div>
            </div>
          </div>
        )}

        {/* Latency Graph */}
        {samples.length > 10 && (() => {
          const filtered = filterOutliers(samples.map(s => s.interval));
          const chartMax = Math.max(20, ...filtered) * 1.1;
          return (
            <div className="bg-muted/20 rounded-xl p-4">
              <div className="flex items-end justify-between h-24 gap-px">
                {samples.slice(-80).map((sample, idx) => {
                  const valid = filterOutliers(samples.slice(Math.max(0, idx - 20), idx + 1).map(s => s.interval));
                  const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : sample.interval;
                  const dev = Math.abs(sample.interval - avg) / avg;
                  const height = Math.min(100, (sample.interval / chartMax) * 100);
                  const color = dev < 0.15 ? 'bg-success' : dev < 0.4 ? 'bg-primary' : dev < 0.8 ? 'bg-warning' : 'bg-destructive';
                  return (
                    <div
                      key={idx}
                      className={cn("flex-1 rounded-t transition-all", color)}
                      style={{ height: `${height}%`, minWidth: '1px' }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>0ms</span>
                <span>{chartMax.toFixed(0)}ms</span>
              </div>
            </div>
          );
        })()}

        {/* Controls */}
        <div className="flex gap-3">
          {!isTesting ? (
            <button
              onClick={startTest}
              className="flex-1 py-4 bg-primary/20 text-primary rounded-xl font-medium hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2 text-lg"
            >
              <Play className="w-5 h-5" />
              {t('startLatencyTest')}
            </button>
          ) : (
            <button
              onClick={stopTest}
              className="flex-1 py-4 bg-destructive/20 text-destructive rounded-xl font-medium hover:bg-destructive hover:text-destructive-foreground transition-all text-lg"
            >
              {t('stopTest')}
            </button>
          )}
          <button
            onClick={resetTest}
            disabled={isTesting}
            className="px-6 py-4 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

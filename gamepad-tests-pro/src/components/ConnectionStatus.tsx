import { Gamepad2, Wifi, WifiOff, Usb } from 'lucide-react';
import { GamepadState, GamepadInfo } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  gamepad: GamepadState | null;
  gamepadInfo: GamepadInfo | null;
  gamepads: (GamepadState | null)[];
  gamepadInfos: (GamepadInfo | null)[];
  activeGamepad: number | null;
  onSelectGamepad: (index: number) => void;
  gamepadSupported: boolean;
}

export const ConnectionStatus = ({
  gamepad,
  gamepadInfo,
  gamepads,
  gamepadInfos,
  activeGamepad,
  onSelectGamepad,
  gamepadSupported,
}: ConnectionStatusProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const connectedCount = gamepads.filter(gp => gp !== null).length;

  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'xbox': return 'text-success';
      case 'playstation': return 'text-primary';
      case 'switch': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getTypeBadge = (type: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return t(type as any) || type;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300",
            gamepad 
              ? "bg-primary/20 text-primary glow-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('connectionStatus')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('devicesConnected', { count: connectedCount, plural: connectedCount !== 1 ? 's' : '' })}
            </p>
          </div>
        </div>
        
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
          gamepad 
            ? "bg-success/20 text-success" 
            : "bg-muted text-muted-foreground animate-pulse"
        )}>
          {gamepad ? (
            <>
              <Wifi className="w-4 h-4" />
              {t('connected')}
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              {t('waitingForDevice')}
            </>
          )}
        </div>
      </div>

      {!gamepad && (
        <div className="bg-muted/50 border border-border rounded-lg p-6 text-center">
          <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />

          {inIframe ? (
            <>
              <h3 className="text-lg font-medium mb-2">{t('noControllerDetected')}</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {t('iframeNotice')}
              </p>
              <button
                onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-medium"
              >
                {t('openInNewTab')}
              </button>
            </>
          ) : !gamepadSupported ? (
            <>
              <h3 className="text-lg font-medium mb-2">{t('gamepadNotSupportedTitle')}</h3>
              <p className="text-muted-foreground text-sm">{t('gamepadNotSupportedDesc')}</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium mb-2">{t('noControllerDetected')}</h3>
              <p className="text-muted-foreground text-sm mb-2">{t('connectInstructions')}</p>
              
              <div className="my-4 p-4 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-warning text-base font-bold animate-pulse">{t('pressButtonHint')}</p>
                <p className="text-warning/80 text-xs mt-1">{t('pressButtonHintSub')}</p>
              </div>

              <div className="flex justify-center gap-8 text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  <Usb className="w-4 h-4" />
                  <span>{t('usbWired')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  <span>{t('bluetooth')}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (typeof navigator.getGamepads === 'function') {
                    navigator.getGamepads();
                  }
                }}
                className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-medium mb-4"
              >
                {t('clickToActivate')}
              </button>

              <div className="mt-4 p-4 bg-muted/50 rounded-lg text-left text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground mb-2">{t('troubleshootTitle')}</p>
                <p>{t('troubleshootStep1')}</p>
                <p>{t('troubleshootStep2')}</p>
                <p>{t('troubleshootStep3')}</p>
                <p>{t('troubleshootStep4')}</p>
              </div>
            </>
          )}

          
        </div>
      )}

      {gamepad && gamepadInfo && (
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    getTypeColor(gamepadInfo.type),
                    "bg-current/10"
                  )}>
                    {getTypeBadge(gamepadInfo.type)}
                  </span>
                  {gamepadInfo.hasVibration && (
                    <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                      {t('vibration')}
                    </span>
                  )}
                  {gamepadInfo.hasGyro && (
                    <span className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">
                      {t('gyro')}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold">{gamepadInfo.name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-1 truncate max-w-md">
                  {gamepad.id}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold text-primary">
                {gamepad.buttons.length}
              </div>
              <div className="text-xs text-muted-foreground">{t('buttons')}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold text-primary">
                {gamepad.axes.length}
              </div>
              <div className="text-xs text-muted-foreground">{t('axes')}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold text-primary">
                #{activeGamepad}
              </div>
              <div className="text-xs text-muted-foreground">{t('index')}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold text-success">
                ✓
              </div>
              <div className="text-xs text-muted-foreground">{t('standard')}</div>
            </div>
          </div>

          {connectedCount > 1 && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-2">{t('multipleControllersDetected')}</p>
              <div className="flex flex-wrap gap-2">
                {gamepads.map((gp, idx) => {
                  if (!gp) return null;
                  const info = gamepadInfos[idx];
                  const isActive = activeGamepad === idx;
                  const typeLabel = info?.type === 'playstation' ? 'PS'
                    : info?.type === 'xbox' ? 'Xbox'
                    : info?.type === 'switch' ? 'NS'
                    : 'GP';
                  return (
                    <button
                      key={idx}
                      onClick={() => onSelectGamepad(idx)}
                      className={cn(
                        "relative px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-xs px-1 py-0.5 rounded",
                          isActive ? "bg-primary-foreground/20" : "bg-foreground/10"
                        )}>{typeLabel}</span>
                        <span>{t('controller')} #{idx + 1}</span>
                      </span>
                      {isActive && (
                        <span className="absolute -bottom-px left-2 right-2 h-0.5 bg-primary-foreground rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

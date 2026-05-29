import { cn } from '@/lib/utils';
import { Keyboard, Move, Vibrate, Activity, Gauge, Trophy, Compass, Link2, Film } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';

interface TestingTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  gamepadConnected: boolean;
}

export const TestingTabs = ({ activeTab, onTabChange, gamepadConnected }: TestingTabsProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const tabs = [
    { id: 'buttons', label: t('buttonsTab'), icon: Keyboard },
    { id: 'joysticks', label: t('joysticksTab'), icon: Move },
    { id: 'vibration', label: t('vibrationTab'), icon: Vibrate },
    { id: 'scenes', label: language === 'zh' ? '场景' : 'Scenes', icon: Film },
    { id: 'latency', label: t('latencyTab'), icon: Activity },
    { id: 'deadzone', label: t('deadzoneTab'), icon: Gauge },
    { id: 'gyroscope', label: t('gyroTab'), icon: Compass },
    { id: 'stability', label: t('stabilityTab'), icon: Link2 },
    { id: 'rankings', label: t('rankingsTab'), icon: Trophy },
  ];

  return (
    <div className="border-b border-border">
      <div className="flex gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
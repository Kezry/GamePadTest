import { Globe, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';

const browsers = [
  { name: 'Chrome', version: '88+', supported: true },
  { name: 'Firefox', version: '85+', supported: true },
  { name: 'Edge', version: '88+', supported: true },
  { name: 'Safari', version: '14+', supported: true },
];

const controllersEn = [
  { name: 'Xbox Series X|S', supported: true },
  { name: 'Xbox One / Elite', supported: true },
  { name: 'PlayStation 5 DualSense', supported: true },
  { name: 'PlayStation 4 DualShock', supported: true },
  { name: 'Nintendo Switch Pro', supported: true },
  { name: 'Generic USB/BT Gamepads', supported: true },
];

const controllersZh = [
  { name: 'Xbox Series X|S 手柄', supported: true },
  { name: 'Xbox One / Elite 精英手柄', supported: true },
  { name: 'PlayStation 5 DualSense 手柄', supported: true },
  { name: 'PlayStation 4 DualShock 手柄', supported: true },
  { name: 'Nintendo Switch Pro 手柄', supported: true },
  { name: '通用 USB/蓝牙手柄', supported: true },
];

export const CompatibilityInfo = () => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const controllers = language === 'zh' ? controllersZh : controllersEn;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">{t('compatibility')}</h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('supportedBrowsers')}
          </h4>
          <div className="space-y-2">
            {browsers.map((browser) => (
              <div 
                key={browser.name}
                className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg"
              >
                <span className="text-sm">{browser.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">{browser.version}</span>
                  <Check className="w-4 h-4 text-success" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('supportedControllers')}
          </h4>
          <div className="space-y-2">
            {controllers.map((controller) => (
              <div 
                key={controller.name}
                className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg"
              >
                <span className="text-sm">{controller.name}</span>
                <Check className="w-4 h-4 text-success" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{t('note')}:</strong> {t('compatibilityNote')}
        </p>
      </div>
    </div>
  );
};

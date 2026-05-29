import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Gauge } from 'lucide-react';

interface SampleRateControlProps {
  sampleRate: number;
  onSampleRateChange: (rate: number) => void;
}

const SAMPLE_RATES = [60, 120, 240, 500, 1000, 2000, 4000, 8000];

export const SampleRateControl = ({ sampleRate, onSampleRateChange }: SampleRateControlProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Gauge className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground">{t('sampleRate')}:</span>
      <div className="flex gap-1 flex-wrap">
        {SAMPLE_RATES.map((rate) => (
          <button
            key={rate}
            onClick={() => onSampleRateChange(rate)}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-mono rounded transition-all duration-100",
              sampleRate === rate
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {rate >= 1000 ? `${rate/1000}k` : rate}
          </button>
        ))}
      </div>
    </div>
  );
};
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, Clock, Medal } from 'lucide-react';

interface TestRecord {
  id: string;
  controller_name: string;
  controller_type: string;
  overall_score: number;
  tested_at: string;
}

interface TierData {
  controller_name: string;
  controller_type: string;
  test_count: number;
  avg_score: number;
  best_score: number;
}

/**
 * Returns Tailwind color classes based on score tier
 * S: >= 90 (yellow), A: >= 80 (primary), B: >= 70 (success), C: >= 60 (muted), D: < 60 (destructive)
 */
const getTierColor = (score: number) => {
  if (score >= 90) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
  if (score >= 80) return 'text-primary bg-primary/10 border-primary/30';
  if (score >= 70) return 'text-success bg-success/10 border-success/30';
  if (score >= 60) return 'text-muted-foreground bg-muted border-border';
  return 'text-destructive bg-destructive/10 border-destructive/30';
};

/**
 * Returns tier label (S/A/B/C/D) based on score
 */
const getTierLabel = (score: number, lang: string) => {
  if (score >= 90) return lang === 'zh' ? 'S级' : 'S';
  if (score >= 80) return lang === 'zh' ? 'A级' : 'A';
  if (score >= 70) return lang === 'zh' ? 'B级' : 'B';
  if (score >= 60) return lang === 'zh' ? 'C级' : 'C';
  return lang === 'zh' ? 'D级' : 'D';
};

/**
 * Rankings component displays controller test rankings
 * Fetches data from Supabase public view for privacy
 * Shows tier rankings by controller type and recent test results
 */
export const Rankings = () => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [tierData, setTierData] = useState<TierData[]>([]);
  const [recentTests, setRecentTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankings();
  }, []);

  /**
   * Fetches ranking data from Supabase:
   * 1. Recent tests (last 10) from public view
   * 2. All records for tier calculation aggregated by controller name
   */
  const fetchRankings = async () => {
    try {
      const { data: recent, error: recentError } = await supabase
        .from('test_records_public')
        .select('id, controller_name, controller_type, overall_score, tested_at')
        .order('tested_at', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;
      setRecentTests(recent || []);

      const { data: allRecords, error: allError } = await supabase
        .from('test_records_public')
        .select('controller_name, controller_type, overall_score');

      if (allError) throw allError;

      const tierMap = new Map<string, { scores: number[], type: string }>();
      
      (allRecords || []).forEach((record) => {
        const key = record.controller_name;
        if (!tierMap.has(key)) {
          tierMap.set(key, { scores: [], type: record.controller_type });
        }
        tierMap.get(key)!.scores.push(record.overall_score);
      });

      const tiers: TierData[] = Array.from(tierMap.entries())
        .map(([name, data]) => ({
          controller_name: name,
          controller_type: data.type,
          test_count: data.scores.length,
          avg_score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
          best_score: Math.max(...data.scores),
        }))
        .sort((a, b) => b.avg_score - a.avg_score);

      setTierData(tiers);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Formats date string to localized format
   */
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tier Rankings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-5 h-5 text-warning" />
          <h3 className="text-lg font-semibold">{t('tierRanking')}</h3>
        </div>

        {tierData.length === 0 ? (
          <div className="py-12 text-center">
            <Medal className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h4 className="text-lg font-medium mb-2">{t('noTestRecords')}</h4>
            <p className="text-muted-foreground text-sm">{t('beTheFirst')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tierData.map((tier) => (
              <div
                key={tier.controller_name}
                className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center font-bold border",
                  getTierColor(tier.avg_score)
                )}>
                  {getTierLabel(tier.avg_score, language)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{tier.controller_name}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                      {tier.controller_type}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {tier.test_count} {t('tests')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-muted-foreground">{t('avgScore')}</div>
                  <div className="text-xl font-mono font-bold text-primary">{tier.avg_score}</div>
                </div>

                <div className="text-right hidden sm:block">
                  <div className="text-sm text-muted-foreground">{t('bestScore')}</div>
                  <div className="text-xl font-mono font-bold text-success">{tier.best_score}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Tests */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('recentTests')}</h3>
        </div>

        {recentTests.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            {t('noTestRecords')}
          </div>
        ) : (
          <div className="space-y-2">
            {recentTests.map((test) => (
              <div
                key={test.id}
                className="flex items-center justify-between py-3 px-4 bg-muted/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center text-xs font-bold border",
                    getTierColor(test.overall_score)
                  )}>
                    {getTierLabel(test.overall_score, language)}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{test.controller_name}</div>
                    <div className="text-xs text-muted-foreground">{test.controller_type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-primary">{test.overall_score}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(test.tested_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

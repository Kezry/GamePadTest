import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GamepadState, GamepadInfo } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Save, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SaveTestButtonProps {
  gamepad: GamepadState | null;
  gamepadInfo: GamepadInfo | null;
  buttonsTested: number;
  buttonsPassed: number;
  leftDrift: number;
  rightDrift: number;
  vibrationTested: boolean;
}

/**
 * Calculates an overall score (0-100) based on test results
 * Score breakdown:
 * - Base: 50 points
 * - Button pass rate: up to 30 points
 * - Drift penalty/reward: -10 to +20 points
 * - Vibration bonus: +10 points (if supported and tested)
 */
const calculateScore = (
  gamepad: GamepadState | null,
  gamepadInfo: GamepadInfo | null,
  buttonsTested: number,
  buttonsPassed: number,
  leftDrift: number,
  rightDrift: number,
  vibrationTested: boolean
): number => {
  if (!gamepad || !gamepadInfo) return 0;

  let score = 50;

  if (buttonsTested > 0) {
    score += Math.round((buttonsPassed / buttonsTested) * 30);
  }

  const avgDrift = (leftDrift + rightDrift) / 2;
  if (avgDrift < 0.05) score += 20;
  else if (avgDrift < 0.1) score += 10;
  else if (avgDrift < 0.15) score += 5;
  else score -= 10;

  if (gamepadInfo.hasVibration && vibrationTested) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
};

/**
 * SaveTestButton component for saving test results to Supabase
 * Displays saving state and success confirmation
 */
export const SaveTestButton = ({
  gamepad,
  gamepadInfo,
  buttonsTested,
  buttonsPassed,
  leftDrift,
  rightDrift,
  vibrationTested,
}: SaveTestButtonProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /**
   * Handles saving test results to the database
   * Shows toast notifications for success/failure states
   */
  const handleSave = async () => {
    if (!gamepad || !gamepadInfo) return;

    setSaving(true);

    try {
      const score = calculateScore(
        gamepad,
        gamepadInfo,
        buttonsTested,
        buttonsPassed,
        leftDrift,
        rightDrift,
        vibrationTested
      );

      const { error } = await supabase.from('test_records').insert({
        controller_name: gamepadInfo.name,
        controller_type: gamepadInfo.type,
        controller_id: gamepad.id,
        button_count: gamepad.buttons.length,
        axes_count: gamepad.axes.length,
        buttons_tested: buttonsTested,
        buttons_passed: buttonsPassed,
        joystick_drift_left: leftDrift,
        joystick_drift_right: rightDrift,
        vibration_supported: gamepadInfo.hasVibration,
        vibration_tested: vibrationTested,
        overall_score: score,
      });

      if (error) throw error;

      setSaved(true);
      toast.success(t('testSavedSuccess'));

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving test:', error);
      toast.error('Failed to save test record');
    } finally {
      setSaving(false);
    }
  };

  if (!gamepad || !gamepadInfo) return null;

  return (
    <button
      onClick={handleSave}
      disabled={saving || saved}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
        saved
          ? "bg-success/20 text-success"
          : "bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
      )}
    >
      {saving ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('saving')}
        </>
      ) : saved ? (
        <>
          <Check className="w-4 h-4" />
          {t('testSaved')}
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          {t('saveTest')}
        </>
      )}
    </button>
  );
};

import { useState, useCallback } from 'react';
import { useGamepad } from '@/hooks/useGamepad';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { Header } from '@/components/Header';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { ButtonTester } from '@/components/ButtonTester';
import { JoystickTester } from '@/components/JoystickTester';
import { VibrationTester } from '@/components/VibrationTester';
import { VibrationScenePlayer } from '@/components/VibrationScenePlayer';
import { LatencyTester } from '@/components/LatencyTester';
import { DeadzoneTester } from '@/components/DeadzoneTester';
import { GyroscopeTester } from '@/components/GyroscopeTester';
import { ConnectionStabilityTester } from '@/components/ConnectionStabilityTester';
import { TestingTabs } from '@/components/TestingTabs';
import { CompatibilityInfo } from '@/components/CompatibilityInfo';
import { Rankings } from '@/components/Rankings';
import { SaveTestButton } from '@/components/SaveTestButton';
import { SampleRateControl } from '@/components/SampleRateControl';

const IndexContent = () => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const {
    gamepads,
    gamepadInfos,
    activeGamepad,
    setActiveGamepad,
    currentGamepad,
    gamepadInfo,
    triggerVibration,
    isSupported,
  } = useGamepad();

  const [activeTab, setActiveTab] = useState('buttons');
  const [buttonsTested, setButtonsTested] = useState(0);
  const [buttonsPassed, setButtonsPassed] = useState(0);
  const [leftDrift, setLeftDrift] = useState(0);
  const [rightDrift, setRightDrift] = useState(0);
  const [vibrationTested, setVibrationTested] = useState(false);
  const [sampleRate, setSampleRate] = useState(60);

  const handleButtonsUpdate = useCallback((tested: number, passed: number) => {
    setButtonsTested(tested);
    setButtonsPassed(passed);
  }, []);

  const handleDriftUpdate = useCallback((left: number, right: number) => {
    setLeftDrift(left);
    setRightDrift(right);
  }, []);

  const handleVibrationTested = useCallback(() => {
    setVibrationTested(true);
  }, []);

  const handleSelectGamepad = useCallback((index: number) => {
    setActiveGamepad(index);
    setButtonsTested(0);
    setButtonsPassed(0);
    setLeftDrift(0);
    setRightDrift(0);
    setVibrationTested(false);
  }, [setActiveGamepad]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Connection Status with Save Button */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <ConnectionStatus
                gamepad={currentGamepad}
                gamepadInfo={gamepadInfo}
                gamepads={gamepads}
                gamepadInfos={gamepadInfos}
                activeGamepad={activeGamepad}
                onSelectGamepad={handleSelectGamepad}
                gamepadSupported={isSupported}
              />
            </div>
            {currentGamepad && (
              <div className="pt-6">
                <SaveTestButton
                  gamepad={currentGamepad}
                  gamepadInfo={gamepadInfo}
                  buttonsTested={buttonsTested}
                  buttonsPassed={buttonsPassed}
                  leftDrift={leftDrift}
                  rightDrift={rightDrift}
                  vibrationTested={vibrationTested}
                />
              </div>
            )}
          </div>
        </div>

        {/* Testing Area */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-8">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 gap-4">
            <TestingTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              gamepadConnected={currentGamepad !== null}
            />
            <SampleRateControl sampleRate={sampleRate} onSampleRateChange={setSampleRate} />
          </div>
          
          <div className="p-6">
            {activeTab === 'buttons' && (
              <ButtonTester 
                gamepad={currentGamepad} 
                gamepadInfo={gamepadInfo}
                sampleRate={sampleRate}
                onButtonsUpdate={handleButtonsUpdate}
              />
            )}
            {activeTab === 'joysticks' && (
              <JoystickTester 
                gamepad={currentGamepad}
                sampleRate={sampleRate}
                onDriftUpdate={handleDriftUpdate}
              />
            )}
            {activeTab === 'vibration' && (
              <VibrationTester
                gamepad={currentGamepad}
                gamepadInfo={gamepadInfo}
                activeGamepad={activeGamepad}
                onTriggerVibration={triggerVibration}
                onVibrationTested={handleVibrationTested}
              />
            )}
            {activeTab === 'scenes' && (
              <VibrationScenePlayer
                gamepad={currentGamepad}
                gamepadInfo={gamepadInfo}
                activeGamepad={activeGamepad}
              />
            )}
            {activeTab === 'latency' && (
              <LatencyTester
                gamepad={currentGamepad}
                activeGamepad={activeGamepad}
                sampleRate={sampleRate}
              />
            )}
            {activeTab === 'deadzone' && (
              <DeadzoneTester
                gamepad={currentGamepad}
                sampleRate={sampleRate}
              />
            )}
            {activeTab === 'gyroscope' && (
              <GyroscopeTester
                gamepad={currentGamepad}
                gamepadInfo={gamepadInfo}
                sampleRate={sampleRate}
              />
            )}
            {activeTab === 'stability' && (
              <ConnectionStabilityTester
                gamepad={currentGamepad}
                gamepadInfo={gamepadInfo}
                sampleRate={sampleRate}
              />
            )}
            {activeTab === 'rankings' && (
              <Rankings />
            )}
          </div>
        </div>

        {/* Compatibility Info */}
        <CompatibilityInfo />

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>{t('footerTitle')}</p>
          <p className="mt-1 text-xs">{t('footerSubtitle')}</p>
        </footer>
      </main>
    </div>
  );
};

const Index = () => {
  return (
    <LanguageProvider>
      <IndexContent />
    </LanguageProvider>
  );
};

export default Index;
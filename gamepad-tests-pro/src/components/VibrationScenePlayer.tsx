import { useState, useCallback, useRef, useEffect } from 'react';
import { GamepadState, GamepadInfo, ExtendedGamepad } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Play, Square, RotateCcw, Save, Trash2, Plus, ChevronUp, Zap, RotateCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VibrationScenePlayerProps {
  gamepad: GamepadState | null;
  gamepadInfo: GamepadInfo | null;
  activeGamepad: number | null;
}

interface VibrationStep {
  strong: number;
  weak: number;
  duration: number; // ms
  subtitle?: string;
}

interface VibrationScene {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  category: 'game' | 'life' | 'custom';
  totalDuration: number;
  steps: VibrationStep[];
}

interface CustomScene extends VibrationScene {
  createdAt: number;
}

type SceneGenerator = () => VibrationStep[];

type SceneStepGenerator = (elapsedMs: number, totalDuration: number) => VibrationStep;

interface SceneDefinition {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  category: 'game' | 'life' | 'custom' | 'quick';
  totalDuration: number;
  generateSteps: SceneGenerator;
  // Lazy mode: generate step on demand instead of pre-generating all steps
  type?: 'eager' | 'lazy';
  getStepAt?: SceneStepGenerator;
}

interface WaveformPoint {
  strong: number;
  weak: number;
  time: number;
}

// 马达类型
type MotorType = 'linear' | 'rotor';

// 步长常量 - 10ms精度
const STEP_DURATION = 10; // ms
const TOTAL_DURATION = 120000; // 2分钟
const TOTAL_STEPS = TOTAL_DURATION / STEP_DURATION; // 12000步

// 辅助函数：创建连续震动曲线
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

// 10ms精度场景定义
const SCENE_DEFINITIONS: SceneDefinition[] = [
  {
    id: 'morning_alarm',
    name: 'Morning Wake Up',
    nameZh: '晨间唤醒',
    description: 'Ultra-smooth wake up vibration (10ms precision)',
    descriptionZh: '超平滑唤醒振动（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS; // 0-1 over 2 minutes
        const ms = i * STEP_DURATION;
        
        // 多层波浪叠加
        const wave1 = Math.sin(t * Math.PI * 60) * 0.08; // 30秒周期
        const wave2 = Math.sin(t * Math.PI * 120) * 0.05; // 15秒周期
        const wave3 = Math.sin(t * Math.PI * 600) * 0.03; // 3秒周期
        const micro = Math.sin(i * 0.5) * 0.02; // 高频微振
        
        // 整体强度递增
        const base = smoothstep(t) * 0.70;
        
        // 节奏脉冲 (后半段)
        const pulsePhase = (i % 200) / 200;
        const pulse = t > 0.5 ? Math.sin(pulsePhase * Math.PI * 2) * 0.15 * (t - 0.5) * 2 : 0;
        
        const strong = clamp(0.05 + base + wave1 + wave2 + micro + pulse);
        const weak = clamp(0.08 + base + wave1 + wave3 + micro + pulse * 0.8);
        
        steps.push({
          strong, weak, duration: STEP_DURATION,
          subtitle: ms === 0 ? '开始轻柔唤醒...' : 
                   ms === 30000 ? '振动逐渐增强...' :
                   ms === 60000 ? '进入节奏阶段' :
                   ms === 90000 ? '最终唤醒阶段' :
                   ms === 115000 ? '即将完成!' : undefined,
        });
      }
      return steps;
    },
  },
  {
    id: 'racing_simulation',
    name: 'Racing Experience',
    nameZh: '赛车体验',
    description: 'Realistic engine rumble & road feel (10ms precision)',
    descriptionZh: '逼真引擎轰鸣与路面质感（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS;
        const ms = i * STEP_DURATION;
        const sec = ms / 1000;
        
        let strong = 0, weak = 0;
        
        if (sec < 10) {
          // 引擎启动 0-10s
          const startT = sec / 10;
          const rpm = startT * startT;
          const engineVib = Math.sin(i * (0.3 + rpm * 1.5)) * 0.12;
          const idle = Math.sin(i * 0.8) * 0.05;
          strong = 0.08 + rpm * 0.35 + engineVib;
          weak = 0.12 + rpm * 0.30 + idle;
        } else if (sec < 30) {
          // 巡航 10-30s
          const cruiseT = (sec - 10) / 20;
          const roadTex = Math.sin(i * 0.15) * 0.06 + Math.sin(i * 0.4) * 0.04;
          const engine = Math.sin(i * 1.2) * 0.05;
          const bump = ((i % 500) < 30) ? 0.18 * (1 - (i % 500) / 30) : 0;
          strong = 0.28 + roadTex + engine + bump;
          weak = 0.38 + roadTex * 0.8 + engine + bump * 0.7;
        } else if (sec < 50) {
          // 加速+颠簸 30-50s
          const accelT = (sec - 30) / 20;
          const accel = 0.40 + accelT * 0.25;
          const roadBump = Math.sin(i * 0.8) * 0.08 + ((i % 80) < 20 ? 0.15 : 0);
          const engineStrain = Math.sin(i * 2) * 0.08;
          strong = accel + roadBump + engineStrain;
          weak = accel + 0.08 + roadBump * 0.7 + engineStrain * 0.8;
        } else if (sec < 70) {
          // 漂移 50-70s
          const driftT = (sec - 50) / 20;
          const drift = Math.sin(i * 0.02) * 0.25; // 慢速左右摇摆
          const tireScreech = 0.50 + Math.sin(i * 3) * 0.12;
          const sparks = ((i % 150) < 20) ? 0.20 * (1 - (i % 150) / 20) : 0;
          strong = tireScreech + Math.abs(drift) + sparks;
          weak = tireScreech * 0.85 + Math.abs(drift) * 0.8;
        } else if (sec < 90) {
          // 激烈竞速 70-90s
          const raceT = (sec - 70) / 20;
          const baseSpeed = 0.55 + raceT * 0.15;
          const enginePulse = Math.sin(i * 2.5) * 0.10;
          const overtake = ((i % 300) < 50) ? 0.25 * smoothstep((i % 300) / 50) : 0;
          const collision = ((i % 450) < 30) ? 0.35 * (1 - (i % 450) / 30) : 0;
          strong = clamp(baseSpeed + enginePulse + overtake + collision);
          weak = clamp(baseSpeed + 0.10 + enginePulse * 0.8 + overtake * 0.7);
        } else if (sec < 110) {
          // 冲刺 90-110s
          const sprintT = (sec - 90) / 20;
          const sprint = 0.65 + sprintT * 0.25;
          const curb = ((i % 120) < 40) ? 0.15 * Math.sin((i % 120) / 40 * Math.PI) : 0;
          const engineMax = Math.sin(i * 3) * 0.06;
          strong = clamp(sprint + curb + engineMax);
          weak = clamp(sprint + 0.08 + curb * 0.8);
        } else {
          // 冲线减速 110-120s
          const finishT = (sec - 110) / 10;
          const decel = 0.90 - finishT * 0.65;
          const brake = (1 - finishT) * Math.sin(i * 2) * 0.10;
          strong = decel + brake;
          weak = decel * 0.9 + brake * 0.8;
        }
        
        steps.push({
          strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION,
          subtitle: ms === 0 ? '引擎启动中...' :
                   ms === 10000 ? '开始巡航' :
                   ms === 30000 ? '踩下油门!' :
                   ms === 50000 ? '漂移中!' :
                   ms === 70000 ? '激烈竞速!' :
                   ms === 90000 ? '最后冲刺!' :
                   ms === 110000 ? '冲过终点!' : undefined,
        });
      }
      return steps;
    },
  },
  {
     id: 'fps_battle',
     name: 'FPS Urban Assault',
     nameZh: 'FPS巷战突袭',
     description: 'Epic urban combat with explosions (10ms precision)',
     descriptionZh: '史诗级巷战（10ms精度）',
     category: 'game',
     totalDuration: TOTAL_DURATION,
     generateSteps: () => {
       const steps: VibrationStep[] = [];
       
       const events = {
         slowWalk: [0, 8000],
         run: [8000, 15000],
         spotted: [15000, 15300],
         aim: [15300, 17000],
         rifleAuto: [17000, 22000],
         reload1: [22000, 25000],
         enemy: [25000, 26000],
         pistol: [26000, 29000],
         throwGranade: [29000, 29500],
         explosion: [29500, 32000],
         indoorClear: [32000, 40000],
         hit: [40000, 40500],
         dodge: [40500, 45000],
         counter: [45000, 50000],
         exit: [50000, 55000],
         crouchShoot: [55000, 62000],
         jump: [62000, 62500],
         land: [62500, 63000],
         preciseShot: [63000, 70000],
         rush: [70000, 80000],
         grenade2: [80000, 81000],
         explosion2: [81000, 85000],
         finalPush: [85000, 100000],
         patrol: [100000, 115000],
         fadeOut: [115000, 120000],
       };
       
       for (let i = 0; i < TOTAL_STEPS; i++) {
         const ms = i * STEP_DURATION;
         let strong = 0, weak = 0, subtitle: string | undefined;
         
         if (ms < events.slowWalk[1]) {
           const footPhase = (i % 80);
           if (footPhase < 35) {
             strong = 0.20 + Math.sin(footPhase / 35 * Math.PI) * 0.12;
             weak = 0.25 + Math.sin(footPhase / 35 * Math.PI) * 0.10;
           } else {
             strong = 0.03; weak = 0.05;
           }
           if (ms === 0) subtitle = '潜行接近...';
         } else if (ms < events.run[1]) {
           const runVib = 0.40 + Math.sin(i * 0.6) * 0.15;
           strong = runVib; weak = runVib * 0.85;
           if (ms === 8000) subtitle = '冲锋!';
         } else if (ms < events.spotted[1]) {
           strong = 0.75; weak = 0.55;
           if (ms === 15000) subtitle = '发现敌人! 急停!';
         } else if (ms < events.aim[1]) {
           const breath = Math.sin(i * 0.8) * 0.05;
           strong = 0.15 + breath;
           weak = 0.18 + breath;
           if (ms === 15300) subtitle = '瞄准...';
         } else if (ms < events.rifleAuto[1]) {
           const shotPhase = (i - 1700) % 18;
           const recoilEscalation = Math.min(0.15, (ms - 17000) / 30000);
           if (shotPhase < 10) {
             strong = 0.75 + recoilEscalation + Math.sin(shotPhase * 0.5) * 0.10;
             weak = 0.70 + recoilEscalation + Math.sin(shotPhase * 0.5) * 0.08;
           } else {
             strong = 0.40 + recoilEscalation;
             weak = 0.35 + recoilEscalation;
           }
           if (ms === 17000) subtitle = '全自动射击!';
         } else if (ms < events.reload1[1]) {
           const reloadT = (ms - 22000) / 3000;
           const eject = reloadT < 0.15 ? 0.50 : 0;
           const magOut = reloadT > 0.4 && reloadT < 0.5 ? 0.25 : 0;
           const insert = reloadT > 0.7 ? 0.55 : 0;
           strong = 0.05 + eject + magOut + insert;
           weak = 0.08 + eject + magOut + insert;
           if (ms === 22000) subtitle = '换弹!';
         } else if (ms < events.enemy[1]) {
           strong = 0.85; weak = 0.50;
           if (ms === 25000) subtitle = '爆头!';
         } else if (ms < events.pistol[1]) {
           const pistolPhase = (ms - 26000) % 600;
           if (pistolPhase < 120) {
             strong = 0.60 - pistolPhase / 120 * 0.35;
             weak = 0.55 - pistolPhase / 120 * 0.30;
           } else {
             strong = 0.08; weak = 0.10;
           }
           if (ms === 26000) subtitle = '手枪补射!';
         } else if (ms < events.throwGranade[1]) {
           strong = 0.50; weak = 0.45;
           if (ms === 29000) subtitle = '手雷!';
         } else if (ms < events.explosion[1]) {
           const expT = (ms - 29500) / 2500;
           if (expT < 0.12) {
             strong = 1.0; weak = 0.95;
           } else if (expT < 0.4) {
             strong = (1.0 - (expT - 0.12) / 0.28) * 0.90;
             weak = (1.0 - (expT - 0.12) / 0.28) * 0.85;
           } else {
             strong = 0.20 * (1 - (expT - 0.4) / 0.6) + Math.sin(i * 0.8) * 0.10;
             weak = 0.18 * (1 - (expT - 0.4) / 0.6) + Math.sin(i * 0.8) * 0.08;
           }
           if (ms === 29500) subtitle = '轰!';
         } else if (ms < events.indoorClear[1]) {
           const burstPhase = (i - 3200) % 25;
           if (burstPhase < 12) {
             strong = 0.85 + Math.sin(burstPhase * 0.8) * 0.12;
             weak = 0.80 + Math.sin(burstPhase * 0.8) * 0.10;
           } else {
             strong = 0.35; weak = 0.30;
           }
           if (ms === 32000) subtitle = '清理房间!';
         } else if (ms < events.hit[1]) {
           strong = 0.95; weak = 0.60;
           if (ms === 40000) subtitle = '中弹!';
         } else if (ms < events.dodge[1]) {
           const dodgeVib = 0.35 + Math.sin(i * 0.5) * 0.12;
           strong = dodgeVib; weak = dodgeVib * 0.9;
           if (ms === 40500) subtitle = '闪避!';
         } else if (ms < events.counter[1]) {
           const counterPhase = (ms - 45000) % 400;
           if (counterPhase < 150) {
             strong = 0.70; weak = 0.65;
           } else {
             strong = 0.10; weak = 0.12;
           }
           if (ms === 45000) subtitle = '反击!';
         } else if (ms < events.exit[1]) {
           const walkVib = 0.25 + Math.sin(i * 0.4) * 0.08;
           strong = walkVib; weak = walkVib * 0.9;
           if (ms === 50000) subtitle = '撤离...';
         } else if (ms < events.crouchShoot[1]) {
           const crouchPhase = (ms - 55000) % 100;
           if (crouchPhase < 50) {
             strong = 0.30 + Math.sin(crouchPhase / 50 * Math.PI) * 0.10;
             weak = 0.35 + Math.sin(crouchPhase / 50 * Math.PI) * 0.08;
           } else {
             strong = 0.08; weak = 0.10;
           }
           if (ms === 55000) subtitle = '蹲射!';
         } else if (ms < events.jump[1]) {
           strong = 0.45; weak = 0.40;
           if (ms === 62000) subtitle = '起跳!';
         } else if (ms < events.land[1]) {
           strong = 0.80; weak = 0.70;
           if (ms === 62500) subtitle = '落地!';
         } else if (ms < events.preciseShot[1]) {
           const shotPhase = (ms - 63000) % 800;
           if (shotPhase < 100) {
             strong = 0.70; weak = 0.40;
           } else {
             strong = 0.05; weak = 0.08;
           }
           if (ms === 63000) subtitle = '精准射击!';
         } else if (ms < events.rush[1]) {
           const rushVib = 0.55 + Math.sin(i * 0.7) * 0.18;
           strong = rushVib; weak = rushVib * 0.88;
           if (ms === 70000) subtitle = '总攻!';
         } else if (ms < events.grenade2[1]) {
           strong = 0.50; weak = 0.45;
           if (ms === 80000) subtitle = '手雷!';
         } else if (ms < events.explosion2[1]) {
           const expT = (ms - 81000) / 4000;
           if (expT < 0.15) {
             strong = 1.0; weak = 0.95;
           } else {
             strong = 0.85 * (1 - expT) + Math.sin(i * 1.2) * 0.15;
             weak = 0.80 * (1 - expT) + Math.sin(i * 1.2) * 0.12;
           }
           if (ms === 81000) subtitle = '爆炸!';
         } else if (ms < events.finalPush[1]) {
           const burstPhase = (ms - 85000) % 180;
           if (burstPhase < 90) {
             strong = 0.90 + Math.sin(burstPhase * 0.3) * 0.08;
             weak = 0.85 + Math.sin(burstPhase * 0.3) * 0.06;
           } else {
             strong = 0.40; weak = 0.35;
           }
           if (ms === 85000) subtitle = '最终清扫!';
         } else if (ms < events.patrol[1]) {
           const patrolVib = 0.12 + Math.sin(i * 0.3) * 0.05;
           strong = patrolVib; weak = patrolVib * 1.1;
           if (ms === 100000) subtitle = '警戒中...';
         } else {
           const fadeT = (ms - 115000) / 5000;
           strong = 0.10 * (1 - fadeT);
           weak = 0.12 * (1 - fadeT);
           if (ms === 115000) subtitle = '任务完成!';
         }
         
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_sniper',
    name: 'FPS Sniper Mission',
    nameZh: 'FPS狙击任务',
    description: 'Sniper warfare simulation with long-range shots (10ms precision)',
    descriptionZh: '狙击战模拟，包含远程射击（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      const events = {
        prone: [0, 5000],
        breathing: [5000, 8000],
        windCheck: [8000, 10000],
        aim: [10000, 12000],
        shot1: [12000, 12200],
        recoil1: [12200, 12800],
        bolt: [12800, 14000],
        reAim: [14000, 18000],
        shot2: [18000, 18200],
        recoil2: [18200, 18800],
        bolt2: [18800, 20000],
        relocate: [20000, 25000],
        crouch: [25000, 26000],
        sideMove: [26000, 32000],
        ambush: [32000, 33000],
        closeShot: [33000, 33200],
        pistol: [33200, 36000],
        suppress: [36000, 40000],
        extract: [40000, 50000],
        fadeOut: [50000, 55000],
      };
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < events.prone[1]) {
          strong = 0.05; weak = 0.08;
          if (ms === 0) subtitle = '卧倒隐蔽...';
        } else if (ms < events.breathing[1]) {
          const breath = Math.sin(i * 0.15) * 0.08;
          strong = 0.12 + breath;
          weak = 0.15 + breath;
          if (ms === 5000) subtitle = '调整呼吸...';
        } else if (ms < events.windCheck[1]) {
          strong = 0.08 + Math.sin(i * 0.2) * 0.03;
          weak = 0.10 + Math.sin(i * 0.2) * 0.03;
          if (ms === 8000) subtitle = '判断风速...';
        } else if (ms < events.aim[1]) {
          const focus = Math.sin(i * 0.5) * 0.02;
          strong = 0.10 + focus;
          weak = 0.12 + focus;
          if (ms === 10000) subtitle = '瞄准目标!';
        } else if (ms < events.shot1[1]) {
          strong = 0.90; weak = 0.50;
          if (ms === 12000) subtitle = '射击!';
        } else if (ms < events.recoil1[1]) {
          const recT = (ms - 12000) / 600;
          strong = 0.60 * (1 - recT) + 0.05;
          weak = 0.35 * (1 - recT) + 0.08;
        } else if (ms < events.bolt[1]) {
          const boltT = (ms - 12800) / 1200;
          const click = boltT > 0.8 ? 0.15 : 0;
          strong = 0.10 + click;
          weak = 0.12 + click;
          if (ms === 12800) subtitle = '拉栓!';
        } else if (ms < events.reAim[1]) {
          const breathe = Math.sin(i * 0.12) * 0.06;
          strong = 0.08 + breathe;
          weak = 0.10 + breathe;
          if (ms === 14000) subtitle = '重新瞄准...';
        } else if (ms < events.shot2[1]) {
          strong = 0.92; weak = 0.52;
          if (ms === 18000) subtitle = '射击!';
        } else if (ms < events.recoil2[1]) {
          const recT = (ms - 18000) / 600;
          strong = 0.62 * (1 - recT) + 0.05;
          weak = 0.38 * (1 - recT) + 0.08;
        } else if (ms < events.bolt2[1]) {
          const click = (ms - 18800) > 1000 && (ms - 18800) < 1100 ? 0.15 : 0;
          strong = 0.10 + click;
          weak = 0.12 + click;
          if (ms === 18800) subtitle = '拉栓!';
        } else if (ms < events.relocate[1]) {
          const crawl = 0.25 + Math.sin(i * 0.3) * 0.08;
          strong = crawl; weak = crawl + 0.04;
          if (ms === 20000) subtitle = '转移阵地...';
        } else if (ms < events.crouch[1]) {
          strong = 0.35 - (ms - 25000) / 1000 * 0.30;
          weak = 0.40 - (ms - 25000) / 1000 * 0.35;
          if (ms === 25000) subtitle = '蹲起!';
        } else if (ms < events.sideMove[1]) {
          const step = Math.sin(i * 0.4) * 0.12;
          strong = 0.22 + Math.abs(step);
          weak = 0.25 + Math.abs(step) * 0.9;
          if (ms === 26000) subtitle = '侧向移动...';
        } else if (ms < events.ambush[1]) {
          strong = 0.85; weak = 0.48;
          if (ms === 32000) subtitle = '伏击!';
        } else if (ms < events.closeShot[1]) {
          strong = 0.95; weak = 0.55;
          if (ms === 33000) subtitle = '近距离射击!';
        } else if (ms < events.pistol[1]) {
          const shotPhase = (ms - 33200) % 400;
          if (shotPhase < 100) {
            strong = 0.55; weak = 0.32;
          } else {
            strong = 0.08; weak = 0.10;
          }
          if (ms === 33200) subtitle = '手枪射击!';
        } else if (ms < events.suppress[1]) {
          const suppress = 0.45 + Math.sin(i * 0.5) * 0.10;
          strong = suppress; weak = suppress * 0.85;
          if (ms === 36000) subtitle = '压制射击!';
        } else if (ms < events.extract[1]) {
          const run = 0.35 + Math.sin(i * 0.6) * 0.10;
          strong = run; weak = run * 0.9;
          if (ms === 40000) subtitle = '撤离!';
        } else if (ms < 60000) {
          // 第二狙击阵地
          const crawl2 = 0.22 + Math.sin(i * 0.25) * 0.07;
          strong = crawl2; weak = crawl2 + 0.04;
          if (ms === 50000) subtitle = '寻找新阵地...';
        } else if (ms < 65000) {
          strong = 0.10 + Math.sin(i * 0.5) * 0.02;
          weak = 0.12 + Math.sin(i * 0.5) * 0.02;
          if (ms === 60000) subtitle = '架枪...';
        } else if (ms < 66000) {
          strong = 0.92; weak = 0.52;
          if (ms === 65000) subtitle = '射击!';
        } else if (ms < 67000) {
          const recT = (ms - 65000) / 600;
          strong = 0.62 * (1 - recT) + 0.05;
          weak = 0.38 * (1 - recT) + 0.08;
        } else if (ms < 70000) {
          const click = (ms - 67000) > 1000 && (ms - 67000) < 1100 ? 0.15 : 0;
          strong = 0.10 + click; weak = 0.12 + click;
          if (ms === 67000) subtitle = '拉栓!';
        } else if (ms < 78000) {
          const longWait = Math.sin(i * 0.1) * 0.04 + 0.06;
          strong = longWait; weak = longWait + 0.03;
          if (ms === 70000) subtitle = '等待目标...';
        } else if (ms < 79000) {
          strong = 0.95; weak = 0.55;
          if (ms === 78000) subtitle = '远程射击!';
        } else if (ms < 85000) {
          const relocate2 = 0.28 + Math.sin(i * 0.35) * 0.08;
          strong = relocate2; weak = relocate2 + 0.04;
          if (ms === 79000) subtitle = '再次转移...';
        } else if (ms < 90000) {
          // 反狙击手交战
          const counterSnipe = Math.sin(i * 0.2) * 0.05 + 0.08;
          strong = counterSnipe; weak = counterSnipe + 0.02;
          if (ms === 85000) subtitle = '敌方狙击手!';
        } else if (ms < 91000) {
          strong = 0.90; weak = 0.50;
          if (ms === 90000) subtitle = '反击!';
        } else if (ms < 95000) {
          const dodge2 = 0.35 + Math.sin(i * 0.5) * 0.10;
          strong = dodge2; weak = dodge2 * 0.9;
          if (ms === 91000) subtitle = '闪避!';
        } else if (ms < 105000) {
          const finalExtract = 0.40 + Math.sin(i * 0.55) * 0.10;
          strong = finalExtract; weak = finalExtract * 0.88;
          if (ms === 95000) subtitle = '最终撤离!';
        } else if (ms < 110000) {
          const fadeOut = 0.20 * (1 - (ms - 105000) / 5000);
          strong = fadeOut; weak = fadeOut * 1.1;
          if (ms === 105000) subtitle = '安全撤离!';
        } else {
          const fadeT = (ms - 110000) / 10000;
          strong = 0.15 * (1 - fadeT);
          weak = 0.18 * (1 - fadeT);
          if (ms === 110000) subtitle = '任务完成!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_riot',
    name: 'FPS CQC Urban',
    nameZh: 'FPS城区CQC',
    description: 'Close quarters combat in urban environment (10ms precision)',
    descriptionZh: '城区近距离战斗（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        // CQC场景：踢门、近战、冲锋枪扫射
        if (ms < 3000) {
          strong = 0.08; weak = 0.10;
          if (ms === 0) subtitle = '接近目标...';
        } else if (ms < 4000) {
          strong = 0.90; weak = 0.50;
          if (ms === 3000) subtitle = '踢门!';
        } else if (ms < 4500) {
          strong = 0.12 + Math.random() * 0.08;
          weak = 0.15 + Math.random() * 0.06;
          if (ms === 4000) subtitle = '门框碎片!';
        } else if (ms < 8000) {
          const smg = (ms - 4500) % 180;
          if (smg < 80) {
            strong = 0.70 + Math.sin(smg * 0.2) * 0.08;
            weak = 0.65 + Math.sin(smg * 0.2) * 0.06;
          } else {
            strong = 0.30; weak = 0.25;
          }
          if (ms === 4500) subtitle = 'SMG扫射!';
        } else if (ms < 9000) {
          strong = 0.55; weak = 0.85;
          if (ms === 8000) subtitle = '近战!';
        } else if (ms < 9500) {
          const hit = 0.65 * (1 - (ms - 9000) / 500);
          strong = hit; weak = hit * 0.9;
          if (ms === 9000) subtitle = '击倒!';
        } else if (ms < 13000) {
          const move = 0.28 + Math.sin(i * 0.5) * 0.08;
          strong = move; weak = move + 0.03;
          if (ms === 9500) subtitle = '推进...';
        } else if (ms < 14000) {
          strong = 0.88; weak = 0.50;
          if (ms === 13000) subtitle = '踢门2!';
        } else if (ms < 18000) {
          const spray = (ms - 14000) % 200;
          if (spray < 100) {
            strong = 0.75 + Math.sin(spray * 0.15) * 0.10;
            weak = 0.70 + Math.sin(spray * 0.15) * 0.08;
          } else {
            strong = 0.35; weak = 0.30;
          }
          if (ms === 14000) subtitle = '扫射!';
        } else if (ms < 18500) {
          strong = 0.60 * (1 - (ms - 18000) / 500);
          weak = 0.55 * (1 - (ms - 18000) / 500);
          if (ms === 18000) subtitle = '敌人击倒!';
        } else if (ms < 22000) {
          const crouch = 0.22 + Math.sin(i * 0.3) * 0.05;
          strong = crouch; weak = crouch + 0.03;
          if (ms === 18500) subtitle = '蹲伏观察...';
        } else if (ms < 25000) {
          const sprint = 0.45 + Math.sin(i * 0.7) * 0.12;
          strong = sprint; weak = sprint * 0.9;
          if (ms === 22000) subtitle = '冲刺!';
        } else if (ms < 30000) {
          const stop = 0.65 + Math.sin((ms - 25000) / 200 * Math.PI) * 0.20;
          strong = stop; weak = stop * 0.9;
          if (ms === 25000) subtitle = '急停!';
        } else if (ms < 35000) {
          const burst = (ms - 30000) % 300;
          if (burst < 150) {
            strong = 0.72 + Math.sin(burst * 0.2) * 0.08;
            weak = 0.68 + Math.sin(burst * 0.2) * 0.06;
          } else {
            strong = 0.30; weak = 0.25;
          }
          if (ms === 30000) subtitle = '点射!';
        } else if (ms < 40000) {
          const walk = 0.20 + Math.sin(i * 0.35) * 0.06;
          strong = walk; weak = walk + 0.03;
          if (ms === 35000) subtitle = '清理房间...';
        } else if (ms < 45000) {
          const flash = Math.sin(i * 1.5) * 0.15 + 0.50;
          strong = flash; weak = flash;
          if (ms === 40000) subtitle = '闪光弹!';
        } else if (ms < 50000) {
          const fight = 0.55 + Math.sin(i * 0.8) * 0.15;
          strong = fight; weak = fight * 0.9;
          if (ms === 45000) subtitle = '混战!';
        } else if (ms < 58000) {
          // 楼梯推进
          const stairs = 0.40 + Math.sin(i * 0.45) * 0.10;
          strong = stairs; weak = stairs + 0.04;
          if (ms === 50000) subtitle = '上楼...';
        } else if (ms < 62000) {
          const breach3 = 0.88; weak = 0.48;
          strong = breach3; weak = breach3 * 0.9;
          if (ms === 58000) subtitle = '踢门!';
        } else if (ms < 70000) {
          const smg2 = (ms - 62000) % 180;
          if (smg2 < 80) {
            strong = 0.72 + Math.sin(smg2 * 0.2) * 0.08;
            weak = 0.68 + Math.sin(smg2 * 0.2) * 0.06;
          } else {
            strong = 0.28; weak = 0.24;
          }
          if (ms === 62000) subtitle = '扫射!';
        } else if (ms < 78000) {
          // 天台战斗
          const rooftop = 0.50 + Math.sin(i * 0.6) * 0.12;
          strong = rooftop; weak = rooftop * 0.88;
          if (ms === 70000) subtitle = '天台战斗!';
        } else if (ms < 82000) {
          strong = 0.55; weak = 0.85;
          if (ms === 78000) subtitle = '近战!';
        } else if (ms < 90000) {
          const rappel = 0.35 + Math.sin(i * 0.3) * 0.08;
          strong = rappel; weak = rappel + 0.03;
          if (ms === 82000) subtitle = '绳降...';
        } else if (ms < 98000) {
          const finalSweep = (ms - 90000) % 300;
          if (finalSweep < 120) {
            strong = 0.70 + Math.sin(finalSweep * 0.18) * 0.10;
            weak = 0.65 + Math.sin(finalSweep * 0.18) * 0.08;
          } else {
            strong = 0.25; weak = 0.22;
          }
          if (ms === 90000) subtitle = '最后清扫!';
        } else if (ms < 110000) {
          const extract = 0.45 + Math.sin(i * 0.5) * 0.10;
          strong = extract; weak = extract * 0.90;
          if (ms === 98000) subtitle = '撤离区域!';
        } else {
          const fade = 0.15 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade * 1.1;
          if (ms === 110000) subtitle = '清场完毕!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_demolition',
    name: 'FPS Bomb Defusal',
    nameZh: 'FPS拆弹专家',
    description: 'High stakes bomb defusal mission (10ms precision)',
    descriptionZh: '高风险拆弹任务（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 5000) {
          strong = 0.05; weak = 0.08;
          if (ms === 0) subtitle = '抵达现场...';
        } else if (ms < 8000) {
          const timer = Math.sin(i * 0.3) * 0.05 + 0.35;
          strong = timer; weak = timer * 1.2;
          if (ms === 5000) subtitle = '炸弹计时中!';
        } else if (ms < 10000) {
          strong = 0.08; weak = 0.10;
          if (ms === 8000) subtitle = '扫描电线...';
        } else if (ms < 12000) {
          const cut = Math.sin((ms - 10000) / 2000 * Math.PI * 8) * 0.15 + 0.45;
          strong = cut; weak = cut * 0.9;
          if (ms === 10000) subtitle = '剪红线!';
        } else if (ms < 14000) {
          const wrong = 0.80 + Math.sin((ms - 12000) / 2000 * Math.PI * 15) * 0.15;
          strong = wrong; weak = 0.90;
          if (ms === 12000) subtitle = '错误! 回退!';
        } else if (ms < 16000) {
          strong = 0.08; weak = 0.10;
          if (ms === 14000) subtitle = '重新扫描...';
        } else if (ms < 18000) {
          const cut2 = Math.sin((ms - 16000) / 2000 * Math.PI * 10) * 0.12 + 0.40;
          strong = cut2; weak = cut2 * 0.85;
          if (ms === 16000) subtitle = '剪蓝线!';
        } else if (ms < 22000) {
          strong = 0.05; weak = 0.08;
          if (ms === 18000) subtitle = '检查引爆器...';
        } else if (ms < 24000) {
          const disarm = 0.55 + Math.sin((ms - 22000) / 2000 * Math.PI * 6) * 0.20;
          strong = disarm; weak = disarm * 0.9;
          if (ms === 22000) subtitle = '拆除引爆器!';
        } else if (ms < 26000) {
          const pulse = Math.sin(i * 0.4) * 0.08 + 0.25;
          strong = pulse; weak = pulse * 1.1;
          if (ms === 24000) subtitle = '炸弹解除中...';
        } else if (ms < 28000) {
          const success = 0.60 + Math.sin((ms - 26000) / 2000 * Math.PI) * 0.25;
          strong = success; weak = success * 0.95;
          if (ms === 26000) subtitle = '成功拆除!';
        } else if (ms < 35000) {
          const walk = 0.22 + Math.sin(i * 0.4) * 0.06;
          strong = walk; weak = walk + 0.03;
          if (ms === 28000) subtitle = '撤离现场...';
        } else if (ms < 42000) {
          // 发现第二枚炸弹
          strong = 0.08; weak = 0.10;
          if (ms === 35000) subtitle = '发现第二枚炸弹!';
        } else if (ms < 48000) {
          const scan2 = Math.sin(i * 0.3) * 0.05 + 0.30;
          strong = scan2; weak = scan2 * 1.2;
          if (ms === 42000) subtitle = '扫描第二枚...';
        } else if (ms < 52000) {
          const cut3 = Math.sin((ms - 48000) / 4000 * Math.PI * 8) * 0.12 + 0.40;
          strong = cut3; weak = cut3 * 0.85;
          if (ms === 48000) subtitle = '剪线!';
        } else if (ms < 56000) {
          const disarm2 = 0.55 + Math.sin((ms - 52000) / 4000 * Math.PI * 6) * 0.18;
          strong = disarm2; weak = disarm2 * 0.90;
          if (ms === 52000) subtitle = '拆除引爆器!';
        } else if (ms < 60000) {
          const pulse = Math.sin(i * 0.4) * 0.08 + 0.25;
          strong = pulse; weak = pulse * 1.1;
          if (ms === 56000) subtitle = '拆除中...';
        } else if (ms < 65000) {
          const success2 = 0.60 + Math.sin((ms - 60000) / 5000 * Math.PI) * 0.22;
          strong = success2; weak = success2 * 0.95;
          if (ms === 60000) subtitle = '第二枚拆除!';
        } else if (ms < 72000) {
          const sweep = 0.25 + Math.sin(i * 0.35) * 0.07;
          strong = sweep; weak = sweep + 0.03;
          if (ms === 65000) subtitle = '搜索区域...';
        } else if (ms < 80000) {
          const detect = Math.sin(i * 0.5) * 0.15 + 0.35;
          strong = detect; weak = detect * 1.1;
          if (ms === 72000) subtitle = '检测到信号!';
        } else if (ms < 88000) {
          const disarm3 = 0.50 + Math.sin((ms - 80000) / 8000 * Math.PI * 5) * 0.15;
          strong = disarm3; weak = disarm3 * 0.88;
          if (ms === 80000) subtitle = '拆除第三枚!';
        } else if (ms < 95000) {
          const eodArrive = 0.35 + Math.sin(i * 0.3) * 0.08;
          strong = eodArrive; weak = eodArrive + 0.03;
          if (ms === 88000) subtitle = 'EOD 队伍到达!';
        } else if (ms < 105000) {
          const transport = 0.40 + Math.sin(i * 0.5) * 0.10;
          strong = transport; weak = transport * 0.92;
          if (ms === 95000) subtitle = '护送撤离...';
        } else if (ms < 110000) {
          const safe = 0.20 + Math.sin((ms - 105000) / 5000 * Math.PI) * 0.10;
          strong = safe; weak = safe * 1.05;
          if (ms === 105000) subtitle = '抵达安全区!';
        } else {
          const fade = 0.12 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade * 1.1;
          if (ms === 110000) subtitle = '所有炸弹拆除!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_hostage_rescue',
    name: 'FPS Hostage Rescue',
    nameZh: 'FPS人质救援',
    description: 'Tactical hostage rescue operation (10ms precision)',
    descriptionZh: '战术人质救援行动（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 4000) {
          const sneak = 0.12 + Math.sin(i * 0.25) * 0.04;
          strong = sneak; weak = sneak + 0.02;
          if (ms === 0) subtitle = '潜入...';
        } else if (ms < 5000) {
          strong = 0.85; weak = 0.45;
          if (ms === 4000) subtitle = '破门!';
        } else if (ms < 7000) {
          const flash = 0.70 + Math.sin(i * 1.2) * 0.20;
          strong = flash; weak = flash;
          if (ms === 5000) subtitle = '闪光弹!';
        } else if (ms < 10000) {
          const burst = (ms - 7000) % 250;
          if (burst < 120) {
            strong = 0.68 + Math.sin(burst * 0.15) * 0.08;
            weak = 0.63 + Math.sin(burst * 0.15) * 0.06;
          } else {
            strong = 0.25; weak = 0.22;
          }
          if (ms === 7000) subtitle = '击毙恐怖分子!';
        } else if (ms < 12000) {
          strong = 0.05; weak = 0.08;
          if (ms === 10000) subtitle = '寻找人质...';
        } else if (ms < 14000) {
          const comfort = 0.35 + Math.sin(i * 0.3) * 0.08;
          strong = comfort; weak = comfort * 1.1;
          if (ms === 12000) subtitle = '安抚人质!';
        } else if (ms < 18000) {
          const cut = 0.45 + Math.sin((ms - 14000) / 4000 * Math.PI * 5) * 0.15;
          strong = cut; weak = cut * 0.9;
          if (ms === 14000) subtitle = '解开绳索!';
        } else if (ms < 22000) {
          const escort = 0.28 + Math.sin(i * 0.35) * 0.07;
          strong = escort; weak = escort + 0.03;
          if (ms === 18000) subtitle = '护送人质...';
        } else if (ms < 25000) {
          const shot = (ms - 22000) % 500;
          if (shot < 100) {
            strong = 0.55; weak = 0.30;
          } else if (shot < 200) {
            strong = 0.08; weak = 0.10;
          }
          if (ms === 22000) subtitle = '掩护射击!';
        } else if (ms < 30000) {
          const carry = 0.40 + Math.sin(i * 0.5) * 0.10;
          strong = carry; weak = carry * 0.95;
          if (ms === 25000) subtitle = '抱起人质!';
        } else if (ms < 38000) {
          const run = 0.50 + Math.sin(i * 0.65) * 0.12;
          strong = run; weak = run * 0.88;
          if (ms === 30000) subtitle = '紧急撤离!';
        } else if (ms < 45000) {
          const arrive = 0.25 + Math.sin((ms - 38000) / 7000 * Math.PI) * 0.10;
          strong = arrive; weak = arrive * 1.05;
          if (ms === 38000) subtitle = '抵达安全区!';
        } else if (ms < 52000) {
          strong = 0.05; weak = 0.08;
          if (ms === 45000) subtitle = '发现第二名人质!';
        } else if (ms < 56000) {
          strong = 0.85; weak = 0.45;
          if (ms === 52000) subtitle = '第二次破门!';
        } else if (ms < 60000) {
          const flash2 = 0.68 + Math.sin(i * 1.3) * 0.18;
          strong = flash2; weak = flash2;
          if (ms === 56000) subtitle = '闪光弹!';
        } else if (ms < 68000) {
          const fight2 = (ms - 60000) % 250;
          if (fight2 < 120) {
            strong = 0.72 + Math.sin(fight2 * 0.16) * 0.10;
            weak = 0.68 + Math.sin(fight2 * 0.16) * 0.08;
          } else {
            strong = 0.28; weak = 0.25;
          }
          if (ms === 60000) subtitle = '清除威胁!';
        } else if (ms < 75000) {
          const untie2 = 0.42 + Math.sin((ms - 68000) / 7000 * Math.PI * 4) * 0.12;
          strong = untie2; weak = untie2 * 0.90;
          if (ms === 68000) subtitle = '解开人质!';
        } else if (ms < 85000) {
          const escort2 = 0.32 + Math.sin(i * 0.38) * 0.08;
          strong = escort2; weak = escort2 + 0.03;
          if (ms === 75000) subtitle = '护送撤离...';
        } else if (ms < 95000) {
          const ambush = (ms - 85000) % 400;
          if (ambush < 150) {
            strong = 0.68 + Math.sin(ambush * 0.2) * 0.08;
            weak = 0.62 + Math.sin(ambush * 0.2) * 0.06;
          } else {
            strong = 0.22; weak = 0.18;
          }
          if (ms === 85000) subtitle = '伏击!';
        } else if (ms < 105000) {
          const heliExtract = 0.50 + Math.sin(i * 0.4) * 0.12;
          strong = heliExtract; weak = heliExtract * 0.85;
          if (ms === 95000) subtitle = '直升机撤离!';
        } else if (ms < 110000) {
          const landing = 0.30 * (1 - (ms - 105000) / 5000) + 0.05;
          strong = landing; weak = landing * 1.05;
          if (ms === 105000) subtitle = '安全着陆!';
        } else {
          const fade = 0.15 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '所有人质安全!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_vehicle_assault',
    name: 'FPS Vehicle Assault',
    nameZh: 'FPS载具突击',
    description: 'Vehicle combat and mounted gun warfare (10ms precision)',
    descriptionZh: '载具战斗与架枪作战（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 5000) {
          const vehicle = 0.45 + Math.sin(i * 0.35) * 0.15;
          strong = vehicle; weak = vehicle * 0.85;
          if (ms === 0) subtitle = '乘车接近...';
        } else if (ms < 8000) {
          const brake = 0.70 + Math.sin((ms - 5000) / 3000 * Math.PI) * 0.20;
          strong = brake; weak = brake * 0.9;
          if (ms === 5000) subtitle = '急刹车!';
        } else if (ms < 10000) {
          const door = 0.90; weak = 0.50;
          strong = door; weak = door * 0.9;
          if (ms === 8000) subtitle = '下车!';
        } else if (ms < 15000) {
          const mount = 0.50 + Math.sin(i * 0.4) * 0.12;
          strong = mount; weak = mount * 0.80;
          if (ms === 10000) subtitle = '架设机枪!';
        } else if (ms < 25000) {
          const mg = (ms - 15000) % 180;
          if (mg < 90) {
            strong = 0.85 + Math.sin(mg * 0.2) * 0.10;
            weak = 0.80 + Math.sin(mg * 0.2) * 0.08;
          } else {
            strong = 0.35; weak = 0.30;
          }
          if (ms === 15000) subtitle = '机枪扫射!';
        } else if (ms < 27000) {
          const recoil = 0.65 * (1 - (ms - 25000) / 2000);
          strong = recoil; weak = recoil * 0.95;
          if (ms === 25000) subtitle = '后坐力!';
        } else if (ms < 30000) {
          const move = 0.30 + Math.sin(i * 0.45) * 0.08;
          strong = move; weak = move + 0.04;
          if (ms === 27000) subtitle = '转移阵地...';
        } else if (ms < 31000) {
          strong = 0.95; weak = 0.55;
          if (ms === 30000) subtitle = '火箭筒!';
        } else if (ms < 35000) {
          const exp = 0.80 * (1 - (ms - 31000) / 4000);
          strong = exp; weak = exp * 0.95;
          if (ms === 31000) subtitle = '爆炸!';
        } else if (ms < 40000) {
          const sprint = 0.48 + Math.sin(i * 0.6) * 0.12;
          strong = sprint; weak = sprint * 0.88;
          if (ms === 35000) subtitle = '冲锋!';
        } else if (ms < 42000) {
          const fire = (ms - 40000) % 200;
          if (fire < 100) {
            strong = 0.72 + Math.sin(fire * 0.18) * 0.08;
            weak = 0.68 + Math.sin(fire * 0.18) * 0.06;
          } else {
            strong = 0.28; weak = 0.24;
          }
          if (ms === 40000) subtitle = '突击步枪!';
        } else if (ms < 48000) {
          const walk = 0.22 + Math.sin(i * 0.35) * 0.06;
          strong = walk; weak = walk + 0.03;
          if (ms === 42000) subtitle = '清剿残敌...';
        } else if (ms < 55000) {
          const pursuit = 0.48 + Math.sin(i * 0.55) * 0.12;
          strong = pursuit; weak = pursuit * 0.88;
          if (ms === 48000) subtitle = '追击残敌!';
        } else if (ms < 60000) {
          const brake2 = 0.70 + Math.sin((ms - 55000) / 5000 * Math.PI) * 0.20;
          strong = brake2; weak = brake2 * 0.9;
          if (ms === 55000) subtitle = '急刹车!';
        } else if (ms < 68000) {
          const mg2 = (ms - 60000) % 180;
          if (mg2 < 90) {
            strong = 0.82 + Math.sin(mg2 * 0.2) * 0.08;
            weak = 0.78 + Math.sin(mg2 * 0.2) * 0.06;
          } else {
            strong = 0.32; weak = 0.28;
          }
          if (ms === 60000) subtitle = '机枪扫射!';
        } else if (ms < 75000) {
          const advance2 = 0.38 + Math.sin(i * 0.4) * 0.09;
          strong = advance2; weak = advance2 + 0.04;
          if (ms === 68000) subtitle = '推进...';
        } else if (ms < 80000) {
          strong = 0.92; weak = 0.52;
          if (ms === 75000) subtitle = '火箭筒!';
        } else if (ms < 88000) {
          const exp2 = 0.75 * (1 - (ms - 80000) / 8000);
          strong = exp2; weak = exp2 * 0.95;
          if (ms === 80000) subtitle = '爆炸!';
        } else if (ms < 98000) {
          const finalPush = 0.52 + Math.sin(i * 0.6) * 0.14;
          strong = finalPush; weak = finalPush * 0.88;
          if (ms === 88000) subtitle = '最终突击!';
        } else if (ms < 110000) {
          const secure = 0.30 + Math.sin(i * 0.35) * 0.08;
          strong = secure; weak = secure + 0.03;
          if (ms === 98000) subtitle = '目标已占领!';
        } else {
          const fade = 0.15 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '任务完成!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_deathmatch',
    name: 'FPS Team Deathmatch',
    nameZh: 'FPS团队死斗',
    description: 'Intense team deathmatch combat (10ms precision)',
    descriptionZh: '激烈的团队死斗（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 3000) {
          strong = 0.08; weak = 0.10;
          if (ms === 0) subtitle = '游戏开始!';
        } else if (ms < 8000) {
          const rush = 0.45 + Math.sin(i * 0.55) * 0.12;
          strong = rush; weak = rush * 0.92;
          if (ms === 3000) subtitle = '冲向战场!';
        } else if (ms < 9000) {
          const burst1 = (ms - 8000) % 280;
          if (burst1 < 130) {
            strong = 0.75 + Math.sin(burst1 * 0.18) * 0.08;
            weak = 0.70 + Math.sin(burst1 * 0.18) * 0.06;
          } else {
            strong = 0.30; weak = 0.26;
          }
          if (ms === 8000) subtitle = '遭遇战!';
        } else if (ms < 10000) {
          strong = 0.55 * (1 - (ms - 9000) / 1000);
          weak = 0.50 * (1 - (ms - 9000) / 1000);
          if (ms === 9000) subtitle = '击杀!';
        } else if (ms < 15000) {
          const move = 0.28 + Math.sin(i * 0.4) * 0.08;
          strong = move; weak = move + 0.03;
          if (ms === 10000) subtitle = '继续推进...';
        } else if (ms < 17000) {
          strong = 0.85; weak = 0.48;
          if (ms === 15000) subtitle = '手雷!';
        } else if (ms < 19000) {
          const exp1 = 0.75 * (1 - (ms - 17000) / 2000);
          strong = exp1; weak = exp1 * 0.95;
          if (ms === 17000) subtitle = '爆炸!';
        } else if (ms < 22000) {
          const hurt = 0.70 + Math.sin(i * 0.8) * 0.15;
          strong = hurt; weak = hurt * 0.90;
          if (ms === 19000) subtitle = '中弹!';
        } else if (ms < 25000) {
          const dodge = 0.35 + Math.sin(i * 0.5) * 0.10;
          strong = dodge; weak = dodge + 0.04;
          if (ms === 22000) subtitle = '躲避!';
        } else if (ms < 27000) {
          const counter = (ms - 25000) % 300;
          if (counter < 150) {
            strong = 0.70 + Math.sin(counter * 0.2) * 0.08;
            weak = 0.65 + Math.sin(counter * 0.2) * 0.06;
          } else {
            strong = 0.25; weak = 0.22;
          }
          if (ms === 25000) subtitle = '反击!';
        } else if (ms < 30000) {
          const heal = 0.40 + Math.sin((ms - 27000) / 3000 * Math.PI) * 0.20;
          strong = heal; weak = heal * 1.05;
          if (ms === 27000) subtitle = '使用医疗包!';
        } else if (ms < 38000) {
          const fight = 0.55 + Math.sin(i * 0.65) * 0.15;
          strong = fight; weak = fight * 0.92;
          if (ms === 30000) subtitle = '激战!';
        } else if (ms < 42000) {
          const streak = 0.65 + Math.sin((ms - 38000) / 4000 * Math.PI) * 0.25;
          strong = streak; weak = streak * 0.90;
          if (ms === 38000) subtitle = '连杀!';
        } else if (ms < 50000) {
          const final = 0.50 + Math.sin(i * 0.5) * 0.15;
          strong = final; weak = final * 0.95;
          if (ms === 42000) subtitle = '最终决战!';
        } else if (ms < 58000) {
          // 重生再战
          const respawn = 0.45 + Math.sin(i * 0.55) * 0.12;
          strong = respawn; weak = respawn * 0.90;
          if (ms === 50000) subtitle = '重生!';
        } else if (ms < 62000) {
          const burst2 = (ms - 58000) % 280;
          if (burst2 < 130) {
            strong = 0.78 + Math.sin(burst2 * 0.18) * 0.08;
            weak = 0.72 + Math.sin(burst2 * 0.18) * 0.06;
          } else {
            strong = 0.28; weak = 0.24;
          }
          if (ms === 58000) subtitle = '遭遇战!';
        } else if (ms < 65000) {
          strong = 0.55 * (1 - (ms - 62000) / 3000);
          weak = 0.50 * (1 - (ms - 62000) / 3000);
          if (ms === 62000) subtitle = '击杀!';
        } else if (ms < 72000) {
          const powerWeapon = 0.60 + Math.sin(i * 0.7) * 0.18;
          strong = powerWeapon; weak = powerWeapon * 0.92;
          if (ms === 65000) subtitle = '捡到强力武器!';
        } else if (ms < 80000) {
          const rampage = (ms - 72000) % 200;
          if (rampage < 100) {
            strong = 0.85 + Math.sin(rampage * 0.22) * 0.10;
            weak = 0.80 + Math.sin(rampage * 0.22) * 0.08;
          } else {
            strong = 0.35; weak = 0.30;
          }
          if (ms === 72000) subtitle = '暴走!';
        } else if (ms < 90000) {
          const intense2 = 0.65 + Math.sin(i * 0.65) * 0.15;
          strong = intense2; weak = intense2 * 0.90;
          if (ms === 80000) subtitle = '激战继续!';
        } else if (ms < 100000) {
          const tripleKill = (ms - 90000) % 400;
          if (tripleKill < 150) {
            strong = 0.88 + Math.sin(tripleKill * 0.2) * 0.10;
            weak = 0.82 + Math.sin(tripleKill * 0.2) * 0.08;
          } else {
            strong = 0.30; weak = 0.26;
          }
          if (ms === 90000) subtitle = '三杀!';
        } else if (ms < 110000) {
          const victory = 0.70 + Math.sin((ms - 100000) / 10000 * Math.PI) * 0.20;
          strong = victory; weak = victory * 0.92;
          if (ms === 100000) subtitle = '胜利在望!';
        } else {
          const fade = 0.18 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '比赛结束!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_battle_royale',
    name: 'FPS Battle Royale',
    nameZh: 'FPS大逃杀',
    description: 'Last one standing survival (10ms precision)',
    descriptionZh: '生存战，最后一人（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const phase = ms / TOTAL_DURATION;
        
        if (ms < 10000) {
          const plane = 0.15 + Math.sin(i * 0.2) * 0.05;
          strong = plane; weak = plane * 0.9;
          if (ms === 0) subtitle = '飞机上...';
        } else if (ms < 13000) {
          strong = 0.50; weak = 0.85;
          if (ms === 10000) subtitle = '跳伞!';
        } else if (ms < 16000) {
          const glide = 0.35 + Math.sin((ms - 13000) / 3000 * Math.PI) * 0.15;
          strong = glide; weak = glide * 1.1;
          if (ms === 13000) subtitle = '滑翔中...';
        } else if (ms < 18000) {
          const land = 0.65 + Math.sin((ms - 16000) / 2000 * Math.PI) * 0.25;
          strong = land; weak = land * 0.9;
          if (ms === 16000) subtitle = '着陆!';
        } else if (ms < 25000) {
          const loot = 0.18 + Math.sin(i * 0.3) * 0.06;
          strong = loot; weak = loot + 0.02;
          if (ms === 18000) subtitle = '搜物资...';
        } else if (ms < 28000) {
          const zone = 0.40 + Math.sin((ms - 25000) / 3000 * Math.PI * 2) * 0.15;
          strong = zone; weak = zone * 1.05;
          if (ms === 25000) subtitle = '缩圈警告!';
        } else if (ms < 35000) {
          const run = 0.50 + Math.sin(i * 0.6) * 0.12;
          strong = run; weak = run * 0.88;
          if (ms === 28000) subtitle = '跑毒!';
        } else if (ms < 40000) {
          const encounter = (ms - 35000) % 400;
          if (encounter < 180) {
            strong = 0.72 + Math.sin(encounter * 0.2) * 0.08;
            weak = 0.68 + Math.sin(encounter * 0.2) * 0.06;
          } else {
            strong = 0.28; weak = 0.24;
          }
          if (ms === 35000) subtitle = '遭遇战!';
        } else if (ms < 45000) {
          const fight = 0.58 + Math.sin(i * 0.55) * 0.15;
          strong = fight; weak = fight * 0.92;
          if (ms === 40000) subtitle = '决赛圈!';
        } else if (ms < 50000) {
          const intense = 0.75 + Math.sin(i * 0.7) * 0.18;
          strong = intense; weak = intense * 0.90;
          if (ms === 45000) subtitle = '最后几人!';
        } else if (ms < 55000) {
          const win = 0.80 + Math.sin((ms - 50000) / 5000 * Math.PI) * 0.20;
          strong = win; weak = win * 0.95;
          if (ms === 50000) subtitle = '胜利在望!';
        } else if (ms < 65000) {
          const thirdParty = (ms - 55000) % 350;
          if (thirdParty < 150) {
            strong = 0.75 + Math.sin(thirdParty * 0.2) * 0.10;
            weak = 0.70 + Math.sin(thirdParty * 0.2) * 0.08;
          } else {
            strong = 0.25; weak = 0.22;
          }
          if (ms === 55000) subtitle = '第三方来袭!';
        } else if (ms < 72000) {
          const heal = 0.35 + Math.sin((ms - 65000) / 7000 * Math.PI) * 0.15;
          strong = heal; weak = heal * 1.05;
          if (ms === 65000) subtitle = '打药治疗...';
        } else if (ms < 82000) {
          const rotate = 0.50 + Math.sin(i * 0.55) * 0.12;
          strong = rotate; weak = rotate * 0.88;
          if (ms === 72000) subtitle = '转移位置!';
        } else if (ms < 90000) {
          const finalFight = (ms - 82000) % 300;
          if (finalFight < 130) {
            strong = 0.80 + Math.sin(finalFight * 0.22) * 0.10;
            weak = 0.75 + Math.sin(finalFight * 0.22) * 0.08;
          } else {
            strong = 0.30; weak = 0.26;
          }
          if (ms === 82000) subtitle = '决赛圈!';
        } else if (ms < 100000) {
          const duel = 0.75 + Math.sin(i * 0.7) * 0.18;
          strong = duel; weak = duel * 0.90;
          if (ms === 90000) subtitle = '最后1v1!';
        } else if (ms < 110000) {
          const chicken = 0.80 + Math.sin((ms - 100000) / 10000 * Math.PI) * 0.20;
          strong = chicken; weak = chicken * 0.95;
          if (ms === 100000) subtitle = '吃鸡!';
        } else {
          const fade = 0.25 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '大吉大利!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_stealth',
    name: 'FPS Stealth Infiltration',
    nameZh: 'FPS潜行渗透',
    description: 'Silent takedown and stealth mission (10ms precision)',
    descriptionZh: '无声击倒与潜行任务（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 8000) {
          const crawl = 0.08 + Math.sin(i * 0.15) * 0.03;
          strong = crawl; weak = crawl + 0.01;
          if (ms === 0) subtitle = '匍匐接近...';
        } else if (ms < 9000) {
          strong = 0.60; weak = 0.35;
          if (ms === 8000) subtitle = '无声击倒!';
        } else if (ms < 11000) {
          strong = 0.05; weak = 0.07;
          if (ms === 9000) subtitle = '拖动尸体...';
        } else if (ms < 18000) {
          const sneak = 0.10 + Math.sin(i * 0.2) * 0.04;
          strong = sneak; weak = sneak + 0.01;
          if (ms === 11000) subtitle = '继续潜行...';
        } else if (ms < 20000) {
          const alert = Math.sin((ms - 18000) / 2000 * Math.PI * 4) * 0.20 + 0.40;
          strong = alert; weak = alert * 0.95;
          if (ms === 18000) subtitle = '触发了警报!';
        } else if (ms < 25000) {
          const run = 0.48 + Math.sin(i * 0.55) * 0.12;
          strong = run; weak = run * 0.88;
          if (ms === 20000) subtitle = '紧急撤离!';
        } else if (ms < 28000) {
          const cover = (ms - 25000) % 350;
          if (cover < 160) {
            strong = 0.68 + Math.sin(cover * 0.18) * 0.08;
            weak = 0.63 + Math.sin(cover * 0.18) * 0.06;
          } else {
            strong = 0.25; weak = 0.22;
          }
          if (ms === 25000) subtitle = '依托掩体射击!';
        } else if (ms < 32000) {
          const move = 0.28 + Math.sin(i * 0.38) * 0.07;
          strong = move; weak = move + 0.03;
          if (ms === 28000) subtitle = '转移...';
        } else if (ms < 35000) {
          strong = 0.55; weak = 0.85;
          if (ms === 32000) subtitle = '近战击杀!';
        } else if (ms < 40000) {
          const sneak2 = 0.12 + Math.sin(i * 0.22) * 0.04;
          strong = sneak2; weak = sneak2 + 0.01;
          if (ms === 35000) subtitle = '恢复潜行...';
        } else if (ms < 45000) {
          const objective = 0.35 + Math.sin(i * 0.35) * 0.10;
          strong = objective; weak = objective * 0.95;
          if (ms === 40000) subtitle = '接近目标...';
        } else if (ms < 48000) {
          strong = 0.90; weak = 0.50;
          if (ms === 45000) subtitle = '完成任务!';
        } else if (ms < 55000) {
          // 第二目标
          const sneak3 = 0.12 + Math.sin(i * 0.22) * 0.04;
          strong = sneak3; weak = sneak3 + 0.01;
          if (ms === 48000) subtitle = '寻找第二目标...';
        } else if (ms < 60000) {
          // 激光网
          const laser = Math.sin(i * 2) * 0.15 + 0.35;
          strong = laser; weak = laser * 0.95;
          if (ms === 55000) subtitle = '躲避激光!';
        } else if (ms < 68000) {
          const crawl3 = 0.10 + Math.sin(i * 0.18) * 0.03;
          strong = crawl3; weak = crawl3 + 0.01;
          if (ms === 60000) subtitle = '匍匐通过...';
        } else if (ms < 72000) {
          strong = 0.88; weak = 0.48;
          if (ms === 68000) subtitle = '完成第二目标!';
        } else if (ms < 80000) {
          const escape = 0.40 + Math.sin(i * 0.5) * 0.10;
          strong = escape; weak = escape * 0.88;
          if (ms === 72000) subtitle = '逃离建筑!';
        } else if (ms < 88000) {
          const rooftop2 = 0.30 + Math.sin(i * 0.35) * 0.08;
          strong = rooftop2; weak = rooftop2 + 0.03;
          if (ms === 80000) subtitle = '到达天台...';
        } else if (ms < 95000) {
          const heliPickup = 0.55 + Math.sin(i * 0.4) * 0.12;
          strong = heliPickup; weak = heliPickup * 0.85;
          if (ms === 88000) subtitle = '直升机接应!';
        } else if (ms < 110000) {
          const flyAway = 0.35 + Math.sin(i * 0.3) * 0.08;
          strong = flyAway; weak = flyAway * 0.90;
          if (ms === 95000) subtitle = '空中撤离...';
        } else {
          const fade = 0.15 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '渗透成功!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_spray_control',
    name: 'FPS扫射控制',
    nameZh: 'FPS Spray Control',
    description: 'Master rifle spray control training (10ms precision)',
    descriptionZh: '步枪扫射控制训练（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        // 扫射控制训练：连续射击，后坐力控制
        if (ms < 2000) {
          strong = 0.08; weak = 0.10;
          if (ms === 0) subtitle = '举枪...';
        } else if (ms < 5000) {
          const spray1 = (ms - 2000) % 150;
          if (spray1 < 80) {
            strong = 0.72 + Math.sin(spray1 * 0.2) * 0.08;
            weak = 0.68 + Math.sin(spray1 * 0.2) * 0.06;
          } else {
            strong = 0.32; weak = 0.28;
          }
          if (ms === 2000) subtitle = '第一发点射!';
        } else if (ms < 8000) {
          const spray2 = (ms - 5000) % 150;
          if (spray2 < 80) {
            strong = 0.78 + Math.sin(spray2 * 0.22) * 0.10;
            weak = 0.74 + Math.sin(spray2 * 0.22) * 0.08;
          } else {
            strong = 0.35; weak = 0.30;
          }
          if (ms === 5000) subtitle = '三连发!';
        } else if (ms < 12000) {
          const burst1 = (ms - 8000) % 200;
          if (burst1 < 100) {
            strong = 0.82 + Math.sin(burst1 * 0.25) * 0.12;
            weak = 0.78 + Math.sin(burst1 * 0.25) * 0.10;
          } else {
            strong = 0.38; weak = 0.33;
          }
          if (ms === 8000) subtitle = '短点射!';
        } else if (ms < 18000) {
          const full1 = (ms - 12000) % 120;
          if (full1 < 70) {
            strong = 0.88 + Math.sin(full1 * 0.28) * 0.12;
            weak = 0.84 + Math.sin(full1 * 0.28) * 0.10;
          } else {
            strong = 0.42; weak = 0.36;
          }
          if (ms === 12000) subtitle = '全自动!';
        } else if (ms < 25000) {
          const control = 0.75 + Math.sin((ms - 18000) / 7000 * Math.PI) * 0.20;
          strong = control; weak = control * 0.95;
          if (ms === 18000) subtitle = '压枪控制!';
        } else if (ms < 30000) {
          const spray3 = (ms - 25000) % 140;
          if (spray3 < 75) {
            strong = 0.90 + Math.sin(spray3 * 0.30) * 0.10;
            weak = 0.86 + Math.sin(spray3 * 0.30) * 0.08;
          } else {
            strong = 0.45; weak = 0.38;
          }
          if (ms === 25000) subtitle = '扫射调姿!';
        } else if (ms < 40000) {
          const final = (ms - 30000) % 130;
          if (final < 70) {
            strong = 0.92 + Math.sin(final * 0.32) * 0.08;
            weak = 0.88 + Math.sin(final * 0.32) * 0.06;
          } else {
            strong = 0.48; weak = 0.40;
          }
          if (ms === 30000) subtitle = '极限扫射!';
        } else if (ms < 50000) {
          // 移动靶射击
          const moveShoot = (ms - 40000) % 160;
          if (moveShoot < 85) {
            strong = 0.85 + Math.sin(moveShoot * 0.26) * 0.10;
            weak = 0.80 + Math.sin(moveShoot * 0.26) * 0.08;
          } else {
            strong = 0.38; weak = 0.32;
          }
          if (ms === 40000) subtitle = '移动靶!';
        } else if (ms < 60000) {
          // 扫射转移
          const transfer = (ms - 50000) % 200;
          if (transfer < 100) {
            strong = 0.88 + Math.sin(transfer * 0.22) * 0.10;
            weak = 0.84 + Math.sin(transfer * 0.22) * 0.08;
          } else {
            strong = 0.42; weak = 0.36;
          }
          if (ms === 50000) subtitle = '扫射转移!';
        } else if (ms < 75000) {
          // 远距离扫射
          const longRange = (ms - 60000) % 180;
          if (longRange < 90) {
            strong = 0.82 + Math.sin(longRange * 0.2) * 0.08;
            weak = 0.78 + Math.sin(longRange * 0.2) * 0.06;
          } else {
            strong = 0.35; weak = 0.30;
          }
          if (ms === 60000) subtitle = '远距离压枪!';
        } else if (ms < 85000) {
          // 高难度扫射
          const hard = (ms - 75000) % 140;
          if (hard < 75) {
            strong = 0.92 + Math.sin(hard * 0.30) * 0.08;
            weak = 0.88 + Math.sin(hard * 0.30) * 0.06;
          } else {
            strong = 0.45; weak = 0.38;
          }
          if (ms === 75000) subtitle = '极限难度!';
        } else if (ms < 95000) {
          // 连续多目标
          const multi = (ms - 85000) % 300;
          if (multi < 60) {
            strong = 0.90; weak = 0.50;
          } else if (multi < 120) {
            strong = 0.20; weak = 0.15;
          } else if (multi < 180) {
            strong = 0.88; weak = 0.48;
          } else if (multi < 240) {
            strong = 0.18; weak = 0.12;
          } else {
            strong = 0.85; weak = 0.45;
          }
          if (ms === 85000) subtitle = '多目标切换!';
        } else if (ms < 105000) {
          // 最终精度测试
          const precision = (ms - 95000) % 1000;
          if (precision < 80) {
            strong = 0.95; weak = 0.55;
          } else {
            strong = 0.05; weak = 0.08;
          }
          if (ms === 95000) subtitle = '精度测试!';
        } else if (ms < 110000) {
          const cooldown = 0.35 + Math.sin((ms - 105000) / 5000 * Math.PI) * 0.15;
          strong = cooldown; weak = cooldown * 0.90;
          if (ms === 105000) subtitle = '收枪...';
        } else {
          const fade = 0.15 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '训练完成!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_rush_stop',
    name: 'FPS急停震动',
    nameZh: 'FPS Rush Stop',
    description: 'Emergency stop during combat advance (10ms precision)',
    descriptionZh: '战斗冲锋中的急停（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 3000) {
          const rush = 0.55 + Math.sin(i * 0.6) * 0.15;
          strong = rush; weak = rush * 0.88;
          if (ms === 0) subtitle = '冲锋!';
        } else if (ms < 4000) {
          const stop = 0.85 + Math.sin((ms - 3000) / 1000 * Math.PI) * 0.15;
          strong = stop; weak = stop * 0.92;
          if (ms === 3000) subtitle = '急停!';
        } else if (ms < 6000) {
          const stabilize = 0.25 + Math.sin((ms - 4000) / 2000 * Math.PI) * 0.10;
          strong = stabilize; weak = stabilize * 0.95;
          if (ms === 4000) subtitle = '稳定枪线!';
        } else if (ms < 8000) {
          const aim = 0.15 + Math.sin(i * 0.3) * 0.04;
          strong = aim; weak = aim * 1.05;
          if (ms === 6000) subtitle = '精确瞄准...';
        } else if (ms < 8500) {
          strong = 0.78; weak = 0.45;
          if (ms === 8000) subtitle = '射击!';
        } else if (ms < 10000) {
          const hit = 0.50 * (1 - (ms - 8500) / 1500);
          strong = hit; weak = hit * 0.95;
          if (ms === 8500) subtitle = '命中!';
        } else if (ms < 13000) {
          const rush2 = 0.50 + Math.sin(i * 0.55) * 0.12;
          strong = rush2; weak = rush2 * 0.90;
          if (ms === 10000) subtitle = '继续冲锋!';
        } else if (ms < 14000) {
          const stop2 = 0.82 + Math.sin((ms - 13000) / 1000 * Math.PI) * 0.15;
          strong = stop2; weak = stop2 * 0.92;
          if (ms === 13000) subtitle = '急停!';
        } else if (ms < 18000) {
          const burst = (ms - 14000) % 250;
          if (burst < 120) {
            strong = 0.80 + Math.sin(burst * 0.22) * 0.10;
            weak = 0.76 + Math.sin(burst * 0.22) * 0.08;
          } else {
            strong = 0.35; weak = 0.30;
          }
          if (ms === 14000) subtitle = '点射!';
        } else if (ms < 22000) {
          const move = 0.32 + Math.sin(i * 0.4) * 0.08;
          strong = move; weak = move + 0.03;
          if (ms === 18000) subtitle = '战术移动...';
        } else if (ms < 25000) {
          const rush3 = 0.55 + Math.sin(i * 0.58) * 0.14;
          strong = rush3; weak = rush3 * 0.88;
          if (ms === 22000) subtitle = '再次冲锋!';
        } else if (ms < 26000) {
          const stop3 = 0.88 + Math.sin((ms - 25000) / 1000 * Math.PI) * 0.12;
          strong = stop3; weak = stop3 * 0.90;
          if (ms === 25000) subtitle = '急停!';
        } else if (ms < 32000) {
          const spray = (ms - 26000) % 140;
          if (spray < 75) {
            strong = 0.85 + Math.sin(spray * 0.25) * 0.10;
            weak = 0.80 + Math.sin(spray * 0.25) * 0.08;
          } else {
            strong = 0.40; weak = 0.35;
          }
          if (ms === 26000) subtitle = '扫射压制!';
        } else if (ms < 40000) {
          // 第四轮冲锋
          const rush4 = 0.52 + Math.sin(i * 0.55) * 0.13;
          strong = rush4; weak = rush4 * 0.88;
          if (ms === 32000) subtitle = '第四次冲锋!';
        } else if (ms < 41000) {
          const stop4 = 0.86 + Math.sin((ms - 40000) / 1000 * Math.PI) * 0.14;
          strong = stop4; weak = stop4 * 0.90;
          if (ms === 40000) subtitle = '急停!';
        } else if (ms < 48000) {
          const burst2 = (ms - 41000) % 220;
          if (burst2 < 110) {
            strong = 0.82 + Math.sin(burst2 * 0.24) * 0.10;
            weak = 0.78 + Math.sin(burst2 * 0.24) * 0.08;
          } else {
            strong = 0.38; weak = 0.32;
          }
          if (ms === 41000) subtitle = '精确点射!';
        } else if (ms < 55000) {
          const move2 = 0.35 + Math.sin(i * 0.42) * 0.09;
          strong = move2; weak = move2 + 0.03;
          if (ms === 48000) subtitle = '侧翼包抄...';
        } else if (ms < 60000) {
          const rush5 = 0.58 + Math.sin(i * 0.62) * 0.15;
          strong = rush5; weak = rush5 * 0.86;
          if (ms === 55000) subtitle = '最后冲锋!';
        } else if (ms < 61000) {
          const stop5 = 0.90 + Math.sin((ms - 60000) / 1000 * Math.PI) * 0.10;
          strong = stop5; weak = stop5 * 0.88;
          if (ms === 60000) subtitle = '急停!';
        } else if (ms < 70000) {
          const spray2 = (ms - 61000) % 120;
          if (spray2 < 65) {
            strong = 0.88 + Math.sin(spray2 * 0.28) * 0.10;
            weak = 0.82 + Math.sin(spray2 * 0.28) * 0.08;
          } else {
            strong = 0.42; weak = 0.36;
          }
          if (ms === 61000) subtitle = '全自动压制!';
        } else if (ms < 78000) {
          const advance = 0.40 + Math.sin(i * 0.45) * 0.10;
          strong = advance; weak = advance + 0.04;
          if (ms === 70000) subtitle = '向前推进...';
        } else if (ms < 85000) {
          const engage = (ms - 78000) % 280;
          if (engage < 140) {
            strong = 0.75 + Math.sin(engage * 0.2) * 0.08;
            weak = 0.70 + Math.sin(engage * 0.2) * 0.06;
          } else {
            strong = 0.30; weak = 0.26;
          }
          if (ms === 78000) subtitle = '遭遇敌人!';
        } else if (ms < 95000) {
          const sprint2 = 0.50 + Math.sin(i * 0.58) * 0.14;
          strong = sprint2; weak = sprint2 * 0.90;
          if (ms === 85000) subtitle = '全速冲锋!';
        } else if (ms < 100000) {
          const finalStop = 0.92 + Math.sin((ms - 95000) / 1000 * Math.PI) * 0.08;
          strong = finalStop; weak = finalStop * 0.85;
          if (ms === 95000) subtitle = '到位!';
        } else if (ms < 110000) {
          const clear = 0.60 + Math.sin(i * 0.5) * 0.15;
          strong = clear; weak = clear * 0.92;
          if (ms === 100000) subtitle = '清扫完毕!';
        } else {
          const fade = 0.18 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '任务完成!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_multi_kill',
    name: 'FPS连杀盛宴',
    nameZh: 'FPS Multi-Kill',
    description: 'Intense multi-kill celebration (10ms precision)',
    descriptionZh: '激烈的连杀盛宴（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 5000) {
          const kill1 = (ms < 2000) ? {s: 0.80, w: 0.45} : (ms < 3500) ? {s: 0.55, w: 0.30} : {s: 0.25 * (1 - (ms - 3500) / 1500), w: 0.20 * (1 - (ms - 3500) / 1500)};
          strong = kill1.s; weak = kill1.w;
          if (ms === 0) subtitle = 'First Blood!';
        } else if (ms < 8000) {
          const kill2 = (ms < 6500) ? {s: 0.82, w: 0.48} : {s: 0.25 * (1 - (ms - 6500) / 1500), w: 0.20 * (1 - (ms - 6500) / 1500)};
          strong = kill2.s; weak = kill2.w;
          if (ms === 5000) subtitle = 'Double Kill!';
        } else if (ms < 11000) {
          const kill3 = (ms < 9500) ? {s: 0.85, w: 0.50} : {s: 0.28 * (1 - (ms - 9500) / 1500), w: 0.22 * (1 - (ms - 9500) / 1500)};
          strong = kill3.s; weak = kill3.w;
          if (ms === 8000) subtitle = 'Triple Kill!';
        } else if (ms < 14000) {
          const kill4 = (ms < 12500) ? {s: 0.88, w: 0.52} : {s: 0.30 * (1 - (ms - 12500) / 1500), w: 0.24 * (1 - (ms - 12500) / 1500)};
          strong = kill4.s; weak = kill4.w;
          if (ms === 11000) subtitle = 'Quad Kill!';
        } else if (ms < 18000) {
          const kill5 = (ms < 16000) ? {s: 0.92, w: 0.55} : {s: 0.35 * (1 - (ms - 16000) / 2000), w: 0.28 * (1 - (ms - 16000) / 2000)};
          strong = kill5.s; weak = kill5.w;
          if (ms === 14000) subtitle = 'PENTA KILL!';
        } else if (ms < 25000) {
          const streak = 0.65 + Math.sin((ms - 18000) / 7000 * Math.PI) * 0.25;
          strong = streak; weak = streak * 0.92;
          if (ms === 18000) subtitle = 'RAMPAGE!';
        } else if (ms < 35000) {
          const dominant = 0.75 + Math.sin(i * 0.6) * 0.18;
          strong = dominant; weak = dominant * 0.90;
          if (ms === 25000) subtitle = 'Dominating!';
        } else if (ms < 50000) {
          const godlike = 0.85 + Math.sin(i * 0.7) * 0.15;
          strong = godlike; weak = godlike * 0.92;
          if (ms === 35000) subtitle = 'GODLIKE!';
        } else if (ms < 60000) {
          // 继续连杀
          const legendary = 0.88 + Math.sin(i * 0.75) * 0.12;
          strong = legendary; weak = legendary * 0.92;
          if (ms === 50000) subtitle = 'LEGENDARY!';
        } else if (ms < 70000) {
          const teamWipe = (ms - 60000) % 300;
          if (teamWipe < 100) {
            strong = 0.92 + Math.sin(teamWipe * 0.25) * 0.08;
            weak = 0.88 + Math.sin(teamWipe * 0.25) * 0.06;
          } else if (teamWipe < 150) {
            strong = 0.50; weak = 0.45;
          } else {
            strong = 0.88; weak = 0.82;
          }
          if (ms === 60000) subtitle = '团灭!';
        } else if (ms < 80000) {
          const streak = 0.80 + Math.sin(i * 0.65) * 0.15;
          strong = streak; weak = streak * 0.90;
          if (ms === 70000) subtitle = '杀疯了!';
        } else if (ms < 90000) {
          const megaKill = (ms - 80000) % 250;
          if (megaKill < 120) {
            strong = 0.90 + Math.sin(megaKill * 0.22) * 0.08;
            weak = 0.85 + Math.sin(megaKill * 0.22) * 0.06;
          } else {
            strong = 0.35; weak = 0.30;
          }
          if (ms === 80000) subtitle = '超神!';
        } else if (ms < 100000) {
          const ace = 0.85 + Math.sin((ms - 90000) / 10000 * Math.PI) * 0.15;
          strong = ace; weak = ace * 0.92;
          if (ms === 90000) subtitle = 'ACE!';
        } else if (ms < 110000) {
          const celebration = 0.70 + Math.sin(i * 0.5) * 0.15;
          strong = celebration; weak = celebration * 0.95;
          if (ms === 100000) subtitle = '胜利庆祝!';
        } else {
          const fade = 0.20 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = 'MVP!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'fps_night_map',
    name: 'FPS夜战',
    nameZh: 'FPS Night Combat',
    description: 'Night vision combat operation (10ms precision)',
    descriptionZh: '夜视仪战斗（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 5000) {
          const nv = 0.15 + Math.sin(i * 0.25) * 0.05;
          strong = nv; weak = nv * 1.1;
          if (ms === 0) subtitle = '开启夜视仪...';
        } else if (ms < 10000) {
          const move = 0.22 + Math.sin(i * 0.35) * 0.06;
          strong = move; weak = move + 0.02;
          if (ms === 5000) subtitle = '夜潜行...';
        } else if (ms < 12000) {
          strong = 0.75; weak = 0.40;
          if (ms === 10000) subtitle = '击杀!';
        } else if (ms < 15000) {
          const scan = 0.18 + Math.sin(i * 0.3) * 0.05;
          strong = scan; weak = scan + 0.02;
          if (ms === 12000) subtitle = '扫描区域...';
        } else if (ms < 18000) {
          const flash = 0.60 + Math.sin(i * 1.5) * 0.25;
          strong = flash; weak = flash;
          if (ms === 15000) subtitle = '敌人闪光弹!';
        } else if (ms < 22000) {
          const blind = 0.45 + Math.sin(i * 0.4) * 0.15;
          strong = blind; weak = blind * 0.95;
          if (ms === 18000) subtitle = '致盲中...';
        } else if (ms < 26000) {
          const recover = 0.30 * (1 - (ms - 22000) / 4000) + 0.10;
          strong = recover; weak = recover * 1.1;
          if (ms === 22000) subtitle = '视力恢复...';
        } else if (ms < 30000) {
          const fight = 0.55 + Math.sin(i * 0.5) * 0.15;
          strong = fight; weak = fight * 0.92;
          if (ms === 26000) subtitle = '夜战!';
        } else if (ms < 40000) {
          const thermal = 0.40 + Math.sin(i * 0.35) * 0.12;
          strong = thermal; weak = thermal * 1.05;
          if (ms === 30000) subtitle = '切换热成像...';
        } else if (ms < 50000) {
          // 热成像战斗
          const thermalFight = (ms - 40000) % 300;
          if (thermalFight < 120) {
            strong = 0.72 + Math.sin(thermalFight * 0.18) * 0.10;
            weak = 0.68 + Math.sin(thermalFight * 0.18) * 0.08;
          } else {
            strong = 0.28; weak = 0.24;
          }
          if (ms === 40000) subtitle = '热成像击杀!';
        } else if (ms < 55000) {
          // 夜视仪失效
          strong = 0.50 + Math.sin(i * 1.5) * 0.25;
          weak = 0.50 + Math.sin(i * 1.5) * 0.25;
          if (ms === 50000) subtitle = '夜视仪失效!';
        } else if (ms < 65000) {
          // 紧急照明弹
          const flare = Math.sin((ms - 55000) / 10000 * Math.PI) * 0.30 + 0.40;
          strong = flare; weak = flare * 0.95;
          if (ms === 55000) subtitle = '发射照明弹!';
        } else if (ms < 75000) {
          // 照明下的战斗
          const litCombat = (ms - 65000) % 250;
          if (litCombat < 120) {
            strong = 0.78 + Math.sin(litCombat * 0.2) * 0.10;
            weak = 0.72 + Math.sin(litCombat * 0.2) * 0.08;
          } else {
            strong = 0.30; weak = 0.26;
          }
          if (ms === 65000) subtitle = '照明下战斗!';
        } else if (ms < 85000) {
          // 近距离夜战
          const closeNight = 0.55 + Math.sin(i * 0.6) * 0.15;
          strong = closeNight; weak = closeNight * 0.90;
          if (ms === 75000) subtitle = '近距离夜战!';
        } else if (ms < 95000) {
          // 撤退
          const retreat = 0.35 + Math.sin(i * 0.4) * 0.08;
          strong = retreat; weak = retreat + 0.03;
          if (ms === 85000) subtitle = '紧急撤退...';
        } else if (ms < 105000) {
          // 黎明前
          const dawn = 0.20 + Math.sin((ms - 95000) / 10000 * Math.PI) * 0.15;
          strong = dawn; weak = dawn * 1.05;
          if (ms === 95000) subtitle = '天快亮了...';
        } else if (ms < 110000) {
          // 撤离直升机
          const heli = 0.45 + Math.sin(i * 0.35) * 0.12;
          strong = heli; weak = heli * 0.85;
          if (ms === 105000) subtitle = '直升机撤离!';
        } else {
          const fade = 0.15 * (1 - (ms - 110000) / 10000);
          strong = fade; weak = fade;
          if (ms === 110000) subtitle = '任务完成!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  // ============ 非对称马达测试场景 ============
  {
    id: 'asym_footstep',
    name: 'Asymmetric Footstep',
    nameZh: '左右脚步',
    description: 'Left-right footstep with realistic random pause (10ms precision)',
    descriptionZh: '真实走路节奏左右交替随机力度（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      // 预计算随机种子，让脚步力度有随机变化
      const randomStrength = Array(TOTAL_STEPS).fill(0).map(() => 0.7 + Math.random() * 0.3);
      const randomWeak = Array(TOTAL_STEPS).fill(0).map(() => 0.4 + Math.random() * 0.3);
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        // 真实走路：非常慢的步频
        // 正常行走每步约1000-1500ms（单脚），完整周期2000-3000ms
        
        if (ms < 40000) {
          // 极慢走 - 每步1200ms（完整周期2400ms）
          // 左脚600ms + 停300ms + 右脚600ms + 停300ms = 1800ms
          const stepCycle = 120; // 1200ms per step
          const phase = i % stepCycle;
          const strengthMod = randomStrength[i];
          const weakMod = randomWeak[i];
          
          if (phase < 40) {
            // 左脚落地冲击
            const env = Math.sin((phase) / 40 * Math.PI);
            strong = (0.45 + env * 0.25) * strengthMod;
            weak = 0;
          } else if (phase < 65) {
            // 左脚停顿
            strong = 0; weak = 0;
          } else if (phase < 105) {
            // 右脚落地冲击
            const env = Math.sin((phase - 65) / 40 * Math.PI);
            strong = 0;
            weak = (0.25 + env * 0.12) * weakMod;
          } else {
            // 右脚停顿
            strong = 0; weak = 0;
          }
          if (ms === 0) subtitle = '慢走...';
        } else if (ms < 80000) {
          // 慢走 - 每步1000ms（完整周期2000ms）
          const stepCycle = 100;
          const phase = i % stepCycle;
          const strengthMod = randomStrength[i];
          const weakMod = randomWeak[i];
          
          if (phase < 35) {
            const env = Math.sin((phase) / 35 * Math.PI);
            strong = (0.50 + env * 0.25) * strengthMod;
            weak = 0;
          } else if (phase < 55) {
            strong = 0; weak = 0;
          } else if (phase < 90) {
            const env = Math.sin((phase - 55) / 35 * Math.PI);
            strong = 0;
            weak = (0.28 + env * 0.12) * weakMod;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 40000) subtitle = '正常走...';
        } else if (ms < 110000) {
          // 中速走 - 每步700ms
          const stepCycle = 70;
          const phase = i % stepCycle;
          const strengthMod = randomStrength[i];
          const weakMod = randomWeak[i];
          
          if (phase < 25) {
            const env = Math.sin((phase) / 25 * Math.PI);
            strong = (0.55 + env * 0.22) * strengthMod;
            weak = 0;
          } else if (phase < 38) {
            strong = 0; weak = 0;
          } else if (phase < 63) {
            const env = Math.sin((phase - 38) / 25 * Math.PI);
            strong = 0;
            weak = (0.32 + env * 0.14) * weakMod;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 80000) subtitle = '稍快...';
        } else if (ms < 115000) {
          // 快走 - 每步500ms
          const stepCycle = 50;
          const phase = i % stepCycle;
          const strengthMod = randomStrength[i];
          const weakMod = randomWeak[i];
          
          if (phase < 18) {
            const env = Math.sin((phase) / 18 * Math.PI);
            strong = (0.62 + env * 0.22) * strengthMod;
            weak = 0;
          } else if (phase < 27) {
            strong = 0; weak = 0;
          } else if (phase < 45) {
            const env = Math.sin((phase - 27) / 18 * Math.PI);
            strong = 0;
            weak = (0.35 + env * 0.15) * weakMod;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 110000) subtitle = '快走!';
        } else {
          // 停下
          const fade = 1 - (ms - 115000) / 5000;
          strong = fade * 0.05;
          weak = fade * 0.03;
          if (ms === 115000) subtitle = '停下...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_explosion',
    name: 'Explosion Shockwave',
    nameZh: '爆炸冲击波',
    description: 'Heavy left motor explosion impact (10ms precision)',
    descriptionZh: '左马达重爆炸冲击（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        // 爆炸场景：左边极强冲击，右边弱
        if (ms < 10000) {
          const pulse = Math.sin(ms / 10000 * Math.PI) * 0.05 + 0.08;
          strong = pulse; weak = pulse * 0.4;
          if (ms === 0) subtitle = '接近目标...';
        } else if (ms < 11000) {
          strong = 0.95; weak = 0.15;
          if (ms === 10000) subtitle = '爆炸!';
        } else if (ms < 12000) {
          const t = (ms - 11000) / 1000;
          strong = 0.85 * (1 - t) + 0.10;
          weak = 0.20 * (1 - t) + 0.05;
        } else if (ms < 15000) {
          const shake = Math.sin(i * 0.8) * 0.15 + 0.30;
          strong = shake; weak = shake * 0.3;
          if (ms === 12000) subtitle = '余震...';
        } else if (ms < 20000) {
          const decay = Math.sin((ms - 15000) / 5000 * Math.PI * 0.5) * 0.20 + 0.15;
          strong = decay; weak = decay * 0.35;
        } else if (ms < 30000) {
          const rumble = 0.20 + Math.sin(i * 0.2) * 0.08;
          strong = rumble; weak = rumble * 0.3;
          if (ms === 20000) subtitle = '持续震动...';
        } else if (ms < 38000) {
          const pulse2 = Math.sin((ms - 30000) / 8000 * Math.PI) * 0.10 + 0.25;
          strong = pulse2; weak = pulse2 * 0.3;
          if (ms === 30000) subtitle = '第二次冲击!';
        } else if (ms < 45000) {
          const decay2 = 0.20 * (1 - (ms - 38000) / 7000) + 0.05;
          strong = decay2; weak = decay2 * 0.35;
        } else if (ms < 55000) {
          const settle = 0.08 + Math.sin(i * 0.15) * 0.03;
          strong = settle; weak = settle * 0.3;
          if (ms === 45000) subtitle = '平稳...';
        } else if (ms < 65000) {
          const crack = Math.random() > 0.9 ? 0.40 : 0.10;
          strong = crack; weak = crack * 0.3;
          if (ms === 55000) subtitle = '建筑物倒塌...';
        } else if (ms < 80000) {
          const fade = 0.12 * (1 - (ms - 65000) / 15000) + 0.02;
          strong = fade; weak = fade * 0.35;
          if (ms === 65000) subtitle = '平息...';
        } else if (ms < 95000) {
          const dust = 0.05 + Math.sin(i * 0.1) * 0.02;
          strong = dust; weak = dust * 0.4;
          if (ms === 80000) subtitle = '灰尘飘落...';
        } else {
          strong = 0.02; weak = 0.01;
          if (ms === 95000) subtitle = '结束';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_heartbeat',
    name: 'Heartbeat Asymmetric',
    nameZh: '心跳不对称',
    description: 'Strong left weak right heartbeat (10ms precision)',
    descriptionZh: '左强右弱心跳（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        const bpm = 60 + t * 40; // 心跳从60逐渐加快到100
        const beatInterval = 60000 / bpm;
        const beatPhase = (i * STEP_DURATION) % beatInterval;
        
        if (beatPhase < 100) {
          // 第一次心跳 - 左强
          const env = Math.sin(beatPhase / 100 * Math.PI);
          strong = 0.70 * env;
          weak = 0.15 * env;
        } else if (beatPhase < 180) {
          // 第二次心跳 - 稍弱
          const env = Math.sin((beatPhase - 100) / 80 * Math.PI);
          strong = 0.50 * env;
          weak = 0.10 * env;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '平静心跳...';
        if (ms === 20000) subtitle = '略微紧张...';
        if (ms === 50000) subtitle = '心跳加速!';
        if (ms === 80000) subtitle = '极度紧张...';
        if (ms === 100000) subtitle = '慢慢平复...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_alternating',
    name: 'Left-Right Alternating',
    nameZh: '左右交替',
    description: 'Alternating left and right motor (10ms precision)',
    descriptionZh: '左右马达交替（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const cycle = 500; // 500ms一周期
        const phase = ms % cycle;
        
        if (phase < 250) {
          // 左马达强
          strong = 0.60 + Math.sin(phase / 250 * Math.PI) * 0.25;
          weak = 0.10 + Math.sin(phase / 250 * Math.PI) * 0.05;
        } else {
          // 右马达强
          strong = 0.10 + Math.sin((phase - 250) / 250 * Math.PI) * 0.05;
          weak = 0.60 + Math.sin((phase - 250) / 250 * Math.PI) * 0.25;
        }
        
        if (ms === 0) subtitle = '左...';
        if (ms === 10000) subtitle = '右...左...右...';
        if (ms === 30000) subtitle = '加速交替!';
        if (ms === 60000) subtitle = '快速切换...';
        if (ms === 90000) subtitle = '减速...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_elevator',
    name: 'Elevator Ascent',
    nameZh: '电梯升降',
    description: 'Heavy bottom asymmetric vibration (10ms precision)',
    descriptionZh: '底部重非对称震动（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const phase = ms / TOTAL_DURATION;
        
        if (ms < 20000) {
          // 启动
          const start = (ms / 20000);
          strong = start * 0.40 + Math.sin(i * 0.3) * 0.08;
          weak = start * 0.08 + Math.sin(i * 0.3) * 0.02;
          if (ms === 0) subtitle = '电梯启动...';
        } else if (ms < 50000) {
          // 上升
          const floor = Math.floor((ms - 20000) / 10000);
          const floorProgress = ((ms - 20000) % 10000) / 10000;
          strong = 0.45 + Math.sin(floorProgress * Math.PI) * 0.15;
          weak = 0.08 + Math.sin(floorProgress * Math.PI) * 0.03;
          if (ms === 20000 || (floor > 0 && ms === 20000 + floor * 10000)) subtitle = `${floor + 1}楼...`;
        } else if (ms < 70000) {
          // 到达顶层
          strong = 0.50 + Math.sin(i * 0.25) * 0.12;
          weak = 0.10 + Math.sin(i * 0.25) * 0.03;
          if (ms === 50000) subtitle = '到达顶层!';
        } else if (ms < 80000) {
          // 停止
          const stop = 1 - (ms - 70000) / 10000;
          strong = 0.35 * stop + Math.sin(i * 0.2) * 0.05;
          weak = 0.07 * stop + Math.sin(i * 0.2) * 0.02;
          if (ms === 70000) subtitle = '停止...';
        } else if (ms < 100000) {
          // 下降
          const floorProgress = ((ms - 80000) % 10000) / 10000;
          strong = 0.40 + Math.sin(floorProgress * Math.PI) * 0.12;
          weak = 0.08 + Math.sin(floorProgress * Math.PI) * 0.03;
          if (ms === 80000) subtitle = '下降...';
        } else {
          // 到底层
          const end = 1 - (ms - 100000) / 20000;
          strong = 0.30 * end + Math.sin(i * 0.15) * 0.05;
          weak = 0.06 * end + Math.sin(i * 0.15) * 0.02;
          if (ms === 100000) subtitle = '到达底层...';
          if (ms === 110000) subtitle = '开门...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_car_engine',
    name: 'Car Engine Idle',
    nameZh: '汽车怠速',
    description: 'Heavy left motor engine simulation (10ms precision)',
    descriptionZh: '左马达重汽车引擎（10ms精度）',
    category: 'vehicle',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 15000) {
          // 怠速
          strong = 0.35 + Math.sin(i * 0.4) * 0.08;
          weak = 0.05 + Math.sin(i * 0.4) * 0.02;
          if (ms === 0) subtitle = '点火启动...';
        } else if (ms < 30000) {
          // 加速
          const rpm = (ms - 15000) / 15000;
          const freq = 0.4 + rpm * 0.4;
          const amp = 0.40 + rpm * 0.30;
          strong = amp + Math.sin(i * freq) * 0.10;
          weak = 0.06 + rpm * 0.04 + Math.sin(i * freq) * 0.02;
          if (ms === 15000) subtitle = '加速...';
        } else if (ms < 60000) {
          // 高转速
          strong = 0.75 + Math.sin(i * 0.9) * 0.12;
          weak = 0.12 + Math.sin(i * 0.9) * 0.03;
          if (ms === 30000) subtitle = '高转速!';
        } else if (ms < 80000) {
          // 减速
          const decel = 1 - (ms - 60000) / 20000;
          const freq = 0.9 * decel + 0.4;
          const amp = 0.75 * decel + 0.35;
          strong = amp + Math.sin(i * freq) * 0.08;
          weak = 0.10 * decel + 0.05 + Math.sin(i * freq) * 0.02;
          if (ms === 60000) subtitle = '减速...';
        } else if (ms < 95000) {
          // 怠速
          strong = 0.35 + Math.sin(i * 0.45) * 0.08;
          weak = 0.06 + Math.sin(i * 0.45) * 0.02;
          if (ms === 80000) subtitle = '怠速...';
        } else {
          // 熄火
          const off = 1 - (ms - 95000) / 25000;
          strong = 0.30 * off + Math.sin(i * 0.3) * 0.05;
          weak = 0.05 * off + Math.sin(i * 0.3) * 0.01;
          if (ms === 95000) subtitle = '熄火...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_high_freq',
    name: 'High Frequency Alert',
    nameZh: '高频警报',
    description: 'Strong right motor for high freq alerts (10ms precision)',
    descriptionZh: '右马达强高频警报（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 20000) {
          // 低频警告
          const freq = 0.3 + t * 0.5;
          strong = 0.08 + Math.sin(i * freq) * 0.04;
          weak = 0.30 + Math.sin(i * freq) * 0.15;
          if (ms === 0) subtitle = '轻微警告...';
        } else if (ms < 40000) {
          // 中频
          const freq = 0.8 + Math.sin((ms - 20000) / 20000 * Math.PI) * 0.4;
          strong = 0.10 + Math.sin(i * freq) * 0.05;
          weak = 0.50 + Math.sin(i * freq) * 0.20;
          if (ms === 20000) subtitle = '警告升级!';
        } else if (ms < 60000) {
          // 高频
          const freq = 1.5 + Math.sin((ms - 40000) / 20000 * Math.PI) * 0.5;
          strong = 0.12 + Math.sin(i * freq) * 0.05;
          weak = 0.70 + Math.sin(i * freq) * 0.20;
          if (ms === 40000) subtitle = '高频警报!';
        } else if (ms < 80000) {
          // 极高频
          const pulse = Math.sin((ms - 60000) / 20000 * Math.PI * 4);
          strong = 0.15 + pulse * 0.08;
          weak = 0.85 + pulse * 0.10;
          if (ms === 60000) subtitle = '紧急警报!';
        } else if (ms < 100000) {
          // 渐停
          const fade = 1 - (ms - 80000) / 20000;
          strong = 0.10 * fade + Math.sin(i * 1.2) * 0.03;
          weak = 0.60 * fade + Math.sin(i * 1.2) * 0.15;
          if (ms === 80000) subtitle = '警报减弱...';
        } else {
          strong = 0.02; weak = 0.05;
          if (ms === 100000) subtitle = '警报解除';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_music_kick',
    name: 'Music Kick Bass',
    nameZh: '音乐重低音',
    description: 'Asymmetric kick bass heavy left (10ms precision)',
    descriptionZh: '非对称重低音左强（10ms精度）',
    category: 'music',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const bpm = 128;
        const beatMs = 60000 / bpm;
        const beatPhase = (i * STEP_DURATION) % beatMs;
        
        if (beatPhase < 30) {
          // Kick - 左重右轻
          const env = Math.sin(beatPhase / 30 * Math.PI);
          strong = 0.90 * env;
          weak = 0.20 * env;
        } else if (beatPhase < 80) {
          // Hi-hat - 右轻高频
          const env = Math.sin((beatPhase - 30) / 50 * Math.PI);
          strong = 0.15 * env;
          weak = 0.60 * env;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = 'Drop loading...';
        if (ms === 30000) subtitle = 'Kick... snare...';
        if (ms === 60000) subtitle = 'Bass drop!';
        if (ms === 90000) subtitle = 'Rolling bass...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_rain_heavy',
    name: 'Heavy Rain',
    nameZh: '暴雨',
    description: 'Heavy asymmetric rain drops (10ms precision)',
    descriptionZh: '左重右轻暴雨（10ms精度）',
    category: 'nature',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 20000) {
          // 小雨
          const drop = Math.random() > 0.95 ? 0.25 : 0;
          strong = drop; weak = drop * 0.3;
          if (ms === 0) subtitle = '开始下雨...';
        } else if (ms < 50000) {
          // 中雨
          const intensity = (ms - 20000) / 30000;
          const drop = Math.random() > (0.85 - intensity * 0.2) ? 0.35 + intensity * 0.25 : 0;
          strong = drop; weak = drop * 0.35;
          if (ms === 20000) subtitle = '雨势增大...';
        } else if (ms < 80000) {
          // 暴雨
          const storm = Math.random() > 0.7 ? 0.65 + Math.random() * 0.25 : 0.15;
          strong = storm; weak = storm * 0.3;
          if (ms === 50000) subtitle = '暴雨!';
        } else {
          // 减弱
          const fade = 1 - (ms - 80000) / 40000;
          const drop = Math.random() > 0.9 ? (0.40 + Math.random() * 0.20) * fade : 0.05 * fade;
          strong = drop; weak = drop * 0.35;
          if (ms === 80000) subtitle = '雨势减弱...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_massage',
    name: 'Deep Tissue Massage',
    nameZh: '深度按摩',
    description: 'Penetrating left heavy massage (10ms precision)',
    descriptionZh: '穿透性左重按摩（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 15000) {
          // 轻柔开始
          const wave = Math.sin(i * 0.15) * 0.08 + 0.12;
          strong = wave; weak = wave * 0.25;
          if (ms === 0) subtitle = '开始按摩...';
        } else if (ms < 35000) {
          // 加深
          const depth = (ms - 15000) / 20000;
          const wave = Math.sin(i * (0.15 + depth * 0.1)) * (0.10 + depth * 0.15) + 0.25 + depth * 0.25;
          strong = wave; weak = wave * (0.30 - depth * 0.1);
          if (ms === 15000) subtitle = '力度加深...';
        } else if (ms < 60000) {
          // 深度
          const wave = Math.sin(i * 0.30) * 0.18 + 0.55;
          strong = wave; weak = wave * 0.18;
          if (ms === 35000) subtitle = '深度放松...';
        } else if (ms < 85000) {
          // 节奏变化
          const rhythm = Math.sin((ms - 60000) / 25000 * Math.PI) * 0.15;
          const wave = Math.sin(i * 0.28) * 0.15 + 0.50 + rhythm;
          strong = wave; weak = wave * 0.20;
          if (ms === 60000) subtitle = '节奏变化...';
        } else {
          // 结束
          const fade = 1 - (ms - 85000) / 35000;
          const wave = Math.sin(i * 0.2) * 0.10 + 0.20;
          strong = wave * fade; weak = wave * fade * 0.25;
          if (ms === 85000) subtitle = '结束按摩...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'asym_electric_shock',
    name: 'Electric Shock',
    nameZh: '触电',
    description: 'Erratic asymmetric electric shock (10ms precision)',
    descriptionZh: '不规则触电震动（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 10000) {
          // 轻微麻痹
          const pulse = Math.sin(i * 0.5) * 0.10 + 0.20;
          strong = pulse; weak = pulse * 0.6;
          if (ms === 0) subtitle = '轻微麻痹...';
        } else if (ms < 15000) {
          // 突然电击
          const shock = Math.random() > 0.7 ? 0.85 : 0.15;
          strong = shock; weak = shock * 0.7;
          if (ms === 10000) subtitle = '触电!';
        } else if (ms < 30000) {
          // 强烈电击
          const intensity = Math.sin((ms - 15000) / 15000 * Math.PI * 3);
          strong = 0.70 + intensity * 0.25;
          weak = 0.50 + intensity * 0.30;
          if (ms === 15000) subtitle = '强烈电流!';
        } else if (ms < 45000) {
          // 间歇电击
          const burst = (ms - 30000) % 3000;
          if (burst < 200) {
            strong = 0.80 + Math.random() * 0.15;
            weak = 0.60 + Math.random() * 0.20;
          } else {
            strong = 0.10 + Math.random() * 0.08;
            weak = 0.08 + Math.random() * 0.06;
          }
          if (ms === 30000) subtitle = '间歇电击...';
        } else if (ms < 65000) {
          // 减弱
          const fade = 1 - (ms - 45000) / 20000;
          strong = (0.30 + Math.random() * 0.20) * fade;
          weak = (0.25 + Math.random() * 0.15) * fade;
          if (ms === 45000) subtitle = '电流减弱...';
        } else {
          // 恢复
          const recover = Math.sin(i * 0.3) * 0.05 + 0.08;
          strong = recover * (1 - (ms - 65000) / 35000);
          weak = recover * 0.8 * (1 - (ms - 65000) / 35000);
          if (ms === 65000) subtitle = '慢慢恢复...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'relaxation',
    name: 'Relaxation Massage',
    nameZh: '放松按摩',
    description: 'Smooth continuous massage waves (10ms precision)',
    descriptionZh: '平滑连续按摩波（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS;
        const ms = i * STEP_DURATION;
        
        // 多层正弦波叠加 - 模拟按摩手法
        const wave1 = Math.sin(t * Math.PI * 40) * 0.12; // 慢波 ~6秒周期
        const wave2 = Math.sin(t * Math.PI * 80) * 0.08; // 中波 ~3秒周期
        const wave3 = Math.sin(t * Math.PI * 200) * 0.05; // 快波 ~1.2秒周期
        const micro = Math.sin(i * 0.3) * 0.03; // 微振动
        
        // 揉捏效果 - 周期性加压
        const kneadCycle = (i % 300) / 300;
        const knead = Math.sin(kneadCycle * Math.PI * 2) * 0.10;
        
        // 整体强度曲线
        let envelope = 0.25;
        if (t < 0.15) envelope = 0.15 + t / 0.15 * 0.10;
        else if (t > 0.85) envelope = 0.25 - (t - 0.85) / 0.15 * 0.15;
        
        const strong = clamp(envelope + wave1 + wave2 + micro + knead);
        const weak = clamp(envelope + 0.08 + wave1 + wave3 + micro + knead * 0.8);
        
        steps.push({
          strong, weak, duration: STEP_DURATION,
          subtitle: ms === 0 ? '开始放松按摩...' :
                   ms === 30000 ? '深呼吸...' :
                   ms === 60000 ? '继续放松...' :
                   ms === 90000 ? '即将结束...' :
                   ms === 115000 ? '按摩完成' : undefined,
        });
      }
      return steps;
    },
  },
  {
    id: 'heartbeat_meditation',
    name: 'Heartbeat Meditation',
    nameZh: '心跳冥想',
    description: 'Realistic heartbeat rhythm (10ms precision)',
    descriptionZh: '逼真心跳节奏（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      // 心跳周期 ~1000ms (60 BPM)，逐渐变化
      let beatPhase = 0;
      let beatDuration = 1000; // 开始60BPM
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS;
        const ms = i * STEP_DURATION;
        
        // 心率变化：60 -> 55 -> 50 BPM (越来越慢，更放松)
        beatDuration = 1000 + t * 200;
        const cyclePos = beatPhase / beatDuration;
        beatPhase += STEP_DURATION;
        if (beatPhase >= beatDuration) beatPhase -= beatDuration;
        
        let strong = 0.03, weak = 0.05;
        
        // S1心音 (0-8% of cycle)
        if (cyclePos < 0.08) {
          const s1T = cyclePos / 0.08;
          strong = 0.55 + Math.sin(s1T * Math.PI) * 0.20;
          weak = 0.50 + Math.sin(s1T * Math.PI) * 0.18;
        }
        // S1-S2间隔 (8-20%)
        else if (cyclePos < 0.20) {
          const gapT = (cyclePos - 0.08) / 0.12;
          strong = 0.55 * (1 - gapT * 0.7);
          weak = 0.50 * (1 - gapT * 0.7);
        }
        // S2心音 (20-28%)
        else if (cyclePos < 0.28) {
          const s2T = (cyclePos - 0.20) / 0.08;
          strong = 0.40 + Math.sin(s2T * Math.PI) * 0.15;
          weak = 0.38 + Math.sin(s2T * Math.PI) * 0.12;
        }
        // 舒张期 (28-100%)
        else {
          const restT = (cyclePos - 0.28) / 0.72;
          const restVib = Math.sin(restT * Math.PI * 4) * 0.02;
          strong = 0.03 + restVib;
          weak = 0.05 + restVib;
        }
        
        steps.push({
          strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION,
          subtitle: ms === 0 ? '调整呼吸...' :
                   ms === 30000 ? '专注心跳' :
                   ms === 60000 ? '深度放松' :
                   ms === 90000 ? '保持平静' : undefined,
        });
      }
      return steps;
    },
  },
  {
    id: 'adventure_journey',
    name: 'Adventure Journey',
    nameZh: '冒险旅程',
    description: 'Epic adventure through terrains (10ms precision)',
    descriptionZh: '史诗冒险穿越地形（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS;
        const ms = i * STEP_DURATION;
        const sec = ms / 1000;
        
        let strong = 0, weak = 0;
        
        if (sec < 20) {
          // 出发 0-20s
          const walkT = sec / 20;
          const footstep = ((i % 80) < 30) ? 0.15 + Math.sin((i % 80) / 30 * Math.PI) * 0.08 : 0.05;
          const excitement = walkT * 0.12;
          strong = 0.10 + footstep + excitement;
          weak = 0.12 + footstep * 0.8 + excitement;
        } else if (sec < 40) {
          // 森林 20-40s
          const ambient = Math.sin(i * 0.08) * 0.10 + Math.sin(i * 0.03) * 0.06;
          const rustling = ((i % 250) < 30) ? 0.20 * (1 - (i % 250) / 30) : 0;
          const footstep = ((i % 100) < 20) ? 0.12 : 0.05;
          strong = 0.15 + ambient + rustling + footstep;
          weak = 0.18 + ambient * 0.8 + rustling * 0.7;
        } else if (sec < 60) {
          // 战斗 40-60s
          const combatPhase = (i - 4000) % 400;
          if (combatPhase < 50) {
            strong = 0.60 + (combatPhase / 50) * 0.30;
            weak = 0.55 + (combatPhase / 50) * 0.25;
          } else if (combatPhase < 100) {
            strong = 0.90 - ((combatPhase - 50) / 50) * 0.40;
            weak = 0.80 - ((combatPhase - 50) / 50) * 0.35;
          } else if (combatPhase < 150) {
            strong = 0.50 + Math.sin((combatPhase - 100) / 50 * Math.PI) * 0.15;
            weak = 0.45 + Math.sin((combatPhase - 100) / 50 * Math.PI) * 0.12;
          } else {
            strong = 0.30 + Math.sin((combatPhase - 150) * 0.05) * 0.08;
            weak = 0.28 + Math.sin((combatPhase - 150) * 0.05) * 0.06;
          }
        } else if (sec < 80) {
          // 山洞 60-80s
          const echo = Math.sin(i * 0.02) * 0.12;
          const drip = ((i % 350) < 20) ? 0.25 * (1 - (i % 350) / 20) : 0;
          const footstep = ((i % 120) < 20) ? 0.10 : 0.03;
          strong = 0.08 + echo + drip + footstep;
          weak = 0.10 + echo * 0.8 + drip * 0.7;
        } else if (sec < 100) {
          // 宝藏 80-100s
          const treasureT = (sec - 80) / 20;
          const sparkle = ((i % 80) < 20) ? 0.15 + treasureT * 0.15 : 0;
          const excitement = treasureT * 0.45;
          const heartbeat = ((i % 150) < 30) ? 0.12 : 0.05;
          strong = 0.25 + excitement + sparkle + heartbeat;
          weak = 0.28 + excitement * 0.9 + sparkle * 0.7;
        } else {
          // 凯旋 100-120s
          const returnT = (sec - 100) / 20;
          const triumph = 0.70 - returnT * 0.45;
          const march = ((i % 100) < 40) ? 0.15 : 0.08;
          const fanfare = ((i % 300) < 50) ? 0.20 * (1 - returnT) : 0;
          strong = triumph + march + fanfare;
          weak = triumph * 0.9 + march * 0.8;
        }
        
        steps.push({
          strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION,
          subtitle: ms === 0 ? '踏上冒险之旅...' :
                   ms === 20000 ? '进入神秘森林' :
                   ms === 40000 ? '遭遇野兽! 战斗!' :
                   ms === 60000 ? '发现神秘山洞' :
                   ms === 80000 ? '发现宝藏!' :
                   ms === 100000 ? '满载而归!' : undefined,
        });
      }
      return steps;
    },
  },
  // ============ 单边马达场景 ============
  {
    id: 'single_left_heartbeat',
    name: 'Left Heartbeat',
    nameZh: '左侧心跳',
    description: 'Only left motor heartbeat (10ms precision)',
    descriptionZh: '仅左侧马达心跳（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const bpm = 70 + Math.sin(ms / TOTAL_DURATION * Math.PI) * 30;
        const beatInterval = 60000 / bpm;
        const beatPhase = (ms % beatInterval);
        
        if (beatPhase < 150) {
          const env = Math.sin(beatPhase / 150 * Math.PI);
          strong = 0.80 * env; // 仅左边
          weak = 0; // 右边不动
        }
        
        if (ms === 0) subtitle = '左侧心跳...';
        if (ms === 30000) subtitle = '心跳加快...';
        if (ms === 60000) subtitle = '紧张...';
        if (ms === 90000) subtitle = '平静...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_alarm',
    name: 'Right Alarm',
    nameZh: '右侧警报',
    description: 'Only right motor alarm (10ms precision)',
    descriptionZh: '仅右侧马达警报（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 20000) {
          // 低频警报
          const freq = 0.2 + t * 0.3;
          strong = 0; // 左边不动
          weak = (Math.sin(i * freq) * 0.3 + 0.4) * (1 - t * 0.3);
          if (ms === 0) subtitle = '警报响起...';
        } else if (ms < 50000) {
          // 加速
          const freq = 0.5 + Math.sin((ms - 20000) / 30000 * Math.PI) * 0.5;
          strong = 0;
          weak = 0.70 + Math.sin(i * freq) * 0.20;
          if (ms === 20000) subtitle = '警报升级!';
        } else if (ms < 80000) {
          // 高频
          const freq = 1.5 + Math.sin((ms - 50000) / 30000 * Math.PI) * 0.5;
          strong = 0;
          weak = 0.90 + Math.sin(i * freq) * 0.08;
          if (ms === 50000) subtitle = '紧急警报!';
        } else {
          // 减弱
          const fade = 1 - (ms - 80000) / 40000;
          strong = 0;
          weak = 0.40 * fade + Math.sin(i * 1.2) * 0.10 * fade;
          if (ms === 80000) subtitle = '警报解除...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_footstep',
    name: 'Left Footstep',
    nameZh: '左侧脚步',
    description: 'Only left motor footstep with realistic random (10ms precision)',
    descriptionZh: '仅左侧脚步随机力度（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      const randomStrength = Array(TOTAL_STEPS).fill(0).map(() => 0.6 + Math.random() * 0.4);
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        // 仅左脚震动，右脚完全静音
        
        if (ms < 40000) {
          // 极慢走 - 每步1200ms
          const stepCycle = 120;
          const phase = i % stepCycle;
          const strMod = randomStrength[i];
          
          if (phase < 50) {
            const env = Math.sin(phase / 50 * Math.PI);
            strong = (0.50 + env * 0.30) * strMod;
            weak = 0;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 0) subtitle = '左脚...';
        } else if (ms < 80000) {
          // 慢走 - 每步1000ms
          const stepCycle = 100;
          const phase = i % stepCycle;
          const strMod = randomStrength[i];
          
          if (phase < 40) {
            const env = Math.sin(phase / 40 * Math.PI);
            strong = (0.55 + env * 0.28) * strMod;
            weak = 0;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 40000) subtitle = '慢走...';
        } else if (ms < 110000) {
          // 中速 - 每步700ms
          const stepCycle = 70;
          const phase = i % stepCycle;
          const strMod = randomStrength[i];
          
          if (phase < 28) {
            const env = Math.sin(phase / 28 * Math.PI);
            strong = (0.60 + env * 0.25) * strMod;
            weak = 0;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 80000) subtitle = '正常走...';
        } else if (ms < 115000) {
          // 较快 - 每步500ms
          const stepCycle = 50;
          const phase = i % stepCycle;
          const strMod = randomStrength[i];
          
          if (phase < 20) {
            const env = Math.sin(phase / 20 * Math.PI);
            strong = (0.68 + env * 0.22) * strMod;
            weak = 0;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 110000) subtitle = '快走!';
        } else {
          const fade = 1 - (ms - 115000) / 5000;
          strong = fade * 0.08;
          weak = 0;
          if (ms === 115000) subtitle = '停下...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_footstep',
    name: 'Right Footstep',
    nameZh: '右侧脚步',
    description: 'Only right motor footstep with realistic random (10ms precision)',
    descriptionZh: '仅右侧脚步随机力度（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      const randomWeak = Array(TOTAL_STEPS).fill(0).map(() => 0.6 + Math.random() * 0.4);
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        // 仅右脚震动，左脚完全静音
        
        if (ms < 40000) {
          // 极慢走 - 每步1200ms
          const stepCycle = 120;
          const phase = i % stepCycle;
          const wkMod = randomWeak[i];
          
          if (phase < 65) {
            strong = 0; weak = 0;
          } else if (phase < 115) {
            const env = Math.sin((phase - 65) / 50 * Math.PI);
            strong = 0;
            weak = (0.50 + env * 0.30) * wkMod;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 0) subtitle = '右脚...';
        } else if (ms < 80000) {
          // 慢走 - 每步1000ms
          const stepCycle = 100;
          const phase = i % stepCycle;
          const wkMod = randomWeak[i];
          
          if (phase < 55) {
            strong = 0; weak = 0;
          } else if (phase < 95) {
            const env = Math.sin((phase - 55) / 40 * Math.PI);
            strong = 0;
            weak = (0.55 + env * 0.28) * wkMod;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 40000) subtitle = '慢走...';
        } else if (ms < 110000) {
          // 中速 - 每步700ms
          const stepCycle = 70;
          const phase = i % stepCycle;
          const wkMod = randomWeak[i];
          
          if (phase < 38) {
            strong = 0; weak = 0;
          } else if (phase < 66) {
            const env = Math.sin((phase - 38) / 28 * Math.PI);
            strong = 0;
            weak = (0.60 + env * 0.25) * wkMod;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 80000) subtitle = '正常走...';
        } else if (ms < 115000) {
          // 较快 - 每步500ms
          const stepCycle = 50;
          const phase = i % stepCycle;
          const wkMod = randomWeak[i];
          
          if (phase < 27) {
            strong = 0; weak = 0;
          } else if (phase < 47) {
            const env = Math.sin((phase - 27) / 20 * Math.PI);
            strong = 0;
            weak = (0.68 + env * 0.22) * wkMod;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 110000) subtitle = '快走!';
        } else {
          const fade = 1 - (ms - 115000) / 5000;
          strong = 0;
          weak = fade * 0.08;
          if (ms === 115000) subtitle = '停下...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_explosion',
    name: 'Left Explosion',
    nameZh: '左侧爆炸',
    description: 'Only left motor explosion (10ms precision)',
    descriptionZh: '仅左侧爆炸（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        if (ms < 30000) {
          strong = 0.02; weak = 0;
          if (ms === 0) subtitle = '接近...';
        } else if (ms < 31000) {
          strong = 1.0; weak = 0;
          if (ms === 30000) subtitle = '爆炸!';
        } else if (ms < 33000) {
          const t = (ms - 31000) / 2000;
          strong = (1.0 - t) * 0.90; weak = 0;
        } else if (ms < 38000) {
          const shake = Math.sin(i * 1.5) * 0.30 + 0.35;
          strong = shake; weak = 0;
          if (ms === 33000) subtitle = '冲击波!';
        } else if (ms < 50000) {
          const decay = Math.sin((ms - 38000) / 12000 * Math.PI * 0.5) * 0.25 + 0.20;
          strong = decay; weak = 0;
        } else if (ms < 70000) {
          const rumble = 0.15 + Math.sin(i * 0.3) * 0.08;
          strong = rumble; weak = 0;
          if (ms === 50000) subtitle = '余震...';
        } else if (ms < 90000) {
          const fade = 0.10 * (1 - (ms - 70000) / 20000);
          strong = fade; weak = 0;
          if (ms === 70000) subtitle = '平息...';
        } else {
          strong = 0.01; weak = 0;
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_guitar',
    name: 'Right Guitar',
    nameZh: '右侧吉他',
    description: 'Only right motor guitar strum (10ms precision)',
    descriptionZh: '仅右侧吉他拨弦（10ms精度）',
    category: 'music',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const beatMs = 500; // 120bpm
        const beatPhase = ms % beatMs;
        
        if (beatPhase < 80) {
          const env = Math.sin(beatPhase / 80 * Math.PI);
          strong = 0;
          weak = 0.60 * env;
        } else if (beatPhase < 150) {
          const env = Math.sin((beatPhase - 80) / 70 * Math.PI);
          strong = 0;
          weak = 0.35 * env;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '吉他弹唱...';
        if (ms === 40000) subtitle = '和弦...';
        if (ms === 80000) subtitle = 'solo...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_drum',
    name: 'Left Drum Kick',
    nameZh: '左侧鼓点',
    description: 'Only left motor kick drum (10ms precision)',
    descriptionZh: '仅左侧底鼓（10ms精度）',
    category: 'music',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const beatMs = 500; // 120bpm
        const beatPhase = ms % beatMs;
        
        if (beatPhase < 60) {
          const env = Math.sin(beatPhase / 60 * Math.PI);
          strong = 0.90 * env;
          weak = 0;
        } else if (beatPhase < 200) {
          strong = 0; weak = 0;
        } else if (beatPhase < 260) {
          const env = Math.sin((beatPhase - 200) / 60 * Math.PI);
          strong = 0.40 * env; // 军鼓
          weak = 0;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '底鼓+军鼓...';
        if (ms === 50000) subtitle = '加速!';
        if (ms === 90000) subtitle = '高潮!';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_hihat',
    name: 'Right Hi-hat',
    nameZh: '右侧踩镲',
    description: 'Only right motor hi-hat (10ms precision)',
    descriptionZh: '仅右侧踩镲（10ms精度）',
    category: 'music',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const beatMs = 250; // 120bpm 8分音符
        const beatPhase = ms % beatMs;
        
        if (beatPhase < 30) {
          const env = Math.sin(beatPhase / 30 * Math.PI);
          strong = 0;
          weak = 0.45 * env;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '踩镲节奏...';
        if (ms === 40000) subtitle = '开镲...';
        if (ms === 80000) subtitle = '紧闭镲...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_sniper',
    name: 'Left Sniper',
    nameZh: '左侧狙击',
    description: 'Only left motor sniper shot (10ms precision)',
    descriptionZh: '仅左侧狙击枪（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const cycle = 15000;
        const cycleMs = ms % cycle;
        
        if (cycleMs < 3000) {
          // 瞄准
          strong = 0.08; weak = 0;
          if (cycleMs === 0) subtitle = '瞄准...';
        } else if (cycleMs < 3500) {
          // 击发
          strong = 0.95; weak = 0;
          if (cycleMs === 3000) subtitle = '射击!';
        } else if (cycleMs < 4500) {
          // 后坐力
          const t = (cycleMs - 3500) / 1000;
          strong = (1.0 - t) * 0.60; weak = 0;
          if (cycleMs === 3500) subtitle = '后坐力!';
        } else if (cycleMs < 7000) {
          // 拉栓
          const t = (cycleMs - 4500) / 2500;
          strong = t > 0.8 ? 0.15 : 0.05;
          weak = 0;
          if (cycleMs === 4500) subtitle = '拉栓...';
        } else {
          strong = 0.05; weak = 0;
        }
        
        if (ms === 0) subtitle = '狙击模式...';
        if (ms === 60000) subtitle = '连续射击...';
        if (ms === 100000) subtitle = '任务完成';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_shotgun',
    name: 'Right Shotgun',
    nameZh: '右侧霰弹',
    description: 'Only right motor shotgun (10ms precision)',
    descriptionZh: '仅右侧霰弹枪（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const cycle = 8000;
        const cycleMs = ms % cycle;
        
        if (cycleMs < 2000) {
          // 上膛
          const t = cycleMs / 2000;
          strong = 0; weak = t * 0.30;
          if (cycleMs === 0) subtitle = '上膛...';
        } else if (cycleMs < 2500) {
          // 击发 - 右马达
          strong = 0; weak = 1.0;
          if (cycleMs === 2000) subtitle = '砰!';
        } else if (cycleMs < 3500) {
          // 退壳
          const t = (cycleMs - 2500) / 1000;
          strong = 0; weak = (1 - t) * 0.60;
          if (cycleMs === 2500) subtitle = '退壳!';
        } else {
          strong = 0; weak = 0.05;
        }
        
        if (ms === 0) subtitle = '霰弹枪...';
        if (ms === 50000) subtitle = '连发!';
        if (ms === 90000) subtitle = '最后一发!';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_rain',
    name: 'Left Rain',
    nameZh: '左侧雨滴',
    description: 'Only left motor rain drops (10ms precision)',
    descriptionZh: '仅左侧雨滴（10ms精度）',
    category: 'nature',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 30000) {
          // 小雨
          strong = Math.random() > 0.97 ? 0.30 : 0;
          weak = 0;
          if (ms === 0) subtitle = '毛毛雨...';
        } else if (ms < 60000) {
          // 中雨
          strong = Math.random() > 0.93 ? 0.45 + Math.random() * 0.20 : 0;
          weak = 0;
          if (ms === 30000) subtitle = '雨变大...';
        } else if (ms < 90000) {
          // 暴雨
          strong = Math.random() > 0.88 ? 0.70 + Math.random() * 0.25 : 0.10;
          weak = 0;
          if (ms === 60000) subtitle = '暴雨!';
        } else {
          // 减弱
          const fade = 1 - (ms - 90000) / 30000;
          strong = Math.random() > 0.95 ? (0.35 + Math.random() * 0.15) * fade : 0;
          weak = 0;
          if (ms === 90000) subtitle = '雨渐停...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_wind',
    name: 'Right Wind',
    nameZh: '右侧风声',
    description: 'Only right motor wind (10ms precision)',
    descriptionZh: '仅右侧风声（10ms精度）',
    category: 'nature',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 25000) {
          const freq = 0.1 + t * 0.2;
          strong = 0;
          weak = (0.15 + Math.sin(i * freq) * 0.10) * (0.5 + t * 0.5);
          if (ms === 0) subtitle = '微风...';
        } else if (ms < 55000) {
          const freq = 0.3 + Math.sin((ms - 25000) / 30000 * Math.PI) * 0.3;
          strong = 0;
          weak = 0.50 + Math.sin(i * freq) * 0.25;
          if (ms === 25000) subtitle = '大风!';
        } else if (ms < 85000) {
          const freq = 0.6 + Math.sin((ms - 55000) / 30000 * Math.PI) * 0.4;
          strong = 0;
          weak = 0.75 + Math.sin(i * freq) * 0.20;
          if (ms === 55000) subtitle = '狂风!';
        } else {
          const fade = 1 - (ms - 85000) / 35000;
          strong = 0;
          weak = (0.30 + Math.sin(i * 0.4) * 0.15) * fade;
          if (ms === 85000) subtitle = '风减弱...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_pulse',
    name: 'Left Pulse',
    nameZh: '左侧脉冲',
    description: 'Only left motor pulsing (10ms precision)',
    descriptionZh: '仅左侧脉冲（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        const pulseMs = 1000 - t * 600; // 从1000ms加速到400ms
        const pulsePhase = ms % pulseMs;
        
        if (pulsePhase < 100) {
          const env = Math.sin(pulsePhase / 100 * Math.PI);
          strong = 0.70 * env;
          weak = 0;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '脉冲开始...';
        if (ms === 30000) subtitle = '加速...';
        if (ms === 60000) subtitle = '快速脉冲!';
        if (ms === 90000) subtitle = '极限...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_click',
    name: 'Right Click',
    nameZh: '右侧点击',
    description: 'Only right motor clicking (10ms precision)',
    descriptionZh: '仅右侧点击（10ms精度）',
    category: 'ui',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 40000) {
          // 慢速点击
          const clickMs = 300;
          const clickPhase = ms % clickMs;
          if (clickPhase < 30) {
            const env = Math.sin(clickPhase / 30 * Math.PI);
            strong = 0; weak = 0.50 * env;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 0) subtitle = '慢速点击...';
        } else if (ms < 70000) {
          // 中速
          const clickMs = 150;
          const clickPhase = ms % clickMs;
          if (clickPhase < 20) {
            const env = Math.sin(clickPhase / 20 * Math.PI);
            strong = 0; weak = 0.65 * env;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 40000) subtitle = '加快!';
        } else {
          // 快速
          const clickMs = 80;
          const clickPhase = ms % clickMs;
          if (clickPhase < 12) {
            const env = Math.sin(clickPhase / 12 * Math.PI);
            strong = 0; weak = 0.80 * env;
          } else {
            strong = 0; weak = 0;
          }
          if (ms === 70000) subtitle = '快速连点!';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_servo',
    name: 'Left Servo',
    nameZh: '左侧舵机',
    description: 'Only left motor servo whine (10ms precision)',
    descriptionZh: '仅左侧舵机嗡鸣（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 30000) {
          // 低频嗡鸣
          const freq = 0.2 + t * 0.3;
          strong = 0.30 + Math.sin(i * freq) * 0.15;
          weak = 0;
          if (ms === 0) subtitle = '舵机启动...';
        } else if (ms < 60000) {
          // 升高频
          const freq = 0.5 + Math.sin((ms - 30000) / 30000 * Math.PI) * 0.5;
          strong = 0.50 + Math.sin(i * freq) * 0.20;
          weak = 0;
          if (ms === 30000) subtitle = '加速!';
        } else if (ms < 90000) {
          // 高频
          const freq = 1.0 + Math.sin((ms - 60000) / 30000 * Math.PI) * 0.5;
          strong = 0.70 + Math.sin(i * freq) * 0.15;
          weak = 0;
          if (ms === 60000) subtitle = '高速!';
        } else {
          // 停止
          const fade = 1 - (ms - 90000) / 30000;
          strong = 0.40 * fade + Math.sin(i * 0.8) * 0.10 * fade;
          weak = 0;
          if (ms === 90000) subtitle = '停止...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_engine',
    name: 'Right Engine',
    nameZh: '右侧引擎',
    description: 'Only right motor engine (10ms precision)',
    descriptionZh: '仅右侧引擎（10ms精度）',
    category: 'vehicle',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        if (ms < 20000) {
          // 怠速
          const freq = 0.4 + t * 0.1;
          strong = 0; weak = 0.35 + Math.sin(i * freq) * 0.10;
          if (ms === 0) subtitle = '怠速...';
        } else if (ms < 50000) {
          // 加速
          const freq = 0.5 + (ms - 20000) / 30000 * 0.5;
          const amp = 0.40 + (ms - 20000) / 30000 * 0.35;
          strong = 0; weak = amp + Math.sin(i * freq) * 0.12;
          if (ms === 20000) subtitle = '加速!';
        } else if (ms < 80000) {
          // 高转速
          const freq = 1.0 + Math.sin((ms - 50000) / 30000 * Math.PI) * 0.3;
          strong = 0; weak = 0.80 + Math.sin(i * freq) * 0.15;
          if (ms === 50000) subtitle = '高转速!';
        } else {
          // 减速熄火
          const fade = 1 - (ms - 80000) / 40000;
          const freq = 0.6 * fade + 0.3;
          strong = 0; weak = (0.50 + Math.sin(i * freq) * 0.10) * fade;
          if (ms === 80000) subtitle = '减速...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_left_spring',
    name: 'Left Spring',
    nameZh: '左侧弹簧',
    description: 'Only left motor spring bounce (10ms precision)',
    descriptionZh: '仅左侧弹簧（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        // 每个周期模拟弹簧弹跳
        const cycleMs = 1200;
        const cyclePhase = ms % cycleMs;
        
        if (cycleMs < 100) {
          // 落地瞬间
          strong = 0.85;
          weak = 0;
        } else if (cycleMs < 400) {
          // 弹起
          const t = (cyclePhase - 100) / 300;
          strong = 0.85 * (1 - t) + 0.20 * t;
          strong += Math.sin(t * Math.PI * 3) * 0.15 * (1 - t);
          weak = 0;
        } else if (cyclePhase < 800) {
          // 阻尼振动
          const t = (cyclePhase - 400) / 400;
          const decay = Math.exp(-t * 3);
          strong = 0.20 * decay + Math.sin(t * Math.PI * 4) * 0.10 * decay;
          weak = 0;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '弹簧弹跳...';
        if (ms === 40000) subtitle = '更高!';
        if (ms === 80000) subtitle = '落地!';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'single_right_bass',
    name: 'Right Bass',
    nameZh: '右侧低音',
    description: 'Only right motor deep bass (10ms precision)',
    descriptionZh: '仅右侧低音（10ms精度）',
    category: 'music',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const bpm = 80;
        const beatMs = 60000 / bpm;
        const beatPhase = ms % beatMs;
        
        if (beatPhase < 100) {
          const env = Math.sin(beatPhase / 100 * Math.PI);
          strong = 0; weak = 0.85 * env;
        } else if (beatPhase < 250) {
          const env = Math.sin((beatPhase - 100) / 150 * Math.PI) * 0.5;
          strong = 0; weak = 0.40 * env;
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '深沉的低音...';
        if (ms === 50000) subtitle = 'drop...';
        if (ms === 90000) subtitle = 'bass...';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'alternating_lr',
    name: 'Left Right Alternating',
    nameZh: '左右交替',
    description: 'Alternating left and right motor (10ms precision)',
    descriptionZh: '左右马达交替（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        const cycleMs = 800 - t * 500; // 从800ms加速到300ms
        
        if ((Math.floor(ms / cycleMs) % 2) === 0) {
          strong = 0.60 + Math.sin(i * 0.5) * 0.15;
          weak = 0.05;
        } else {
          strong = 0.05;
          weak = 0.60 + Math.sin(i * 0.5) * 0.15;
        }
        
        if (ms === 0) subtitle = '左...';
        if (ms === 20000) subtitle = '右...左...';
        if (ms === 50000) subtitle = '交替加速!';
        if (ms === 90000) subtitle = '极限切换!';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'wave_sweep',
    name: 'Wave Sweep',
    nameZh: '波形扫频',
    description: 'Sweep from left to right motor (10ms precision)',
    descriptionZh: '从左到右扫频（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const t = ms / TOTAL_DURATION;
        
        // 从左边逐渐移动到右边
        if (t < 0.25) {
          // 仅左
          strong = 0.70; weak = 0.10;
          if (ms === 0) subtitle = '左侧...';
        } else if (t < 0.5) {
          // 左强右弱
          const blend = (t - 0.25) / 0.25;
          strong = 0.70 * (1 - blend) + 0.10 * blend;
          weak = 0.10 * (1 - blend) + 0.70 * blend;
          if (ms === 30000) subtitle = '中间...';
        } else if (t < 0.75) {
          // 右强左弱
          const blend = (t - 0.5) / 0.25;
          strong = 0.10 * (1 - blend) + 0.70 * blend;
          weak = 0.70 * (1 - blend) + 0.10 * blend;
          if (ms === 60000) subtitle = '移动到右侧...';
        } else {
          // 仅右
          strong = 0.10; weak = 0.70;
          if (ms === 90000) subtitle = '右侧...';
        }
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'heartbeat_lr',
    name: 'Heartbeat Left Right',
    nameZh: '心跳左右',
    description: 'Double heartbeat left then right (10ms precision)',
    descriptionZh: '双重心跳左然后右（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        let strong = 0, weak = 0, subtitle: string | undefined;
        
        const bpm = 75;
        const beatInterval = 60000 / bpm;
        const halfBeat = beatInterval / 2;
        const beatPhase = ms % beatInterval;
        
        if (beatPhase < 100) {
          // 左心室
          strong = 0.75; weak = 0.10;
        } else if (beatPhase < 180) {
          // 右心室
          strong = 0.10; weak = 0.65;
        } else if (beatPhase < halfBeat + 80) {
          // 第二次左
          const t = (beatPhase - halfBeat) / 80;
          strong = 0.55 * (1 - t); weak = 0.08 * (1 - t);
        } else if (beatPhase < halfBeat + 150) {
          // 第二次右
          const t = (beatPhase - halfBeat - 80) / 70;
          strong = 0.08 * (1 - t); weak = 0.45 * (1 - t);
        } else {
          strong = 0; weak = 0;
        }
        
        if (ms === 0) subtitle = '真实心跳...';
        if (ms === 40000) subtitle = '加速...';
        if (ms === 80000) subtitle = '强健有力!';
        
        steps.push({ strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION, subtitle });
      }
      return steps;
    },
  },
  {
    id: 'storm_experience',
    name: 'Thunder Storm',
    nameZh: '雷暴体验',
    description: 'Realistic storm with rain and thunder (10ms precision)',
    descriptionZh: '逼真雷暴与雨声（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      // 预设雷声时间点
      const thunderTimes = [32000, 38000, 45000, 52000, 58000, 65000, 72000, 78000, 85000];
      
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS;
        const ms = i * STEP_DURATION;
        const sec = ms / 1000;
        
        let strong = 0, weak = 0;
        
        // 检查是否在雷声范围内
        let isThunder = false;
        let thunderIntensity = 0;
        for (const tTime of thunderTimes) {
          if (ms >= tTime && ms < tTime + 2000) {
            isThunder = true;
            const tPhase = (ms - tTime) / 2000;
            if (tPhase < 0.15) {
              thunderIntensity = 0.95;
            } else if (tPhase < 0.3) {
              thunderIntensity = 0.95 - (tPhase - 0.15) / 0.15 * 0.30;
            } else {
              thunderIntensity = 0.65 * (1 - (tPhase - 0.3) / 0.7);
            }
            break;
          }
        }
        
        if (sec < 30) {
          // 乌云聚集 0-30s
          const windBuild = sec / 30;
          const wind = windBuild * 0.25 + Math.sin(i * 0.05) * 0.05 * windBuild;
          const pressure = Math.sin(i * 0.01) * 0.03;
          strong = 0.05 + wind + pressure;
          weak = 0.08 + wind * 0.9 + pressure;
        } else if (sec < 90) {
          // 暴风雨 30-90s
          const rain = 0.20 + Math.sin(i * 0.3) * 0.08 + Math.sin(i * 0.7) * 0.05;
          const wind = Math.sin(i * 0.02) * 0.12;
          strong = rain + wind + (isThunder ? thunderIntensity : 0);
          weak = rain * 0.85 + wind * 0.9 + (isThunder ? thunderIntensity * 0.95 : 0);
        } else {
          // 雨停 90-120s
          const fadeT = (sec - 90) / 30;
          const rain = (1 - fadeT) * 0.25;
          const wind = (1 - fadeT) * 0.10 + Math.sin(i * 0.03) * 0.03 * (1 - fadeT);
          const drip = ((i % 300) < 20 && fadeT < 0.7) ? 0.08 * (1 - fadeT) : 0;
          strong = rain + wind + drip;
          weak = rain * 0.9 + wind * 0.85;
        }
        
        steps.push({
          strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION,
          subtitle: ms === 0 ? '乌云密布...' :
                   ms === 30000 ? '暴风雨来了!' :
                   (thunderTimes.includes(ms) ? '轰隆隆! 雷声!' : undefined) ||
                   (ms === 90000 ? '风暴减弱...' :
                   ms === 115000 ? '天晴了' : undefined),
        });
      }
      return steps;
    },
  },
  {
    id: 'workout_timer',
    name: 'Workout Timer',
    nameZh: '健身计时器',
    description: 'HIIT training with smooth transitions (10ms precision)',
    descriptionZh: 'HIIT训练平滑过渡（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      
      // 4组，每组30秒 (20秒运动 + 10秒休息)
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const ms = i * STEP_DURATION;
        const cycleMs = ms % 30000; // 每30秒一个周期
        const cycleNum = Math.floor(ms / 30000);
        
        let strong = 0, weak = 0;
        
        if (cycleMs < 20000) {
          // 运动阶段 0-20s
          const workT = cycleMs / 20000;
          const phase = (i % 400) / 400;
          
          // 动态强度曲线
          let intensity = 0.35;
          if (phase < 0.25) {
            intensity = 0.35 + phase / 0.25 * 0.35;
          } else if (phase < 0.5) {
            intensity = 0.70 + Math.sin((phase - 0.25) / 0.25 * Math.PI) * 0.10;
          } else if (phase < 0.75) {
            intensity = 0.70 - (phase - 0.5) / 0.25 * 0.25;
          } else {
            intensity = 0.45 + Math.sin((phase - 0.75) / 0.25 * Math.PI * 2) * 0.08;
          }
          
          // 整体递增
          intensity += workT * 0.15;
          
          // 心跳叠加
          const heartbeat = ((i % 120) < 20) ? 0.10 : 0;
          
          strong = clamp(intensity + heartbeat);
          weak = clamp(intensity + 0.08);
        } else {
          // 休息阶段 20-30s
          const restT = (cycleMs - 20000) / 10000;
          const recovery = 0.35 - restT * 0.25;
          const breath = Math.sin(restT * Math.PI * 4) * 0.05;
          strong = recovery + breath;
          weak = recovery + 0.05 + breath * 0.8;
        }
        
        steps.push({
          strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION,
          subtitle: (cycleMs === 0 && cycleNum < 4) ? `第${cycleNum + 1}组开始! 加油!` :
                   (cycleMs === 15000) ? '坚持!' :
                   (cycleMs === 20000) ? '休息! 深呼吸...' :
                   (cycleMs === 28000) ? '准备下一组!' : undefined,
        });
      }
      return steps;
    },
  },
  {
    id: 'space_adventure',
    name: 'Space Adventure',
    nameZh: '太空冒险',
    description: 'Space journey: launch to landing (10ms precision)',
    descriptionZh: '太空旅行：发射到着陆（10ms精度）',
    category: 'game',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS;
        const ms = i * STEP_DURATION;
        const sec = ms / 1000;
        
        let strong = 0, weak = 0;
        
        if (sec < 10) {
          // 倒计时 0-10s
          const countdown = 10 - Math.floor(sec);
          const tension = sec / 10 * 0.15;
          const beep = ((i % 100) < 20) ? 0.20 : 0;
          const rumble = Math.sin(i * 0.5) * 0.03 * (sec / 10);
          strong = 0.08 + tension + beep + rumble;
          weak = 0.10 + tension + beep * 0.8;
        } else if (sec < 12) {
          // 发射 10-12s
          const launchT = (sec - 10) / 2;
          const ignition = 0.85 + launchT * 0.15;
          const shake = Math.sin(i * 5) * 0.08;
          strong = ignition + shake;
          weak = ignition * 0.95 + shake * 0.8;
        } else if (sec < 30) {
          // 穿越大气层 12-30s
          const atmT = (sec - 12) / 18;
          const turbulence = Math.sin(i * 0.3) * 0.15 + Math.sin(i * 0.8) * 0.08;
          const gForce = 0.70 + Math.sin(atmT * Math.PI) * 0.15;
          const shake = ((i % 80) < 30) ? 0.12 : 0.05;
          strong = gForce + turbulence + shake;
          weak = gForce * 0.9 + turbulence * 0.8;
        } else if (sec < 60) {
          // 进入太空 30-60s
          const spaceT = (sec - 30) / 30;
          const engineOff = (1 - spaceT) * 0.50;
          const weightless = Math.sin(i * 0.01) * 0.05 * spaceT;
          const debris = ((i % 400) < 20) ? 0.08 : 0;
          strong = engineOff + weightless + debris;
          weak = engineOff * 0.9 + weightless;
        } else if (sec < 90) {
          // 太空漫步 60-90s
          const floatT = (sec - 60) / 30;
          const float = Math.sin(i * 0.005) * 0.06;
          const heartbeat = ((i % 200) < 20) ? 0.08 : 0;
          const suit = Math.sin(i * 0.03) * 0.02;
          strong = 0.03 + float + heartbeat;
          weak = 0.05 + float + suit;
        } else {
          // 返回着陆 90-120s
          const returnT = (sec - 90) / 30;
          const reentry = returnT * 0.65;
          const heat = returnT > 0.3 ? Math.sin(i * 0.8) * 0.12 * (returnT - 0.3) : 0;
          const turbulence = returnT > 0.5 ? Math.sin(i * 0.2) * 0.15 * (returnT - 0.5) : 0;
          const parachute = (returnT > 0.7 && (i % 150) < 30) ? 0.20 : 0;
          const landing = returnT > 0.95 ? 0.50 * (returnT - 0.95) / 0.05 : 0;
          strong = reentry + heat + turbulence + parachute + landing;
          weak = reentry * 0.9 + heat * 0.8 + turbulence * 0.8;
        }
        
        steps.push({
          strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION,
          subtitle: ms === 0 ? '发射倒计时...' :
                   (sec < 10 && (i % 100) === 0) ? `${10 - Math.floor(sec)}...` :
                   ms === 10000 ? '发射!!' :
                   ms === 12000 ? '穿越大气层!' :
                   ms === 30000 ? '进入太空!' :
                   ms === 60000 ? '太空漫步中...' :
                   ms === 90000 ? '准备返回!' :
                   ms === 115000 ? '着陆!' : undefined,
        });
      }
      return steps;
    },
  },
  {
    id: 'cooking_simulation',
    name: 'Cooking Simulation',
    nameZh: '烹饪模拟',
    description: 'Kitchen experience with chopping & frying (10ms precision)',
    descriptionZh: '厨房体验：切菜与翻炒（10ms精度）',
    category: 'life',
    totalDuration: TOTAL_DURATION,
    generateSteps: () => {
      const steps: VibrationStep[] = [];
      for (let i = 0; i < TOTAL_STEPS; i++) {
        const t = i / TOTAL_STEPS;
        const ms = i * STEP_DURATION;
        const sec = ms / 1000;
        
        let strong = 0, weak = 0;
        
        if (sec < 30) {
          // 切菜 0-30s
          const chopPhase = (i % 150);
          if (chopPhase < 20) {
            strong = 0.45 + chopPhase / 20 * 0.10;
            weak = 0.40 + chopPhase / 20 * 0.08;
          } else if (chopPhase < 40) {
            strong = 0.55 - (chopPhase - 20) / 20 * 0.30;
            weak = 0.48 - (chopPhase - 20) / 20 * 0.25;
          } else if (chopPhase < 60) {
            strong = 0.25 - (chopPhase - 40) / 20 * 0.15;
            weak = 0.23 - (chopPhase - 40) / 20 * 0.12;
          } else {
            strong = 0.08 + Math.sin((chopPhase - 60) * 0.05) * 0.02;
            weak = 0.10 + Math.sin((chopPhase - 60) * 0.05) * 0.02;
          }
        } else if (sec < 60) {
          // 热锅 30-60s
          const heatT = (sec - 30) / 30;
          const heat = 0.15 + heatT * 0.15;
          const sizzle = Math.sin(i * 1.5) * 0.08 + Math.sin(i * 3) * 0.04;
          const pop = ((i % 250) < 20) ? 0.25 * (1 - (i % 250) / 20) : 0;
          const oil = (heatT > 0.5 && (i % 150) < 30) ? 0.15 : 0;
          strong = heat + sizzle + pop + oil;
          weak = heat + sizzle * 0.7 + pop * 0.8;
        } else if (sec < 90) {
          // 翻炒 60-90s
          const stirPhase = (i % 250);
          if (stirPhase < 50) {
            strong = 0.40 + stirPhase / 50 * 0.30;
            weak = 0.35 + stirPhase / 50 * 0.25;
          } else if (stirPhase < 100) {
            strong = 0.70 - (stirPhase - 50) / 50 * 0.20;
            weak = 0.60 - (stirPhase - 50) / 50 * 0.15;
          } else if (stirPhase < 150) {
            strong = 0.50 + Math.sin((stirPhase - 100) / 50 * Math.PI) * 0.15;
            weak = 0.45 + Math.sin((stirPhase - 100) / 50 * Math.PI) * 0.12;
          } else {
            strong = 0.35 + Math.sin((stirPhase - 150) * 0.03) * 0.05;
            weak = 0.32 + Math.sin((stirPhase - 150) * 0.03) * 0.04;
          }
          const flame = Math.sin(i * 2) * 0.05;
          strong += flame; weak += flame * 0.8;
        } else {
          // 装盘 90-120s
          const plateT = (sec - 90) / 30;
          const base = 0.25 * (1 - plateT * 0.6);
          const pour = ((i % 600) < 100) ? 0.15 + (i % 600) / 100 * 0.10 : 0;
          const garnish = (plateT > 0.7 && (i % 200) < 30) ? 0.12 : 0;
          const plate = Math.sin(i * 0.05) * 0.04 * (1 - plateT);
          strong = base + pour + garnish + plate;
          weak = base + pour * 0.8 + plate;
        }
        
        steps.push({
          strong: clamp(strong), weak: clamp(weak), duration: STEP_DURATION,
          subtitle: ms === 0 ? '开始切菜...' :
                   ms === 30000 ? '热锅中...' :
                   ms === 45000 ? '油热了!' :
                   ms === 60000 ? '开始翻炒!' :
                   ms === 75000 ? '火候正好!' :
                   ms === 90000 ? '出锅装盘...' :
                   ms === 115000 ? '美味完成!' : undefined,
        });
      }
      return steps;
    },
  },
];

// Quick scenes for fast testing (5-30 seconds, lazy generation)
const QUICK_SCENE_DEFINITIONS: SceneDefinition[] = [
  {
    id: 'quick_pulse',
    name: 'Quick Pulse',
    nameZh: '快速脉冲',
    description: '8 pulses for quick vibration test',
    descriptionZh: '8次脉冲快速震动测试',
    category: 'quick',
    totalDuration: 15000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms, total) => {
      const t = ms / total;
      const pulse = Math.sin(t * Math.PI * 8) * 0.5 + 0.5;
      return { strong: pulse, weak: pulse * 0.7, duration: 10 };
    },
  },
  {
    id: 'quick_gradient',
    name: 'Intensity Gradient',
    nameZh: '强度渐变',
    description: 'Smooth 0→1→0 intensity ramp',
    descriptionZh: '平滑0→1→0强度渐变',
    category: 'quick',
    totalDuration: 15000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms, total) => {
      const t = ms / total;
      const ramp = t < 0.5 ? t * 2 : (1 - t) * 2;
      return { strong: ramp, weak: ramp * 0.8, duration: 10 };
    },
  },
  {
    id: 'quick_beat',
    name: 'Rhythm Beat',
    nameZh: '节奏心跳',
    description: 'Heartbeat rhythm at 80 BPM',
    descriptionZh: '80BPM心跳节奏',
    category: 'quick',
    totalDuration: 20000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms) => {
      const bpm = 80;
      const beatInterval = 60000 / bpm;
      const beatPhase = ms % beatInterval;
      let strong = 0, weak = 0;
      if (beatPhase < 100) {
        const env = Math.sin(beatPhase / 100 * Math.PI);
        strong = 0.7 * env;
        weak = 0.6 * env;
      } else if (beatPhase < 180) {
        const env = Math.sin((beatPhase - 100) / 80 * Math.PI);
        strong = 0.5 * env;
        weak = 0.45 * env;
      }
      return { strong, weak, duration: 10 };
    },
  },
  {
    id: 'quick_ramp',
    name: 'Engine Ramp',
    nameZh: '油门加速',
    description: 'Engine RPM ramp up simulation',
    descriptionZh: '引擎RPM加速模拟',
    category: 'quick',
    totalDuration: 20000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms, total) => {
      const t = ms / total;
      const rpm = t * t;
      const freq = 0.3 + rpm * 0.8;
      const amp = 0.3 + rpm * 0.5;
      const strong = amp + Math.sin(ms / 1000 * freq * 100) * 0.1;
      const weak = amp * 0.85 + Math.sin(ms / 1000 * freq * 100) * 0.08;
      return { strong: clamp(strong), weak: clamp(weak), duration: 10 };
    },
  },
  {
    id: 'quick_explosion',
    name: 'Explosion',
    nameZh: '爆炸冲击',
    description: 'Explosion shockwave + aftershock',
    descriptionZh: '爆炸冲击波+余震',
    category: 'quick',
    totalDuration: 10000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms) => {
      let strong = 0, weak = 0;
      if (ms < 200) {
        strong = 1.0; weak = 0.9;
      } else if (ms < 1500) {
        const decay = 1 - (ms - 200) / 1300;
        strong = 0.8 * decay;
        weak = 0.7 * decay;
      } else if (ms < 4000) {
        const shake = Math.sin(ms / 50) * 0.15 + 0.25;
        strong = shake; weak = shake * 0.8;
      } else if (ms < 7000) {
        const fade = 1 - (ms - 4000) / 3000;
        strong = 0.2 * fade;
        weak = 0.18 * fade;
      }
      return { strong, weak, duration: 10 };
    },
  },
  {
    id: 'notification',
    name: 'Notification',
    nameZh: '通知提醒',
    description: 'Double-pulse notification pattern',
    descriptionZh: '双短震通知模式',
    category: 'quick',
    totalDuration: 5000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms) => {
      let strong = 0, weak = 0;
      const pulse1 = ms >= 0 && ms < 150;
      const pulse2 = ms >= 400 && ms < 550;
      if (pulse1 || pulse2) {
        const t = (pulse1 ? ms : ms - 400) / 150;
        const env = Math.sin(t * Math.PI);
        strong = 0.6 * env;
        weak = 0.5 * env;
      }
      return { strong, weak, duration: 10 };
    },
  },
  {
    id: 'call_alert',
    name: 'Call Alert',
    nameZh: '来电提醒',
    description: 'Repeating call vibration pattern',
    descriptionZh: '重复来电震动模式',
    category: 'quick',
    totalDuration: 15000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms) => {
      let strong = 0, weak = 0;
      const cycle = 3000;
      const phase = ms % cycle;
      if (phase < 300) {
        const t = phase / 300;
        const env = Math.sin(t * Math.PI);
        strong = 0.7 * env;
        weak = 0.6 * env;
      } else if (phase >= 800 && phase < 1200) {
        const t = (phase - 800) / 400;
        const env = Math.sin(t * Math.PI);
        strong = 0.7 * env;
        weak = 0.6 * env;
      } else if (phase >= 1800 && phase < 2100) {
        const t = (phase - 1800) / 300;
        const env = Math.sin(t * Math.PI);
        strong = 0.7 * env;
        weak = 0.6 * env;
      }
      return { strong, weak, duration: 10 };
    },
  },
  {
    id: 'quick_asym',
    name: 'Left-Right Alternate',
    nameZh: '左右交替',
    description: 'Quick left-right motor alternation',
    descriptionZh: '快速左右马达交替',
    category: 'quick',
    totalDuration: 15000,
    type: 'lazy',
    generateSteps: () => [],
    getStepAt: (ms) => {
      const cycle = 600;
      const phase = ms % cycle;
      let strong = 0, weak = 0;
      if (phase < 300) {
        const t = phase / 300;
        const env = Math.sin(t * Math.PI);
        strong = 0.6 * env;
        weak = 0.1;
      } else {
        const t = (phase - 300) / 300;
        const env = Math.sin(t * Math.PI);
        strong = 0.1;
        weak = 0.6 * env;
      }
      return { strong, weak, duration: 10 };
    },
  },
];

const getSceneForDisplay = (def: SceneDefinition): VibrationScene => ({
  id: def.id,
  name: def.name,
  nameZh: def.nameZh,
  description: def.description,
  descriptionZh: def.descriptionZh,
  category: def.category,
  totalDuration: def.totalDuration,
  steps: [],
});

const STORAGE_KEY = 'vibration_custom_scenes';

// 波形可视化组件
const WaveformVisualizer = ({ 
  waveformHistory, 
  currentStrong, 
  currentWeak,
  isPlaying 
}: { 
  waveformHistory: WaveformPoint[];
  currentStrong: number;
  currentWeak: number;
  isPlaying: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // 网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let i = 1; i < 5; i++) {
      const x = (width / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px sans-serif';
    ctx.fillText('100%', 2, 12);
    ctx.fillText('0%', 2, height - 4);
    
    if (waveformHistory.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('播放场景后显示波形', width / 2, height / 2);
      ctx.textAlign = 'left';
      return;
    }
    
    const displayDuration = 5000;
    const now = waveformHistory[waveformHistory.length - 1]?.time || 0;
    const startTime = now - displayDuration;
    
    const visiblePoints = waveformHistory.filter(p => p.time >= startTime);
    if (visiblePoints.length < 2) return;
    
    // 强马达填充
    const strongGradient = ctx.createLinearGradient(0, 0, 0, height);
    strongGradient.addColorStop(0, 'rgba(249, 115, 22, 0.6)');
    strongGradient.addColorStop(1, 'rgba(249, 115, 22, 0.1)');
    
    ctx.beginPath();
    ctx.moveTo(0, height);
    visiblePoints.forEach((point, idx) => {
      const x = ((point.time - startTime) / displayDuration) * width;
      const y = height - (point.strong * height * 0.95);
      if (idx === 0) {
        ctx.lineTo(x, height);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    const lastX = ((visiblePoints[visiblePoints.length - 1].time - startTime) / displayDuration) * width;
    ctx.lineTo(lastX, height);
    ctx.closePath();
    ctx.fillStyle = strongGradient;
    ctx.fill();
    
    // 弱马达填充
    const weakGradient = ctx.createLinearGradient(0, 0, 0, height);
    weakGradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    weakGradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    
    ctx.beginPath();
    ctx.moveTo(0, height);
    visiblePoints.forEach((point, idx) => {
      const x = ((point.time - startTime) / displayDuration) * width;
      const y = height - (point.weak * height * 0.95);
      if (idx === 0) {
        ctx.lineTo(x, height);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(lastX, height);
    ctx.closePath();
    ctx.fillStyle = weakGradient;
    ctx.fill();
    
    // 强马达线条
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    visiblePoints.forEach((point, idx) => {
      const x = ((point.time - startTime) / displayDuration) * width;
      const y = height - (point.strong * height * 0.95);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 弱马达线条
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    visiblePoints.forEach((point, idx) => {
      const x = ((point.time - startTime) / displayDuration) * width;
      const y = height - (point.weak * height * 0.95);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 指示器
    if (isPlaying && visiblePoints.length > 0) {
      ctx.fillStyle = '#f97316';
      const strongY = height - (currentStrong * height * 0.95);
      ctx.beginPath();
      ctx.arc(lastX, strongY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#3b82f6';
      const weakY = height - (currentWeak * height * 0.95);
      ctx.beginPath();
      ctx.arc(lastX, weakY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [waveformHistory, currentStrong, currentWeak, isPlaying]);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-orange-500" />
            强马达
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-blue-500" />
            弱马达
          </span>
        </div>
        <span>实时波形 (5秒)</span>
      </div>
      <canvas 
        ref={canvasRef}
        style={{ width: '100%', height: '120px' }}
        className="rounded-lg border border-border"
      />
      {isPlaying && (
        <div className="flex justify-between text-xs font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-orange-500">{(currentStrong * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-blue-500">{(currentWeak * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const VibrationScenePlayer = ({
  gamepad,
  gamepadInfo,
  activeGamepad,
}: VibrationScenePlayerProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [customScenes, setCustomScenes] = useState<CustomScene[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<VibrationStep[]>([]);
  const [recordingName, setRecordingName] = useState('');
  const [showRecording, setShowRecording] = useState(false);
  
  const [waveformHistory, setWaveformHistory] = useState<WaveformPoint[]>([]);
  const [currentStrong, setCurrentStrong] = useState(0);
  const [currentWeak, setCurrentWeak] = useState(0);
  const [motorType, setMotorType] = useState<MotorType>('linear');
  
  const abortRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCustomScenes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom scenes', e);
      }
    }
  }, []);

  const saveCustomScenes = useCallback((scenes: CustomScene[]) => {
    setCustomScenes(scenes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes));
  }, []);

  const allScenes = [
    ...QUICK_SCENE_DEFINITIONS.map(getSceneForDisplay),
    ...SCENE_DEFINITIONS.map(getSceneForDisplay),
    ...customScenes,
  ];

  const scene = selectedScene ? allScenes.find(s => s.id === selectedScene) : null;

  // 高精度播放 - 波形和震动同步
  const playScene = useCallback(async (sceneId: string) => {
    if (activeGamepad === null) return;

    const gp = navigator.getGamepads()[activeGamepad] as ExtendedGamepad | null;
    if (!gp || !gp.vibrationActuator) return;

    // Find scene definition in all scene lists
    const quickSceneDef = QUICK_SCENE_DEFINITIONS.find(s => s.id === sceneId);
    const sceneDef = SCENE_DEFINITIONS.find(s => s.id === sceneId);
    const customScene = customScenes.find(s => s.id === sceneId);

    const isLazy = quickSceneDef?.type === 'lazy' || sceneDef?.type === 'lazy';
    const getStepAt = quickSceneDef?.getStepAt || sceneDef?.getStepAt;
    const steps = sceneDef ? sceneDef.generateSteps() : (customScene?.steps || []);
    const totalDuration = quickSceneDef?.totalDuration || sceneDef?.totalDuration ||
                         (steps.length > 0 ? steps.reduce((acc, step) => acc + step.duration, 0) : 0);

    if (isLazy && !getStepAt) return;
    if (!isLazy && steps.length === 0) return;

    abortRef.current = false;
    setIsPlaying(true);
    setWaveformHistory([]);

    const startTime = performance.now();
    let lastWaveformTime = 0;
    let lastVibrationStrong = -1;
    let lastVibrationWeak = -1;

    // For eager scenes, pre-compute cumulative time array
    const stepEndTimes: number[] = [];
    if (!isLazy) {
      let acc = 0;
      for (const step of steps) {
        acc += step.duration;
        stepEndTimes.push(acc);
      }
    }

    // Binary search for eager scenes
    const findStep = (elapsed: number): number => {
      let lo = 0, hi = stepEndTimes.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (stepEndTimes[mid] <= elapsed) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    
    const animate = (now: number) => {
      if (abortRef.current) {
        setIsPlaying(false);
        // 停止震动
        try {
          gp?.vibrationActuator?.playEffect('dual-rumble', {
            startDelay: 0, duration: 1,
            weakMagnitude: 0, strongMagnitude: 0,
          });
        } catch { /* noop */ }
        return;
      }
      
      const elapsed = now - startTime;
      
      // 完成检测
      if (elapsed >= totalDuration) {
        setIsPlaying(false);
        setProgress(100);
        setCurrentSubtitle(null);
        setCurrentStrong(0);
        setCurrentWeak(0);
        // 停止震动
        try {
          gp?.vibrationActuator?.playEffect('dual-rumble', {
            startDelay: 0, duration: 1,
            weakMagnitude: 0, strongMagnitude: 0,
          });
        } catch { /* noop */ }
        return;
      }
      
      // Get current step (lazy or eager)
      let step: VibrationStep;
      if (isLazy && getStepAt) {
        step = getStepAt(elapsed, totalDuration);
      } else {
        const stepIdx = findStep(elapsed);
        step = steps[stepIdx];
      }
      
      // 更新进度和UI
      setProgress((elapsed / totalDuration) * 100);
      setCurrentStrong(step.strong);
      setCurrentWeak(step.weak);
      
      if (step.subtitle) {
        setCurrentSubtitle(step.subtitle);
      }
      
      // 同步更新波形和震动 - 每30ms更新一次
      const timeSinceLastUpdate = now - lastWaveformTime;
      if (timeSinceLastUpdate >= 30) {
        // 记录波形数据
        setWaveformHistory(prev => {
          const newHistory = [...prev, { strong: step.strong, weak: step.weak, time: elapsed }];
          const cutoff = elapsed - 10000;
          return newHistory.filter(p => p.time >= cutoff);
        });
        
        // 同步发送震动命令 - 仅当强度变化时
        // 根据马达类型决定输出强度
        let outputStrong = step.strong;
        let outputWeak = step.weak;
        
        if (motorType === 'rotor') {
          // 转子马达：量化为4档位（关、低、中、高）
          // 转子马达响应慢，连续变化会变成傻振，需要离散档位
          const quantize = (v: number): number => {
            if (v < 0.1) return 0;        // 关
            if (v < 0.35) return 0.4;     // 低档
            if (v < 0.65) return 0.7;     // 中档
            return 1.0;                    // 高档
          };
          outputStrong = quantize(step.strong);
          outputWeak = quantize(step.weak);
        }
        
        const strongChanged = Math.abs(outputStrong - lastVibrationStrong) > 0.01;
        const weakChanged = Math.abs(outputWeak - lastVibrationWeak) > 0.01;
        const hasOutput = outputStrong > 0 || outputWeak > 0;
        
        // 转子马达：只要有输出就持续发送（保持震动）
        // 线性马达：只在强度变化时发送（避免频繁命令）
        const shouldSend = motorType === 'rotor' 
          ? (hasOutput || strongChanged || weakChanged) // 转子马达持续输出
          : (strongChanged || weakChanged || timeSinceLastUpdate >= 40); // 线性马达变化时输出
        
        if (shouldSend) {
          try {
            gp?.vibrationActuator?.playEffect('dual-rumble', {
              startDelay: 0,
              duration: motorType === 'rotor' ? 60 : 40, // 转子马达duration稍长确保连续
              weakMagnitude: clamp(outputWeak),
              strongMagnitude: clamp(outputStrong),
            });
            lastVibrationStrong = outputStrong;
            lastVibrationWeak = outputWeak;
          } catch { /* noop */ }
        }
        
        lastWaveformTime = now;
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [activeGamepad, customScenes, motorType, QUICK_SCENE_DEFINITIONS, SCENE_DEFINITIONS]);

  const stopPlayback = useCallback(() => {
    abortRef.current = true;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    setProgress(0);
    setCurrentSubtitle(null);
    setCurrentStrong(0);
    setCurrentWeak(0);
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordedSteps([]);
  }, []);

  const addRecordingStep = useCallback((strong: number, weak: number, duration: number, subtitle?: string) => {
    setRecordedSteps(prev => [...prev, { strong, weak, duration, subtitle }]);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const saveRecording = useCallback(() => {
    if (recordedSteps.length === 0 || !recordingName.trim()) return;
    
    const totalDuration = recordedSteps.reduce((acc, step) => acc + step.duration, 0);
    const newScene: CustomScene = {
      id: `custom_${Date.now()}`,
      name: recordingName,
      nameZh: recordingName,
      description: 'Custom recorded scene',
      descriptionZh: '自定义录制场景',
      category: 'custom',
      totalDuration,
      steps: recordedSteps,
      createdAt: Date.now(),
    };
    
    saveCustomScenes([...customScenes, newScene]);
    setRecordedSteps([]);
    setRecordingName('');
    setShowRecording(false);
  }, [recordedSteps, recordingName, customScenes, saveCustomScenes]);

  const deleteCustomScene = useCallback((id: string) => {
    saveCustomScenes(customScenes.filter(s => s.id !== id));
    if (selectedScene === id) setSelectedScene(null);
  }, [customScenes, selectedScene, saveCustomScenes]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gamepad || !gamepadInfo) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {language === 'zh' ? '震动场景播放器' : 'Vibration Scene Player'}
        </h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">
          {t('connectToTestVibration')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full",
            gamepadInfo.hasVibration ? "bg-success animate-pulse" : "bg-muted-foreground"
          )} />
          {language === 'zh' ? '震动场景播放器' : 'Vibration Scene Player'}
          <span className="text-xs text-muted-foreground font-normal">
            (10ms精度)
          </span>
        </h3>
        <button
          onClick={() => setShowRecording(!showRecording)}
          className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-all"
        >
          {showRecording ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* 马达类型切换 */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {language === 'zh' ? '马达类型:' : 'Motor Type:'}
        </span>
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setMotorType('linear')}
            disabled={isPlaying}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              motorType === 'linear'
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              isPlaying && "opacity-50 cursor-not-allowed"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            {language === 'zh' ? '线性马达' : 'Linear'}
          </button>
          <button
            onClick={() => setMotorType('rotor')}
            disabled={isPlaying}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              motorType === 'rotor'
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              isPlaying && "opacity-50 cursor-not-allowed"
            )}
          >
            <RotateCw className="w-3.5 h-3.5" />
            {language === 'zh' ? '转子马达' : 'Rotor'}
          </button>
        </div>
        {motorType === 'rotor' && (
          <span className="text-xs text-muted-foreground">
            {language === 'zh' ? '(4档位输出: 关/低/中/高)' : '(4-level: Off/Low/Mid/High)'}
          </span>
        )}
      </div>

      <div className="mb-6">
        <WaveformVisualizer 
          waveformHistory={waveformHistory}
          currentStrong={currentStrong}
          currentWeak={currentWeak}
          isPlaying={isPlaying}
        />
      </div>

      {showRecording && (
        <div className="bg-muted/30 rounded-xl p-4 mb-6 space-y-4">
          <h4 className="text-sm font-medium">{language === 'zh' ? '自定义录制' : 'Custom Recording'}</h4>
          
          {!isRecording ? (
            <div className="space-y-3">
              <input
                type="text"
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                placeholder={language === 'zh' ? '场景名称' : 'Scene name'}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={startRecording}
                  disabled={!recordingName.trim()}
                  className={cn(
                    "flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2",
                    recordingName.trim()
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="w-2 h-2 bg-current rounded-full animate-pulse" />
                  {language === 'zh' ? '开始录制' : 'Start Recording'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                {language === 'zh' ? '录制中...' : 'Recording...'} ({recordedSteps.length} {language === 'zh' ? '步' : 'steps'})
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: language === 'zh' ? '轻微' : 'Light', strong: 0.2, weak: 0.3 },
                  { label: language === 'zh' ? '中等' : 'Medium', strong: 0.5, weak: 0.6 },
                  { label: language === 'zh' ? '强烈' : 'Strong', strong: 0.9, weak: 1.0 },
                ].map(({ label, strong, weak }) => (
                  <button
                    key={label}
                    onClick={() => addRecordingStep(strong, weak, 500)}
                    className="py-2 bg-primary/20 text-primary rounded-lg text-sm hover:bg-primary/30 transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => addRecordingStep(0, 0, 500)} className="py-2 bg-muted text-muted-foreground rounded-lg text-sm">
                  {language === 'zh' ? '暂停0.5s' : 'Pause 0.5s'}
                </button>
                <button onClick={() => addRecordingStep(0, 0, 1000)} className="py-2 bg-muted text-muted-foreground rounded-lg text-sm">
                  {language === 'zh' ? '暂停1s' : 'Pause 1s'}
                </button>
                <button onClick={() => addRecordingStep(0, 0, 2000)} className="py-2 bg-muted text-muted-foreground rounded-lg text-sm">
                  {language === 'zh' ? '暂停2s' : 'Pause 2s'}
                </button>
              </div>
              
              <div className="flex gap-2">
                <button onClick={stopRecording} className="flex-1 py-2 bg-muted text-muted-foreground rounded-lg">
                  {language === 'zh' ? '停止' : 'Stop'}
                </button>
                <button
                  onClick={saveRecording}
                  disabled={recordedSteps.length === 0}
                  className="flex-1 py-2 bg-success text-success-foreground rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {language === 'zh' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <label className="text-sm text-muted-foreground mb-3 block">
          {language === 'zh' ? '选择场景' : 'Select Scene'}
        </label>
        <ScrollArea className="h-48">
          <div className="space-y-2 pr-4">
            {allScenes.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedScene(selectedScene === s.id ? null : s.id)}
                disabled={isPlaying}
                className={cn(
                  "w-full p-3 rounded-lg border transition-all text-left flex items-center justify-between",
                  selectedScene === s.id
                    ? "bg-primary/20 border-primary"
                    : "bg-muted/30 border-border hover:bg-muted/50",
                  isPlaying && "opacity-50"
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {language === 'zh' ? s.nameZh : s.name}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      s.category === 'game' ? "bg-primary/20 text-primary" :
                      s.category === 'life' ? "bg-success/20 text-success" :
                      s.category === 'quick' ? "bg-accent/20 text-accent" :
                      "bg-warning/20 text-warning"
                    )}>
                      {s.category === 'game' ? (language === 'zh' ? '游戏' : 'Game') :
                       s.category === 'life' ? (language === 'zh' ? '生活' : 'Life') :
                       s.category === 'quick' ? (language === 'zh' ? '快速' : 'Quick') :
                       (language === 'zh' ? '自定义' : 'Custom')}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      s.totalDuration <= 30000 ? "bg-accent/10 text-accent border border-accent/30" :
                      s.totalDuration <= 60000 ? "bg-primary/10 text-primary border border-primary/30" :
                      "bg-muted/30 text-muted-foreground"
                    )}>
                      {s.totalDuration <= 30000 ? (s.totalDuration / 1000) + 's' :
                       s.totalDuration <= 60000 ? '1m' : '2m'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'zh' ? s.descriptionZh : s.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatTime(s.totalDuration)}
                  </span>
                  {s.category === 'custom' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomScene(s.id);
                      }}
                      className="p-1 hover:bg-destructive/20 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {scene && (
        <div className="mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{language === 'zh' ? '播放进度' : 'Progress'}</span>
            <span className="font-mono text-primary">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          
          {currentSubtitle && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
              <p className="text-sm text-primary font-medium animate-fade-in">
                {currentSubtitle}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={isPlaying ? stopPlayback : () => scene && playScene(scene.id)}
          disabled={!scene || !gamepadInfo.hasVibration}
          className={cn(
            "flex-1 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3",
            isPlaying
              ? "bg-destructive text-destructive-foreground"
              : scene && gamepadInfo.hasVibration
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isPlaying ? (
            <>
              <Square className="w-5 h-5" />
              {language === 'zh' ? '停止播放' : 'Stop'}
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              {language === 'zh' ? '开始播放' : 'Play'}
            </>
          )}
        </button>
        
        <button
          onClick={() => {
            setProgress(0);
            setCurrentSubtitle(null);
            setWaveformHistory([]);
            setCurrentStrong(0);
            setCurrentWeak(0);
          }}
          disabled={isPlaying}
          className="p-4 bg-muted rounded-xl hover:bg-muted/80 transition-all disabled:opacity-50"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

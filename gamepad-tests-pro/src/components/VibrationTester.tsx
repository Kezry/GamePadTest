import { useState, useCallback, useRef } from 'react';
import { GamepadState, GamepadInfo, ExtendedGamepad } from '@/hooks/useGamepad';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Vibrate, Heart, Car, AlertTriangle, Zap, CloudRain, Waves, Smartphone, Gamepad2, Music, Wind, Target, Flame, Droplets, Mountain, Sword, Shield, Footprints, Timer, Bell, Sparkles, Volume2, Skull, Trophy, Rocket, Bomb, TreePine, Bird, Fish, Bug, Ghost, Crown, Star, Moon, Sun, ThermometerSun, Snowflake, Hammer, Wrench, Truck, Plane, Ship, Train, Bike, Coffee, Pizza, Cake, Gift, Clock, Phone, Mail, Camera, MessageCircle, Battery, Wifi, Lock, Unlock, Power, Play, Pause, FastForward, Rewind, SkipForward, SkipBack, VolumeX, Mic, MapPin, Navigation, Home, Building, Store, Utensils, Wine, Apple, Banana, Carrot, Egg, IceCream, Cookie, Candy, Popcorn, Sandwich, Soup, Salad, Beef, Drumstick, Eye, Hand, Fingerprint, Laugh, Frown, Meh, ZapOff, Activity, Crosshair, Disc, VolumeX as Mute, Ear, PawPrint, Baby, Sparkle, Sword as Blade } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VibrationTesterProps {
  gamepad: GamepadState | null;
  gamepadInfo: GamepadInfo | null;
  activeGamepad: number | null;
  onTriggerVibration: (
    gamepadIndex: number,
    intensity: 'weak' | 'medium' | 'strong',
    duration: number
  ) => void;
  onVibrationTested?: () => void;
}

interface VibrationPattern {
  id: string;
  nameZh: string;
  icon: typeof Heart;
  category: 'game' | 'vehicle' | 'nature' | 'ui' | 'impact' | 'life' | 'music' | 'sports';
  sequence: { strong: number; weak: number; duration: number }[];
}

const PATTERNS: VibrationPattern[] = [
  // Game Effects (20) - 更细腻的游戏反馈
  { id: 'heartbeat', nameZh: '心跳', icon: Heart, category: 'game', sequence: [
    { strong: 0.7, weak: 0.2, duration: 80 }, { strong: 0.9, weak: 0.4, duration: 60 }, { strong: 0.3, weak: 0.1, duration: 40 },
    { strong: 0, weak: 0, duration: 120 },
    { strong: 0.5, weak: 0.15, duration: 60 }, { strong: 0.7, weak: 0.3, duration: 50 }, { strong: 0.2, weak: 0.1, duration: 40 },
    { strong: 0, weak: 0, duration: 400 }
  ]},
  { id: 'lowHealth', nameZh: '低血量', icon: Skull, category: 'game', sequence: [
    { strong: 0.6, weak: 0.2, duration: 100 }, { strong: 0.9, weak: 0.5, duration: 80 }, { strong: 0.4, weak: 0.2, duration: 60 },
    { strong: 0, weak: 0, duration: 500 },
    { strong: 0.5, weak: 0.2, duration: 90 }, { strong: 0.8, weak: 0.4, duration: 70 }
  ]},
  { id: 'powerUp', nameZh: '加强', icon: Sparkles, category: 'game', sequence: [
    { strong: 0.15, weak: 0.25, duration: 40 }, { strong: 0.25, weak: 0.35, duration: 40 }, { strong: 0.35, weak: 0.45, duration: 40 },
    { strong: 0.45, weak: 0.55, duration: 40 }, { strong: 0.55, weak: 0.65, duration: 40 }, { strong: 0.65, weak: 0.75, duration: 40 },
    { strong: 0.75, weak: 0.85, duration: 50 }, { strong: 0.85, weak: 0.95, duration: 60 }, { strong: 1.0, weak: 1.0, duration: 100 },
    { strong: 0.6, weak: 0.7, duration: 80 }
  ]},
  { id: 'levelUp', nameZh: '升级', icon: Trophy, category: 'game', sequence: [
    { strong: 0.2, weak: 0.4, duration: 60 }, { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.6, weak: 0.8, duration: 80 },
    { strong: 0.8, weak: 0.95, duration: 100 }, { strong: 1.0, weak: 1.0, duration: 150 },
    { strong: 0.7, weak: 0.8, duration: 100 }, { strong: 0.4, weak: 0.5, duration: 150 }, { strong: 0.2, weak: 0.3, duration: 100 }
  ]},
  { id: 'coinCollect', nameZh: '金币', icon: Star, category: 'game', sequence: [
    { strong: 0.3, weak: 0.5, duration: 25 }, { strong: 0.5, weak: 0.7, duration: 20 }, { strong: 0.3, weak: 0.4, duration: 25 }, { strong: 0.1, weak: 0.2, duration: 20 }
  ]},
  { id: 'swordSlash', nameZh: '刀剑', icon: Sword, category: 'game', sequence: [
    { strong: 0.4, weak: 0.2, duration: 20 }, { strong: 0.95, weak: 0.5, duration: 50 }, { strong: 0.7, weak: 0.4, duration: 40 },
    { strong: 0.4, weak: 0.3, duration: 40 }, { strong: 0.2, weak: 0.15, duration: 30 }
  ]},
  { id: 'shieldBlock', nameZh: '盾挡', icon: Shield, category: 'game', sequence: [
    { strong: 1.0, weak: 0.6, duration: 40 }, { strong: 0.8, weak: 0.7, duration: 60 }, { strong: 0.5, weak: 0.55, duration: 80 }, { strong: 0.3, weak: 0.4, duration: 60 }
  ]},
  { id: 'footsteps', nameZh: '脚步', icon: Footprints, category: 'game', sequence: [
    { strong: 0.25, weak: 0.15, duration: 40 }, { strong: 0.35, weak: 0.2, duration: 30 }, { strong: 0.15, weak: 0.1, duration: 20 },
    { strong: 0, weak: 0, duration: 180 },
    { strong: 0.28, weak: 0.18, duration: 40 }, { strong: 0.38, weak: 0.22, duration: 30 }, { strong: 0.18, weak: 0.12, duration: 20 }
  ]},
  { id: 'jump', nameZh: '跳跃', icon: Rocket, category: 'game', sequence: [
    { strong: 0.3, weak: 0.2, duration: 30 }, { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.3, weak: 0.2, duration: 25 }
  ]},
  { id: 'land', nameZh: '落地', icon: Mountain, category: 'game', sequence: [
    { strong: 0.7, weak: 0.4, duration: 50 }, { strong: 0.9, weak: 0.6, duration: 60 }, { strong: 0.5, weak: 0.4, duration: 50 },
    { strong: 0.3, weak: 0.25, duration: 40 }, { strong: 0.15, weak: 0.1, duration: 30 }
  ]},
  { id: 'damage', nameZh: '受伤', icon: Flame, category: 'game', sequence: [
    { strong: 0.95, weak: 0.5, duration: 60 }, { strong: 1.0, weak: 0.7, duration: 50 }, { strong: 0.7, weak: 0.5, duration: 50 },
    { strong: 0.4, weak: 0.35, duration: 60 }, { strong: 0.2, weak: 0.2, duration: 50 }
  ]},
  { id: 'heal', nameZh: '治疗', icon: Heart, category: 'game', sequence: [
    { strong: 0.2, weak: 0.35, duration: 80 }, { strong: 0.25, weak: 0.45, duration: 100 }, { strong: 0.3, weak: 0.5, duration: 120 },
    { strong: 0.25, weak: 0.45, duration: 100 }, { strong: 0.18, weak: 0.35, duration: 80 }
  ]},
  { id: 'magic', nameZh: '魔法', icon: Sparkles, category: 'game', sequence: [
    { strong: 0.3, weak: 0.55, duration: 60 }, { strong: 0.4, weak: 0.7, duration: 70 }, { strong: 0.55, weak: 0.85, duration: 80 },
    { strong: 0.65, weak: 0.95, duration: 90 }, { strong: 0.5, weak: 0.75, duration: 70 }, { strong: 0.3, weak: 0.5, duration: 60 }
  ]},
  { id: 'death', nameZh: '死亡', icon: Ghost, category: 'game', sequence: [
    { strong: 1.0, weak: 1.0, duration: 200 }, { strong: 0.8, weak: 0.8, duration: 150 }, { strong: 0.6, weak: 0.6, duration: 150 },
    { strong: 0.45, weak: 0.45, duration: 200 }, { strong: 0.3, weak: 0.3, duration: 200 }, { strong: 0.15, weak: 0.15, duration: 250 }, { strong: 0.05, weak: 0.05, duration: 300 }
  ]},
  { id: 'victory', nameZh: '胜利', icon: Crown, category: 'game', sequence: [
    { strong: 0.4, weak: 0.5, duration: 60 }, { strong: 0.55, weak: 0.65, duration: 60 }, { strong: 0.7, weak: 0.8, duration: 70 },
    { strong: 0.85, weak: 0.95, duration: 80 }, { strong: 1.0, weak: 1.0, duration: 150 }, { strong: 0.8, weak: 0.9, duration: 100 },
    { strong: 0.6, weak: 0.7, duration: 150 }, { strong: 0.4, weak: 0.5, duration: 150 }
  ]},
  { id: 'respawn', nameZh: '重生', icon: Sparkles, category: 'game', sequence: [
    { strong: 0.1, weak: 0.2, duration: 50 }, { strong: 0.2, weak: 0.35, duration: 60 }, { strong: 0.35, weak: 0.5, duration: 70 },
    { strong: 0.5, weak: 0.65, duration: 80 }, { strong: 0.65, weak: 0.8, duration: 90 }, { strong: 0.45, weak: 0.6, duration: 70 }, { strong: 0.25, weak: 0.4, duration: 60 }
  ]},
  { id: 'countdown', nameZh: '倒计时', icon: Timer, category: 'game', sequence: [
    { strong: 0.45, weak: 0.25, duration: 40 }, { strong: 0.55, weak: 0.35, duration: 35 }, { strong: 0.3, weak: 0.2, duration: 25 }, { strong: 0, weak: 0, duration: 900 }
  ]},
  { id: 'checkpoint', nameZh: '存档点', icon: MapPin, category: 'game', sequence: [
    { strong: 0.35, weak: 0.5, duration: 60 }, { strong: 0.5, weak: 0.7, duration: 80 }, { strong: 0.35, weak: 0.5, duration: 60 }, { strong: 0.2, weak: 0.3, duration: 50 }
  ]},
  { id: 'combo', nameZh: '连击', icon: Zap, category: 'game', sequence: [
    { strong: 0.45, weak: 0.25, duration: 25 }, { strong: 0.55, weak: 0.35, duration: 25 }, { strong: 0.65, weak: 0.45, duration: 25 },
    { strong: 0.75, weak: 0.55, duration: 30 }, { strong: 0.85, weak: 0.65, duration: 35 }
  ]},
  { id: 'critical', nameZh: '暴击', icon: Target, category: 'game', sequence: [
    { strong: 0.6, weak: 0.3, duration: 30 }, { strong: 1.0, weak: 0.7, duration: 60 }, { strong: 0.8, weak: 0.55, duration: 50 },
    { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.25, weak: 0.2, duration: 30 }
  ]},

  // Impact Effects (15) - 更真实的冲击感
  { id: 'explosion', nameZh: '爆炸', icon: Bomb, category: 'impact', sequence: [
    { strong: 0.8, weak: 0.6, duration: 30 }, { strong: 1.0, weak: 1.0, duration: 80 }, { strong: 0.95, weak: 0.9, duration: 60 },
    { strong: 0.75, weak: 0.8, duration: 80 }, { strong: 0.55, weak: 0.65, duration: 100 }, { strong: 0.35, weak: 0.45, duration: 120 },
    { strong: 0.2, weak: 0.3, duration: 150 }, { strong: 0.1, weak: 0.15, duration: 180 }
  ]},
  { id: 'gunshot', nameZh: '枪声', icon: Target, category: 'impact', sequence: [
    { strong: 0.95, weak: 0.4, duration: 35 }, { strong: 1.0, weak: 0.55, duration: 30 }, { strong: 0.6, weak: 0.7, duration: 50 },
    { strong: 0.3, weak: 0.45, duration: 60 }, { strong: 0.15, weak: 0.25, duration: 40 }
  ]},
  { id: 'machineGun', nameZh: '机枪', icon: Target, category: 'impact', sequence: [
    { strong: 0.65, weak: 0.35, duration: 25 }, { strong: 0.25, weak: 0.15, duration: 25 },
    { strong: 0.7, weak: 0.38, duration: 25 }, { strong: 0.28, weak: 0.18, duration: 25 },
    { strong: 0.68, weak: 0.36, duration: 25 }, { strong: 0.26, weak: 0.16, duration: 25 },
    { strong: 0.72, weak: 0.4, duration: 25 }, { strong: 0.27, weak: 0.17, duration: 25 }
  ]},
  { id: 'shotgun', nameZh: '霰弹枪', icon: Zap, category: 'impact', sequence: [
    { strong: 1.0, weak: 0.7, duration: 50 }, { strong: 0.9, weak: 0.85, duration: 60 }, { strong: 0.6, weak: 0.75, duration: 80 },
    { strong: 0.35, weak: 0.5, duration: 100 }, { strong: 0.15, weak: 0.25, duration: 80 }
  ]},
  { id: 'punch', nameZh: '拳击', icon: Hammer, category: 'impact', sequence: [
    { strong: 0.5, weak: 0.2, duration: 20 }, { strong: 0.9, weak: 0.35, duration: 40 }, { strong: 0.5, weak: 0.25, duration: 35 }, { strong: 0.2, weak: 0.15, duration: 25 }
  ]},
  { id: 'kick', nameZh: '踢击', icon: Footprints, category: 'impact', sequence: [
    { strong: 0.4, weak: 0.2, duration: 25 }, { strong: 0.8, weak: 0.45, duration: 55 }, { strong: 0.55, weak: 0.35, duration: 45 },
    { strong: 0.3, weak: 0.2, duration: 35 }, { strong: 0.15, weak: 0.1, duration: 25 }
  ]},
  { id: 'crash', nameZh: '碰撞', icon: AlertTriangle, category: 'impact', sequence: [
    { strong: 0.9, weak: 0.8, duration: 60 }, { strong: 1.0, weak: 1.0, duration: 80 }, { strong: 0.85, weak: 0.75, duration: 60 },
    { strong: 0.6, weak: 0.55, duration: 80 }, { strong: 0.4, weak: 0.4, duration: 100 }, { strong: 0.2, weak: 0.25, duration: 80 }
  ]},
  { id: 'fall', nameZh: '坠落', icon: Mountain, category: 'impact', sequence: [
    { strong: 0.1, weak: 0.08, duration: 50 }, { strong: 0.2, weak: 0.15, duration: 50 }, { strong: 0.35, weak: 0.25, duration: 50 },
    { strong: 0.55, weak: 0.4, duration: 50 }, { strong: 0.8, weak: 0.6, duration: 60 }, { strong: 1.0, weak: 0.85, duration: 80 },
    { strong: 0.6, weak: 0.5, duration: 80 }, { strong: 0.3, weak: 0.25, duration: 60 }
  ]},
  { id: 'earthquake', nameZh: '地震', icon: Waves, category: 'impact', sequence: [
    { strong: 0.25, weak: 0.4, duration: 80 }, { strong: 0.5, weak: 0.65, duration: 100 }, { strong: 0.75, weak: 0.55, duration: 80 },
    { strong: 0.4, weak: 0.7, duration: 100 }, { strong: 0.85, weak: 0.5, duration: 120 }, { strong: 0.35, weak: 0.6, duration: 100 },
    { strong: 0.55, weak: 0.45, duration: 80 }, { strong: 0.2, weak: 0.35, duration: 100 }
  ]},
  { id: 'boulder', nameZh: '巨石', icon: Mountain, category: 'impact', sequence: [
    { strong: 0.4, weak: 0.25, duration: 100 }, { strong: 0.55, weak: 0.35, duration: 80 }, { strong: 0.7, weak: 0.45, duration: 80 },
    { strong: 0.85, weak: 0.6, duration: 100 }, { strong: 1.0, weak: 0.75, duration: 80 }, { strong: 0.6, weak: 0.5, duration: 100 }
  ]},
  { id: 'hammer', nameZh: '锤击', icon: Hammer, category: 'impact', sequence: [
    { strong: 0.6, weak: 0.3, duration: 30 }, { strong: 1.0, weak: 0.55, duration: 70 }, { strong: 0.7, weak: 0.5, duration: 60 },
    { strong: 0.4, weak: 0.35, duration: 80 }, { strong: 0.2, weak: 0.2, duration: 60 }
  ]},
  { id: 'slam', nameZh: '重击', icon: Hammer, category: 'impact', sequence: [
    { strong: 0.7, weak: 0.5, duration: 40 }, { strong: 1.0, weak: 1.0, duration: 80 }, { strong: 0.75, weak: 0.7, duration: 80 },
    { strong: 0.5, weak: 0.5, duration: 100 }, { strong: 0.25, weak: 0.3, duration: 100 }
  ]},
  { id: 'breakGlass', nameZh: '碎玻璃', icon: AlertTriangle, category: 'impact', sequence: [
    { strong: 0.75, weak: 0.85, duration: 35 }, { strong: 0.9, weak: 0.95, duration: 30 }, { strong: 0.55, weak: 0.75, duration: 50 },
    { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.2, weak: 0.35, duration: 50 }, { strong: 0.1, weak: 0.2, duration: 40 }
  ]},
  { id: 'doorSlam', nameZh: '关门', icon: Home, category: 'impact', sequence: [
    { strong: 0.85, weak: 0.45, duration: 50 }, { strong: 0.95, weak: 0.55, duration: 45 }, { strong: 0.5, weak: 0.35, duration: 60 },
    { strong: 0.2, weak: 0.15, duration: 50 }, { strong: 0.08, weak: 0.05, duration: 40 }
  ]},
  { id: 'stomp', nameZh: '跺脚', icon: Footprints, category: 'impact', sequence: [
    { strong: 0.55, weak: 0.3, duration: 35 }, { strong: 0.85, weak: 0.5, duration: 45 }, { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.2, weak: 0.15, duration: 30 }
  ]},

  // Vehicle Effects (15) - 更逼真的载具震动
  { id: 'engine', nameZh: '引擎', icon: Car, category: 'vehicle', sequence: [
    { strong: 0.28, weak: 0.45, duration: 40 }, { strong: 0.22, weak: 0.38, duration: 35 }, { strong: 0.32, weak: 0.52, duration: 40 },
    { strong: 0.25, weak: 0.42, duration: 35 }, { strong: 0.3, weak: 0.48, duration: 40 }
  ]},
  { id: 'roadBump', nameZh: '颠簸', icon: AlertTriangle, category: 'vehicle', sequence: [
    { strong: 0.08, weak: 0.08, duration: 30 }, { strong: 0.35, weak: 0.25, duration: 40 }, { strong: 0.85, weak: 0.65, duration: 80 },
    { strong: 0.55, weak: 0.45, duration: 60 }, { strong: 0.35, weak: 0.3, duration: 50 }, { strong: 0.15, weak: 0.15, duration: 40 }
  ]},
  { id: 'rumbleStrip', nameZh: '减速带', icon: Waves, category: 'vehicle', sequence: [
    { strong: 0.55, weak: 0.75, duration: 25 }, { strong: 0.2, weak: 0.28, duration: 20 },
    { strong: 0.6, weak: 0.8, duration: 25 }, { strong: 0.22, weak: 0.3, duration: 20 },
    { strong: 0.58, weak: 0.78, duration: 25 }, { strong: 0.21, weak: 0.29, duration: 20 },
    { strong: 0.62, weak: 0.82, duration: 25 }, { strong: 0.23, weak: 0.31, duration: 20 }
  ]},
  { id: 'drifting', nameZh: '漂移', icon: Car, category: 'vehicle', sequence: [
    { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.5, weak: 0.7, duration: 70 }, { strong: 0.6, weak: 0.8, duration: 80 },
    { strong: 0.55, weak: 0.75, duration: 70 }, { strong: 0.45, weak: 0.65, duration: 60 }
  ]},
  { id: 'nitro', nameZh: '氮气加速', icon: Rocket, category: 'vehicle', sequence: [
    { strong: 0.6, weak: 0.8, duration: 80 }, { strong: 0.75, weak: 0.9, duration: 100 }, { strong: 0.85, weak: 0.98, duration: 120 },
    { strong: 0.9, weak: 1.0, duration: 150 }, { strong: 0.85, weak: 0.95, duration: 100 }
  ]},
  { id: 'brake', nameZh: '刹车', icon: Car, category: 'vehicle', sequence: [
    { strong: 0.35, weak: 0.25, duration: 50 }, { strong: 0.5, weak: 0.35, duration: 70 }, { strong: 0.65, weak: 0.45, duration: 80 },
    { strong: 0.55, weak: 0.4, duration: 60 }, { strong: 0.35, weak: 0.28, duration: 50 }
  ]},
  { id: 'offroad', nameZh: '越野', icon: Truck, category: 'vehicle', sequence: [
    { strong: 0.35, weak: 0.55, duration: 35 }, { strong: 0.28, weak: 0.45, duration: 30 }, { strong: 0.45, weak: 0.65, duration: 35 },
    { strong: 0.32, weak: 0.52, duration: 30 }, { strong: 0.4, weak: 0.6, duration: 35 }, { strong: 0.3, weak: 0.48, duration: 30 }
  ]},
  { id: 'helicopter', nameZh: '直升机', icon: Plane, category: 'vehicle', sequence: [
    { strong: 0.28, weak: 0.55, duration: 45 }, { strong: 0.25, weak: 0.48, duration: 45 }, { strong: 0.3, weak: 0.58, duration: 45 },
    { strong: 0.26, weak: 0.5, duration: 45 }
  ]},
  { id: 'boat', nameZh: '船只', icon: Ship, category: 'vehicle', sequence: [
    { strong: 0.18, weak: 0.35, duration: 150 }, { strong: 0.25, weak: 0.45, duration: 180 }, { strong: 0.3, weak: 0.5, duration: 160 },
    { strong: 0.25, weak: 0.45, duration: 170 }, { strong: 0.18, weak: 0.35, duration: 150 }
  ]},
  { id: 'train', nameZh: '火车', icon: Train, category: 'vehicle', sequence: [
    { strong: 0.38, weak: 0.28, duration: 80 }, { strong: 0.35, weak: 0.25, duration: 70 }, { strong: 0.4, weak: 0.3, duration: 80 },
    { strong: 0.36, weak: 0.26, duration: 70 }
  ]},
  { id: 'motorcycle', nameZh: '摩托车', icon: Bike, category: 'vehicle', sequence: [
    { strong: 0.45, weak: 0.65, duration: 35 }, { strong: 0.38, weak: 0.55, duration: 30 }, { strong: 0.5, weak: 0.7, duration: 35 },
    { strong: 0.4, weak: 0.58, duration: 30 }
  ]},
  { id: 'airplane', nameZh: '飞机', icon: Plane, category: 'vehicle', sequence: [
    { strong: 0.18, weak: 0.38, duration: 80 }, { strong: 0.22, weak: 0.42, duration: 80 }, { strong: 0.2, weak: 0.4, duration: 80 }
  ]},
  { id: 'turbulence', nameZh: '颠簸气流', icon: Wind, category: 'vehicle', sequence: [
    { strong: 0.25, weak: 0.45, duration: 60 }, { strong: 0.5, weak: 0.7, duration: 50 }, { strong: 0.35, weak: 0.55, duration: 70 },
    { strong: 0.6, weak: 0.8, duration: 50 }, { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.2, weak: 0.4, duration: 70 }
  ]},
  { id: 'gearShift', nameZh: '换挡', icon: Car, category: 'vehicle', sequence: [
    { strong: 0.5, weak: 0.25, duration: 35 }, { strong: 0.65, weak: 0.35, duration: 30 }, { strong: 0.35, weak: 0.2, duration: 35 }, { strong: 0.15, weak: 0.1, duration: 25 }
  ]},
  { id: 'flatTire', nameZh: '爆胎', icon: AlertTriangle, category: 'vehicle', sequence: [
    { strong: 0.75, weak: 0.55, duration: 70 }, { strong: 0.9, weak: 0.7, duration: 60 }, { strong: 0.5, weak: 0.65, duration: 100 },
    { strong: 0.55, weak: 0.75, duration: 80 }, { strong: 0.45, weak: 0.6, duration: 100 }
  ]},

  // Nature Effects (15)
  { id: 'rainDrop', nameZh: '雨滴', icon: CloudRain, category: 'nature', sequence: [
    { strong: 0.25, weak: 0.08, duration: 25 }, { strong: 0.35, weak: 0.12, duration: 20 }, { strong: 0.15, weak: 0.05, duration: 20 },
    { strong: 0, weak: 0, duration: 180 },
    { strong: 0.18, weak: 0.06, duration: 20 }, { strong: 0.28, weak: 0.1, duration: 18 }
  ]},
  { id: 'thunder', nameZh: '雷鸣', icon: Zap, category: 'nature', sequence: [
    { strong: 0.85, weak: 0.65, duration: 60 }, { strong: 1.0, weak: 0.85, duration: 80 }, { strong: 0.7, weak: 0.6, duration: 100 },
    { strong: 0.85, weak: 0.75, duration: 80 }, { strong: 0.55, weak: 0.5, duration: 120 }, { strong: 0.35, weak: 0.35, duration: 150 },
    { strong: 0.2, weak: 0.22, duration: 180 }, { strong: 0.1, weak: 0.12, duration: 150 }
  ]},
  { id: 'wind', nameZh: '风吹', icon: Wind, category: 'nature', sequence: [
    { strong: 0.08, weak: 0.25, duration: 150 }, { strong: 0.15, weak: 0.4, duration: 200 }, { strong: 0.22, weak: 0.52, duration: 180 },
    { strong: 0.18, weak: 0.45, duration: 200 }, { strong: 0.12, weak: 0.35, duration: 170 }
  ]},
  { id: 'waves', nameZh: '海浪', icon: Waves, category: 'nature', sequence: [
    { strong: 0.15, weak: 0.35, duration: 200 }, { strong: 0.25, weak: 0.48, duration: 250 }, { strong: 0.38, weak: 0.58, duration: 300 },
    { strong: 0.45, weak: 0.65, duration: 280 }, { strong: 0.35, weak: 0.55, duration: 250 }, { strong: 0.2, weak: 0.4, duration: 200 }
  ]},
  { id: 'fire', nameZh: '火焰', icon: Flame, category: 'nature', sequence: [
    { strong: 0.28, weak: 0.48, duration: 70 }, { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.4, weak: 0.62, duration: 70 },
    { strong: 0.32, weak: 0.52, duration: 65 }, { strong: 0.38, weak: 0.58, duration: 70 }
  ]},
  { id: 'waterfall', nameZh: '瀑布', icon: Droplets, category: 'nature', sequence: [
    { strong: 0.38, weak: 0.65, duration: 100 }, { strong: 0.45, weak: 0.75, duration: 120 }, { strong: 0.5, weak: 0.8, duration: 110 },
    { strong: 0.42, weak: 0.7, duration: 115 }
  ]},
  { id: 'forest', nameZh: '森林', icon: TreePine, category: 'nature', sequence: [
    { strong: 0.08, weak: 0.18, duration: 150 }, { strong: 0.12, weak: 0.22, duration: 180 }, { strong: 0.1, weak: 0.2, duration: 160 }
  ]},
  { id: 'bird', nameZh: '鸟鸣', icon: Bird, category: 'nature', sequence: [
    { strong: 0.18, weak: 0.08, duration: 30 }, { strong: 0.25, weak: 0.12, duration: 25 }, { strong: 0.12, weak: 0.05, duration: 25 },
    { strong: 0, weak: 0, duration: 80 },
    { strong: 0.22, weak: 0.1, duration: 30 }, { strong: 0.28, weak: 0.15, duration: 28 }
  ]},
  { id: 'snow', nameZh: '雪花', icon: Snowflake, category: 'nature', sequence: [
    { strong: 0.08, weak: 0.12, duration: 80 }, { strong: 0.05, weak: 0.08, duration: 100 }, { strong: 0.1, weak: 0.15, duration: 90 },
    { strong: 0.06, weak: 0.1, duration: 100 }
  ]},
  { id: 'heat', nameZh: '酷热', icon: ThermometerSun, category: 'nature', sequence: [
    { strong: 0.18, weak: 0.28, duration: 200 }, { strong: 0.22, weak: 0.32, duration: 220 }, { strong: 0.2, weak: 0.3, duration: 200 }
  ]},
  { id: 'volcano', nameZh: '火山', icon: Mountain, category: 'nature', sequence: [
    { strong: 0.4, weak: 0.55, duration: 150 }, { strong: 0.55, weak: 0.7, duration: 130 }, { strong: 0.75, weak: 0.85, duration: 150 },
    { strong: 0.9, weak: 0.95, duration: 180 }, { strong: 1.0, weak: 1.0, duration: 200 }, { strong: 0.75, weak: 0.8, duration: 150 }
  ]},
  { id: 'avalanche', nameZh: '雪崩', icon: Mountain, category: 'nature', sequence: [
    { strong: 0.35, weak: 0.45, duration: 80 }, { strong: 0.5, weak: 0.6, duration: 100 }, { strong: 0.65, weak: 0.75, duration: 120 },
    { strong: 0.8, weak: 0.88, duration: 150 }, { strong: 0.92, weak: 0.98, duration: 180 }, { strong: 0.75, weak: 0.85, duration: 150 }
  ]},
  { id: 'storm', nameZh: '暴风雨', icon: CloudRain, category: 'nature', sequence: [
    { strong: 0.45, weak: 0.65, duration: 80 }, { strong: 0.3, weak: 0.48, duration: 100 }, { strong: 0.55, weak: 0.75, duration: 80 },
    { strong: 0.38, weak: 0.55, duration: 100 }, { strong: 0.6, weak: 0.78, duration: 80 }
  ]},
  { id: 'sunrise', nameZh: '日出', icon: Sun, category: 'nature', sequence: [
    { strong: 0.08, weak: 0.15, duration: 150 }, { strong: 0.12, weak: 0.22, duration: 160 }, { strong: 0.18, weak: 0.3, duration: 170 },
    { strong: 0.25, weak: 0.38, duration: 180 }, { strong: 0.32, weak: 0.45, duration: 180 }
  ]},
  { id: 'moonlight', nameZh: '月光', icon: Moon, category: 'nature', sequence: [
    { strong: 0.08, weak: 0.18, duration: 200 }, { strong: 0.12, weak: 0.22, duration: 220 }, { strong: 0.1, weak: 0.2, duration: 200 }
  ]},

  // UI/Notification Effects (10)
  { id: 'notification', nameZh: '通知', icon: Bell, category: 'ui', sequence: [
    { strong: 0.45, weak: 0.65, duration: 70 }, { strong: 0.55, weak: 0.75, duration: 60 }, { strong: 0, weak: 0, duration: 80 },
    { strong: 0.48, weak: 0.68, duration: 70 }, { strong: 0.52, weak: 0.72, duration: 60 }
  ]},
  { id: 'success', nameZh: '成功', icon: Trophy, category: 'ui', sequence: [
    { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.5, weak: 0.7, duration: 70 }, { strong: 0.65, weak: 0.85, duration: 80 },
    { strong: 0.45, weak: 0.6, duration: 70 }
  ]},
  { id: 'error', nameZh: '错误', icon: AlertTriangle, category: 'ui', sequence: [
    { strong: 0.65, weak: 0.45, duration: 70 }, { strong: 0.75, weak: 0.55, duration: 60 }, { strong: 0, weak: 0, duration: 40 },
    { strong: 0.68, weak: 0.48, duration: 70 }, { strong: 0.72, weak: 0.52, duration: 60 }
  ]},
  { id: 'click', nameZh: '点击', icon: Smartphone, category: 'ui', sequence: [
    { strong: 0.28, weak: 0.18, duration: 20 }, { strong: 0.35, weak: 0.22, duration: 18 }, { strong: 0.15, weak: 0.1, duration: 15 }
  ]},
  { id: 'select', nameZh: '选择', icon: Star, category: 'ui', sequence: [
    { strong: 0.35, weak: 0.25, duration: 35 }, { strong: 0.45, weak: 0.32, duration: 30 }, { strong: 0.2, weak: 0.15, duration: 25 }
  ]},
  { id: 'toggle', nameZh: '开关', icon: Power, category: 'ui', sequence: [
    { strong: 0.45, weak: 0.35, duration: 30 }, { strong: 0.55, weak: 0.42, duration: 25 }, { strong: 0.25, weak: 0.2, duration: 25 }
  ]},
  { id: 'scroll', nameZh: '滚动', icon: Smartphone, category: 'ui', sequence: [
    { strong: 0.08, weak: 0.18, duration: 15 }, { strong: 0.12, weak: 0.22, duration: 12 }
  ]},
  { id: 'longPress', nameZh: '长按', icon: Timer, category: 'ui', sequence: [
    { strong: 0.18, weak: 0.28, duration: 40 }, { strong: 0.28, weak: 0.38, duration: 50 }, { strong: 0.38, weak: 0.48, duration: 60 },
    { strong: 0.5, weak: 0.6, duration: 70 }, { strong: 0.62, weak: 0.72, duration: 80 }
  ]},
  { id: 'swipe', nameZh: '滑动', icon: Smartphone, category: 'ui', sequence: [
    { strong: 0.25, weak: 0.35, duration: 40 }, { strong: 0.35, weak: 0.45, duration: 35 }, { strong: 0.2, weak: 0.28, duration: 30 }
  ]},
  { id: 'unlock', nameZh: '解锁', icon: Unlock, category: 'ui', sequence: [
    { strong: 0.45, weak: 0.55, duration: 40 }, { strong: 0.55, weak: 0.65, duration: 35 }, { strong: 0.35, weak: 0.42, duration: 50 }, { strong: 0.2, weak: 0.28, duration: 40 }
  ]},

  // Life/Daily Scenarios (15)
  { id: 'alarm', nameZh: '闹钟', icon: Clock, category: 'life', sequence: [
    { strong: 0.55, weak: 0.75, duration: 80 }, { strong: 0.65, weak: 0.85, duration: 70 }, { strong: 0, weak: 0, duration: 80 },
    { strong: 0.58, weak: 0.78, duration: 80 }, { strong: 0.62, weak: 0.82, duration: 70 }, { strong: 0, weak: 0, duration: 80 }
  ]},
  { id: 'phoneCall', nameZh: '来电', icon: Phone, category: 'life', sequence: [
    { strong: 0.45, weak: 0.65, duration: 150 }, { strong: 0.55, weak: 0.75, duration: 130 }, { strong: 0, weak: 0, duration: 250 },
    { strong: 0.48, weak: 0.68, duration: 150 }, { strong: 0.52, weak: 0.72, duration: 130 }
  ]},
  { id: 'message', nameZh: '短信', icon: MessageCircle, category: 'life', sequence: [
    { strong: 0.38, weak: 0.48, duration: 60 }, { strong: 0.45, weak: 0.55, duration: 50 }, { strong: 0.28, weak: 0.38, duration: 55 }
  ]},
  { id: 'email', nameZh: '邮件', icon: Mail, category: 'life', sequence: [
    { strong: 0.28, weak: 0.45, duration: 70 }, { strong: 0.35, weak: 0.52, duration: 60 }, { strong: 0.2, weak: 0.35, duration: 50 }
  ]},
  { id: 'camera', nameZh: '拍照', icon: Camera, category: 'life', sequence: [
    { strong: 0.45, weak: 0.28, duration: 45 }, { strong: 0.55, weak: 0.35, duration: 40 }, { strong: 0.25, weak: 0.18, duration: 35 }
  ]},
  { id: 'lowBattery', nameZh: '低电量', icon: Battery, category: 'life', sequence: [
    { strong: 0.38, weak: 0.55, duration: 80 }, { strong: 0.45, weak: 0.62, duration: 70 }, { strong: 0, weak: 0, duration: 400 },
    { strong: 0.4, weak: 0.58, duration: 80 }, { strong: 0.42, weak: 0.6, duration: 70 }
  ]},
  { id: 'charging', nameZh: '充电中', icon: Battery, category: 'life', sequence: [
    { strong: 0.18, weak: 0.28, duration: 80 }, { strong: 0.25, weak: 0.35, duration: 90 }, { strong: 0.32, weak: 0.42, duration: 100 }
  ]},
  { id: 'wifi', nameZh: '连接WiFi', icon: Wifi, category: 'life', sequence: [
    { strong: 0.28, weak: 0.38, duration: 40 }, { strong: 0.38, weak: 0.48, duration: 40 }, { strong: 0.48, weak: 0.58, duration: 45 },
    { strong: 0.35, weak: 0.45, duration: 40 }
  ]},
  { id: 'doorbell', nameZh: '门铃', icon: Home, category: 'life', sequence: [
    { strong: 0.55, weak: 0.75, duration: 100 }, { strong: 0.65, weak: 0.85, duration: 90 }, { strong: 0, weak: 0, duration: 80 },
    { strong: 0.58, weak: 0.78, duration: 100 }, { strong: 0.62, weak: 0.82, duration: 90 }
  ]},
  { id: 'microwave', nameZh: '微波炉', icon: Timer, category: 'life', sequence: [
    { strong: 0.38, weak: 0.48, duration: 70 }, { strong: 0.42, weak: 0.52, duration: 65 }, { strong: 0, weak: 0, duration: 80 },
    { strong: 0.4, weak: 0.5, duration: 70 }, { strong: 0.44, weak: 0.54, duration: 65 }, { strong: 0, weak: 0, duration: 80 },
    { strong: 0.42, weak: 0.52, duration: 70 }
  ]},
  { id: 'washer', nameZh: '洗衣机', icon: Waves, category: 'life', sequence: [
    { strong: 0.28, weak: 0.48, duration: 60 }, { strong: 0.35, weak: 0.55, duration: 65 }, { strong: 0.4, weak: 0.6, duration: 60 },
    { strong: 0.32, weak: 0.52, duration: 65 }
  ]},
  { id: 'blender', nameZh: '搅拌机', icon: Waves, category: 'life', sequence: [
    { strong: 0.55, weak: 0.75, duration: 35 }, { strong: 0.48, weak: 0.68, duration: 35 }, { strong: 0.58, weak: 0.78, duration: 35 },
    { strong: 0.5, weak: 0.7, duration: 35 }
  ]},
  { id: 'vacuum', nameZh: '吸尘器', icon: Wind, category: 'life', sequence: [
    { strong: 0.38, weak: 0.58, duration: 70 }, { strong: 0.42, weak: 0.62, duration: 75 }, { strong: 0.4, weak: 0.6, duration: 70 }
  ]},
  { id: 'hairDryer', nameZh: '吹风机', icon: Wind, category: 'life', sequence: [
    { strong: 0.28, weak: 0.48, duration: 60 }, { strong: 0.32, weak: 0.52, duration: 55 }, { strong: 0.3, weak: 0.5, duration: 60 }
  ]},
  { id: 'shaver', nameZh: '剃须刀', icon: Wrench, category: 'life', sequence: [
    { strong: 0.48, weak: 0.38, duration: 30 }, { strong: 0.44, weak: 0.34, duration: 28 }, { strong: 0.5, weak: 0.4, duration: 30 },
    { strong: 0.46, weak: 0.36, duration: 28 }
  ]},

  // Music/Rhythm (10)
  { id: 'bass', nameZh: '低音', icon: Music, category: 'music', sequence: [
    { strong: 0.75, weak: 0.28, duration: 60 }, { strong: 0.85, weak: 0.35, duration: 50 }, { strong: 0.5, weak: 0.22, duration: 45 }
  ]},
  { id: 'drum', nameZh: '鼓点', icon: Music, category: 'music', sequence: [
    { strong: 0.85, weak: 0.38, duration: 40 }, { strong: 0.5, weak: 0.25, duration: 30 }, { strong: 0, weak: 0, duration: 150 },
    { strong: 0.68, weak: 0.3, duration: 35 }, { strong: 0.4, weak: 0.2, duration: 30 }
  ]},
  { id: 'beat', nameZh: '节拍', icon: Music, category: 'music', sequence: [
    { strong: 0.55, weak: 0.38, duration: 45 }, { strong: 0.65, weak: 0.45, duration: 40 }, { strong: 0.35, weak: 0.25, duration: 35 }, { strong: 0, weak: 0, duration: 180 }
  ]},
  { id: 'melody', nameZh: '旋律', icon: Music, category: 'music', sequence: [
    { strong: 0.28, weak: 0.48, duration: 70 }, { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.42, weak: 0.62, duration: 70 },
    { strong: 0.48, weak: 0.68, duration: 80 }, { strong: 0.38, weak: 0.58, duration: 70 }
  ]},
  { id: 'crescendo', nameZh: '渐强', icon: Volume2, category: 'music', sequence: [
    { strong: 0.18, weak: 0.28, duration: 70 }, { strong: 0.28, weak: 0.38, duration: 70 }, { strong: 0.38, weak: 0.48, duration: 70 },
    { strong: 0.48, weak: 0.58, duration: 70 }, { strong: 0.58, weak: 0.68, duration: 70 }, { strong: 0.68, weak: 0.78, duration: 80 },
    { strong: 0.8, weak: 0.9, duration: 90 }
  ]},
  { id: 'drop', nameZh: '节奏落点', icon: Music, category: 'music', sequence: [
    { strong: 0.18, weak: 0.28, duration: 120 }, { strong: 0.25, weak: 0.38, duration: 100 }, { strong: 0.35, weak: 0.5, duration: 80 },
    { strong: 1.0, weak: 1.0, duration: 100 }, { strong: 0.8, weak: 0.85, duration: 80 }, { strong: 0.55, weak: 0.65, duration: 100 }
  ]},
  { id: 'synth', nameZh: '合成器', icon: Music, category: 'music', sequence: [
    { strong: 0.38, weak: 0.65, duration: 45 }, { strong: 0.45, weak: 0.75, duration: 45 }, { strong: 0.52, weak: 0.82, duration: 50 },
    { strong: 0.42, weak: 0.72, duration: 45 }
  ]},
  { id: 'guitar', nameZh: '吉他', icon: Music, category: 'music', sequence: [
    { strong: 0.48, weak: 0.28, duration: 70 }, { strong: 0.55, weak: 0.35, duration: 60 }, { strong: 0.38, weak: 0.25, duration: 100 },
    { strong: 0.28, weak: 0.2, duration: 120 }
  ]},
  { id: 'piano', nameZh: '钢琴', icon: Music, category: 'music', sequence: [
    { strong: 0.38, weak: 0.48, duration: 60 }, { strong: 0.45, weak: 0.55, duration: 50 }, { strong: 0.3, weak: 0.38, duration: 80 },
    { strong: 0.2, weak: 0.28, duration: 100 }
  ]},
  { id: 'applause', nameZh: '掌声', icon: Volume2, category: 'music', sequence: [
    { strong: 0.28, weak: 0.55, duration: 35 }, { strong: 0.35, weak: 0.62, duration: 30 }, { strong: 0.32, weak: 0.58, duration: 35 },
    { strong: 0.4, weak: 0.68, duration: 30 }, { strong: 0.3, weak: 0.55, duration: 35 }, { strong: 0.38, weak: 0.65, duration: 30 }
  ]},

  // Fun/Entertainment (有趣场景)
  { id: 'popcorn', nameZh: '爆米花', icon: Popcorn, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.35, duration: 20 }, { strong: 0.25, weak: 0.45, duration: 15 }, { strong: 0.18, weak: 0.38, duration: 18 },
    { strong: 0.22, weak: 0.42, duration: 22 }, { strong: 0.12, weak: 0.32, duration: 20 }, { strong: 0, weak: 0, duration: 100 },
    { strong: 0.2, weak: 0.4, duration: 16 }, { strong: 0.28, weak: 0.5, duration: 14 }, { strong: 0.16, weak: 0.36, duration: 19 },
    { strong: 0, weak: 0, duration: 80 }, { strong: 0.24, weak: 0.48, duration: 17 }, { strong: 0.14, weak: 0.34, duration: 21 }
  ]},
  { id: 'cinemaSeat', nameZh: '影院座椅', icon: Disc, category: 'fun', sequence: [
    { strong: 0.08, weak: 0.2, duration: 80 }, { strong: 0.12, weak: 0.28, duration: 100 }, { strong: 0.15, weak: 0.35, duration: 120 },
    { strong: 0.1, weak: 0.25, duration: 90 }, { strong: 0.18, weak: 0.4, duration: 150 }, { strong: 0.08, weak: 0.2, duration: 80 }
  ]},
  { id: 'openChest', nameZh: '开宝箱', icon: Gift, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.55, weak: 0.75, duration: 70 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.85, weak: 0.95, duration: 90 }, { strong: 1.0, weak: 1.0, duration: 120 }, { strong: 0.75, weak: 0.85, duration: 100 },
    { strong: 0.55, weak: 0.7, duration: 80 }, { strong: 0.35, weak: 0.5, duration: 60 }
  ]},
  { id: 'winner', nameZh: '大吉大利', icon: Crown, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.6, duration: 50 }, { strong: 0.65, weak: 0.75, duration: 50 }, { strong: 0.8, weak: 0.9, duration: 60 },
    { strong: 0.9, weak: 0.95, duration: 70 }, { strong: 1.0, weak: 1.0, duration: 100 }, { strong: 0.95, weak: 1.0, duration: 100 },
    { strong: 0.85, weak: 0.95, duration: 80 }, { strong: 0.7, weak: 0.85, duration: 80 }, { strong: 0.5, weak: 0.7, duration: 100 }
  ]},
  { id: 'electricShock', nameZh: '触电', icon: Zap, category: 'fun', sequence: [
    { strong: 0.85, weak: 0.9, duration: 25 }, { strong: 0.4, weak: 0.5, duration: 20 }, { strong: 0.9, weak: 0.95, duration: 30 },
    { strong: 0.35, weak: 0.45, duration: 25 }, { strong: 0.75, weak: 0.8, duration: 35 }, { strong: 0.3, weak: 0.4, duration: 20 },
    { strong: 0.6, weak: 0.65, duration: 40 }, { strong: 0.2, weak: 0.3, duration: 30 }
  ]},
  { id: 'nervous', nameZh: '紧张发抖', icon: Fingerprint, category: 'fun', sequence: [
    { strong: 0.12, weak: 0.18, duration: 50 }, { strong: 0.15, weak: 0.22, duration: 45 }, { strong: 0.1, weak: 0.16, duration: 55 },
    { strong: 0.18, weak: 0.25, duration: 48 }, { strong: 0.14, weak: 0.2, duration: 52 }, { strong: 0.16, weak: 0.23, duration: 46 },
    { strong: 0.11, weak: 0.17, duration: 54 }, { strong: 0.13, weak: 0.19, duration: 50 }
  ]},
  { id: 'hiccup', nameZh: '打嗝', icon: Baby, category: 'fun', sequence: [
    { strong: 0.55, weak: 0.35, duration: 30 }, { strong: 0.3, weak: 0.2, duration: 50 }, { strong: 0.6, weak: 0.4, duration: 28 },
    { strong: 0.28, weak: 0.18, duration: 55 }, { strong: 0.58, weak: 0.38, duration: 32 }, { strong: 0.25, weak: 0.15, duration: 52 }
  ]},
  { id: 'whisper', nameZh: '耳语', icon: Ear, category: 'fun', sequence: [
    { strong: 0.02, weak: 0.08, duration: 100 }, { strong: 0.04, weak: 0.1, duration: 120 }, { strong: 0.03, weak: 0.09, duration: 110 },
    { strong: 0.05, weak: 0.12, duration: 130 }, { strong: 0.02, weak: 0.07, duration: 100 }
  ]},
  { id: 'typing', nameZh: '打字机', icon: Hammer, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.2, duration: 15 }, { strong: 0.25, weak: 0.15, duration: 20 }, { strong: 0.4, weak: 0.25, duration: 12 },
    { strong: 0.3, weak: 0.18, duration: 18 }, { strong: 0.38, weak: 0.22, duration: 14 }, { strong: 0.28, weak: 0.16, duration: 22 }
  ]},
  { id: 'drill', nameZh: '电钻', icon: Wrench, category: 'fun', sequence: [
    { strong: 0.65, weak: 0.75, duration: 30 }, { strong: 0.6, weak: 0.7, duration: 28 }, { strong: 0.7, weak: 0.8, duration: 32 },
    { strong: 0.62, weak: 0.72, duration: 30 }, { strong: 0.68, weak: 0.78, duration: 28 }
  ]},
  { id: 'chainsaw', nameZh: '电锯', icon: Blade, category: 'fun', sequence: [
    { strong: 0.85, weak: 0.7, duration: 40 }, { strong: 0.8, weak: 0.65, duration: 38 }, { strong: 0.88, weak: 0.72, duration: 42 },
    { strong: 0.82, weak: 0.68, duration: 40 }, { strong: 0.78, weak: 0.63, duration: 36 }
  ]},
  { id: 'rollerCoaster', nameZh: '过山车', icon: Zap, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.4, duration: 100 }, { strong: 0.5, weak: 0.65, duration: 80 }, { strong: 0.7, weak: 0.8, duration: 60 },
    { strong: 0.9, weak: 0.95, duration: 50 }, { strong: 1.0, weak: 1.0, duration: 80 }, { strong: 0.85, weak: 0.9, duration: 70 },
    { strong: 0.6, weak: 0.7, duration: 90 }, { strong: 0.4, weak: 0.5, duration: 120 }
  ]},
  { id: 'speedboat', nameZh: '快艇', icon: Ship, category: 'fun', sequence: [
    { strong: 0.45, weak: 0.65, duration: 40 }, { strong: 0.35, weak: 0.55, duration: 35 }, { strong: 0.5, weak: 0.7, duration: 45 },
    { strong: 0.4, weak: 0.6, duration: 38 }, { strong: 0.48, weak: 0.68, duration: 42 }
  ]},
  { id: 'catPurr', nameZh: '撸猫', icon: PawPrint, category: 'fun', sequence: [
    { strong: 0.08, weak: 0.22, duration: 120 }, { strong: 0.12, weak: 0.28, duration: 100 }, { strong: 0.1, weak: 0.25, duration: 130 },
    { strong: 0.14, weak: 0.3, duration: 110 }, { strong: 0.09, weak: 0.24, duration: 125 }
  ]},
  { id: 'taiChi', nameZh: '太极', icon: Activity, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.25, duration: 300 }, { strong: 0.2, weak: 0.32, duration: 350 }, { strong: 0.18, weak: 0.28, duration: 320 },
    { strong: 0.22, weak: 0.35, duration: 380 }, { strong: 0.16, weak: 0.26, duration: 300 }
  ]},
  { id: 'dentalDrill', nameZh: '牙医钻', icon: Disc, category: 'fun', sequence: [
    { strong: 0.55, weak: 0.45, duration: 25 }, { strong: 0.6, weak: 0.5, duration: 22 }, { strong: 0.58, weak: 0.48, duration: 24 },
    { strong: 0.62, weak: 0.52, duration: 23 }, { strong: 0.57, weak: 0.47, duration: 26 }
  ]},
  { id: 'laughter', nameZh: '大笑', icon: Laugh, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 60 }, { strong: 0.35, weak: 0.55, duration: 50 }, { strong: 0.4, weak: 0.6, duration: 45 },
    { strong: 0.38, weak: 0.58, duration: 55 }, { strong: 0.32, weak: 0.52, duration: 60 }, { strong: 0.28, weak: 0.48, duration: 70 },
    { strong: 0.25, weak: 0.45, duration: 80 }
  ]},
  { id: 'subway', nameZh: '地铁', icon: Train, category: 'fun', sequence: [
    { strong: 0.25, weak: 0.35, duration: 60 }, { strong: 0.22, weak: 0.32, duration: 55 }, { strong: 0.28, weak: 0.38, duration: 65 },
    { strong: 0.24, weak: 0.34, duration: 58 }, { strong: 0.26, weak: 0.36, duration: 62 }
  ]},
  { id: 'hairBrushing', nameZh: '梳头', icon: Sparkle, category: 'fun', sequence: [
    { strong: 0.05, weak: 0.15, duration: 80 }, { strong: 0.08, weak: 0.2, duration: 70 }, { strong: 0.06, weak: 0.18, duration: 90 },
    { strong: 0.1, weak: 0.22, duration: 75 }, { strong: 0.07, weak: 0.17, duration: 85 }
  ]},
  { id: '4dChair', nameZh: '4D座椅', icon: Disc, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.6, duration: 100 }, { strong: 0.6, weak: 0.75, duration: 80 }, { strong: 0.8, weak: 0.9, duration: 60 },
    { strong: 0.55, weak: 0.7, duration: 120 }, { strong: 0.35, weak: 0.5, duration: 150 }, { strong: 0.7, weak: 0.85, duration: 90 },
    { strong: 0.45, weak: 0.65, duration: 110 }
  ]},
  { id: 'explorer', nameZh: '探险', icon: MapPin, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.35, duration: 150 }, { strong: 0.35, weak: 0.5, duration: 120 }, { strong: 0.5, weak: 0.65, duration: 100 },
    { strong: 0.65, weak: 0.8, duration: 80 }, { strong: 0.45, weak: 0.6, duration: 130 }, { strong: 0.25, weak: 0.4, duration: 160 }
  ]},
  { id: 'meditation', nameZh: '冥想', icon: Sparkle, category: 'fun', sequence: [
    { strong: 0.02, weak: 0.05, duration: 500 }, { strong: 0.03, weak: 0.08, duration: 600 }, { strong: 0.04, weak: 0.1, duration: 550 },
    { strong: 0.03, weak: 0.07, duration: 580 }, { strong: 0.02, weak: 0.06, duration: 520 }
  ]},
  { id: 'heartbeat2', nameZh: '心动', icon: Heart, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.15, duration: 50 }, { strong: 0.7, weak: 0.2, duration: 40 }, { strong: 0.25, weak: 0.1, duration: 30 },
    { strong: 0, weak: 0, duration: 100 }, { strong: 0.55, weak: 0.18, duration: 48 }, { strong: 0.75, weak: 0.22, duration: 38 },
    { strong: 0.2, weak: 0.08, duration: 35 }
  ]},
  { id: 'crying', nameZh: '大哭', icon: Frown, category: 'fun', sequence: [
    { strong: 0.45, weak: 0.35, duration: 80 }, { strong: 0.5, weak: 0.4, duration: 70 }, { strong: 0.4, weak: 0.3, duration: 90 },
    { strong: 0.48, weak: 0.38, duration: 75 }, { strong: 0.52, weak: 0.42, duration: 68 }, { strong: 0.38, weak: 0.28, duration: 95 },
    { strong: 0.46, weak: 0.36, duration: 82 }
  ]},
  { id: 'snoring', nameZh: '打呼噜', icon: Moon, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.5, duration: 200 }, { strong: 0.45, weak: 0.6, duration: 250 }, { strong: 0.4, weak: 0.55, duration: 220 },
    { strong: 0.5, weak: 0.65, duration: 280 }, { strong: 0.38, weak: 0.52, duration: 240 }
  ]},
  { id: 'brushingTeeth', nameZh: '刷牙', icon: Disc, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.3, duration: 40 }, { strong: 0.25, weak: 0.35, duration: 35 }, { strong: 0.18, weak: 0.28, duration: 45 },
    { strong: 0.22, weak: 0.32, duration: 38 }, { strong: 0.2, weak: 0.3, duration: 42 }
  ]},
  { id: 'washingMachine', nameZh: '洗衣机', icon: Waves, category: 'fun', sequence: [
    { strong: 0.18, weak: 0.38, duration: 200 }, { strong: 0.25, weak: 0.45, duration: 220 }, { strong: 0.2, weak: 0.4, duration: 210 },
    { strong: 0.22, weak: 0.42, duration: 215 }
  ]},
  { id: 'heartAttack', nameZh: '心惊肉跳', icon: Skull, category: 'fun', sequence: [
    { strong: 0.8, weak: 0.6, duration: 40 }, { strong: 0.9, weak: 0.7, duration: 35 }, { strong: 1.0, weak: 0.8, duration: 50 },
    { strong: 0.7, weak: 0.55, duration: 45 }, { strong: 0.85, weak: 0.65, duration: 38 }, { strong: 0.6, weak: 0.5, duration: 55 },
    { strong: 0.75, weak: 0.6, duration: 42 }
  ]},
  { id: 'fireworks', nameZh: '烟花', icon: Star, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.7, duration: 60 }, { strong: 0.7, weak: 0.85, duration: 50 }, { strong: 0.85, weak: 0.95, duration: 70 },
    { strong: 0.6, weak: 0.8, duration: 55 }, { strong: 0.4, weak: 0.6, duration: 80 }, { strong: 0.55, weak: 0.75, duration: 65 },
    { strong: 0.3, weak: 0.5, duration: 90 }
  ]},
  { id: 'motorcycle2', nameZh: '摩托引擎', icon: Bike, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.7, duration: 30 }, { strong: 0.45, weak: 0.65, duration: 28 }, { strong: 0.55, weak: 0.75, duration: 32 },
    { strong: 0.48, weak: 0.68, duration: 30 }
  ]},
  { id: 'subwayDoor', nameZh: '地铁关门', icon: Mute, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.35, duration: 40 }, { strong: 0.75, weak: 0.45, duration: 50 }, { strong: 0.5, weak: 0.3, duration: 45 },
    { strong: 0.25, weak: 0.15, duration: 50 }, { strong: 0.1, weak: 0.05, duration: 40 }
  ]},
  { id: 'chineseNewYear', nameZh: '过年', icon: Gift, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.6, duration: 50 }, { strong: 0.6, weak: 0.8, duration: 60 }, { strong: 0.8, weak: 0.95, duration: 70 },
    { strong: 1.0, weak: 1.0, duration: 100 }, { strong: 0.85, weak: 0.9, duration: 80 }, { strong: 0.65, weak: 0.75, duration: 70 },
    { strong: 0.5, weak: 0.65, duration: 80 }, { strong: 0.7, weak: 0.85, duration: 60 }, { strong: 0.9, weak: 1.0, duration: 90 }
  ]},
  { id: 'earthquake', nameZh: '地震', icon: AlertTriangle, category: 'fun', sequence: [
    { strong: 0.7, weak: 0.85, duration: 100 }, { strong: 0.9, weak: 1.0, duration: 80 }, { strong: 0.6, weak: 0.75, duration: 120 },
    { strong: 0.85, weak: 0.95, duration: 90 }, { strong: 0.5, weak: 0.7, duration: 150 }, { strong: 0.8, weak: 0.9, duration: 100 },
    { strong: 0.65, weak: 0.8, duration: 110 }, { strong: 0.45, weak: 0.6, duration: 140 }
  ]},
  { id: 'boss', nameZh: '老板来了', icon: Skull, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.4, duration: 30 }, { strong: 0.75, weak: 0.55, duration: 25 }, { strong: 0.5, weak: 0.35, duration: 35 },
    { strong: 0.8, weak: 0.6, duration: 28 }, { strong: 0.55, weak: 0.4, duration: 32 }, { strong: 0.7, weak: 0.5, duration: 30 },
    { strong: 0.45, weak: 0.3, duration: 40 }
  ]},
  { id: 'gamingSetup', nameZh: '电竞外设', icon: Gamepad2, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.35, duration: 40 }, { strong: 0.2, weak: 0.45, duration: 35 }, { strong: 0.18, weak: 0.4, duration: 38 },
    { strong: 0.22, weak: 0.48, duration: 36 }, { strong: 0.16, weak: 0.38, duration: 42 }
  ]},
  { id: 'magicCast', nameZh: '施法', icon: Sparkles, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.4, duration: 80 }, { strong: 0.35, weak: 0.6, duration: 100 }, { strong: 0.5, weak: 0.75, duration: 120 },
    { strong: 0.65, weak: 0.85, duration: 100 }, { strong: 0.8, weak: 0.95, duration: 80 }, { strong: 0.6, weak: 0.8, duration: 90 },
    { strong: 0.4, weak: 0.6, duration: 70 }
  ]},
  { id: 'beerTap', nameZh: '扎啤', icon: Wine, category: 'fun', sequence: [
    { strong: 0.25, weak: 0.45, duration: 60 }, { strong: 0.35, weak: 0.55, duration: 55 }, { strong: 0.2, weak: 0.4, duration: 65 },
    { strong: 0.3, weak: 0.5, duration: 58 }, { strong: 0.28, weak: 0.48, duration: 62 }
  ]},
  { id: 'slap', nameZh: '拍脸', icon: Hand, category: 'fun', sequence: [
    { strong: 0.7, weak: 0.4, duration: 30 }, { strong: 0.9, weak: 0.55, duration: 25 }, { strong: 0.6, weak: 0.35, duration: 40 },
    { strong: 0.4, weak: 0.25, duration: 50 }
  ]},
  { id: 'kickDoor', nameZh: '踹门', icon: Home, category: 'fun', sequence: [
    { strong: 0.9, weak: 0.5, duration: 40 }, { strong: 1.0, weak: 0.65, duration: 60 }, { strong: 0.75, weak: 0.45, duration: 70 },
    { strong: 0.5, weak: 0.3, duration: 80 }, { strong: 0.3, weak: 0.2, duration: 60 }
  ]},
  { id: 'phoneVibrate', nameZh: '手机震动', icon: Phone, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.5, duration: 80 }, { strong: 0.5, weak: 0.6, duration: 70 }, { strong: 0.35, weak: 0.45, duration: 90 }
  ]},
  { id: 'afk', nameZh: '挂机', icon: Coffee, category: 'fun', sequence: [
    { strong: 0.05, weak: 0.1, duration: 500 }, { strong: 0.08, weak: 0.15, duration: 600 }, { strong: 0.06, weak: 0.12, duration: 550 }
  ]},
  { id: 'coffee', nameZh: '咖啡机', icon: Coffee, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.35, duration: 100 }, { strong: 0.2, weak: 0.4, duration: 120 }, { strong: 0.18, weak: 0.38, duration: 110 },
    { strong: 0.22, weak: 0.42, duration: 130 }
  ]},
  { id: 'bubble', nameZh: '冒泡', icon: Disc, category: 'fun', sequence: [
    { strong: 0.1, weak: 0.25, duration: 80 }, { strong: 0.15, weak: 0.3, duration: 70 }, { strong: 0.12, weak: 0.28, duration: 90 },
    { strong: 0.18, weak: 0.35, duration: 75 }, { strong: 0.14, weak: 0.32, duration: 85 }
  ]},
  { id: 'tattoo', nameZh: '纹身', icon: Zap, category: 'fun', sequence: [
    { strong: 0.55, weak: 0.35, duration: 20 }, { strong: 0.6, weak: 0.4, duration: 18 }, { strong: 0.58, weak: 0.38, duration: 22 },
    { strong: 0.62, weak: 0.42, duration: 20 }, { strong: 0.56, weak: 0.36, duration: 24 }
  ]},
  { id: 'racing', nameZh: '赛车', icon: Car, category: 'fun', sequence: [
    { strong: 0.55, weak: 0.75, duration: 35 }, { strong: 0.5, weak: 0.7, duration: 30 }, { strong: 0.6, weak: 0.8, duration: 38 },
    { strong: 0.52, weak: 0.72, duration: 32 }, { strong: 0.58, weak: 0.78, duration: 36 }
  ]},
  { id: 'shootingRange', nameZh: '射击', icon: Crosshair, category: 'fun', sequence: [
    { strong: 0.85, weak: 0.4, duration: 35 }, { strong: 0.9, weak: 0.45, duration: 30 }, { strong: 0.55, weak: 0.6, duration: 50 },
    { strong: 0.3, weak: 0.4, duration: 40 }
  ]},
  { id: 'treasure', nameZh: '开盲盒', icon: Gift, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 60 }, { strong: 0.45, weak: 0.65, duration: 70 }, { strong: 0.6, weak: 0.8, duration: 80 },
    { strong: 0.8, weak: 0.95, duration: 100 }, { strong: 1.0, weak: 1.0, duration: 150 }, { strong: 0.7, weak: 0.85, duration: 100 },
    { strong: 0.5, weak: 0.7, duration: 80 }
  ]},
  { id: 'sneeze', nameZh: '打喷嚏', icon: Wind, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.5, duration: 40 }, { strong: 0.55, weak: 0.65, duration: 35 }, { strong: 0.7, weak: 0.8, duration: 50 },
    { strong: 0.85, weak: 0.9, duration: 45 }, { strong: 0.4, weak: 0.5, duration: 60 }
  ]},
  { id: 'massage', nameZh: '按摩', icon: Hand, category: 'fun', sequence: [
    { strong: 0.25, weak: 0.45, duration: 120 }, { strong: 0.3, weak: 0.5, duration: 110 }, { strong: 0.28, weak: 0.48, duration: 130 },
    { strong: 0.32, weak: 0.52, duration: 115 }
  ]},
  { id: 'stomach', nameZh: '肚子叫', icon: Disc, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.4, duration: 100 }, { strong: 0.3, weak: 0.5, duration: 90 }, { strong: 0.25, weak: 0.45, duration: 110 },
    { strong: 0.35, weak: 0.55, duration: 85 }, { strong: 0.22, weak: 0.42, duration: 105 }
  ]},
  { id: 'doorKnock', nameZh: '敲门', icon: Home, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.4, duration: 30 }, { strong: 0.65, weak: 0.45, duration: 28 }, { strong: 0, weak: 0, duration: 100 },
    { strong: 0.7, weak: 0.5, duration: 32 }, { strong: 0.75, weak: 0.55, duration: 30 }, { strong: 0, weak: 0, duration: 150 },
    { strong: 0.65, weak: 0.45, duration: 28 }
  ]},
  { id: 'punch2', nameZh: '一拳', icon: Zap, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.3, duration: 25 }, { strong: 1.0, weak: 0.6, duration: 50 }, { strong: 0.8, weak: 0.5, duration: 40 },
    { strong: 0.5, weak: 0.3, duration: 35 }, { strong: 0.25, weak: 0.15, duration: 30 }
  ]},
  { id: 'bungee', nameZh: '蹦极', icon: Zap, category: 'fun', sequence: [
    { strong: 0.1, weak: 0.15, duration: 50 }, { strong: 0.2, weak: 0.3, duration: 60 }, { strong: 0.35, weak: 0.5, duration: 80 },
    { strong: 0.55, weak: 0.7, duration: 100 }, { strong: 0.8, weak: 0.9, duration: 80 }, { strong: 0.6, weak: 0.75, duration: 100 },
    { strong: 0.4, weak: 0.55, duration: 120 }, { strong: 0.2, weak: 0.35, duration: 100 }
  ]},
  { id: 'waterSlide', nameZh: '水滑梯', icon: Droplets, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 80 }, { strong: 0.45, weak: 0.65, duration: 70 }, { strong: 0.6, weak: 0.75, duration: 60 },
    { strong: 0.4, weak: 0.6, duration: 90 }, { strong: 0.25, weak: 0.4, duration: 100 }, { strong: 0.5, weak: 0.7, duration: 75 }
  ]},
  { id: 'zombie', nameZh: '僵尸', icon: Ghost, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.25, duration: 200 }, { strong: 0.25, weak: 0.35, duration: 180 }, { strong: 0.2, weak: 0.3, duration: 220 },
    { strong: 0.3, weak: 0.4, duration: 190 }, { strong: 0.18, weak: 0.28, duration: 210 }
  ]},
  { id: 'alien', nameZh: '外星人', icon: Eye, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.6, duration: 100 }, { strong: 0.5, weak: 0.75, duration: 80 }, { strong: 0.65, weak: 0.85, duration: 90 },
    { strong: 0.4, weak: 0.65, duration: 110 }, { strong: 0.25, weak: 0.5, duration: 130 }
  ]},
  { id: 'robot', nameZh: '机器人', icon: Disc, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.5, duration: 60 }, { strong: 0.5, weak: 0.6, duration: 55 }, { strong: 0.45, weak: 0.55, duration: 65 },
    { strong: 0.55, weak: 0.65, duration: 50 }, { strong: 0.42, weak: 0.52, duration: 58 }
  ]},
  { id: 'thunderStep', nameZh: '打雷', icon: CloudRain, category: 'fun', sequence: [
    { strong: 0.8, weak: 0.6, duration: 50 }, { strong: 0.6, weak: 0.45, duration: 60 }, { strong: 0.9, weak: 0.7, duration: 45 },
    { strong: 0.7, weak: 0.55, duration: 70 }, { strong: 0.5, weak: 0.4, duration: 80 }, { strong: 0.85, weak: 0.65, duration: 55 },
    { strong: 0.65, weak: 0.5, duration: 75 }, { strong: 0.4, weak: 0.3, duration: 100 }
  ]},
  { id: 'timeMachine', nameZh: '时光机', icon: Clock, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 80 }, { strong: 0.45, weak: 0.65, duration: 70 }, { strong: 0.6, weak: 0.8, duration: 60 },
    { strong: 0.8, weak: 0.95, duration: 100 }, { strong: 0.6, weak: 0.75, duration: 80 }, { strong: 0.4, weak: 0.6, duration: 90 },
    { strong: 0.2, weak: 0.4, duration: 120 }, { strong: 0.1, weak: 0.2, duration: 150 }
  ]},
  { id: 'propeller', nameZh: '螺旋桨', icon: Wind, category: 'fun', sequence: [
    { strong: 0.45, weak: 0.65, duration: 40 }, { strong: 0.4, weak: 0.6, duration: 38 }, { strong: 0.48, weak: 0.68, duration: 42 },
    { strong: 0.42, weak: 0.62, duration: 40 }
  ]},
  { id: 'spaceship', nameZh: '飞船', icon: Rocket, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.5, weak: 0.7, duration: 55 }, { strong: 0.65, weak: 0.8, duration: 70 },
    { strong: 0.45, weak: 0.65, duration: 65 }, { strong: 0.3, weak: 0.5, duration: 75 }
  ]},
  { id: 'jungle', nameZh: '丛林', icon: TreePine, category: 'fun', sequence: [
    { strong: 0.08, weak: 0.2, duration: 150 }, { strong: 0.12, weak: 0.25, duration: 180 }, { strong: 0.1, weak: 0.22, duration: 160 },
    { strong: 0.15, weak: 0.28, duration: 170 }
  ]},
  { id: 'desert', nameZh: '沙漠', icon: Sun, category: 'fun', sequence: [
    { strong: 0.05, weak: 0.12, duration: 200 }, { strong: 0.08, weak: 0.18, duration: 220 }, { strong: 0.06, weak: 0.15, duration: 210 }
  ]},
  { id: 'snow2', nameZh: '暴风雪', icon: Snowflake, category: 'fun', sequence: [
    { strong: 0.25, weak: 0.45, duration: 80 }, { strong: 0.35, weak: 0.55, duration: 70 }, { strong: 0.3, weak: 0.5, duration: 90 },
    { strong: 0.4, weak: 0.6, duration: 75 }, { strong: 0.28, weak: 0.48, duration: 85 }
  ]},
  { id: 'volcano2', nameZh: '火山爆发', icon: Flame, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.65, duration: 100 }, { strong: 0.7, weak: 0.8, duration: 120 }, { strong: 0.85, weak: 0.95, duration: 150 },
    { strong: 1.0, weak: 1.0, duration: 200 }, { strong: 0.9, weak: 0.95, duration: 180 }, { strong: 0.75, weak: 0.85, duration: 150 },
    { strong: 0.6, weak: 0.7, duration: 120 }
  ]},
  { id: 'tsunami', nameZh: '海啸', icon: Waves, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.4, duration: 100 }, { strong: 0.35, weak: 0.55, duration: 120 }, { strong: 0.5, weak: 0.7, duration: 150 },
    { strong: 0.7, weak: 0.85, duration: 180 }, { strong: 0.9, weak: 1.0, duration: 200 }, { strong: 0.75, weak: 0.9, duration: 170 },
    { strong: 0.55, weak: 0.7, duration: 160 }, { strong: 0.35, weak: 0.5, duration: 150 }
  ]},
  { id: 'avalanche2', nameZh: '雪崩', icon: Mountain, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 80 }, { strong: 0.45, weak: 0.65, duration: 100 }, { strong: 0.6, weak: 0.75, duration: 120 },
    { strong: 0.75, weak: 0.9, duration: 150 }, { strong: 0.85, weak: 0.95, duration: 180 }, { strong: 0.7, weak: 0.85, duration: 150 }
  ]},
  { id: 'beerBottle', nameZh: '开啤酒', icon: Wine, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.3, duration: 30 }, { strong: 0.7, weak: 0.45, duration: 40 }, { strong: 0.4, weak: 0.25, duration: 50 },
    { strong: 0.2, weak: 0.15, duration: 60 }
  ]},
  { id: 'corkPop', nameZh: '开香槟', icon: Sparkle, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.4, duration: 35 }, { strong: 0.8, weak: 0.55, duration: 45 }, { strong: 0.5, weak: 0.35, duration: 55 },
    { strong: 0.3, weak: 0.2, duration: 70 }, { strong: 0.15, weak: 0.1, duration: 100 }
  ]},
  { id: 'laser', nameZh: '激光剑', icon: Zap, category: 'fun', sequence: [
    { strong: 0.7, weak: 0.85, duration: 40 }, { strong: 0.8, weak: 0.9, duration: 50 }, { strong: 0.65, weak: 0.8, duration: 45 },
    { strong: 0.75, weak: 0.88, duration: 48 }
  ]},
  { id: 'jetpack', nameZh: '喷气背包', icon: Rocket, category: 'fun', sequence: [
    { strong: 0.45, weak: 0.7, duration: 50 }, { strong: 0.55, weak: 0.8, duration: 45 }, { strong: 0.5, weak: 0.75, duration: 55 },
    { strong: 0.6, weak: 0.85, duration: 48 }
  ]},
  { id: 'banana', nameZh: '香蕉皮', icon: AlertTriangle, category: 'fun', sequence: [
    { strong: 0.7, weak: 0.5, duration: 50 }, { strong: 0.85, weak: 0.65, duration: 60 }, { strong: 0.6, weak: 0.45, duration: 80 },
    { strong: 0.4, weak: 0.3, duration: 100 }, { strong: 0.2, weak: 0.15, duration: 80 }
  ]},
  { id: 'slip', nameZh: '滑倒', icon: Footprints, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.3, duration: 40 }, { strong: 0.6, weak: 0.45, duration: 50 }, { strong: 0.8, weak: 0.6, duration: 60 },
    { strong: 0.9, weak: 0.7, duration: 50 }, { strong: 0.5, weak: 0.4, duration: 80 }, { strong: 0.25, weak: 0.2, duration: 70 }
  ]},
  { id: 'portal', nameZh: '传送门', icon: Sparkle, category: 'fun', sequence: [
    { strong: 0.25, weak: 0.5, duration: 100 }, { strong: 0.4, weak: 0.65, duration: 90 }, { strong: 0.55, weak: 0.8, duration: 80 },
    { strong: 0.75, weak: 0.95, duration: 100 }, { strong: 0.9, weak: 1.0, duration: 120 }, { strong: 0.6, weak: 0.8, duration: 100 },
    { strong: 0.35, weak: 0.55, duration: 90 }, { strong: 0.15, weak: 0.3, duration: 80 }
  ]},
  { id: 'levelUp2', nameZh: '升级啦', icon: Star, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 60 }, { strong: 0.45, weak: 0.65, duration: 70 }, { strong: 0.6, weak: 0.8, duration: 80 },
    { strong: 0.75, weak: 0.9, duration: 90 }, { strong: 0.9, weak: 1.0, duration: 120 }, { strong: 0.8, weak: 0.95, duration: 100 },
    { strong: 0.65, weak: 0.85, duration: 80 }, { strong: 0.5, weak: 0.7, duration: 70 }, { strong: 0.35, weak: 0.55, duration: 60 }
  ]},
  { id: 'comboKill', nameZh: '连杀', icon: Zap, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.35, duration: 30 }, { strong: 0.6, weak: 0.4, duration: 28 }, { strong: 0.7, weak: 0.5, duration: 35 },
    { strong: 0.8, weak: 0.6, duration: 40 }, { strong: 0.9, weak: 0.7, duration: 45 }, { strong: 1.0, weak: 0.8, duration: 60 },
    { strong: 0.85, weak: 0.7, duration: 50 }, { strong: 0.65, weak: 0.5, duration: 45 }
  ]},
  { id: 'guard', nameZh: '防御', icon: Shield, category: 'fun', sequence: [
    { strong: 0.8, weak: 0.6, duration: 50 }, { strong: 0.6, weak: 0.45, duration: 60 }, { strong: 0.45, weak: 0.35, duration: 70 },
    { strong: 0.35, weak: 0.28, duration: 80 }, { strong: 0.25, weak: 0.2, duration: 90 }
  ]},
  { id: 'parry', nameZh: '弹反', icon: Zap, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.25, duration: 20 }, { strong: 0.9, weak: 0.6, duration: 40 }, { strong: 0.7, weak: 0.45, duration: 35 },
    { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.3, weak: 0.2, duration: 50 }
  ]},
  { id: 'summon', nameZh: '召唤', icon: Sparkles, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.3, duration: 100 }, { strong: 0.25, weak: 0.45, duration: 120 }, { strong: 0.4, weak: 0.6, duration: 140 },
    { strong: 0.6, weak: 0.8, duration: 160 }, { strong: 0.8, weak: 0.95, duration: 180 }, { strong: 0.5, weak: 0.7, duration: 150 },
    { strong: 0.3, weak: 0.5, duration: 130 }
  ]},
  { id: 'portal2', nameZh: '开门', icon: Home, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.4, duration: 80 }, { strong: 0.35, weak: 0.55, duration: 70 }, { strong: 0.5, weak: 0.7, duration: 60 },
    { strong: 0.7, weak: 0.85, duration: 80 }, { strong: 0.55, weak: 0.75, duration: 70 }, { strong: 0.4, weak: 0.6, duration: 60 },
    { strong: 0.25, weak: 0.45, duration: 70 }
  ]},
  { id: 'defuse', nameZh: '拆弹', icon: AlertTriangle, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.3, duration: 50 }, { strong: 0.55, weak: 0.4, duration: 45 }, { strong: 0.7, weak: 0.5, duration: 40 },
    { strong: 0.85, weak: 0.65, duration: 50 }, { strong: 1.0, weak: 0.8, duration: 80 }, { strong: 0.9, weak: 0.7, duration: 70 },
    { strong: 0.75, weak: 0.55, duration: 60 }, { strong: 0.6, weak: 0.45, duration: 50 }
  ]},
  { id: 'plantBomb', nameZh: '放炸弹', icon: Bomb, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.4, duration: 60 }, { strong: 0.4, weak: 0.5, duration: 70 }, { strong: 0.5, weak: 0.6, duration: 80 },
    { strong: 0.6, weak: 0.7, duration: 90 }, { strong: 0.7, weak: 0.8, duration: 100 }, { strong: 0.8, weak: 0.9, duration: 120 },
    { strong: 1.0, weak: 1.0, duration: 200 }
  ]},
  { id: 'headshot', nameZh: '爆头', icon: Crosshair, category: 'fun', sequence: [
    { strong: 0.7, weak: 0.35, duration: 25 }, { strong: 1.0, weak: 0.6, duration: 40 }, { strong: 0.8, weak: 0.5, duration: 35 },
    { strong: 0.5, weak: 0.3, duration: 40 }, { strong: 0.25, weak: 0.15, duration: 50 }
  ]},
  { id: 'noscope', nameZh: '盲狙', icon: Crosshair, category: 'fun', sequence: [
    { strong: 0.8, weak: 0.4, duration: 35 }, { strong: 0.95, weak: 0.55, duration: 45 }, { strong: 0.6, weak: 0.7, duration: 60 },
    { strong: 0.35, weak: 0.45, duration: 50 }, { strong: 0.15, weak: 0.25, duration: 45 }
  ]},
  { id: 'flashbang', nameZh: '闪光弹', icon: Sun, category: 'fun', sequence: [
    { strong: 0.8, weak: 0.9, duration: 50 }, { strong: 0.9, weak: 1.0, duration: 60 }, { strong: 0.7, weak: 0.85, duration: 70 },
    { strong: 0.5, weak: 0.65, duration: 80 }, { strong: 0.3, weak: 0.45, duration: 100 }, { strong: 0.15, weak: 0.25, duration: 150 }
  ]},
  { id: 'molotov', nameZh: '燃烧瓶', icon: Flame, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.55, weak: 0.75, duration: 70 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.85, weak: 0.95, duration: 100 }, { strong: 0.75, weak: 0.9, duration: 90 }, { strong: 0.6, weak: 0.8, duration: 100 },
    { strong: 0.45, weak: 0.65, duration: 90 }
  ]},
  { id: 'heal2', nameZh: '回血', icon: Heart, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.4, duration: 80 }, { strong: 0.3, weak: 0.5, duration: 100 }, { strong: 0.4, weak: 0.6, duration: 120 },
    { strong: 0.5, weak: 0.7, duration: 140 }, { strong: 0.4, weak: 0.6, duration: 120 }, { strong: 0.3, weak: 0.5, duration: 100 },
    { strong: 0.2, weak: 0.4, duration: 80 }
  ]},
  { id: 'shieldBreak', nameZh: '破盾', icon: Shield, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.4, duration: 40 }, { strong: 0.8, weak: 0.55, duration: 35 }, { strong: 0.9, weak: 0.65, duration: 45 },
    { strong: 0.7, weak: 0.5, duration: 55 }, { strong: 0.5, weak: 0.35, duration: 70 }, { strong: 0.3, weak: 0.2, duration: 100 }
  ]},
  { id: 'revive', nameZh: '复活', icon: Sparkles, category: 'fun', sequence: [
    { strong: 0.1, weak: 0.2, duration: 80 }, { strong: 0.2, weak: 0.35, duration: 100 }, { strong: 0.35, weak: 0.5, duration: 120 },
    { strong: 0.5, weak: 0.65, duration: 140 }, { strong: 0.65, weak: 0.8, duration: 160 }, { strong: 0.5, weak: 0.65, duration: 140 },
    { strong: 0.35, weak: 0.5, duration: 120 }, { strong: 0.2, weak: 0.35, duration: 100 }
  ]},
  { id: 'victory2', nameZh: '胜利', icon: Trophy, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.55, duration: 60 }, { strong: 0.55, weak: 0.7, duration: 70 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.85, weak: 0.95, duration: 100 }, { strong: 1.0, weak: 1.0, duration: 150 }, { strong: 0.9, weak: 1.0, duration: 120 },
    { strong: 0.75, weak: 0.9, duration: 100 }, { strong: 0.6, weak: 0.75, duration: 100 }, { strong: 0.45, weak: 0.6, duration: 100 }
  ]},
  { id: 'defeat', nameZh: '失败', icon: Frown, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.3, duration: 100 }, { strong: 0.3, weak: 0.22, duration: 120 }, { strong: 0.22, weak: 0.15, duration: 150 },
    { strong: 0.15, weak: 0.1, duration: 200 }, { strong: 0.1, weak: 0.08, duration: 250 }, { strong: 0.08, weak: 0.05, duration: 300 }
  ]},
  { id: 'perfect', nameZh: '完美', icon: Star, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.65, duration: 50 }, { strong: 0.65, weak: 0.8, duration: 60 }, { strong: 0.8, weak: 0.9, duration: 70 },
    { strong: 0.9, weak: 0.98, duration: 80 }, { strong: 1.0, weak: 1.0, duration: 120 }, { strong: 0.95, weak: 1.0, duration: 100 },
    { strong: 0.85, weak: 0.95, duration: 80 }, { strong: 0.7, weak: 0.85, duration: 70 }, { strong: 0.55, weak: 0.7, duration: 60 },
    { strong: 0.4, weak: 0.55, duration: 50 }
  ]},
  { id: 'noDamage', nameZh: '无伤', icon: Shield, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 60 }, { strong: 0.4, weak: 0.6, duration: 70 }, { strong: 0.5, weak: 0.7, duration: 80 },
    { strong: 0.6, weak: 0.8, duration: 90 }, { strong: 0.7, weak: 0.85, duration: 100 }, { strong: 0.5, weak: 0.7, duration: 90 },
    { strong: 0.35, weak: 0.55, duration: 80 }, { strong: 0.2, weak: 0.4, duration: 70 }, { strong: 0.1, weak: 0.25, duration: 60 }
  ]},
  { id: 'speedrun', nameZh: '速通', icon: FastForward, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.55, duration: 40 }, { strong: 0.5, weak: 0.7, duration: 35 }, { strong: 0.65, weak: 0.85, duration: 40 },
    { strong: 0.8, weak: 0.95, duration: 45 }, { strong: 0.9, weak: 1.0, duration: 50 }, { strong: 0.75, weak: 0.9, duration: 45 },
    { strong: 0.6, weak: 0.8, duration: 40 }, { strong: 0.45, weak: 0.65, duration: 35 }, { strong: 0.3, weak: 0.5, duration: 30 }
  ]},
  { id: 'newGame', nameZh: '新游戏', icon: Gamepad2, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.35, duration: 80 }, { strong: 0.35, weak: 0.5, duration: 90 }, { strong: 0.5, weak: 0.65, duration: 100 },
    { strong: 0.65, weak: 0.8, duration: 120 }, { strong: 0.8, weak: 0.95, duration: 150 }, { strong: 1.0, weak: 1.0, duration: 200 },
    { strong: 0.8, weak: 0.95, duration: 150 }, { strong: 0.6, weak: 0.8, duration: 120 }, { strong: 0.4, weak: 0.6, duration: 100 }
  ]},
  { id: 'credits', nameZh: '制作名单', icon: Disc, category: 'fun', sequence: [
    { strong: 0.08, weak: 0.15, duration: 300 }, { strong: 0.1, weak: 0.18, duration: 350 }, { strong: 0.12, weak: 0.2, duration: 320 },
    { strong: 0.1, weak: 0.18, duration: 380 }, { strong: 0.08, weak: 0.15, duration: 300 }
  ]},
  { id: 'save', nameZh: '存档', icon: Gift, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.5, duration: 60 }, { strong: 0.5, weak: 0.65, duration: 70 }, { strong: 0.4, weak: 0.55, duration: 65 },
    { strong: 0.55, weak: 0.7, duration: 75 }, { strong: 0.3, weak: 0.45, duration: 60 }
  ]},
  { id: 'load', nameZh: '读档', icon: Clock, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.35, duration: 80 }, { strong: 0.3, weak: 0.45, duration: 90 }, { strong: 0.25, weak: 0.4, duration: 85 },
    { strong: 0.35, weak: 0.5, duration: 95 }, { strong: 0.2, weak: 0.35, duration: 80 }
  ]},
  { id: 'stealth', nameZh: '潜行', icon: Eye, category: 'fun', sequence: [
    { strong: 0.05, weak: 0.12, duration: 200 }, { strong: 0.08, weak: 0.15, duration: 220 }, { strong: 0.06, weak: 0.13, duration: 210 },
    { strong: 0.1, weak: 0.18, duration: 230 }
  ]},
  { id: 'sprint', nameZh: '冲刺', icon: Zap, category: 'fun', sequence: [
    { strong: 0.45, weak: 0.6, duration: 35 }, { strong: 0.55, weak: 0.7, duration: 30 }, { strong: 0.5, weak: 0.65, duration: 32 },
    { strong: 0.58, weak: 0.72, duration: 28 }
  ]},
  { id: 'swim', nameZh: '游泳', icon: Droplets, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.4, duration: 60 }, { strong: 0.28, weak: 0.48, duration: 55 }, { strong: 0.22, weak: 0.42, duration: 65 },
    { strong: 0.3, weak: 0.5, duration: 58 }
  ]},
  { id: 'climb', nameZh: '攀爬', icon: Mountain, category: 'fun', sequence: [
    { strong: 0.25, weak: 0.4, duration: 50 }, { strong: 0.35, weak: 0.5, duration: 45 }, { strong: 0.3, weak: 0.45, duration: 55 },
    { strong: 0.4, weak: 0.55, duration: 48 }
  ]},
  { id: 'drive', nameZh: '驾驶', icon: Car, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 45 }, { strong: 0.35, weak: 0.55, duration: 42 }, { strong: 0.32, weak: 0.52, duration: 48 },
    { strong: 0.38, weak: 0.58, duration: 40 }
  ]},
  { id: 'fly', nameZh: '飞行', icon: Plane, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.3, duration: 100 }, { strong: 0.2, weak: 0.38, duration: 90 }, { strong: 0.18, weak: 0.35, duration: 95 },
    { strong: 0.22, weak: 0.4, duration: 88 }
  ]},
  { id: 'falling', nameZh: '下落', icon: Zap, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.2, duration: 80 }, { strong: 0.25, weak: 0.32, duration: 75 }, { strong: 0.35, weak: 0.45, duration: 70 },
    { strong: 0.5, weak: 0.6, duration: 65 }, { strong: 0.65, weak: 0.75, duration: 60 }, { strong: 0.8, weak: 0.9, duration: 80 },
    { strong: 1.0, weak: 1.0, duration: 100 }
  ]},
  { id: 'dodge', nameZh: '闪避', icon: FastForward, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.4, duration: 25 }, { strong: 0.8, weak: 0.55, duration: 30 }, { strong: 0.5, weak: 0.35, duration: 35 },
    { strong: 0.3, weak: 0.2, duration: 40 }
  ]},
  { id: 'throw', nameZh: '投掷', icon: Rocket, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.25, duration: 30 }, { strong: 0.6, weak: 0.4, duration: 35 }, { strong: 0.8, weak: 0.55, duration: 40 },
    { strong: 0.6, weak: 0.42, duration: 45 }, { strong: 0.35, weak: 0.25, duration: 50 }
  ]},
  { id: 'catch', nameZh: '接住', icon: Hand, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.7, weak: 0.5, duration: 45 }, { strong: 0.85, weak: 0.65, duration: 50 },
    { strong: 0.6, weak: 0.45, duration: 55 }, { strong: 0.35, weak: 0.25, duration: 50 }
  ]},
  { id: 'reload', nameZh: '换弹', icon: Disc, category: 'fun', sequence: [
    { strong: 0.25, weak: 0.4, duration: 60 }, { strong: 0.35, weak: 0.5, duration: 70 }, { strong: 0.45, weak: 0.6, duration: 80 },
    { strong: 0.35, weak: 0.5, duration: 70 }, { strong: 0.2, weak: 0.35, duration: 60 }
  ]},
  { id: 'melee', nameZh: '近战', icon: Sword, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.3, duration: 25 }, { strong: 0.8, weak: 0.5, duration: 40 }, { strong: 0.6, weak: 0.4, duration: 35 },
    { strong: 0.35, weak: 0.25, duration: 40 }, { strong: 0.2, weak: 0.15, duration: 35 }
  ]},
  { id: 'ultimate', nameZh: '大招', icon: Zap, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.7, duration: 60 }, { strong: 0.7, weak: 0.85, duration: 70 }, { strong: 0.85, weak: 0.95, duration: 80 },
    { strong: 1.0, weak: 1.0, duration: 120 }, { strong: 0.9, weak: 1.0, duration: 100 }, { strong: 0.75, weak: 0.9, duration: 90 },
    { strong: 0.55, weak: 0.75, duration: 80 }, { strong: 0.35, weak: 0.55, duration: 70 }
  ]},
  { id: 'ability', nameZh: '技能', icon: Sparkles, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 70 }, { strong: 0.45, weak: 0.65, duration: 80 }, { strong: 0.6, weak: 0.8, duration: 90 },
    { strong: 0.75, weak: 0.9, duration: 100 }, { strong: 0.6, weak: 0.8, duration: 90 }, { strong: 0.45, weak: 0.65, duration: 80 },
    { strong: 0.3, weak: 0.5, duration: 70 }
  ]},
  { id: 'special', nameZh: '特殊', icon: Star, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.55, weak: 0.75, duration: 70 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.85, weak: 0.95, duration: 100 }, { strong: 0.7, weak: 0.85, duration: 80 }, { strong: 0.55, weak: 0.75, duration: 70 },
    { strong: 0.4, weak: 0.6, duration: 60 }
  ]},
  { id: 'passive', nameZh: '被动', icon: Activity, category: 'fun', sequence: [
    { strong: 0.08, weak: 0.18, duration: 150 }, { strong: 0.1, weak: 0.2, duration: 180 }, { strong: 0.12, weak: 0.22, duration: 160 },
    { strong: 0.08, weak: 0.18, duration: 150 }
  ]},
  { id: 'cooldown', nameZh: '冷却', icon: Clock, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.25, duration: 100 }, { strong: 0.12, weak: 0.22, duration: 90 }, { strong: 0.1, weak: 0.2, duration: 100 },
    { strong: 0.08, weak: 0.18, duration: 110 }, { strong: 0.05, weak: 0.12, duration: 120 }
  ]},
  { id: 'respawn2', nameZh: '重生', icon: Sparkles, category: 'fun', sequence: [
    { strong: 0.1, weak: 0.2, duration: 100 }, { strong: 0.2, weak: 0.35, duration: 120 }, { strong: 0.35, weak: 0.5, duration: 140 },
    { strong: 0.5, weak: 0.65, duration: 160 }, { strong: 0.65, weak: 0.8, duration: 180 }, { strong: 0.5, weak: 0.65, duration: 160 },
    { strong: 0.35, weak: 0.5, duration: 140 }, { strong: 0.2, weak: 0.35, duration: 120 }
  ]},
  { id: 'teleport', nameZh: '传送', icon: Clock, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.7, duration: 50 }, { strong: 0.7, weak: 0.85, duration: 45 }, { strong: 0.85, weak: 0.95, duration: 60 },
    { strong: 1.0, weak: 1.0, duration: 80 }, { strong: 0.85, weak: 0.95, duration: 60 }, { strong: 0.7, weak: 0.85, duration: 45 },
    { strong: 0.5, weak: 0.7, duration: 50 }
  ]},
  { id: 'invisible', nameZh: '隐身', icon: Eye, category: 'fun', sequence: [
    { strong: 0.05, weak: 0.1, duration: 200 }, { strong: 0.03, weak: 0.08, duration: 250 }, { strong: 0.02, weak: 0.05, duration: 300 },
    { strong: 0.01, weak: 0.03, duration: 350 }
  ]},
  { id: 'freeze', nameZh: '冰冻', icon: Snowflake, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.25, duration: 100 }, { strong: 0.12, weak: 0.2, duration: 120 }, { strong: 0.1, weak: 0.18, duration: 150 },
    { strong: 0.08, weak: 0.15, duration: 180 }, { strong: 0.05, weak: 0.1, duration: 200 }
  ]},
  { id: 'burn', nameZh: '燃烧', icon: Flame, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.45, weak: 0.65, duration: 55 }, { strong: 0.4, weak: 0.6, duration: 65 },
    { strong: 0.5, weak: 0.7, duration: 58 }, { strong: 0.38, weak: 0.58, duration: 62 }
  ]},
  { id: 'poison', nameZh: '中毒', icon: AlertTriangle, category: 'fun', sequence: [
    { strong: 0.2, weak: 0.35, duration: 80 }, { strong: 0.25, weak: 0.4, duration: 70 }, { strong: 0.22, weak: 0.38, duration: 85 },
    { strong: 0.28, weak: 0.42, duration: 75 }, { strong: 0.2, weak: 0.35, duration: 80 }
  ]},
  { id: 'stun', nameZh: '眩晕', icon: Star, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.55, weak: 0.7, duration: 55 }, { strong: 0.45, weak: 0.65, duration: 65 },
    { strong: 0.6, weak: 0.75, duration: 50 }, { strong: 0.4, weak: 0.6, duration: 60 }
  ]},
  { id: 'silence', nameZh: '沉默', icon: VolumeX, category: 'fun', sequence: [
    { strong: 0.08, weak: 0.15, duration: 150 }, { strong: 0.05, weak: 0.1, duration: 180 }, { strong: 0.03, weak: 0.08, duration: 200 },
    { strong: 0.02, weak: 0.05, duration: 250 }
  ]},
  { id: 'berserk', nameZh: '狂战士', icon: Flame, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.7, duration: 40 }, { strong: 0.6, weak: 0.78, duration: 35 }, { strong: 0.7, weak: 0.85, duration: 38 },
    { strong: 0.8, weak: 0.92, duration: 40 }, { strong: 0.9, weak: 0.98, duration: 45 }, { strong: 1.0, weak: 1.0, duration: 50 },
    { strong: 0.85, weak: 0.95, duration: 45 }, { strong: 0.7, weak: 0.85, duration: 42 }
  ]},
  { id: 'stealthKill', nameZh: '暗杀', icon: Hand, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.4, duration: 30 }, { strong: 0.85, weak: 0.6, duration: 40 }, { strong: 0.7, weak: 0.5, duration: 45 },
    { strong: 0.5, weak: 0.35, duration: 50 }, { strong: 0.3, weak: 0.2, duration: 60 }
  ]},
  { id: 'trap', nameZh: '陷阱', icon: AlertTriangle, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.7, weak: 0.5, duration: 50 }, { strong: 0.85, weak: 0.65, duration: 60 },
    { strong: 1.0, weak: 0.8, duration: 70 }, { strong: 0.8, weak: 0.65, duration: 60 }, { strong: 0.6, weak: 0.45, duration: 55 }
  ]},
  { id: 'mine', nameZh: '地雷', icon: Bomb, category: 'fun', sequence: [
    { strong: 0.7, weak: 0.5, duration: 40 }, { strong: 0.9, weak: 0.7, duration: 50 }, { strong: 1.0, weak: 0.85, duration: 70 },
    { strong: 0.85, weak: 0.7, duration: 60 }, { strong: 0.65, weak: 0.5, duration: 70 }, { strong: 0.45, weak: 0.35, duration: 80 }
  ]},
  { id: 'turret', nameZh: '炮塔', icon: Crosshair, category: 'fun', sequence: [
    { strong: 0.75, weak: 0.4, duration: 30 }, { strong: 0.8, weak: 0.45, duration: 28 }, { strong: 0.78, weak: 0.42, duration: 32 },
    { strong: 0.82, weak: 0.48, duration: 26 }
  ]},
  { id: 'shieldGen', nameZh: '护盾生成', icon: Shield, category: 'fun', sequence: [
    { strong: 0.15, weak: 0.3, duration: 100 }, { strong: 0.25, weak: 0.45, duration: 120 }, { strong: 0.4, weak: 0.6, duration: 140 },
    { strong: 0.55, weak: 0.75, duration: 160 }, { strong: 0.4, weak: 0.6, duration: 140 }, { strong: 0.25, weak: 0.45, duration: 120 }
  ]},
  { id: 'shieldDown', nameZh: '护盾破碎', icon: Shield, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.7, weak: 0.5, duration: 50 }, { strong: 0.85, weak: 0.65, duration: 60 },
    { strong: 1.0, weak: 0.8, duration: 80 }, { strong: 0.75, weak: 0.6, duration: 70 }, { strong: 0.5, weak: 0.4, duration: 80 }
  ]},
  { id: ' Objectives', nameZh: '占点', icon: MapPin, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.55, duration: 60 }, { strong: 0.55, weak: 0.7, duration: 70 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.55, weak: 0.7, duration: 70 }, { strong: 0.4, weak: 0.55, duration: 60 }
  ]},
  { id: 'payload', nameZh: '推车', icon: Truck, category: 'fun', sequence: [
    { strong: 0.3, weak: 0.5, duration: 50 }, { strong: 0.4, weak: 0.6, duration: 45 }, { strong: 0.35, weak: 0.55, duration: 55 },
    { strong: 0.45, weak: 0.65, duration: 48 }
  ]},
  { id: 'koth', nameZh: '运载', icon: MapPin, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.5, weak: 0.7, duration: 55 }, { strong: 0.45, weak: 0.65, duration: 65 },
    { strong: 0.55, weak: 0.75, duration: 50 }
  ]},
  { id: 'deathmatch', nameZh: '死斗', icon: Skull, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.65, duration: 40 }, { strong: 0.65, weak: 0.8, duration: 45 }, { strong: 0.8, weak: 0.9, duration: 50 },
    { strong: 0.9, weak: 0.98, duration: 55 }, { strong: 0.75, weak: 0.88, duration: 50 }, { strong: 0.6, weak: 0.75, duration: 45 },
    { strong: 0.45, weak: 0.6, duration: 40 }
  ]},
  { id: 'battleRoyale', nameZh: '大逃杀', icon: Crown, category: 'fun', sequence: [
    { strong: 0.35, weak: 0.5, duration: 60 }, { strong: 0.5, weak: 0.65, duration: 70 }, { strong: 0.65, weak: 0.8, duration: 80 },
    { strong: 0.8, weak: 0.9, duration: 100 }, { strong: 0.9, weak: 0.98, duration: 120 }, { strong: 1.0, weak: 1.0, duration: 150 },
    { strong: 0.85, weak: 0.95, duration: 120 }, { strong: 0.7, weak: 0.85, duration: 100 }, { strong: 0.55, weak: 0.7, duration: 80 }
  ]},
  { id: 'firstBlood', nameZh: '第一滴血', icon: Droplets, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.4, duration: 40 }, { strong: 0.8, weak: 0.55, duration: 50 }, { strong: 0.6, weak: 0.42, duration: 55 },
    { strong: 0.4, weak: 0.28, duration: 70 }
  ]},
  { id: 'ace', nameZh: 'ACE', icon: Star, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.7, duration: 50 }, { strong: 0.65, weak: 0.85, duration: 60 }, { strong: 0.8, weak: 0.95, duration: 70 },
    { strong: 0.95, weak: 1.0, duration: 80 }, { strong: 1.0, weak: 1.0, duration: 100 }, { strong: 0.9, weak: 1.0, duration: 90 },
    { strong: 0.75, weak: 0.9, duration: 80 }, { strong: 0.6, weak: 0.8, duration: 70 }, { strong: 0.45, weak: 0.65, duration: 60 },
    { strong: 0.35, weak: 0.55, duration: 50 }
  ]},
  { id: 'penta', nameZh: '五杀', icon: Trophy, category: 'fun', sequence: [
    { strong: 0.6, weak: 0.75, duration: 50 }, { strong: 0.75, weak: 0.88, duration: 60 }, { strong: 0.88, weak: 0.98, duration: 70 },
    { strong: 0.98, weak: 1.0, duration: 90 }, { strong: 1.0, weak: 1.0, duration: 120 }, { strong: 1.0, weak: 1.0, duration: 150 },
    { strong: 0.9, weak: 1.0, duration: 120 }, { strong: 0.8, weak: 0.95, duration: 100 }, { strong: 0.65, weak: 0.85, duration: 80 },
    { strong: 0.5, weak: 0.7, duration: 60 }
  ]},
  { id: 'rampage', nameZh: '暴走', icon: Zap, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.65, duration: 35 }, { strong: 0.65, weak: 0.8, duration: 32 }, { strong: 0.8, weak: 0.92, duration: 38 },
    { strong: 0.92, weak: 1.0, duration: 42 }, { strong: 1.0, weak: 1.0, duration: 50 }, { strong: 0.88, weak: 0.98, duration: 45 },
    { strong: 0.75, weak: 0.9, duration: 40 }, { strong: 0.6, weak: 0.78, duration: 35 }
  ]},
  { id: 'unstoppable', nameZh: '势不可挡', icon: Zap, category: 'fun', sequence: [
    { strong: 0.55, weak: 0.7, duration: 40 }, { strong: 0.7, weak: 0.85, duration: 45 }, { strong: 0.85, weak: 0.95, duration: 50 },
    { strong: 0.95, weak: 1.0, duration: 60 }, { strong: 1.0, weak: 1.0, duration: 80 }, { strong: 0.95, weak: 1.0, duration: 70 },
    { strong: 0.85, weak: 0.95, duration: 60 }, { strong: 0.7, weak: 0.85, duration: 55 }, { strong: 0.55, weak: 0.7, duration: 50 }
  ]},
  { id: 'dominating', nameZh: '统治战场', icon: Crown, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.65, duration: 45 }, { strong: 0.65, weak: 0.8, duration: 50 }, { strong: 0.8, weak: 0.92, duration: 55 },
    { strong: 0.92, weak: 1.0, duration: 65 }, { strong: 1.0, weak: 1.0, duration: 80 }, { strong: 0.9, weak: 0.98, duration: 70 },
    { strong: 0.75, weak: 0.9, duration: 60 }, { strong: 0.6, weak: 0.78, duration: 55 }, { strong: 0.5, weak: 0.65, duration: 50 }
  ]},
  { id: 'godlike', nameZh: '神级发挥', icon: Star, category: 'fun', sequence: [
    { strong: 0.45, weak: 0.6, duration: 50 }, { strong: 0.6, weak: 0.75, duration: 55 }, { strong: 0.75, weak: 0.88, duration: 60 },
    { strong: 0.88, weak: 0.98, duration: 70 }, { strong: 0.98, weak: 1.0, duration: 80 }, { strong: 1.0, weak: 1.0, duration: 100 },
    { strong: 1.0, weak: 1.0, duration: 120 }, { strong: 0.95, weak: 1.0, duration: 100 }, { strong: 0.85, weak: 0.95, duration: 80 },
    { strong: 0.7, weak: 0.88, duration: 70 }, { strong: 0.55, weak: 0.75, duration: 60 }, { strong: 0.4, weak: 0.6, duration: 55 }
  ]},
  { id: 'matchStart', nameZh: '比赛开始', icon: Disc, category: 'fun', sequence: [
    { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.6, weak: 0.8, duration: 70 }, { strong: 0.8, weak: 0.95, duration: 80 },
    { strong: 0.95, weak: 1.0, duration: 100 }, { strong: 0.8, weak: 0.95, duration: 80 }, { strong: 0.6, weak: 0.8, duration: 70 },
    { strong: 0.4, weak: 0.6, duration: 60 }
  ]},
  { id: 'matchEnd', nameZh: '比赛结束', icon: Disc, category: 'fun', sequence: [
    { strong: 0.5, weak: 0.65, duration: 80 }, { strong: 0.4, weak: 0.55, duration: 90 }, { strong: 0.3, weak: 0.45, duration: 100 },
    { strong: 0.2, weak: 0.35, duration: 120 }, { strong: 0.15, weak: 0.25, duration: 150 }, { strong: 0.1, weak: 0.2, duration: 200 }
  ]},
  { id: 'overtime', nameZh: '加时赛', icon: Timer, category: 'fun', sequence: [
    { strong: 0.45, weak: 0.3, duration: 40 }, { strong: 0.55, weak: 0.38, duration: 35 }, { strong: 0.65, weak: 0.45, duration: 38 },
    { strong: 0.75, weak: 0.52, duration: 42 }, { strong: 0.85, weak: 0.6, duration: 48 }, { strong: 0.95, weak: 0.68, duration: 55 },
    { strong: 1.0, weak: 0.75, duration: 60 }
  ]},
  { id: 'finalKill', nameZh: '终结', icon: Skull, category: 'fun', sequence: [
    { strong: 0.65, weak: 0.45, duration: 35 }, { strong: 0.85, weak: 0.6, duration: 45 }, { strong: 1.0, weak: 0.75, duration: 60 },
    { strong: 0.9, weak: 0.7, duration: 55 }, { strong: 0.75, weak: 0.55, duration: 60 }, { strong: 0.55, weak: 0.4, duration: 70 }
  ]},

  // FPS巷战突袭场景
  { id: 'rifle', nameZh: '步枪连发', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.65, weak: 0.35, duration: 30 }, { strong: 0.25, weak: 0.15, duration: 25 },
    { strong: 0.7, weak: 0.38, duration: 28 }, { strong: 0.25, weak: 0.15, duration: 25 },
    { strong: 0.68, weak: 0.36, duration: 30 }, { strong: 0.25, weak: 0.15, duration: 25 },
    { strong: 0.72, weak: 0.4, duration: 28 }, { strong: 0.25, weak: 0.15, duration: 25 },
    { strong: 0.7, weak: 0.38, duration: 30 }, { strong: 0.25, weak: 0.15, duration: 25 },
    { strong: 0.75, weak: 0.42, duration: 28 }, { strong: 0.25, weak: 0.15, duration: 25 }
  ]},
  { id: 'smg', nameZh: '冲锋枪', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.55, weak: 0.3, duration: 22 }, { strong: 0.2, weak: 0.12, duration: 18 },
    { strong: 0.58, weak: 0.32, duration: 20 }, { strong: 0.22, weak: 0.14, duration: 18 },
    { strong: 0.6, weak: 0.34, duration: 22 }, { strong: 0.2, weak: 0.12, duration: 18 },
    { strong: 0.56, weak: 0.31, duration: 21 }, { strong: 0.21, weak: 0.13, duration: 18 },
    { strong: 0.62, weak: 0.35, duration: 20 }, { strong: 0.2, weak: 0.12, duration: 18 },
    { strong: 0.58, weak: 0.33, duration: 22 }, { strong: 0.22, weak: 0.14, duration: 18 },
    { strong: 0.6, weak: 0.34, duration: 21 }, { strong: 0.21, weak: 0.13, duration: 18 }
  ]},
  { id: 'pistol', nameZh: '手枪点射', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.7, weak: 0.35, duration: 35 }, { strong: 0.3, weak: 0.18, duration: 30 },
    { strong: 0.75, weak: 0.38, duration: 32 }, { strong: 0.28, weak: 0.16, duration: 35 },
    { strong: 0.72, weak: 0.36, duration: 35 }
  ]},
  { id: 'shotgun', nameZh: '霰弹枪', icon: Crosshair, category: 'fps', sequence: [
    { strong: 1.0, weak: 0.75, duration: 60 }, { strong: 0.9, weak: 0.85, duration: 80 },
    { strong: 0.6, weak: 0.7, duration: 100 }, { strong: 0.35, weak: 0.5, duration: 120 },
    { strong: 0.15, weak: 0.25, duration: 100 }
  ]},
  { id: 'sniper', nameZh: '狙击枪', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.25, duration: 40 }, { strong: 0.85, weak: 0.45, duration: 50 },
    { strong: 1.0, weak: 0.6, duration: 80 }, { strong: 0.6, weak: 0.35, duration: 100 },
    { strong: 0.3, weak: 0.2, duration: 80 }
  ]},
  { id: 'spray', nameZh: '扫射', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.6, weak: 0.32, duration: 25 }, { strong: 0.22, weak: 0.14, duration: 20 },
    { strong: 0.65, weak: 0.35, duration: 25 }, { strong: 0.25, weak: 0.16, duration: 20 },
    { strong: 0.7, weak: 0.38, duration: 25 }, { strong: 0.28, weak: 0.18, duration: 20 },
    { strong: 0.75, weak: 0.42, duration: 25 }, { strong: 0.3, weak: 0.2, duration: 20 },
    { strong: 0.8, weak: 0.45, duration: 25 }, { strong: 0.32, weak: 0.22, duration: 20 },
    { strong: 0.78, weak: 0.44, duration: 25 }, { strong: 0.3, weak: 0.2, duration: 20 },
    { strong: 0.72, weak: 0.4, duration: 25 }, { strong: 0.28, weak: 0.18, duration: 20 },
    { strong: 0.68, weak: 0.38, duration: 25 }, { strong: 0.26, weak: 0.16, duration: 20 },
    { strong: 0.65, weak: 0.35, duration: 25 }, { strong: 0.24, weak: 0.15, duration: 20 },
    { strong: 0.6, weak: 0.32, duration: 25 }, { strong: 0.22, weak: 0.14, duration: 20 }
  ]},
  { id: 'burstFire', nameZh: '三连发', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.72, weak: 0.4, duration: 25 }, { strong: 0.28, weak: 0.18, duration: 20 },
    { strong: 0.75, weak: 0.42, duration: 25 }, { strong: 0.3, weak: 0.2, duration: 20 },
    { strong: 0.7, weak: 0.38, duration: 25 }, { strong: 0.26, weak: 0.16, duration: 80 }
  ]},
  { id: 'grenade', nameZh: '手雷', icon: Bomb, category: 'fps', sequence: [
    { strong: 0.3, weak: 0.4, duration: 60 }, { strong: 0.5, weak: 0.65, duration: 70 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.9, weak: 1.0, duration: 100 }, { strong: 1.0, weak: 1.0, duration: 150 },
    { strong: 0.85, weak: 0.9, duration: 120 }, { strong: 0.65, weak: 0.75, duration: 100 },
    { strong: 0.45, weak: 0.55, duration: 90 }, { strong: 0.25, weak: 0.35, duration: 80 }
  ]},
  { id: 'flashbang', nameZh: '闪光弹', icon: Sun, category: 'fps', sequence: [
    { strong: 0.8, weak: 0.9, duration: 50 }, { strong: 0.9, weak: 1.0, duration: 60 }, { strong: 0.7, weak: 0.85, duration: 70 },
    { strong: 0.5, weak: 0.65, duration: 80 }, { strong: 0.3, weak: 0.45, duration: 100 }, { strong: 0.15, weak: 0.25, duration: 150 }
  ]},
  { id: 'smoke', nameZh: '烟雾弹', icon: Wind, category: 'fps', sequence: [
    { strong: 0.25, weak: 0.45, duration: 80 }, { strong: 0.2, weak: 0.4, duration: 90 }, { strong: 0.28, weak: 0.48, duration: 85 },
    { strong: 0.22, weak: 0.42, duration: 95 }
  ]},
  { id: 'molotov', nameZh: '燃烧瓶', icon: Flame, category: 'fps', sequence: [
    { strong: 0.4, weak: 0.6, duration: 60 }, { strong: 0.55, weak: 0.75, duration: 70 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.85, weak: 0.95, duration: 100 }, { strong: 0.75, weak: 0.9, duration: 90 }, { strong: 0.6, weak: 0.8, duration: 100 },
    { strong: 0.45, weak: 0.65, duration: 90 }
  ]},
  { id: 'claymore', nameZh: '阔剑地雷', icon: AlertTriangle, category: 'fps', sequence: [
    { strong: 0.8, weak: 0.6, duration: 40 }, { strong: 1.0, weak: 0.85, duration: 60 }, { strong: 0.9, weak: 0.75, duration: 70 },
    { strong: 0.7, weak: 0.6, duration: 80 }, { strong: 0.5, weak: 0.4, duration: 90 }, { strong: 0.3, weak: 0.25, duration: 80 }
  ]},
  { id: 'c4', nameZh: 'C4安装', icon: Bomb, category: 'fps', sequence: [
    { strong: 0.4, weak: 0.3, duration: 40 }, { strong: 0.55, weak: 0.4, duration: 35 }, { strong: 0.45, weak: 0.35, duration: 45 },
    { strong: 0.6, weak: 0.45, duration: 38 }, { strong: 0.5, weak: 0.38, duration: 42 }
  ]},
  { id: 'c4Explode', nameZh: 'C4爆炸', icon: Bomb, category: 'fps', sequence: [
    { strong: 0.6, weak: 0.5, duration: 40 }, { strong: 0.8, weak: 0.7, duration: 60 }, { strong: 1.0, weak: 1.0, duration: 100 },
    { strong: 0.95, weak: 0.95, duration: 120 }, { strong: 0.85, weak: 0.85, duration: 150 },
    { strong: 0.65, weak: 0.7, duration: 180 }, { strong: 0.4, weak: 0.45, duration: 200 }
  ]},
  { id: 'knife', nameZh: '刀杀', icon: Sword, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.3, duration: 25 }, { strong: 0.9, weak: 0.55, duration: 50 },
    { strong: 0.7, weak: 0.45, duration: 45 }, { strong: 0.4, weak: 0.25, duration: 40 }
  ]},
  { id: 'taser', nameZh: '电击枪', icon: Zap, category: 'fps', sequence: [
    { strong: 0.85, weak: 0.9, duration: 25 }, { strong: 0.4, weak: 0.5, duration: 20 }, { strong: 0.9, weak: 0.95, duration: 30 },
    { strong: 0.35, weak: 0.45, duration: 25 }, { strong: 0.75, weak: 0.8, duration: 35 }, { strong: 0.3, weak: 0.4, duration: 20 },
    { strong: 0.6, weak: 0.65, duration: 40 }, { strong: 0.2, weak: 0.3, duration: 30 }
  ]},
  { id: 'killstreak', nameZh: '连杀警报', icon: AlertTriangle, category: 'fps', sequence: [
    { strong: 0.45, weak: 0.3, duration: 40 }, { strong: 0.55, weak: 0.38, duration: 35 }, { strong: 0.65, weak: 0.45, duration: 40 },
    { strong: 0.75, weak: 0.52, duration: 38 }, { strong: 0.85, weak: 0.6, duration: 42 }, { strong: 0.9, weak: 0.65, duration: 50 },
    { strong: 0.85, weak: 0.6, duration: 48 }, { strong: 0.75, weak: 0.52, duration: 45 }
  ]},
  { id: 'uav', nameZh: 'UAV侦察', icon: Plane, category: 'fps', sequence: [
    { strong: 0.2, weak: 0.45, duration: 60 }, { strong: 0.25, weak: 0.5, duration: 65 }, { strong: 0.22, weak: 0.48, duration: 62 }
  ]},
  { id: 'airdrop', nameZh: '空投', icon: Plane, category: 'fps', sequence: [
    { strong: 0.25, weak: 0.5, duration: 80 }, { strong: 0.35, weak: 0.6, duration: 90 }, { strong: 0.45, weak: 0.7, duration: 100 },
    { strong: 0.55, weak: 0.8, duration: 120 }, { strong: 0.7, weak: 0.9, duration: 150 },
    { strong: 0.85, weak: 1.0, duration: 200 }
  ]},
  { id: 'vtol', nameZh: 'VTOL呼叫', icon: Plane, category: 'fps', sequence: [
    { strong: 0.4, weak: 0.65, duration: 80 }, { strong: 0.55, weak: 0.78, duration: 100 }, { strong: 0.7, weak: 0.9, duration: 120 },
    { strong: 0.85, weak: 1.0, duration: 150 }, { strong: 1.0, weak: 1.0, duration: 200 },
    { strong: 0.9, weak: 0.95, duration: 180 }, { strong: 0.75, weak: 0.85, duration: 150 }
  ]},
  { id: 'chopper', nameZh: '武装直升机', icon: Plane, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.65, duration: 50 }, { strong: 0.38, weak: 0.68, duration: 48 }, { strong: 0.4, weak: 0.7, duration: 52 },
    { strong: 0.36, weak: 0.66, duration: 50 }
  ]},
  { id: 'missile', nameZh: '导弹发射', icon: Rocket, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.75, duration: 80 }, { strong: 0.65, weak: 0.88, duration: 100 }, { strong: 0.8, weak: 0.95, duration: 120 },
    { strong: 0.9, weak: 1.0, duration: 150 }, { strong: 0.75, weak: 0.9, duration: 130 }
  ]},
  { id: 'juggernaut', nameZh: '生化兵', icon: Skull, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.7, duration: 60 }, { strong: 0.65, weak: 0.85, duration: 70 }, { strong: 0.8, weak: 0.95, duration: 80 },
    { strong: 0.9, weak: 1.0, duration: 100 }, { strong: 0.75, weak: 0.9, duration: 90 }, { strong: 0.6, weak: 0.8, duration: 80 }
  ]},
  { id: 'stop', nameZh: '急停', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.8, weak: 0.5, duration: 40 }, { strong: 0.9, weak: 0.6, duration: 35 },
    { strong: 0.65, weak: 0.45, duration: 45 }, { strong: 0.4, weak: 0.3, duration: 50 },
    { strong: 0.2, weak: 0.15, duration: 40 }
  ]},
  { id: 'sprintFps', nameZh: '冲刺', icon: Zap, category: 'fps', sequence: [
    { strong: 0.45, weak: 0.6, duration: 35 }, { strong: 0.5, weak: 0.65, duration: 30 }, { strong: 0.48, weak: 0.62, duration: 32 },
    { strong: 0.52, weak: 0.68, duration: 28 }
  ]},
  { id: 'jumpFps', nameZh: '跳跃', icon: Rocket, category: 'fps', sequence: [
    { strong: 0.3, weak: 0.2, duration: 30 }, { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.3, weak: 0.2, duration: 25 }
  ]},
  { id: 'landFps', nameZh: '落地', icon: Mountain, category: 'fps', sequence: [
    { strong: 0.7, weak: 0.4, duration: 50 }, { strong: 0.9, weak: 0.6, duration: 60 }, { strong: 0.5, weak: 0.4, duration: 50 },
    { strong: 0.3, weak: 0.25, duration: 40 }, { strong: 0.15, weak: 0.1, duration: 30 }
  ]},
  { id: 'slide', nameZh: '滑铲', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.6, weak: 0.42, duration: 50 }, { strong: 0.55, weak: 0.38, duration: 60 },
    { strong: 0.45, weak: 0.32, duration: 55 }, { strong: 0.35, weak: 0.25, duration: 50 }
  ]},
  { id: 'wallRun', nameZh: '跑墙', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.5, duration: 40 }, { strong: 0.4, weak: 0.55, duration: 38 }, { strong: 0.38, weak: 0.52, duration: 42 },
    { strong: 0.42, weak: 0.58, duration: 36 }
  ]},
  { id: 'zipLine', nameZh: '滑索', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.25, weak: 0.45, duration: 50 }, { strong: 0.3, weak: 0.5, duration: 48 }, { strong: 0.28, weak: 0.48, duration: 52 },
    { strong: 0.32, weak: 0.52, duration: 46 }
  ]},
  { id: 'grapple', nameZh: '抓钩', icon: Zap, category: 'fps', sequence: [
    { strong: 0.4, weak: 0.3, duration: 30 }, { strong: 0.6, weak: 0.45, duration: 35 }, { strong: 0.8, weak: 0.6, duration: 40 },
    { strong: 0.65, weak: 0.5, duration: 45 }, { strong: 0.4, weak: 0.3, duration: 40 }
  ]},
  { id: 'tactical', nameZh: '战术动作', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.25, duration: 35 }, { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.4, weak: 0.28, duration: 38 },
    { strong: 0.55, weak: 0.4, duration: 42 }, { strong: 0.38, weak: 0.26, duration: 36 }
  ]},
  { id: 'reloadRifle', nameZh: '步枪换弹', icon: Disc, category: 'fps', sequence: [
    { strong: 0.25, weak: 0.4, duration: 60 }, { strong: 0.35, weak: 0.5, duration: 70 }, { strong: 0.45, weak: 0.6, duration: 80 },
    { strong: 0.35, weak: 0.5, duration: 70 }, { strong: 0.2, weak: 0.35, duration: 60 }
  ]},
  { id: 'reloadSmg', nameZh: '冲锋枪换弹', icon: Disc, category: 'fps', sequence: [
    { strong: 0.3, weak: 0.45, duration: 50 }, { strong: 0.4, weak: 0.55, duration: 55 }, { strong: 0.5, weak: 0.65, duration: 60 },
    { strong: 0.4, weak: 0.55, duration: 55 }, { strong: 0.25, weak: 0.4, duration: 50 }
  ]},
  { id: 'reloadShotgun', nameZh: '霰弹换弹', icon: Disc, category: 'fps', sequence: [
    { strong: 0.4, weak: 0.3, duration: 80 }, { strong: 0.5, weak: 0.38, duration: 100 }, { strong: 0.45, weak: 0.35, duration: 90 },
    { strong: 0.55, weak: 0.42, duration: 110 }, { strong: 0.5, weak: 0.38, duration: 100 }, { strong: 0.6, weak: 0.45, duration: 120 }
  ]},
  { id: 'hit', nameZh: '被击中', icon: AlertTriangle, category: 'fps', sequence: [
    { strong: 0.7, weak: 0.45, duration: 45 }, { strong: 0.85, weak: 0.55, duration: 40 }, { strong: 0.6, weak: 0.4, duration: 50 },
    { strong: 0.4, weak: 0.28, duration: 55 }
  ]},
  { id: 'headshotFps', nameZh: '爆头击杀', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.75, weak: 0.4, duration: 25 }, { strong: 1.0, weak: 0.6, duration: 40 }, { strong: 0.8, weak: 0.5, duration: 35 },
    { strong: 0.5, weak: 0.3, duration: 40 }, { strong: 0.25, weak: 0.15, duration: 50 }
  ]},
  { id: 'assist', nameZh: '助攻', icon: Star, category: 'fps', sequence: [
    { strong: 0.45, weak: 0.3, duration: 40 }, { strong: 0.6, weak: 0.42, duration: 45 }, { strong: 0.5, weak: 0.35, duration: 50 },
    { strong: 0.35, weak: 0.25, duration: 45 }
  ]},
  { id: 'revenge', nameZh: '复仇击杀', icon: Skull, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.35, duration: 35 }, { strong: 0.7, weak: 0.5, duration: 40 }, { strong: 0.85, weak: 0.6, duration: 50 },
    { strong: 0.7, weak: 0.5, duration: 45 }, { strong: 0.5, weak: 0.35, duration: 40 }
  ]},
  { id: 'double', nameZh: '双杀', icon: Zap, category: 'fps', sequence: [
    { strong: 0.55, weak: 0.38, duration: 35 }, { strong: 0.7, weak: 0.48, duration: 40 }, { strong: 0.5, weak: 0.35, duration: 80 },
    { strong: 0.6, weak: 0.42, duration: 38 }, { strong: 0.75, weak: 0.52, duration: 45 },
    { strong: 0.55, weak: 0.4, duration: 40 }
  ]},
  { id: 'triple', nameZh: '三杀', icon: Zap, category: 'fps', sequence: [
    { strong: 0.6, weak: 0.42, duration: 32 }, { strong: 0.75, weak: 0.52, duration: 38 }, { strong: 0.55, weak: 0.38, duration: 70 },
    { strong: 0.65, weak: 0.45, duration: 35 }, { strong: 0.8, weak: 0.58, duration: 42 }, { strong: 0.58, weak: 0.4, duration: 65 },
    { strong: 0.7, weak: 0.5, duration: 40 }, { strong: 0.85, weak: 0.62, duration: 48 },
    { strong: 0.65, weak: 0.48, duration: 45 }
  ]},
  { id: 'multiKill', nameZh: '多杀', icon: Zap, category: 'fps', sequence: [
    { strong: 0.65, weak: 0.45, duration: 30 }, { strong: 0.8, weak: 0.58, duration: 35 }, { strong: 0.6, weak: 0.42, duration: 60 },
    { strong: 0.72, weak: 0.52, duration: 32 }, { strong: 0.88, weak: 0.65, duration: 38 }, { strong: 0.62, weak: 0.45, duration: 55 },
    { strong: 0.75, weak: 0.55, duration: 35 }, { strong: 0.9, weak: 0.68, duration: 42 }, { strong: 0.68, weak: 0.5, duration: 50 },
    { strong: 0.78, weak: 0.58, duration: 38 }, { strong: 0.92, weak: 0.7, duration: 45 }
  ]},
  { id: 'lockedOn', nameZh: '锁定目标', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.55, duration: 60 }, { strong: 0.45, weak: 0.65, duration: 55 }, { strong: 0.55, weak: 0.75, duration: 60 },
    { strong: 0.65, weak: 0.85, duration: 70 }, { strong: 0.75, weak: 0.92, duration: 80 }
  ]},
  { id: 'launcher', nameZh: '火箭筒', icon: Rocket, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.35, duration: 45 }, { strong: 0.85, weak: 0.65, duration: 60 }, { strong: 1.0, weak: 0.85, duration: 100 },
    { strong: 0.8, weak: 0.7, duration: 120 }, { strong: 0.55, weak: 0.5, duration: 100 }
  ]},
  { id: 'lmg', nameZh: '轻机枪', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.7, weak: 0.4, duration: 28 }, { strong: 0.3, weak: 0.18, duration: 22 },
    { strong: 0.72, weak: 0.42, duration: 28 }, { strong: 0.32, weak: 0.2, duration: 22 },
    { strong: 0.75, weak: 0.44, duration: 28 }, { strong: 0.3, weak: 0.18, duration: 22 },
    { strong: 0.7, weak: 0.4, duration: 28 }, { strong: 0.28, weak: 0.17, duration: 22 },
    { strong: 0.68, weak: 0.38, duration: 28 }, { strong: 0.26, weak: 0.16, duration: 22 },
    { strong: 0.65, weak: 0.36, duration: 28 }, { strong: 0.25, weak: 0.15, duration: 22 },
    { strong: 0.7, weak: 0.4, duration: 28 }, { strong: 0.28, weak: 0.17, duration: 22 },
    { strong: 0.72, weak: 0.42, duration: 28 }, { strong: 0.3, weak: 0.18, duration: 22 }
  ]},
  { id: 'medic', nameZh: '医疗', icon: Heart, category: 'fps', sequence: [
    { strong: 0.2, weak: 0.4, duration: 80 }, { strong: 0.3, weak: 0.5, duration: 100 }, { strong: 0.4, weak: 0.6, duration: 120 },
    { strong: 0.5, weak: 0.7, duration: 140 }, { strong: 0.4, weak: 0.6, duration: 120 }, { strong: 0.3, weak: 0.5, duration: 100 },
    { strong: 0.2, weak: 0.4, duration: 80 }
  ]},
  { id: 'resupply', nameZh: '补给', icon: Gift, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.5, duration: 60 }, { strong: 0.5, weak: 0.65, duration: 70 }, { strong: 0.4, weak: 0.55, duration: 65 },
    { strong: 0.55, weak: 0.7, duration: 75 }, { strong: 0.3, weak: 0.45, duration: 60 }
  ]},
  { id: 'emp', nameZh: 'EMP干扰', icon: ZapOff, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.7, duration: 80 }, { strong: 0.4, weak: 0.6, duration: 100 }, { strong: 0.3, weak: 0.5, duration: 120 },
    { strong: 0.2, weak: 0.4, duration: 150 }, { strong: 0.1, weak: 0.25, duration: 200 }
  ]},
  { id: 'wallBang', nameZh: '穿墙击杀', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.6, weak: 0.35, duration: 30 }, { strong: 0.85, weak: 0.5, duration: 45 }, { strong: 0.7, weak: 0.42, duration: 40 },
    { strong: 0.45, weak: 0.28, duration: 50 }
  ]},
  { id: 'throughGlass', nameZh: '玻璃穿透', icon: AlertTriangle, category: 'fps', sequence: [
    { strong: 0.55, weak: 0.35, duration: 35 }, { strong: 0.4, weak: 0.25, duration: 30 }, { strong: 0.7, weak: 0.45, duration: 40 },
    { strong: 0.5, weak: 0.32, duration: 45 }
  ]},
  { id: 'mounted', nameZh: '架枪', icon: Crosshair, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.5, duration: 60 }, { strong: 0.45, weak: 0.6, duration: 55 }, { strong: 0.4, weak: 0.55, duration: 65 }
  ]},
  { id: 'breach', nameZh: '破门', icon: Home, category: 'fps', sequence: [
    { strong: 0.85, weak: 0.55, duration: 45 }, { strong: 1.0, weak: 0.7, duration: 60 }, { strong: 0.8, weak: 0.55, duration: 70 },
    { strong: 0.55, weak: 0.4, duration: 80 }, { strong: 0.3, weak: 0.22, duration: 70 }
  ]},
  { id: 'flashHide', nameZh: '闪光致盲', icon: Sun, category: 'fps', sequence: [
    { strong: 0.9, weak: 1.0, duration: 40 }, { strong: 0.85, weak: 0.95, duration: 60 }, { strong: 0.7, weak: 0.85, duration: 80 },
    { strong: 0.5, weak: 0.7, duration: 100 }, { strong: 0.3, weak: 0.5, duration: 150 }, { strong: 0.15, weak: 0.3, duration: 200 }
  ]},
  { id: 'suppressor', nameZh: '消音器', icon: VolumeX, category: 'fps', sequence: [
    { strong: 0.45, weak: 0.25, duration: 30 }, { strong: 0.2, weak: 0.12, duration: 25 },
    { strong: 0.48, weak: 0.27, duration: 28 }, { strong: 0.22, weak: 0.14, duration: 25 },
    { strong: 0.5, weak: 0.28, duration: 30 }
  ]},
  { id: 'nightVision', nameZh: '夜视仪', icon: Eye, category: 'fps', sequence: [
    { strong: 0.15, weak: 0.3, duration: 100 }, { strong: 0.25, weak: 0.45, duration: 120 }, { strong: 0.35, weak: 0.55, duration: 150 }
  ]},
  { id: 'thermal', nameZh: '热成像', icon: Eye, category: 'fps', sequence: [
    { strong: 0.2, weak: 0.4, duration: 80 }, { strong: 0.3, weak: 0.55, duration: 90 }, { strong: 0.25, weak: 0.48, duration: 85 }
  ]},
  { id: 'killConfirmed', nameZh: '确认击杀', icon: Skull, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.35, duration: 40 }, { strong: 0.65, weak: 0.48, duration: 45 }, { strong: 0.45, weak: 0.32, duration: 50 }
  ]},
  { id: 'bombPlant', nameZh: '安装炸弹', icon: Bomb, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.25, duration: 50 }, { strong: 0.5, weak: 0.38, duration: 55 }, { strong: 0.45, weak: 0.32, duration: 60 },
    { strong: 0.55, weak: 0.42, duration: 65 }, { strong: 0.5, weak: 0.38, duration: 60 }
  ]},
  { id: 'bombDefuse', nameZh: '拆除炸弹', icon: Wrench, category: 'fps', sequence: [
    { strong: 0.3, weak: 0.45, duration: 70 }, { strong: 0.4, weak: 0.55, duration: 75 }, { strong: 0.35, weak: 0.5, duration: 80 },
    { strong: 0.45, weak: 0.6, duration: 85 }, { strong: 0.4, weak: 0.55, duration: 80 }
  ]},
  { id: 'hostage', nameZh: '人质救援', icon: Heart, category: 'fps', sequence: [
    { strong: 0.25, weak: 0.45, duration: 100 }, { strong: 0.35, weak: 0.55, duration: 120 }, { strong: 0.45, weak: 0.65, duration: 150 },
    { strong: 0.6, weak: 0.8, duration: 180 }
  ]},
  { id: 'dominate', nameZh: '压制', icon: Crown, category: 'fps', sequence: [
    { strong: 0.55, weak: 0.4, duration: 50 }, { strong: 0.7, weak: 0.52, duration: 55 }, { strong: 0.6, weak: 0.45, duration: 60 },
    { strong: 0.75, weak: 0.58, duration: 65 }, { strong: 0.65, weak: 0.5, duration: 60 }, { strong: 0.8, weak: 0.62, duration: 70 }
  ]},
  { id: 'payback', nameZh: '报仇', icon: Skull, category: 'fps', sequence: [
    { strong: 0.55, weak: 0.4, duration: 40 }, { strong: 0.72, weak: 0.55, duration: 48 }, { strong: 0.88, weak: 0.68, duration: 55 },
    { strong: 0.7, weak: 0.55, duration: 50 }, { strong: 0.5, weak: 0.4, duration: 45 }
  ]},
  { id: 'comeback', nameZh: '翻盘', icon: Trophy, category: 'fps', sequence: [
    { strong: 0.45, weak: 0.6, duration: 60 }, { strong: 0.6, weak: 0.75, duration: 70 }, { strong: 0.75, weak: 0.88, duration: 80 },
    { strong: 0.88, weak: 0.98, duration: 100 }, { strong: 1.0, weak: 1.0, duration: 150 },
    { strong: 0.85, weak: 0.95, duration: 120 }, { strong: 0.7, weak: 0.85, duration: 100 }, { strong: 0.55, weak: 0.7, duration: 80 }
  ]},
  { id: 'clutch', nameZh: '一打多', icon: Star, category: 'fps', sequence: [
    { strong: 0.6, weak: 0.45, duration: 40 }, { strong: 0.75, weak: 0.58, duration: 45 }, { strong: 0.6, weak: 0.45, duration: 70 },
    { strong: 0.78, weak: 0.6, duration: 42 }, { strong: 0.88, weak: 0.7, duration: 50 }, { strong: 0.65, weak: 0.5, duration: 65 },
    { strong: 0.8, weak: 0.65, duration: 48 }, { strong: 0.92, weak: 0.75, duration: 55 }, { strong: 0.7, weak: 0.55, duration: 60 },
    { strong: 1.0, weak: 0.85, duration: 80 }, { strong: 0.85, weak: 0.7, duration: 70 }
  ]},
  { id: 'aceFps', nameZh: 'ACE团灭', icon: Crown, category: 'fps', sequence: [
    { strong: 0.65, weak: 0.5, duration: 35 }, { strong: 0.8, weak: 0.65, duration: 40 }, { strong: 0.7, weak: 0.55, duration: 60 },
    { strong: 0.85, weak: 0.7, duration: 38 }, { strong: 0.95, weak: 0.8, duration: 45 }, { strong: 0.75, weak: 0.6, duration: 55 },
    { strong: 0.88, weak: 0.75, duration: 42 }, { strong: 1.0, weak: 0.88, duration: 50 }, { strong: 0.85, weak: 0.72, duration: 48 },
    { strong: 0.92, weak: 0.8, duration: 55 }, { strong: 1.0, weak: 0.9, duration: 80 }, { strong: 1.0, weak: 1.0, duration: 150 }
  ]},
  { id: 'winFps', nameZh: '胜利', icon: Trophy, category: 'fps', sequence: [
    { strong: 0.5, weak: 0.65, duration: 60 }, { strong: 0.65, weak: 0.8, duration: 70 }, { strong: 0.8, weak: 0.92, duration: 80 },
    { strong: 0.92, weak: 1.0, duration: 100 }, { strong: 1.0, weak: 1.0, duration: 150 },
    { strong: 0.9, weak: 0.98, duration: 120 }, { strong: 0.75, weak: 0.88, duration: 100 }, { strong: 0.6, weak: 0.75, duration: 90 },
    { strong: 0.5, weak: 0.65, duration: 80 }
  ]},
  { id: 'lose', nameZh: '失败', icon: Frown, category: 'fps', sequence: [
    { strong: 0.45, weak: 0.35, duration: 100 }, { strong: 0.35, weak: 0.28, duration: 120 }, { strong: 0.28, weak: 0.2, duration: 150 },
    { strong: 0.2, weak: 0.15, duration: 200 }, { strong: 0.15, weak: 0.1, duration: 250 }, { strong: 0.1, weak: 0.08, duration: 300 }
  ]},
  { id: 'footstepConcrete', nameZh: '脚步-水泥地', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.25, weak: 0.15, duration: 40 }, { strong: 0.35, weak: 0.2, duration: 30 }, { strong: 0.15, weak: 0.1, duration: 25 }
  ]},
  { id: 'footstepMetal', nameZh: '脚步-金属', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.25, duration: 35 }, { strong: 0.45, weak: 0.32, duration: 28 }, { strong: 0.22, weak: 0.16, duration: 22 }
  ]},
  { id: 'footstepWood', nameZh: '脚步-木板', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.3, weak: 0.2, duration: 38 }, { strong: 0.4, weak: 0.28, duration: 32 }, { strong: 0.18, weak: 0.12, duration: 25 }
  ]},
  { id: 'footstepGrass', nameZh: '脚步-草地', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.12, weak: 0.08, duration: 50 }, { strong: 0.18, weak: 0.12, duration: 45 }, { strong: 0.1, weak: 0.07, duration: 40 }
  ]},
  { id: 'footstepWater', nameZh: '脚步-水域', icon: Droplets, category: 'fps', sequence: [
    { strong: 0.2, weak: 0.4, duration: 45 }, { strong: 0.28, weak: 0.5, duration: 40 }, { strong: 0.15, weak: 0.35, duration: 50 }
  ]},
  { id: 'vault', nameZh: '翻越', icon: Footprints, category: 'fps', sequence: [
    { strong: 0.4, weak: 0.28, duration: 35 }, { strong: 0.55, weak: 0.38, duration: 40 }, { strong: 0.35, weak: 0.25, duration: 38 }
  ]},
  { id: 'mantle', nameZh: '攀爬', icon: Hand, category: 'fps', sequence: [
    { strong: 0.35, weak: 0.5, duration: 50 }, { strong: 0.5, weak: 0.65, duration: 55 }, { strong: 0.45, weak: 0.6, duration: 52 }
  ]},
  { id: 'downed', nameZh: '倒地', icon: Skull, category: 'fps', sequence: [
    { strong: 0.6, weak: 0.45, duration: 60 }, { strong: 0.45, weak: 0.35, duration: 80 }, { strong: 0.3, weak: 0.25, duration: 100 },
    { strong: 0.2, weak: 0.15, duration: 150 }
  ]},
  { id: 'reviveFps', nameZh: '拉人', icon: Heart, category: 'fps', sequence: [
    { strong: 0.2, weak: 0.35, duration: 80 }, { strong: 0.3, weak: 0.5, duration: 100 }, { strong: 0.4, weak: 0.6, duration: 120 },
    { strong: 0.5, weak: 0.7, duration: 140 }, { strong: 0.4, weak: 0.6, duration: 120 }, { strong: 0.3, weak: 0.5, duration: 100 }
  ]},
  { id: 'spectator', nameZh: '观战', icon: Eye, category: 'fps', sequence: [
    { strong: 0.08, weak: 0.15, duration: 200 }, { strong: 0.1, weak: 0.18, duration: 220 }, { strong: 0.12, weak: 0.2, duration: 180 }
  ]},
];

const CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  game: { en: 'Game', zh: '游戏' },
  impact: { en: 'Impact', zh: '冲击' },
  vehicle: { en: 'Vehicle', zh: '载具' },
  nature: { en: 'Nature', zh: '自然' },
  ui: { en: 'UI', zh: '界面' },
  life: { en: 'Life', zh: '生活' },
  music: { en: 'Music', zh: '音乐' },
  sports: { en: 'Sports', zh: '运动' },
  fun: { en: 'Fun', zh: '趣味' },
  fps: { en: 'FPS', zh: 'FPS射击' },
};

export const VibrationTester = ({
  gamepad,
  gamepadInfo,
  activeGamepad,
  onTriggerVibration,
  onVibrationTested,
}: VibrationTesterProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [isVibrating, setIsVibrating] = useState(false);
  const [selectedIntensity, setSelectedIntensity] = useState<'weak' | 'medium' | 'strong'>('medium');
  const [duration, setDuration] = useState(1);
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [repeatCount, setRepeatCount] = useState(3);
  const [currentRepeat, setCurrentRepeat] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const abortRef = useRef(false);

  const filteredPatterns = selectedCategory 
    ? PATTERNS.filter(p => p.category === selectedCategory)
    : PATTERNS;

  const playPattern = useCallback(async (pattern: VibrationPattern, repeats: number) => {
    if (activeGamepad === null) return;
    
    const gp = navigator.getGamepads()[activeGamepad] as ExtendedGamepad | null;
    if (!gp || !gp.vibrationActuator) return;

    setIsVibrating(true);
    abortRef.current = false;
    onVibrationTested?.();

    for (let r = 0; r < repeats; r++) {
      if (abortRef.current) break;
      setCurrentRepeat(r + 1);
      
      for (const step of pattern.sequence) {
        if (abortRef.current) break;
        try {
          await gp.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: step.duration,
            strongMagnitude: step.strong,
            weakMagnitude: step.weak,
          });
          await new Promise(resolve => setTimeout(resolve, step.duration));
        } catch (e) {
          console.log('Vibration error:', e);
        }
      }
    }

    setIsVibrating(false);
    setCurrentRepeat(0);
  }, [activeGamepad, onVibrationTested]);

  const handleVibrate = async () => {
    if (activeGamepad === null) return;
    
    if (selectedPattern) {
      const pattern = PATTERNS.find(p => p.id === selectedPattern);
      if (pattern) {
        playPattern(pattern, repeatCount);
        return;
      }
    }

    setIsVibrating(true);
    onTriggerVibration(activeGamepad, selectedIntensity, duration * 1000);
    onVibrationTested?.();
    
    timeoutRef.current = window.setTimeout(() => {
      setIsVibrating(false);
    }, duration * 1000);
  };

  const handleStop = () => {
    abortRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVibrating(false);
    setCurrentRepeat(0);
  };

  if (!gamepad || !gamepadInfo) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {t('vibrationTest')}
        </h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">
          {t('connectToTestVibration')}
        </div>
      </div>
    );
  }

  const intensities = [
    { key: 'weak' as const, label: t('weak'), percent: 20 },
    { key: 'medium' as const, label: t('medium'), percent: 50 },
    { key: 'strong' as const, label: t('strong'), percent: 100 },
  ];

  const categories = Object.entries(CATEGORY_LABELS);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full",
            gamepadInfo.hasVibration ? "bg-success animate-pulse" : "bg-muted-foreground"
          )} />
          {t('vibrationTest')}
          <span className="text-xs text-muted-foreground font-normal">({PATTERNS.length} {t('patterns')})</span>
        </h3>
        {!gamepadInfo.hasVibration && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {t('notSupported')}
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              selectedCategory === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {language === 'zh' ? '全部' : 'All'}
          </button>
          {categories.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                selectedCategory === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {language === 'zh' ? label.zh : label.en}
            </button>
          ))}
        </div>

        {/* Vibration Patterns Grid */}
        <div>
          <label className="text-sm text-muted-foreground mb-3 block">{t('vibrationPatterns')}</label>
          <ScrollArea className="h-56">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 pr-4">
              {filteredPatterns.map((pattern) => {
                const Icon = pattern.icon;
                const displayName = language === 'zh' ? pattern.nameZh : pattern.id;
                return (
                  <button
                    key={pattern.id}
                    onClick={() => setSelectedPattern(selectedPattern === pattern.id ? null : pattern.id)}
                    disabled={!gamepadInfo.hasVibration}
                    title={language === 'zh' ? pattern.nameZh : pattern.id}
                    className={cn(
                      "py-2 px-1 rounded-lg border transition-all flex flex-col items-center gap-0.5",
                      selectedPattern === pattern.id
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-muted/30 border-border text-foreground hover:bg-muted",
                      !gamepadInfo.hasVibration && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[8px] truncate w-full text-center">{displayName}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Pattern repeat count - 1 to 50 */}
        {selectedPattern && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t('loopCount')}</span>
              <span className="font-mono text-primary">
                {isVibrating ? `${currentRepeat}/${repeatCount}` : `${repeatCount}x`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
              disabled={isVibrating}
              className={cn(
                "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full",
                isVibrating && "opacity-50"
              )}
            />
          </div>
        )}

        {/* Simple Intensity Selection */}
        {!selectedPattern && (
          <>
            <div>
              <label className="text-sm text-muted-foreground mb-3 block">{t('intensity')}</label>
              <div className="grid grid-cols-3 gap-3">
                {intensities.map(({ key, label, percent }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedIntensity(key)}
                    disabled={!gamepadInfo.hasVibration}
                    className={cn(
                      "py-3 rounded-lg border transition-all",
                      selectedIntensity === key
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-muted/30 border-border text-foreground hover:bg-muted",
                      !gamepadInfo.hasVibration && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="text-lg font-semibold">{percent}%</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{t('duration')}</span>
                <span className="font-mono text-primary">{duration}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={!gamepadInfo.hasVibration}
                className={cn(
                  "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full",
                  !gamepadInfo.hasVibration && "opacity-50"
                )}
              />
            </div>
          </>
        )}

        {/* Vibrate Button */}
        <button
          onClick={isVibrating ? handleStop : handleVibrate}
          disabled={!gamepadInfo.hasVibration}
          className={cn(
            "w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3",
            isVibrating
              ? "bg-destructive text-destructive-foreground"
              : gamepadInfo.hasVibration
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Vibrate className={cn("w-5 h-5", isVibrating && "animate-pulse")} />
          {isVibrating ? t('stopTest') : t('testVibration')}
        </button>
      </div>
    </div>
  );
};
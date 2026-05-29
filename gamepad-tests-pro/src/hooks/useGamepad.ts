import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Gamepad API Standard Interface Types
 * @see https://w3c.github.io/gamepad/#gamepad-interface
 */
interface GamepadHapticActuator {
  type: string;
  players: number[];
  playEffect(effectType: string, options?: object): Promise<void>;
}

/**
 * Extended Gamepad interface with vibration actuator support
 * This is a vendor-specific extension not in the standard Gamepad interface
 */
export interface ExtendedGamepad extends Gamepad {
  vibrationActuator: GamepadHapticActuator | null;
}

/**
 * Represents the state of a connected gamepad
 */
export interface GamepadState {
  connected: boolean;
  id: string;
  index: number;
  buttons: GamepadButton[];
  axes: number[];
  timestamp: number;
  mapping: string;
  vibrationActuator: GamepadHapticActuator | null;
}

/**
 * Information about a gamepad's capabilities and type
 */
export interface GamepadInfo {
  name: string;
  type: "xbox" | "playstation" | "switch" | "generic";
  hasVibration: boolean;
  hasTouchpad: boolean;
  hasGyro: boolean;
}

/**
 * Detects the type and capabilities of a gamepad based on its ID string
 * @param id - The gamepad.id string from the Gamepad API
 * @returns GamepadInfo object with detected type and features
 */
const detectGamepadType = (id: string): GamepadInfo => {
  const idLower = id.toLowerCase();

  if (idLower.includes("xbox") || idLower.includes("xinput")) {
    return {
      name: idLower.includes("elite") ? "Xbox Elite Controller" : "Xbox Controller",
      type: "xbox",
      hasVibration: true,
      hasTouchpad: false,
      hasGyro: false,
    };
  }

  if (idLower.includes("dualsense") || idLower.includes("ps5")) {
    return {
      name: "DualSense Controller",
      type: "playstation",
      hasVibration: true,
      hasTouchpad: true,
      hasGyro: true,
    };
  }

  if (idLower.includes("dualshock") || idLower.includes("ps4") || idLower.includes("054c")) {
    return {
      name: "DualShock 4 Controller",
      type: "playstation",
      hasVibration: true,
      hasTouchpad: true,
      hasGyro: true,
    };
  }

  if (idLower.includes("pro controller") || idLower.includes("switch") || idLower.includes("057e")) {
    return {
      name: "Nintendo Switch Pro Controller",
      type: "switch",
      hasVibration: true,
      hasTouchpad: false,
      hasGyro: true,
    };
  }

  return {
    name: "Generic Gamepad",
    type: "generic",
    hasVibration: true,
    hasTouchpad: false,
    hasGyro: false,
  };
};

/**
 * Custom hook for managing gamepad state and connections
 * Provides real-time gamepad input monitoring with automatic device detection
 * @returns Object containing gamepad state and control functions
 */
export const useGamepad = () => {
  const [gamepads, setGamepads] = useState<(GamepadState | null)[]>([null, null, null, null]);
  const [gamepadInfos, setGamepadInfos] = useState<(GamepadInfo | null)[]>([null, null, null, null]);
  const [activeGamepad, setActiveGamepad] = useState<number | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const animationFrameRef = useRef<number>();
  const activeGamepadRef = useRef<number | null>(null);
  const lastGamepadStatesRef = useRef<(GamepadState | null)[]>([null, null, null, null]);
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    activeGamepadRef.current = activeGamepad;
  }, [activeGamepad]);

  /**
   * Compares two gamepad states to detect significant changes
   * Uses threshold-based comparison to filter out noise
   * @param prev - Previous gamepad state
   * @param curr - Current gamepad from API
   * @returns true if there are significant differences
   */
  const hasSignificantChange = useCallback((prev: GamepadState | null, curr: Gamepad | null): boolean => {
    if (!prev && !curr) return false;
    if (!prev || !curr) return true;

    for (let i = 0; i < curr.buttons.length; i++) {
      if (prev.buttons[i]?.pressed !== curr.buttons[i]?.pressed) return true;
      if (Math.abs((prev.buttons[i]?.value || 0) - (curr.buttons[i]?.value || 0)) > 0.01) return true;
    }

    for (let i = 0; i < curr.axes.length; i++) {
      if (Math.abs((prev.axes[i] || 0) - (curr.axes[i] || 0)) > 0.01) return true;
    }

    return false;
  }, []);

  /**
   * Main gamepad polling function - updates state based on gamepad input changes
   * Throttled to ~60fps to reduce CPU usage
   */
  const updateGamepads = useCallback(
    (timestamp: number) => {
      if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
        setIsSupported(false);
        setGamepads([null, null, null, null]);
        setActiveGamepad(null);
        return;
      }

      const throttleInterval = 16;
      if (timestamp - lastUpdateTimeRef.current < throttleInterval) {
        animationFrameRef.current = requestAnimationFrame(updateGamepads);
        return;
      }
      lastUpdateTimeRef.current = timestamp;

      let connectedGamepads: (Gamepad | null)[] = [];
      try {
        connectedGamepads = navigator.getGamepads();
      } catch (e) {
        console.warn("navigator.getGamepads() failed:", e);
        setIsSupported(false);
        setGamepads([null, null, null, null]);
        setActiveGamepad(null);
        return;
      }

      let hasAnyChange = false;
      const newStates: (GamepadState | null)[] = Array.from(connectedGamepads).map((gp, index) => {
        if (!gp) {
          if (lastGamepadStatesRef.current[index] !== null) {
            hasAnyChange = true;
          }
          return null;
        }

        const extendedGp = gp as ExtendedGamepad;
        const newState: GamepadState = {
          connected: true,
          id: gp.id,
          index: gp.index,
          buttons: [...gp.buttons],
          axes: [...gp.axes],
          timestamp: gp.timestamp,
          mapping: gp.mapping,
          vibrationActuator: extendedGp.vibrationActuator || null,
        };

        if (hasSignificantChange(lastGamepadStatesRef.current[index], gp)) {
          hasAnyChange = true;
        }

        return newState;
      });

      if (hasAnyChange) {
        lastGamepadStatesRef.current = newStates;

        const currentActive = activeGamepadRef.current;
        if (currentActive === null || !newStates[currentActive]) {
          const firstConnected = newStates.findIndex((gp) => gp !== null);
          setActiveGamepad(firstConnected >= 0 ? firstConnected : null);
        }

        const newInfos = newStates.map((gp) => gp ? detectGamepadType(gp.id) : null);
        setGamepadInfos(newInfos);
        setGamepads(newStates);
      }

      animationFrameRef.current = requestAnimationFrame(updateGamepads);
    },
    [hasSignificantChange],
  );

  /**
   * Handler for gamepad connection events
   */
  const handleGamepadConnected = useCallback((e: GamepadEvent) => {
    console.log("Gamepad connected:", e.gamepad.id);
    // Only auto-select if no gamepad is currently active
    if (activeGamepadRef.current === null) {
      setActiveGamepad(e.gamepad.index);
    }
  }, []);

  /**
   * Handler for gamepad disconnection events
   * Automatically selects another connected gamepad if available
   */
  const handleGamepadDisconnected = useCallback(
    (e: GamepadEvent) => {
      console.log("Gamepad disconnected:", e.gamepad.id);
      if (activeGamepadRef.current === e.gamepad.index) {
        const remaining = lastGamepadStatesRef.current.findIndex(
          (gp, i) => gp !== null && i !== e.gamepad.index,
        );
        setActiveGamepad(remaining >= 0 ? remaining : null);
      }
    },
    [],
  );

  /**
   * Triggers haptic vibration on a gamepad
   * @param gamepadIndex - Index of the gamepad to vibrate
   * @param intensity - Vibration intensity level
   * @param duration - Vibration duration in milliseconds
   */
  const triggerVibration = useCallback(
    async (gamepadIndex: number, intensity: "weak" | "medium" | "strong", duration: number = 1000) => {
      if (!isSupported || typeof navigator.getGamepads !== "function") return;

      const gp = navigator.getGamepads()[gamepadIndex];
      if (!gp) return;

      const intensityMap = {
        weak: { strongMagnitude: 0.2, weakMagnitude: 0.2 },
        medium: { strongMagnitude: 0.5, weakMagnitude: 0.5 },
        strong: { strongMagnitude: 1.0, weakMagnitude: 1.0 },
      };

      const { strongMagnitude, weakMagnitude } = intensityMap[intensity];

      try {
        const extendedGp = gp as ExtendedGamepad;
        if (extendedGp.vibrationActuator) {
          await extendedGp.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration,
            weakMagnitude,
            strongMagnitude,
          });
        }
      } catch (error) {
        console.log("Vibration not supported or failed:", error);
      }
    },
    [isSupported],
  );

  useEffect(() => {
    const supported = typeof navigator !== "undefined" && typeof navigator.getGamepads === "function";
    setIsSupported(supported);

    if (!supported) {
      return;
    }

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    animationFrameRef.current = requestAnimationFrame(updateGamepads);

    const existingGamepads = navigator.getGamepads();
    for (let i = 0; i < existingGamepads.length; i++) {
      if (existingGamepads[i]) {
        setActiveGamepad(i);
        break;
      }
    }

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleGamepadConnected, handleGamepadDisconnected, updateGamepads]);

  const currentGamepad = activeGamepad !== null ? gamepads[activeGamepad] : null;
  const gamepadInfo = currentGamepad ? detectGamepadType(currentGamepad.id) : null;

  return {
    gamepads,
    gamepadInfos,
    activeGamepad,
    setActiveGamepad,
    currentGamepad,
    gamepadInfo,
    triggerVibration,
    detectGamepadType,
    isSupported,
  };
};

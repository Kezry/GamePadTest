import { useState, useEffect, useRef, useCallback } from "react";
import { GamepadState, GamepadInfo } from "@/hooks/useGamepad";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RotateCcw, Compass, RotateCw, Smartphone, Gamepad2 } from "lucide-react";

/**
 * Extended DeviceOrientationEvent with iOS 13+ requestPermission method
 */
interface ExtendedDeviceOrientationEvent extends DeviceOrientationEvent {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
}

/**
 * GamepadPose interface for vendor-specific gamepad gyroscope data
 */
interface GamepadPose {
  orientation: Float32Array | null;
  angularVelocity: Float32Array | null;
  linearAcceleration: Float32Array | null;
}

/**
 * Extended Gamepad interface with pose support for gyroscope data
 */
interface GamepadWithPose extends Gamepad {
  pose: GamepadPose | null;
}

interface GyroscopeTesterProps {
  gamepad: GamepadState | null;
  gamepadInfo: GamepadInfo | null;
  sampleRate: number;
}

type GyroSource = "device" | "gamepad" | "joystick" | "client";

export const GyroscopeTester = ({ gamepad, gamepadInfo, sampleRate }: GyroscopeTesterProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Use refs for high-frequency updates to avoid triggering re-renders
  const rotationRef = useRef({ pitch: 0, yaw: 0, roll: 0 }); // Angular velocity (°/s)
  const orientationRef = useRef({ pitch: 0, yaw: 0, roll: 0 }); // Accumulated orientation (°)
  const accelerationRef = useRef({ x: 0, y: 0, z: 0 });
  const historyRef = useRef<{ pitch: number; yaw: number; roll: number }[]>([]);

  // State for UI updates (throttled)
  const [displayData, setDisplayData] = useState({
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    orientation: { pitch: 0, yaw: 0, roll: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
    history: [] as { pitch: number; yaw: number; roll: number }[],
  });

  // Store previous display values for stability
  const prevDisplayRef = useRef({
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    orientation: { pitch: 0, yaw: 0, roll: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
  });

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationOffset, setCalibrationOffset] = useState({ pitch: 0, yaw: 0, roll: 0 });
  const [gyroDeadzone, setGyroDeadzone] = useState(0.5); // User adjustable deadzone
  const [gyroSource, setGyroSource] = useState<GyroSource>("joystick");
  const [deviceMotionAvailable, setDeviceMotionAvailable] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [clientConnected, setClientConnected] = useState(false);
  const [manuallySelected, setManuallySelected] = useState(false); // Track if user manually selected mode
  const [viewMode, setViewMode] = useState<"axes" | "controller">("axes");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastDisplayUpdateRef = useRef<number>(0);
  const lastCanvasUpdateRef = useRef<number>(0);
  const deviceOrientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const deviceMotionRef = useRef({
    rotationRate: { alpha: 0, beta: 0, gamma: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
  });
  const noDataFrameCount = useRef<number>(0); // Track frames with no gyro data
  const wsRef = useRef<WebSocket | null>(null);
  const clientDataRef = useRef({ pitch: 0, yaw: 0, roll: 0, ax: 0, ay: 0, az: 0 });
  const lastSampleRateRef = useRef<number>(sampleRate);
  const manuallySelectedRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number>();

  // Sync manuallySelected state with ref
  useEffect(() => {
    manuallySelectedRef.current = manuallySelected;
  }, [manuallySelected]);

  // Send sample rate to client when it changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && clientConnected) {
      if (lastSampleRateRef.current !== sampleRate) {
        wsRef.current.send(
          JSON.stringify({
            type: "setSampleRate",
            sampleRate: sampleRate,
          }),
        );
        lastSampleRateRef.current = sampleRate;
        console.log(`Sent sample rate ${sampleRate} Hz to client`);
      }
    }
  }, [sampleRate, clientConnected]);

  // Check for Device Motion API availability
  useEffect(() => {
    const hasDeviceOrientation = "DeviceOrientationEvent" in window;
    const hasDeviceMotion = "DeviceMotionEvent" in window;
    setDeviceMotionAvailable(hasDeviceOrientation || hasDeviceMotion);
  }, []);

  // Connect to local client via WebSocket with auto-reconnect
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectToClient = () => {
      if (isUnmounted) return;

      try {
        console.log("🔌 Attempting to connect to client at ws://localhost:3001...");
        const ws = new WebSocket("ws://localhost:3001");

        ws.onopen = () => {
          console.log("✅ Connected to Gamepad Client");
          setClientConnected(true);
          // Only auto-switch to client if user hasn't manually selected a mode
          if (!manuallySelectedRef.current) {
            setGyroSource("client");
          }
          // Suggest calibration
          console.log('💡 Tip: Click "Calibrate" button to zero out gyroscope drift');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Debug: log raw WebSocket message occasionally
            if (Math.random() < 0.005) {
              // Log 0.5% of messages
              console.log("[WebSocket] Raw message from client:", data);
            }

            clientDataRef.current = {
              pitch: data.pitch || 0,
              yaw: data.yaw || 0,
              roll: data.roll || 0,
              ax: data.ax || 0,
              ay: data.ay || 0,
              az: data.az || 0,
            };
          } catch (err) {
            console.error("❌ Error parsing client data:", err);
          }
        };

        ws.onerror = (error) => {
          console.log("⚠️ Client connection error - client may not be running");
        };

        ws.onclose = () => {
          console.log("🔌 Client disconnected");
          setClientConnected(false);
          // Switch back to joystick if was using client
          setGyroSource((prev) => (prev === "client" ? "joystick" : prev));

          // Auto-reconnect after 3 seconds
          if (!isUnmounted) {
            console.log("🔄 Will retry connection in 3 seconds...");
            reconnectTimer = setTimeout(connectToClient, 3000);
          }
        };

        wsRef.current = ws;
      } catch (err) {
        console.log("❌ Could not connect to client:", err);
        // Retry connection after 3 seconds
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connectToClient, 3000);
        }
      }
    };

    // Try to connect
    connectToClient();

    // Cleanup on unmount
    return () => {
      isUnmounted = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Request permission for device motion (iOS 13+)
  const requestDeviceMotionPermission = useCallback(async () => {
    try {
      const typedDeviceOrientation = DeviceOrientationEvent as ExtendedDeviceOrientationEvent;
      if (typeof typedDeviceOrientation.requestPermission === "function") {
        const permission = await typedDeviceOrientation.requestPermission();
        if (permission === "granted") {
          setPermissionGranted(true);
          setGyroSource("device");
          setManuallySelected(true);
        }
      } else {
        // Non-iOS or older iOS
        setPermissionGranted(true);
        setGyroSource("device");
        setManuallySelected(true);
      }
    } catch (error) {
      console.log("Device motion permission denied:", error);
    }
  }, []);

  // Device orientation listener
  useEffect(() => {
    if (gyroSource !== "device" || !permissionGranted) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      deviceOrientationRef.current = {
        alpha: event.alpha || 0, // yaw
        beta: event.beta || 0, // pitch
        gamma: event.gamma || 0, // roll
      };
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      // Get rotation rate (angular velocity in deg/s)
      const rotationRate = event.rotationRate;
      if (rotationRate) {
        deviceMotionRef.current.rotationRate = {
          alpha: rotationRate.alpha || 0, // Z-axis rotation (yaw)
          beta: rotationRate.beta || 0, // X-axis rotation (pitch)
          gamma: rotationRate.gamma || 0, // Y-axis rotation (roll)
        };
      }

      // Get linear acceleration
      const acc = event.accelerationIncludingGravity;
      if (acc) {
        deviceMotionRef.current.acceleration = {
          x: acc.x || 0,
          y: acc.y || 0,
          z: acc.z || 0,
        };
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("devicemotion", handleMotion);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [gyroSource, permissionGranted]);

  const calibrate = useCallback(() => {
    setIsCalibrating(true);

    // Collect samples for 1 second to get average bias
    const samples: { pitch: number; yaw: number; roll: number }[] = [];
    const sampleInterval = setInterval(() => {
      // Only collect samples from current rotation data
      const current = rotationRef.current;
      samples.push({
        pitch: current.pitch,
        yaw: current.yaw,
        roll: current.roll,
      });
    }, 50); // Sample every 50ms

    setTimeout(() => {
      clearInterval(sampleInterval);

      if (samples.length === 0) {
        console.warn("⚠️ No samples collected for calibration");
        setIsCalibrating(false);
        return;
      }

      // Calculate average with proper rounding
      const avgPitch = Math.round((samples.reduce((sum, s) => sum + s.pitch, 0) / samples.length) * 1000) / 1000;
      const avgYaw = Math.round((samples.reduce((sum, s) => sum + s.yaw, 0) / samples.length) * 1000) / 1000;
      const avgRoll = Math.round((samples.reduce((sum, s) => sum + s.roll, 0) / samples.length) * 1000) / 1000;

      setCalibrationOffset({
        pitch: avgPitch,
        yaw: avgYaw,
        roll: avgRoll,
      });

      console.log("✅ Calibration complete:", {
        pitch: avgPitch.toFixed(3),
        yaw: avgYaw.toFixed(3),
        roll: avgRoll.toFixed(3),
        samples: samples.length,
      });

      setIsCalibrating(false);
    }, 1000);
  }, []);

  // Clear calibration when switching gyro source
  useEffect(() => {
    // Reset calibration when switching between different gyro sources
    setCalibrationOffset({ pitch: 0, yaw: 0, roll: 0 });
    console.log("ℹ️ Switched to", gyroSource, "- calibration reset");
  }, [gyroSource]);

  const reset = useCallback(() => {
    rotationRef.current = { pitch: 0, yaw: 0, roll: 0 };
    orientationRef.current = { pitch: 0, yaw: 0, roll: 0 };
    accelerationRef.current = { x: 0, y: 0, z: 0 };
    historyRef.current = [];
    setDisplayData({
      rotation: { pitch: 0, yaw: 0, roll: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      history: [],
    });
    // Don't reset calibration offset - it should persist
  }, []);

  // Sample motion data at specified rate
  useEffect(() => {
    if (!gamepad && gyroSource !== "device") return;

    const interval = 1000 / sampleRate;
    const displayUpdateInterval = 1000 / 60; // Limit display updates to 60Hz to prevent flickering
    const canvasUpdateInterval = 1000 / 30; // Update canvas at 30fps max

    const sampleMotion = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= interval) {
        const dt = (timestamp - lastUpdateRef.current) / 1000; // Time delta in seconds
        lastUpdateRef.current = timestamp;

        let pitch = 0,
          yaw = 0,
          roll = 0,
          ax = 0,
          ay = 0,
          az = 0;

        if (gyroSource === "client") {
          // Use data from local client
          // Client source axes are ordered differently from the page display:
          // client roll -> page X, client pitch -> page Y, client yaw -> page Z
          pitch = clientDataRef.current.roll;
          yaw = clientDataRef.current.pitch;
          roll = clientDataRef.current.yaw;
          ax = clientDataRef.current.ax;
          ay = clientDataRef.current.ay;
          az = clientDataRef.current.az;

          // Debug: log client data
          if (Math.random() < 0.02) {
            // Log 2% of frames
            console.log("[Client] Received remapped data:", {
              displayX: pitch.toFixed(3),
              displayY: yaw.toFixed(3),
              displayZ: roll.toFixed(3),
              rawClient: {
                pitch: clientDataRef.current.pitch.toFixed(3),
                yaw: clientDataRef.current.yaw.toFixed(3),
                roll: clientDataRef.current.roll.toFixed(3),
              },
              calibrationOffset: {
                pitch: calibrationOffset.pitch.toFixed(3),
                yaw: calibrationOffset.yaw.toFixed(3),
                roll: calibrationOffset.roll.toFixed(3),
              },
            });
          }
        } else if (gyroSource === "device" && permissionGranted) {
          // Use device motion API - rotationRate (angular velocity in deg/s)
          pitch = deviceMotionRef.current.rotationRate.beta; // X-axis
          yaw = deviceMotionRef.current.rotationRate.alpha; // Z-axis
          roll = deviceMotionRef.current.rotationRate.gamma; // Y-axis
          ax = deviceMotionRef.current.acceleration.x / 10;
          ay = deviceMotionRef.current.acceleration.y / 10;
          az = deviceMotionRef.current.acceleration.z / 10;

          // Debug: log device data
          if (Math.random() < 0.02) {
            console.log("[Device] Rotation rate:", {
              pitch: pitch.toFixed(3),
              yaw: yaw.toFixed(3),
              roll: roll.toFixed(3),
            });
          }
        } else if (gyroSource === "gamepad" && gamepad) {
          // Get native gamepad for pose data
          const nativeGamepad = navigator.getGamepads()[gamepad.index];
          let hasValidData = false;

          // Priority 1: Use standard GamepadPose API (PS4/PS5/Switch Pro Controller)
          if (nativeGamepad && (nativeGamepad as GamepadWithPose).pose) {
            const pose = (nativeGamepad as GamepadWithPose).pose;

            // Use angular velocity (gyroscope data)
            if (pose.angularVelocity && Array.isArray(pose.angularVelocity)) {
              const [vx, vy, vz] = pose.angularVelocity;
              // Check if we have valid non-null data
              if (vx !== null && vy !== null && vz !== null) {
                pitch = ((vx * 180) / Math.PI) * 10; // Convert rad/s to degrees
                yaw = ((vy * 180) / Math.PI) * 10;
                roll = ((vz * 180) / Math.PI) * 10;
                hasValidData = true;
              }
            }

            // Use orientation quaternion if available
            if (!hasValidData && pose.orientation && Array.isArray(pose.orientation)) {
              const [x, y, z, w] = pose.orientation;
              // Check if we have valid non-null quaternion data
              if (x !== null && y !== null && z !== null && w !== null) {
                // Quaternion to Euler conversion
                const sinr_cosp = 2 * (w * x + y * z);
                const cosr_cosp = 1 - 2 * (x * x + y * y);
                roll = (Math.atan2(sinr_cosp, cosr_cosp) * 180) / Math.PI;

                const sinp = 2 * (w * y - z * x);
                pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * 90 : (Math.asin(sinp) * 180) / Math.PI;

                const siny_cosp = 2 * (w * z + x * y);
                const cosy_cosp = 1 - 2 * (y * y + z * z);
                yaw = (Math.atan2(siny_cosp, cosy_cosp) * 180) / Math.PI;
                hasValidData = true;
              }
            }

            // Use linear acceleration if available
            if (pose.linearAcceleration && Array.isArray(pose.linearAcceleration)) {
              const [lax, lay, laz] = pose.linearAcceleration;
              if (lax !== null && lay !== null && laz !== null) {
                ax = lax;
                ay = lay;
                az = laz;
              }
            }
          }
          // Priority 2: Fallback to extended axes (some browsers)
          else if (gamepad.axes.length > 4) {
            pitch = (gamepad.axes[4] || 0) * 180;
            yaw = (gamepad.axes[5] || 0) * 180;
            roll = (gamepad.axes[6] || 0) * 180;
            ax = gamepad.axes[7] || 0;
            ay = gamepad.axes[8] || 0;
            az = gamepad.axes[9] || 0;
            hasValidData = true;
          }

          // Check if we got valid data, if not increment counter
          if (!hasValidData) {
            noDataFrameCount.current++;
            // If we haven't received valid data for 60 frames (~1 second), fallback to joystick
            if (noDataFrameCount.current > 60) {
              console.log("No valid gyro data received, falling back to joystick simulation");
              setGyroSource("joystick");
              noDataFrameCount.current = 0;
            }
            // Use joystick simulation while in gamepad mode but no data
            pitch = (gamepad.axes[1] || 0) * 45;
            yaw = (gamepad.axes[0] || 0) * 45;
            roll = (gamepad.axes[2] || 0) * 45;
            ax = gamepad.axes[0] || 0;
            ay = gamepad.axes[1] || 0;
            az = gamepad.axes[3] || 0;
          } else {
            // Reset counter if we got valid data
            noDataFrameCount.current = 0;
          }
        } else if (gyroSource === "joystick" && gamepad) {
          // Joystick simulation mode - directly map to orientation (not velocity)
          // Apply deadzone to prevent drift
          const deadzone = 0.1;
          const applyDeadzone = (value: number) => {
            return Math.abs(value) < deadzone ? 0 : value;
          };

          // Left stick: Pitch (up/down) and Yaw (left/right)
          // Right stick: Also can control Pitch (up/down) and Roll (left/right)
          const leftStickY = applyDeadzone(gamepad.axes[1] || 0);
          const leftStickX = applyDeadzone(gamepad.axes[0] || 0);
          const rightStickX = applyDeadzone(gamepad.axes[2] || 0);
          const rightStickY = applyDeadzone(gamepad.axes[3] || 0);

          // Combine both sticks
          const joystickPitch = (leftStickY + rightStickY) * 180; // Both sticks control pitch
          const joystickYaw = leftStickX * 180; // Left stick horizontal → Yaw
          const joystickRoll = rightStickX * 180; // Right stick horizontal → Roll

          ax = leftStickX;
          ay = leftStickY;
          az = rightStickY;

          // Apply calibration
          const targetPitch = joystickPitch - calibrationOffset.pitch;
          const targetYaw = joystickYaw - calibrationOffset.yaw;
          const targetRoll = joystickRoll - calibrationOffset.roll;

          // Update refs (high-frequency)
          // For joystick mode, orientation follows joystick directly
          orientationRef.current = {
            pitch: targetPitch,
            yaw: targetYaw,
            roll: targetRoll,
          };

          // Calculate angular velocity from orientation change
          pitch = targetPitch - rotationRef.current.pitch;
          yaw = targetYaw - rotationRef.current.yaw;
          roll = targetRoll - rotationRef.current.roll;

          rotationRef.current = { pitch, yaw, roll };
          accelerationRef.current = { x: ax, y: ay, z: az };

          // Debug: log axes values occasionally
          if (Math.random() < 0.05) {
            // Log 5% of frames
            console.log("[Joystick Sim] Raw Axes:", gamepad.axes.map((v, i) => `[${i}]=${v.toFixed(3)}`).join(", "));
            console.log(
              "[Joystick Sim] After Deadzone:",
              `leftY=${leftStickY.toFixed(3)}, leftX=${leftStickX.toFixed(3)}, rightX=${rightStickX.toFixed(3)}, rightY=${rightStickY.toFixed(3)}`,
            );
            console.log(
              "[Joystick Sim] Calculated:",
              `pitch=${joystickPitch.toFixed(1)}, yaw=${joystickYaw.toFixed(1)}, roll=${joystickRoll.toFixed(1)}`,
            );
            console.log(
              "[Joystick Sim] After Calibration:",
              `pitch=${targetPitch.toFixed(1)}, yaw=${targetYaw.toFixed(1)}, roll=${targetRoll.toFixed(1)}`,
            );
            console.log(
              "[Joystick Sim] Final Orientation:",
              `pitch=${orientationRef.current.pitch.toFixed(1)}, yaw=${orientationRef.current.yaw.toFixed(1)}, roll=${orientationRef.current.roll.toFixed(1)}`,
            );
          }
        }

        // For gyro modes (not joystick), integrate angular velocity
        if (gyroSource !== "joystick") {
          // Apply calibration with proper rounding to avoid floating point errors
          pitch = Math.round((pitch - calibrationOffset.pitch) * 1000) / 1000;
          yaw = Math.round((yaw - calibrationOffset.yaw) * 1000) / 1000;
          roll = Math.round((roll - calibrationOffset.roll) * 1000) / 1000;

          // Apply small deadzone to prevent accumulation of residual calibration errors
          const applyDeadzone = (value: number) => {
            return Math.abs(value) < gyroDeadzone ? 0 : value;
          };

          pitch = applyDeadzone(pitch);
          yaw = applyDeadzone(yaw);
          roll = applyDeadzone(roll);

          // Debug: log calibrated values
          if (Math.random() < 0.02) {
            console.log("[Gyro] After calibration + deadzone:", {
              pitch: pitch.toFixed(3),
              yaw: yaw.toFixed(3),
              roll: roll.toFixed(3),
              "(should be 0)": "",
            });
          }

          // Update refs (high-frequency)
          rotationRef.current = { pitch, yaw, roll };
          accelerationRef.current = { x: ax, y: ay, z: az };

          // Integrate angular velocity to get orientation (Euler integration)
          orientationRef.current = {
            pitch: orientationRef.current.pitch + pitch * dt,
            yaw: orientationRef.current.yaw + yaw * dt,
            roll: orientationRef.current.roll + roll * dt,
          };
        }

        // Update history (without creating new array each time)
        historyRef.current.push({ pitch, yaw, roll });
        if (historyRef.current.length > 100) {
          historyRef.current.shift();
        }

        // Throttled display update (60Hz)
        if (timestamp - lastDisplayUpdateRef.current >= displayUpdateInterval) {
          lastDisplayUpdateRef.current = timestamp;

          // Apply display-level stabilization to prevent flickering
          const stabilizeValue = (value: number, threshold: number = 1.0): number => {
            // Force small values to exactly 0 to prevent +/- flickering
            // Use larger threshold for better stability at high sample rates
            return Math.abs(value) < threshold ? 0 : value;
          };

          // Stabilize sign changes - only change sign if value changed significantly
          const stabilizeSign = (newVal: number, prevVal: number, changeThreshold: number = 5.0): number => {
            // If value is close to 0, always return 0
            if (Math.abs(newVal) < 1.0) return 0;

            // If absolute values are similar but signs differ, keep previous sign
            const absNew = Math.abs(newVal);
            const absPrev = Math.abs(prevVal);
            const absChange = Math.abs(absNew - absPrev);

            // If absolute value didn't change much (< changeThreshold), keep previous sign
            if (absChange < changeThreshold && Math.sign(newVal) !== Math.sign(prevVal) && prevVal !== 0) {
              return Math.sign(prevVal) * absNew;
            }

            return newVal;
          };

          const newRotation = {
            pitch: stabilizeSign(
              stabilizeValue(rotationRef.current.pitch, 1.0),
              prevDisplayRef.current.rotation.pitch,
              3.0,
            ),
            yaw: stabilizeSign(stabilizeValue(rotationRef.current.yaw, 1.0), prevDisplayRef.current.rotation.yaw, 3.0),
            roll: stabilizeSign(
              stabilizeValue(rotationRef.current.roll, 1.0),
              prevDisplayRef.current.rotation.roll,
              3.0,
            ),
          };

          const newOrientation = {
            pitch: stabilizeSign(
              stabilizeValue(orientationRef.current.pitch, 2.0),
              prevDisplayRef.current.orientation.pitch,
              5.0,
            ),
            yaw: stabilizeSign(
              stabilizeValue(orientationRef.current.yaw, 2.0),
              prevDisplayRef.current.orientation.yaw,
              5.0,
            ),
            roll: stabilizeSign(
              stabilizeValue(orientationRef.current.roll, 2.0),
              prevDisplayRef.current.orientation.roll,
              5.0,
            ),
          };

          const newAcceleration = {
            x: stabilizeSign(
              stabilizeValue(accelerationRef.current.x, 0.1),
              prevDisplayRef.current.acceleration.x,
              0.2,
            ),
            y: stabilizeSign(
              stabilizeValue(accelerationRef.current.y, 0.1),
              prevDisplayRef.current.acceleration.y,
              0.2,
            ),
            z: stabilizeSign(
              stabilizeValue(accelerationRef.current.z, 0.1),
              prevDisplayRef.current.acceleration.z,
              0.2,
            ),
          };

          // Update previous display values
          prevDisplayRef.current = {
            rotation: newRotation,
            orientation: newOrientation,
            acceleration: newAcceleration,
          };

          setDisplayData({
            rotation: newRotation,
            orientation: newOrientation,
            acceleration: newAcceleration,
            history: [...historyRef.current],
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(sampleMotion);
    };

    animationFrameRef.current = requestAnimationFrame(sampleMotion);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gamepad, sampleRate, calibrationOffset, gyroSource, permissionGranted, gyroDeadzone]);

  // Auto-detect best gyro source
  useEffect(() => {
    // Don't auto-switch if user has manually selected a mode
    if (manuallySelected) {
      return;
    }

    if (!gamepad) {
      if (!permissionGranted) {
        setGyroSource("joystick");
      }
      return;
    }

    // Get native gamepad for pose detection
    const nativeGamepad = navigator.getGamepads()[gamepad.index];

    console.log("=== Gyroscope Detection Debug ===");
    console.log("Gamepad ID:", nativeGamepad?.id);
    console.log("Has pose property:", !!(nativeGamepad && (nativeGamepad as GamepadWithPose).pose));

    if (nativeGamepad && (nativeGamepad as GamepadWithPose).pose) {
      const pose = (nativeGamepad as GamepadWithPose).pose;
      console.log("Pose object:", pose);
      console.log("angularVelocity:", pose.angularVelocity);
      console.log("orientation:", pose.orientation);
      console.log("linearAcceleration:", pose.linearAcceleration);
      console.log("position:", pose.position);
    }

    console.log("Axes count:", gamepad.axes.length);
    console.log("Axes values:", gamepad.axes);
    console.log("=================================");

    // Priority 1: Check for GamepadPose API (standard for PS4/PS5/Switch Pro)
    if (nativeGamepad && (nativeGamepad as GamepadWithPose).pose) {
      const pose = (nativeGamepad as GamepadWithPose).pose;

      // Check if pose has valid gyroscope data (not just null values)
      let hasValidGyro = false;

      if (pose.angularVelocity && Array.isArray(pose.angularVelocity)) {
        const [vx, vy, vz] = pose.angularVelocity;
        hasValidGyro = vx !== null && vy !== null && vz !== null;
        console.log("angularVelocity check:", { vx, vy, vz, hasValidGyro });
      }

      if (!hasValidGyro && pose.orientation && Array.isArray(pose.orientation)) {
        const [x, y, z, w] = pose.orientation;
        hasValidGyro = x !== null && y !== null && z !== null && w !== null;
        console.log("orientation check:", { x, y, z, w, hasValidGyro });
      }

      if (hasValidGyro) {
        console.log("✅ Detected gamepad with native gyroscope support (GamepadPose API)");
        setGyroSource("gamepad");
        noDataFrameCount.current = 0;
        return;
      } else {
        console.log("⚠️ GamepadPose API present but no valid data, checking extended axes...");
      }
    }

    // Priority 2: Check for extended axes (some browsers)
    if (gamepad.axes.length > 4) {
      // Check if gamepad has real gyro data (non-zero values on extended axes)
      const hasRealGyro = gamepad.axes.slice(4).some((v) => Math.abs(v) > 0.01);
      console.log("Extended axes check:", { count: gamepad.axes.length, hasRealGyro });
      if (hasRealGyro) {
        console.log("✅ Detected gamepad with gyroscope via extended axes");
        setGyroSource("gamepad");
        noDataFrameCount.current = 0;
        return;
      }
    }

    // Priority 3: Fallback to joystick simulation (only if not already using client)
    console.log("❌ No native gyroscope detected, using joystick simulation");
    if (!permissionGranted && gyroSource !== "client") {
      setGyroSource("joystick");
    }
    noDataFrameCount.current = 0;
  }, [gamepad, permissionGranted, manuallySelected, gyroSource]);

  // Draw 3D visualization - Scientific style (optimized, max 360fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationId: number;
    const maxFps = 360; // Maximum canvas refresh rate
    const minFrameInterval = 1000 / maxFps; // ~2.78ms

    const draw = (timestamp: number) => {
      // Throttle to max 360fps, otherwise follow screen refresh rate
      if (timestamp - lastCanvasUpdateRef.current < minFrameInterval) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastCanvasUpdateRef.current = timestamp;

      const { orientation, rotation, acceleration } = displayData;
      const size = canvas.width;
      const center = size / 2;

      // Clear with solid dark background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, size, size);

      // Draw reference circle
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(center, center, size * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      // Convert degrees to radians (use accumulated orientation)
      // Controller view: 0° = top view, L2/L1 faces up
      const yawOffset = 0;
      const pitchRad = (orientation.pitch * Math.PI) / 180;
      const yawRad = ((orientation.yaw + yawOffset) * Math.PI) / 180;
      const rollRad = (orientation.roll * Math.PI) / 180;

      // Rotation matrix function
      // pitch = X轴旋转, yaw = Y轴旋转, roll = Z轴旋转
      const rotatePoint = (x: number, y: number, z: number) => {
        // Pitch rotation (around X-axis)
        const y1 = y * Math.cos(pitchRad) - z * Math.sin(pitchRad);
        const z1 = y * Math.sin(pitchRad) + z * Math.cos(pitchRad);
        const x1 = x;

        // Yaw rotation (around Y-axis)
        const x2 = x1 * Math.cos(yawRad) + z1 * Math.sin(yawRad);
        const z2 = -x1 * Math.sin(yawRad) + z1 * Math.cos(yawRad);
        const y2 = y1;

        // Roll rotation (around Z-axis)
        const x3 = x2 * Math.cos(rollRad) - y2 * Math.sin(rollRad);
        const y3 = x2 * Math.sin(rollRad) + y2 * Math.cos(rollRad);
        const z3 = z2;

        return { x: x3, y: y3, z: z3 };
      };

      // Project 3D to 2D
      const project = (x: number, y: number, z: number) => {
        if (viewMode === "controller") {
          // Axis remapping derived from user calibration:
          //   screen X  = -y  (gyro Y- → screen right)
          //   screen Y  =  x  (gyro X+ → screen up)
          //   depth     = -z  (gyro Z+ → out of screen)
          const cx = -y;
          const cy = x;
          const cz = -z;
          // Small downward tilt so grips show depth
          const tilt = (3 * Math.PI) / 180;
          const sy = cy * Math.cos(tilt) + cz * Math.sin(tilt);
          const sz = -cy * Math.sin(tilt) + cz * Math.cos(tilt);
          const scale = size * 0.155;
          // After 90° CW rotation: screenX = sy, screenY = -cx
          // User calibration: Y+ shows X-, X- shows Y+ → swap axes and fix signs
          // Correct: screenX = -cx (= y), screenY = -sy (= -x)
          const screenX = -cx;
          const screenY = -sy;
          return { x: center + screenX * scale, y: center - screenY * scale, z: sz };
        }
        // Axes view: Z→right, Y→up, X→depth (isometric, slight offset left-down)
        const depthAngle = (210 * Math.PI) / 180; // X-depth axis goes lower-left
        const depthScale = 0.55; // foreshortening for depth axis
        const scale = size * 0.18;
        const sx = z + x * Math.cos(depthAngle) * depthScale;
        const sy = y + x * Math.sin(depthAngle) * depthScale;
        return { x: center + sx * scale, y: center - sy * scale, z: x };
      };

      const originProj = project(0, 0, 0);

      if (viewMode === "axes") {
        // Draw coordinate axes (body-fixed)
        const axisLength = 2.2;
        const axes = [
          { vec: [axisLength, 0, 0], color: "#ff4444", label: "X" },
          { vec: [0, axisLength, 0], color: "#44ff44", label: "Y" },
          { vec: [0, 0, axisLength], color: "#4488ff", label: "Z" },
        ];

        axes.forEach((axis) => {
          const rotated = rotatePoint(axis.vec[0], axis.vec[1], axis.vec[2]);
          const end = project(rotated.x, rotated.y, rotated.z);

          ctx.strokeStyle = axis.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(originProj.x, originProj.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          const angle = Math.atan2(end.y - originProj.y, end.x - originProj.x);
          const headLength = 10;
          ctx.fillStyle = axis.color;
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();

          ctx.font = "bold 16px monospace";
          ctx.fillStyle = axis.color;
          ctx.fillText(axis.label, end.x + 12, end.y + 5);
        });

        const cubeSize = 1.5;
        const cubeVertices = [
          [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
          [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
        ].map(([x, y, z]) => {
          const rotated = rotatePoint(x * cubeSize, y * cubeSize, z * cubeSize);
          return project(rotated.x, rotated.y, rotated.z);
        });

        const edges = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
        ];

        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1.5;
        edges.forEach(([i, j]) => {
          ctx.beginPath();
          ctx.moveTo(cubeVertices[i].x, cubeVertices[i].y);
          ctx.lineTo(cubeVertices[j].x, cubeVertices[j].y);
          ctx.stroke();
        });
      } else {
        // === CONTROLLER VIEW: Clear DualShock 4 3D Controller ===
        
        const scale = size * 0.45; // Overall scale
        
        // Colors
        const C = {
          body: '#1a1a2e',
          bodyLight: '#2d2d4a',
          bodyDark: '#0f0f1a',
          touchpad: '#252540',
          stick: '#0a0a15',
          stickTop: '#3a3a55',
          dpad: '#1f1f35',
          ps: '#162040',
          faceGreen: '#00d26a',
          faceRed: '#ff4757',
          faceBlue: '#3742fa',
          facePink: '#ff6b9d',
          shoulder: '#252540',
          lightBar: '#a0d0ff',
        };
        
        // Simple 3D rotation
        const rotate = (x: number, y: number, z: number) => {
          let x1 = x, y1 = y, z1 = z;
          
          // Pitch
          let t = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
          z1 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);
          y1 = t;
          
          // Yaw
          t = x1 * Math.cos(yawRad) + z1 * Math.sin(yawRad);
          z1 = -x1 * Math.sin(yawRad) + z1 * Math.cos(yawRad);
          x1 = t;
          
          // Roll
          t = x1 * Math.cos(rollRad) - y1 * Math.sin(rollRad);
          y1 = x1 * Math.sin(rollRad) + y1 * Math.cos(rollRad);
          x1 = t;
          
          return { x: x1, y: y1, z: z1 };
        };
        
        // Project 3D to 2D with perspective
        const project = (x: number, y: number, z: number) => {
          const r = rotate(x, y, z);
          const depth = 4 + r.z;
          return {
            x: center + (r.x * scale) / depth,
            y: center - (r.y * scale) / depth,
            z: r.z
          };
        };
        
        // Draw functions
        const faces: { z: number; draw: () => void }[] = [];
        
        const addFace = (z: number, fn: () => void) => faces.push({ z, draw: fn });
        
        const drawRect = (
          cx: number, cy: number, cz: number,
          w: number, h: number,
          fill: string, stroke?: string
        ) => {
          const p = project(cx, cy, cz);
          const sw = w * scale / 5;
          const sh = h * scale / 5;
          addFace(p.z, () => {
            ctx.fillStyle = fill;
            ctx.fillRect(p.x - sw/2, p.y - sh/2, sw, sh);
            if (stroke) {
              ctx.strokeStyle = stroke;
              ctx.lineWidth = 1;
              ctx.strokeRect(p.x - sw/2, p.y - sh/2, sw, sh);
            }
          });
        };
        
        const drawCircle = (
          cx: number, cy: number, cz: number,
          r: number,
          fill: string, stroke?: string
        ) => {
          const p = project(cx, cy, cz);
          const pr = r * scale / 5;
          addFace(p.z - 0.5, () => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(2, pr), 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();
            if (stroke) {
              ctx.strokeStyle = stroke;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
        };
        
        // === MAIN BODY (rounded rectangle) ===
        const bodyW = 1.6, bodyH = 0.25, bodyD = 0.9;
        
        // Top face
        const tf1 = project(-bodyW, bodyH, bodyD);
        const tf2 = project(bodyW, bodyH, bodyD);
        const tf3 = project(bodyW, bodyH, -bodyD);
        const tf4 = project(-bodyW, bodyH, -bodyD);
        addFace((tf1.z + tf2.z + tf3.z + tf4.z) / 4, () => {
          ctx.beginPath();
          ctx.moveTo(tf1.x, tf1.y);
          ctx.lineTo(tf2.x, tf2.y);
          ctx.lineTo(tf3.x, tf3.y);
          ctx.lineTo(tf4.x, tf4.y);
          ctx.closePath();
          ctx.fillStyle = C.bodyLight;
          ctx.fill();
          ctx.strokeStyle = C.bodyDark;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        
        // Front face
        const ff1 = project(-bodyW, bodyH, bodyD);
        const ff2 = project(bodyW, bodyH, bodyD);
        const ff3 = project(bodyW, -bodyH, bodyD);
        const ff4 = project(-bodyW, -bodyH, bodyD);
        addFace((ff1.z + ff2.z + ff3.z + ff4.z) / 4, () => {
          ctx.beginPath();
          ctx.moveTo(ff1.x, ff1.y);
          ctx.lineTo(ff2.x, ff2.y);
          ctx.lineTo(ff3.x, ff3.y);
          ctx.lineTo(ff4.x, ff4.y);
          ctx.closePath();
          ctx.fillStyle = C.body;
          ctx.fill();
        });
        
        // === LEFT GRIP ===
        const gw = 0.5, gh = 0.9, gd = 0.35;
        const gf1 = project(-bodyW - gw/2, -bodyH - gh/2, gd);
        const gf2 = project(-bodyW + gw/2, -bodyH - gh/2, gd);
        const gf3 = project(-bodyW + gw/2 * 0.5, -bodyH - gh * 0.9, gd);
        const gf4 = project(-bodyW - gw/2 * 0.5, -bodyH - gh * 0.9, gd);
        addFace((gf1.z + gf2.z + gf3.z + gf4.z) / 4, () => {
          ctx.beginPath();
          ctx.moveTo(gf1.x, gf1.y);
          ctx.lineTo(gf2.x, gf2.y);
          ctx.lineTo(gf3.x, gf3.y);
          ctx.lineTo(gf4.x, gf4.y);
          ctx.closePath();
          ctx.fillStyle = C.body;
          ctx.fill();
        });
        
        // === RIGHT GRIP ===
        const rf1 = project(bodyW + gw/2, -bodyH - gh/2, gd);
        const rf2 = project(bodyW - gw/2, -bodyH - gh/2, gd);
        const rf3 = project(bodyW - gw/2 * 0.5, -bodyH - gh * 0.9, gd);
        const rf4 = project(bodyW + gw/2 * 0.5, -bodyH - gh * 0.9, gd);
        addFace((rf1.z + rf2.z + rf3.z + rf4.z) / 4, () => {
          ctx.beginPath();
          ctx.moveTo(rf1.x, rf1.y);
          ctx.lineTo(rf2.x, rf2.y);
          ctx.lineTo(rf3.x, rf3.y);
          ctx.lineTo(rf4.x, rf4.y);
          ctx.closePath();
          ctx.fillStyle = C.body;
          ctx.fill();
        });
        
        // === LIGHT BAR ===
        drawRect(0, bodyH + 0.05, bodyD - 0.1, 2.4, 0.08, C.lightBar);
        
        // === TOUCHPAD ===
        drawRect(0, bodyH + 0.12, 0, 1.1, 0.55, C.touchpad, C.bodyDark);
        
        // === PS BUTTON ===
        drawCircle(0, bodyH + 0.08, -0.2, 0.12, C.ps, C.bodyDark);
        
        // === SHARE / OPTIONS ===
        drawRect(-0.25, bodyH + 0.06, -0.2, 0.12, 0.06, C.shoulder);
        drawRect(0.25, bodyH + 0.06, -0.2, 0.12, 0.06, C.shoulder);
        
        // === SPEAKER HOLES ===
        for (let i = 0; i < 6; i++) {
          drawCircle(-0.2 + i * 0.08, bodyH + 0.08, 0.3, 0.015, '#000');
        }
        
        // === LEFT STICK ===
        drawCircle(-0.45, bodyH + 0.15, 0.1, 0.22, C.stick, C.bodyDark);
        drawCircle(-0.45, bodyH + 0.2, 0.12, 0.14, C.stickTop, C.stick);
        
        // === RIGHT STICK ===
        drawCircle(0.45, bodyH + 0.15, -0.1, 0.22, C.stick, C.bodyDark);
        drawCircle(0.45, bodyH + 0.2, -0.08, 0.14, C.stickTop, C.stick);
        
        // === D-PAD ===
        drawRect(-0.45, bodyH + 0.1, -0.35, 0.08, 0.3, C.dpad, C.bodyDark);
        drawRect(-0.45, bodyH + 0.1, -0.35, 0.3, 0.08, C.dpad, C.bodyDark);
        
        // === FACE BUTTONS (△○✕□) ===
        drawCircle(0.45, bodyH + 0.25, -0.3, 0.1, C.faceGreen);   // △
        drawCircle(0.45, bodyH + 0.1, -0.45, 0.1, C.faceBlue);   // ×
        drawCircle(0.3, bodyH + 0.1, -0.3, 0.1, C.facePink);      // □
        drawCircle(0.6, bodyH + 0.1, -0.3, 0.1, C.faceRed);      // ○
        
        // === SHOULDER BUTTONS ===
        drawRect(-0.9, bodyH + 0.2, 0.6, 0.4, 0.1, C.shoulder, C.bodyDark);  // L1
        drawRect(-0.9, bodyH + 0.15, 0.7, 0.4, 0.12, C.shoulder, C.bodyDark); // L2
        drawRect(0.9, bodyH + 0.2, 0.6, 0.4, 0.1, C.shoulder, C.bodyDark);   // R1
        drawRect(0.9, bodyH + 0.15, 0.7, 0.4, 0.12, C.shoulder, C.bodyDark); // R2
        
        // Sort and draw
        faces.sort((a, b) => a.z - b.z);
        faces.forEach(f => f.draw());
        
        // Glow effect for light bar
        const lbProj = project(0, bodyH + 0.05, bodyD);
        const grd = ctx.createRadialGradient(lbProj.x, lbProj.y, 0, lbProj.x, lbProj.y, scale * 0.5);
        grd.addColorStop(0, 'rgba(150, 200, 255, 0.2)');
        grd.addColorStop(1, 'rgba(150, 200, 255, 0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, size, size);
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(originProj.x, originProj.y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (viewMode === "axes") {
        ctx.font = "11px monospace";
        const legendY = size - 15;
        ctx.fillStyle = "#ff4444";
        ctx.fillText("X(深)", 10, legendY);
        ctx.fillStyle = "#44ff44";
        ctx.fillText("Y(上)", 60, legendY);
        ctx.fillStyle = "#4488ff";
        ctx.fillText("Z(右)", 110, legendY);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillText("右手系", 160, legendY);
      } else {
        ctx.font = "11px monospace";
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillText(language === "zh" ? "手柄姿态视图" : "Controller attitude view", 10, size - 15);
      }

      // Draw center point
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(originProj.x, originProj.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw acceleration vector if significant
      const accelMagnitude = Math.sqrt(acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2);
      if (accelMagnitude > 0.1) {
        const scale = Math.min(1.5, accelMagnitude);
        const rotated = rotatePoint(acceleration.x * scale, -acceleration.y * scale, acceleration.z * scale);
        const accelEnd = project(rotated.x, rotated.y, rotated.z);

        // Draw acceleration vector
        ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(originProj.x, originProj.y);
        ctx.lineTo(accelEnd.x, accelEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw arrow head
        const angle = Math.atan2(accelEnd.y - originProj.y, accelEnd.x - originProj.x);
        const headLength = 10;
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.moveTo(accelEnd.x, accelEnd.y);
        ctx.lineTo(
          accelEnd.x - headLength * Math.cos(angle - Math.PI / 6),
          accelEnd.y - headLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          accelEnd.x - headLength * Math.cos(angle + Math.PI / 6),
          accelEnd.y - headLength * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.font = "11px monospace";
        ctx.fillStyle = "#ffaa00";
        ctx.fillText(`${accelMagnitude.toFixed(2)}g`, accelEnd.x + 8, accelEnd.y - 8);
      }

      // Draw data overlay (top-left) - Show both orientation and angular velocity
      ctx.font = "12px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      const dataY = 20;
      ctx.fillText(`Pitch: ${orientation.pitch.toFixed(1)}° (${rotation.pitch.toFixed(1)}°/s)`, 10, dataY);
      ctx.fillText(`Yaw:   ${orientation.yaw.toFixed(1)}° (${rotation.yaw.toFixed(1)}°/s)`, 10, dataY + 18);
      ctx.fillText(`Roll:  ${orientation.roll.toFixed(1)}° (${rotation.roll.toFixed(1)}°/s)`, 10, dataY + 36);

      // Draw angular velocity magnitude (top-right)
      const angularMag = Math.sqrt(rotation.pitch ** 2 + rotation.yaw ** 2 + rotation.roll ** 2);
      ctx.font = "14px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.textAlign = "right";
      ctx.fillText(`|ω| = ${angularMag.toFixed(1)}°/s`, size - 10, 20);
      ctx.textAlign = "left";

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [displayData, viewMode, language]);

  if (!gamepad) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
          {t("gyroTest")}
        </h3>
        <div className="h-48 flex items-center justify-center text-muted-foreground">{t("connectToTest")}</div>
      </div>
    );
  }

  // Check if gamepad has gyroscope support
  const nativeGamepad = navigator.getGamepads()[gamepad.index];
  const gamepadWithPose = nativeGamepad as GamepadWithPose | null;
  const hasGamepadPose =
    gamepadWithPose &&
    gamepadWithPose.pose &&
    (gamepadWithPose.pose.angularVelocity || gamepadWithPose.pose.orientation);
  const hasExtendedAxes = gamepad.axes.length > 4;
  const hasGamepadGyro = hasGamepadPose || hasExtendedAxes;
  const sourceLabels = {
    device: language === "zh" ? "设备陀螺仪" : "Device Gyro",
    gamepad: language === "zh" ? "手柄陀螺仪" : "Gamepad Gyro",
    joystick: language === "zh" ? "摇杆模拟" : "Joystick Sim",
    client: language === "zh" ? "客户端陀螺仪" : "Client Gyro",
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              gyroSource === "client" || gyroSource === "gamepad" || gyroSource === "device"
                ? "bg-success animate-pulse"
                : "bg-warning",
            )}
          />
          {t("gyroTest")}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(v => v === "axes" ? "controller" : "axes")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all",
              viewMode === "controller"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
            title={language === "zh" ? "切换视图" : "Toggle view"}
          >
            <Gamepad2 className="w-4 h-4" />
            {language === "zh" ? (viewMode === "controller" ? "轴视图" : "手柄视图") : (viewMode === "controller" ? "Axes" : "Controller")}
          </button>
          <button
            onClick={calibrate}
            disabled={isCalibrating}
            className="px-3 py-1.5 bg-muted rounded-lg hover:bg-muted/80 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Compass className={cn("w-4 h-4", isCalibrating && "animate-spin")} />
            {t("calibrate")}
          </button>
          <button onClick={reset} className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-all">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gyro Source Selection */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {clientConnected && (
          <button
            onClick={() => {
              setGyroSource("client");
              setManuallySelected(true);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              gyroSource === "client" ? "bg-success text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
            {language === "zh" ? "客户端" : "Client"}
          </button>
        )}
        {deviceMotionAvailable && (
          <button
            onClick={() => {
              if (!permissionGranted) {
                requestDeviceMotionPermission();
              } else {
                setGyroSource("device");
                setManuallySelected(true);
              }
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              gyroSource === "device" && permissionGranted
                ? "bg-primary text-primary-foreground"
                : gyroSource === "device" && !permissionGranted
                ? "bg-warning/20 text-warning border border-warning/40"
                : !permissionGranted
                ? "bg-muted/50 text-muted-foreground hover:bg-warning/10 hover:text-warning"
                : "bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            <Smartphone className="w-3 h-3" />
            {language === "zh"
              ? permissionGranted ? "设备陀螺仪" : "设备陀螺仪 (需授权)"
              : permissionGranted ? "Device" : "Device (tap to allow)"}
          </button>
        )}
        <button
          onClick={() => {
            setGyroSource("gamepad");
            setManuallySelected(true);
          }}
          disabled={!hasGamepadGyro}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
            gyroSource === "gamepad"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
            !hasGamepadGyro && "opacity-50 cursor-not-allowed",
          )}
        >
          <Gamepad2 className="w-3 h-3" />
          {language === "zh" ? "手柄陀螺仪" : "Gamepad"}
        </button>
        <button
          onClick={() => {
            setGyroSource("joystick");
            setManuallySelected(true);
          }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
            gyroSource === "joystick"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
        >
          <RotateCw className="w-3 h-3" />
          {language === "zh" ? "摇杆模拟" : "Joystick"}
        </button>
      </div>

      {gyroSource === "joystick" && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-6 text-sm text-warning">
          {t("gyroNotDetected")}
        </div>
      )}

      {gyroSource === "client" && clientConnected && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3 mb-6 text-sm text-success">
          {language === "zh"
            ? "✓ 已连接到本地客户端，正在读取真实陀螺仪数据"
            : "✓ Connected to local client, reading real gyroscope data"}
        </div>
      )}

      {gyroSource === "client" && !clientConnected && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-6 text-sm text-primary">
          <div>
            {language === "zh"
              ? "ℹ 提示：双击运行 gamepad-test-client.exe 可读取真实手柄陀螺仪数据"
              : "ℹ Tip: Run gamepad-test-client.exe to read real gamepad gyroscope data"}
          </div>
          <div className="mt-1">
            {language === "zh" ? (
              <>
                客户端下载：
                <a
                  href="https://wwbwr.lanzouw.com/i6M5o3lziksb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-80"
                >
                  https://wwbwr.lanzouw.com/i6M5o3lziksb
                </a>
                {" "}（密码：game）
              </>
            ) : (
              <>
                Download client：
                <a
                  href="https://wwbwr.lanzouw.com/i6M5o3lziksb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-80"
                >
                  https://wwbwr.lanzouw.com/i6M5o3lziksb
                </a>
                {" "}(password: game)
              </>
            )}
          </div>
        </div>
      )}

      {gyroSource === "gamepad" && hasGamepadPose && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3 mb-6 text-sm text-success">
          {language === "zh"
            ? "✓ 已检测到原生陀螺仪支持 (GamepadPose API)"
            : "✓ Native gyroscope detected (GamepadPose API)"}
        </div>
      )}

      {gyroSource === "gamepad" && !hasGamepadPose && hasExtendedAxes && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-6 text-sm text-primary">
          {language === "zh" ? "ℹ 使用扩展轴陀螺仪数据" : "ℹ Using extended axes for gyroscope data"}
        </div>
      )}

      {gyroSource === "device" && !permissionGranted && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-6 text-sm text-warning">
          <div className="font-medium mb-1">
            {language === "zh" ? "⚠ 需要授权设备传感器" : "⚠ Sensor permission required"}
          </div>
          <div className="text-xs opacity-80">
            {language === "zh"
              ? '请点击上方"设备陀螺仪"按钮，在弹出的权限请求中选择"允许"'
              : 'Click the "Device" button above and allow sensor access in the permission prompt'}
          </div>
        </div>
      )}

      {gyroSource === "device" && permissionGranted && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3 mb-6 text-sm text-success">
          {language === "zh"
            ? "✓ 已授权设备传感器，正在读取设备陀螺仪数据"
            : "✓ Sensor permission granted, reading device gyroscope data"}
        </div>
      )}

      {/* Calibration & Settings Panel */}
      {(gyroSource === "client" || gyroSource === "gamepad" || gyroSource === "device") && (
        <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Calibration Info */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Compass className="w-4 h-4" />
                {language === "zh" ? "校准偏移值" : "Calibration Offset"}
              </h4>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pitch (X):</span>
                  <span className="text-red-400">{calibrationOffset.pitch.toFixed(3)}°/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Yaw (Y):</span>
                  <span className="text-green-400">{calibrationOffset.yaw.toFixed(3)}°/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Roll (Z):</span>
                  <span className="text-blue-400">{calibrationOffset.roll.toFixed(3)}°/s</span>
                </div>
              </div>
            </div>

            {/* Deadzone Control */}
            <div>
              <h4 className="text-sm font-semibold mb-2">{language === "zh" ? "死区设置" : "Deadzone"}</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{language === "zh" ? "当前值" : "Current"}:</span>
                  <span className="font-mono font-medium">{gyroDeadzone.toFixed(2)}°/s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={gyroDeadzone}
                  onChange={(e) => setGyroDeadzone(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0</span>
                  <span>2.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3D Visualization */}
        <div className="flex flex-col items-center">
          <canvas ref={canvasRef} width={400} height={400} className="rounded-xl shadow-2xl border border-border/50" />
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                gyroSource === "client" || gyroSource === "gamepad" || gyroSource === "device"
                  ? "bg-success"
                  : "bg-warning",
              )}
            />
            {sourceLabels[gyroSource]}
          </p>
        </div>

        {/* Values */}
        <div className="space-y-4">
          {/* Rotation */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <RotateCw className="w-4 h-4" />
              {t("rotation")}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  axis: "X",
                  name: language === "zh" ? "俯仰" : "Pitch",
                  angle: displayData.orientation.pitch,
                  velocity: displayData.rotation.pitch,
                  color: "hsl(0, 70%, 60%)",
                },
                {
                  axis: "Y",
                  name: language === "zh" ? "偏航" : "Yaw",
                  angle: displayData.orientation.yaw,
                  velocity: displayData.rotation.yaw,
                  color: "hsl(120, 70%, 60%)",
                },
                {
                  axis: "Z",
                  name: language === "zh" ? "横滚" : "Roll",
                  angle: displayData.orientation.roll,
                  velocity: displayData.rotation.roll,
                  color: "hsl(220, 70%, 60%)",
                },
              ].map(({ axis, name, angle, velocity, color }) => {
                const angleStr = angle.toFixed(1) === "-0.0" ? "0.0" : angle.toFixed(1);
                const velocityStr = velocity.toFixed(1) === "-0.0" ? "0.0" : velocity.toFixed(1);

                return (
                  <div key={axis} className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-semibold">{axis}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{name}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1">{language === "zh" ? "角度" : "Angle"}</div>
                        <div className="font-mono tabular-nums text-lg font-semibold" style={{ color }}>
                          {angleStr}°
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1">{language === "zh" ? "角速度" : "Rate"}</div>
                        <div className="font-mono tabular-nums text-sm font-medium text-foreground/90">
                          {velocityStr}°/s
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                          <span>{language === "zh" ? "姿态" : "Orientation"}</span>
                          <span>±180°</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                          <div
                            className="absolute h-full rounded-full"
                            style={{
                              backgroundColor: color,
                              width: `${Math.min(50, (Math.abs(angle) / 180) * 50)}%`,
                              left: angle >= 0 ? "50%" : `${50 - Math.min(50, (Math.abs(angle) / 180) * 50)}%`,
                            }}
                          />
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-foreground/30" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                          <span>{language === "zh" ? "速率" : "Velocity"}</span>
                          <span>±180°/s</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                          <div
                            className="absolute h-full rounded-full opacity-80"
                            style={{
                              backgroundColor: color,
                              width: `${Math.min(50, (Math.abs(velocity) / 180) * 50)}%`,
                              left: velocity >= 0 ? "50%" : `${50 - Math.min(50, (Math.abs(velocity) / 180) * 50)}%`,
                            }}
                          />
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-foreground/30" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Acceleration */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t("acceleration")}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  axis: "X",
                  name: language === "zh" ? "前后" : "Forward",
                  value: displayData.acceleration.x,
                  color: "hsl(0, 70%, 60%)",
                },
                {
                  axis: "Y",
                  name: language === "zh" ? "左右" : "Right",
                  value: displayData.acceleration.y,
                  color: "hsl(120, 70%, 60%)",
                },
                {
                  axis: "Z",
                  name: language === "zh" ? "上下" : "Up",
                  value: displayData.acceleration.z,
                  color: "hsl(220, 70%, 60%)",
                },
              ].map(({ axis, name, value, color }) => {
                const valueStr = value.toFixed(2) === "-0.00" ? "0.00" : value.toFixed(2);
                const fill = Math.min(50, (Math.abs(value) / 20) * 50);

                return (
                  <div key={axis} className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-semibold">{axis}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{name}</span>
                    </div>

                    <div>
                      <div className="text-[11px] text-muted-foreground mb-1">m/s²</div>
                      <div className="font-mono tabular-nums text-lg font-semibold" style={{ color }}>
                        {valueStr}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>{language === "zh" ? "加速度" : "Acceleration"}</span>
                        <span>±20</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                        <div
                          className="absolute h-full rounded-full"
                          style={{
                            backgroundColor: color,
                            width: `${fill}%`,
                            left: value >= 0 ? "50%" : `${50 - fill}%`,
                          }}
                        />
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-foreground/30" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Motion History Graph */}
          {displayData.history.length > 10 && (
            <div className="bg-muted/20 rounded-lg p-3">
              <div className="flex items-end justify-between h-16 gap-px">
                {displayData.history.slice(-50).map((h, idx) => {
                  const maxVal = 45;
                  const height = ((Math.abs(h.pitch) + Math.abs(h.yaw) + Math.abs(h.roll)) / (maxVal * 3)) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-primary/60 rounded-t"
                      style={{ height: `${Math.min(100, height)}%`, minWidth: "2px" }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

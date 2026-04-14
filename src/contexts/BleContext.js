import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import {
  decodeBlePayload,
  decodePpgPayload,
  destroyBleManager,
  formatBleError,
  getBleConfig,
  getBleConfigError,
  getBleManager,
  normalizeBleReading,
  requestBlePermissions,
  waitForBluetoothPoweredOn,
  scanForDevice,
} from "../services/ble";

const STORAGE_KEY = "@mindpulse/ble-device-id";

const BleContext = createContext({
  bluetoothState: "Unknown",
  deviceName: "",
  connectedDevice: null,
  latestReading: null,
  latestPayload: null,
  isScanning: false,
  isConnecting: false,
  isConnected: false,
  error: "",
  configError: "",
  connect: async () => {},
  disconnect: async () => {},
  clearError: () => {},
});

export function BleProvider({ children }) {
  const managerRef = useRef(null);
  const bluetoothSubscriptionRef = useRef(null);
  const disconnectSubscriptionRef = useRef(null);
  const monitorSubscriptionRef = useRef(null);
  const ppgMonitorSubscriptionRef = useRef(null);
  const fallbackReadIntervalRef = useRef(null);
  const lastPrimaryPacketAtRef = useRef(0);
  const latestReadingRef = useRef(null);
  const [bluetoothState, setBluetoothState] = useState("Unknown");
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [latestPayload, setLatestPayload] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const config = useMemo(() => getBleConfig(), []);
  const configError = useMemo(() => getBleConfigError(), []);

  useEffect(() => {
    return () => {
      bluetoothSubscriptionRef.current?.remove();
      disconnectSubscriptionRef.current?.remove();
      monitorSubscriptionRef.current?.remove();
      ppgMonitorSubscriptionRef.current?.remove();
      if (fallbackReadIntervalRef.current) {
        clearInterval(fallbackReadIntervalRef.current);
        fallbackReadIntervalRef.current = null;
      }
      destroyBleManager();
    };
  }, []);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const applyPrimaryCharacteristicValue = useCallback((encodedValue) => {
    const payload = decodeBlePayload(encodedValue);
    setLatestPayload(payload);

    const reading = normalizeBleReading(payload);
    if (!reading) {
      return null;
    }

    latestReadingRef.current = reading;
    setLatestReading(reading);

    if (reading.metrics) {
      lastPrimaryPacketAtRef.current = Date.now();
      setError((previous) =>
        previous?.startsWith("BLE data format error:") ? "" : previous
      );
    } else if (payload?.raw) {
      const preview = String(payload.raw).replace(/\s+/g, " ").slice(0, 120);
      const commaCount = (preview.match(/,/g) || []).length;
      const likelyTruncated = preview.length >= 18 && preview.length <= 24 && commaCount < 6;
      setError((previous) =>
        previous ||
        (likelyTruncated
          ? `BLE data format error: payload appears truncated (likely BLE MTU limit). Payload: ${preview}`
          : `BLE data format error: payload received but could not parse metrics (${preview}).`)
      );
    }

    return reading;
  }, []);

  const connect = useCallback(async () => {
    if (connectedDevice?.id) {
      return connectedDevice;
    }

    if (configError) {
      setError(configError);
      throw new Error(configError);
    }

    setError("");
    setIsScanning(false);
    setIsConnecting(true);

    const permissionGranted = await requestBlePermissions();
    if (!permissionGranted) {
      const message = "Bluetooth permission was denied.";
      setError(message);
      setIsConnecting(false);
      throw new Error(message);
    }

    try {
      if (!managerRef.current) {
        const manager = getBleManager();
        managerRef.current = manager;

        bluetoothSubscriptionRef.current?.remove();
        bluetoothSubscriptionRef.current = manager.onStateChange((nextState) => {
          setBluetoothState(nextState);
        }, true);
      }

      await waitForBluetoothPoweredOn(managerRef.current);

      const savedDeviceId = await AsyncStorage.getItem(STORAGE_KEY).catch(
        () => null
      );
      let nextDevice = null;

      if (savedDeviceId) {
        try {
          nextDevice = await managerRef.current.connectToDevice(savedDeviceId);
        } catch {
          await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      }

      if (!nextDevice) {
        setIsScanning(true);
        const scannedDevice = await scanForDevice({
          manager: managerRef.current,
          serviceUuid: config.serviceUuid,
          preferredName: config.deviceName,
        });
        setIsScanning(false);
        nextDevice = await managerRef.current.connectToDevice(scannedDevice.id);
      }

      let readyDevice = await nextDevice.discoverAllServicesAndCharacteristics();
      if (Platform.OS === "android" && typeof readyDevice.requestMTU === "function") {
        try {
          // Prevent 20-byte truncation for CSV payloads containing all sensor fields.
          readyDevice = await readyDevice.requestMTU(185);
        } catch (mtuError) {
          console.warn(
            "[BLE] MTU request failed",
            formatBleError(mtuError, "BLE MTU request failed.")
          );
        }
      }
      lastPrimaryPacketAtRef.current = 0;

      disconnectSubscriptionRef.current?.remove();
      disconnectSubscriptionRef.current = managerRef.current.onDeviceDisconnected(
        readyDevice.id,
        (disconnectError) => {
          setConnectedDevice(null);
          setLatestReading(null);
          setLatestPayload(null);
          if (fallbackReadIntervalRef.current) {
            clearInterval(fallbackReadIntervalRef.current);
            fallbackReadIntervalRef.current = null;
          }
          if (disconnectError) {
            setError(formatBleError(disconnectError, "BLE device disconnected."));
          }
        }
      );

      monitorSubscriptionRef.current?.remove();
      monitorSubscriptionRef.current = readyDevice.monitorCharacteristicForService(
        config.serviceUuid,
        config.characteristicUuid,
        (monitorError, characteristic) => {
          if (monitorError) {
            setError(formatBleError(monitorError, "BLE notification failed."));
            return;
          }
          applyPrimaryCharacteristicValue(characteristic?.value);
        }
      );

      ppgMonitorSubscriptionRef.current?.remove();
      ppgMonitorSubscriptionRef.current = readyDevice.monitorCharacteristicForService(
        config.serviceUuid,
        config.ppgCharacteristicUuid,
        (monitorError, characteristic) => {
          if (monitorError) {
            console.warn(
              "[BLE] PPG notification failed",
              formatBleError(monitorError, "BLE PPG notification failed.")
            );
            return;
          }

          const ppgSamples = decodePpgPayload(characteristic?.value);
          if (!ppgSamples.length) return;

          const baseReading = latestReadingRef.current;
          if (!baseReading) return;

          const nextReading = {
            ...baseReading,
            timestamp: new Date().toISOString(),
            raw: {
              ...baseReading.raw,
              ppg_samples: ppgSamples,
            },
          };
          latestReadingRef.current = nextReading;
          setLatestReading(nextReading);
        }
      );

      const readPrimaryCharacteristic = async () => {
        try {
          const characteristic = await readyDevice.readCharacteristicForService(
            config.serviceUuid,
            config.characteristicUuid
          );
          applyPrimaryCharacteristicValue(characteristic?.value);
        } catch (readError) {
          // Keep connection alive even if one read attempt fails.
        }
      };

      // Seed the first packet quickly without waiting for notify timing.
      await readPrimaryCharacteristic();

      // Fallback polling: if notify stalls, read characteristic directly.
      if (fallbackReadIntervalRef.current) {
        clearInterval(fallbackReadIntervalRef.current);
        fallbackReadIntervalRef.current = null;
      }
      fallbackReadIntervalRef.current = setInterval(() => {
        if (Date.now() - lastPrimaryPacketAtRef.current < 3000) return;
        readPrimaryCharacteristic();
      }, 2000);

      await AsyncStorage.setItem(STORAGE_KEY, readyDevice.id);
      setConnectedDevice(readyDevice);
      setError("");

      return readyDevice;
    } catch (connectError) {
      const message = formatBleError(connectError, "Unable to connect to BLE device.");
      setConnectedDevice(null);
      if (fallbackReadIntervalRef.current) {
        clearInterval(fallbackReadIntervalRef.current);
        fallbackReadIntervalRef.current = null;
      }
      setError(message);
      throw connectError;
    } finally {
      setIsScanning(false);
      setIsConnecting(false);
    }
  }, [
    config.characteristicUuid,
    config.deviceName,
    config.ppgCharacteristicUuid,
    config.serviceUuid,
    configError,
    connectedDevice,
  ]);

  const disconnect = useCallback(async () => {
    if (!managerRef.current || !connectedDevice?.id) {
      setConnectedDevice(null);
      return;
    }

    monitorSubscriptionRef.current?.remove();
    monitorSubscriptionRef.current = null;
    ppgMonitorSubscriptionRef.current?.remove();
    ppgMonitorSubscriptionRef.current = null;
    disconnectSubscriptionRef.current?.remove();
    disconnectSubscriptionRef.current = null;
    if (fallbackReadIntervalRef.current) {
      clearInterval(fallbackReadIntervalRef.current);
      fallbackReadIntervalRef.current = null;
    }

    try {
      await managerRef.current.cancelDeviceConnection(connectedDevice.id);
    } catch (disconnectError) {
      const message = formatBleError(
        disconnectError,
        "Unable to disconnect BLE device."
      );
      setError(message);
      throw disconnectError;
    } finally {
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      setConnectedDevice(null);
      setLatestReading(null);
      setLatestPayload(null);
      latestReadingRef.current = null;
    }
  }, [connectedDevice?.id]);

  const value = useMemo(
    () => ({
      bluetoothState,
      deviceName:
        connectedDevice?.name ||
        connectedDevice?.localName ||
        config.deviceName ||
        "BLE wearable",
      connectedDevice,
      latestReading,
      latestPayload,
      isScanning,
      isConnecting,
      isConnected: Boolean(connectedDevice?.id),
      error,
      configError,
      connect,
      disconnect,
      clearError,
    }),
    [
      bluetoothState,
      clearError,
      config.deviceName,
      configError,
      connect,
      connectedDevice,
      disconnect,
      error,
      isConnecting,
      isScanning,
      latestPayload,
      latestReading,
    ]
  );

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
}

export function useBle() {
  return useContext(BleContext);
}

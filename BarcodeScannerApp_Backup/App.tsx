// App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView, Dimensions, Platform, PermissionsAndroid, Vibration, AppState, useWindowDimensions, StatusBar, NativeModules } from 'react-native';
import Torch from 'react-native-torch';
import { Camera } from 'react-native-camera-kit';
import Clipboard from '@react-native-clipboard/clipboard';

const { width } = Dimensions.get('window');

const toBracketed = (text: string) => `[${text}]`;

// Play beep sound and vibration together
const playBeepSound = () => {
  // Play vibration
  if (Platform.OS === 'ios') {
    Vibration.vibrate([0, 100]); // Short vibration for iOS
  } else {
    Vibration.vibrate(100); // Short vibration for Android
  }
  
  // Play system notification sound
  if (Platform.OS === 'android') {
    // Use Android's built-in notification sound
    try {
      const { NativeModules } = require('react-native');
      if (NativeModules.SoundManager) {
        // Play notification sound
        NativeModules.SoundManager.playSystemSound(1);
      }
    } catch (e) {
      console.log('System sound not available');
    }
  }
};

// Flashlight control using native modules
const toggleFlashlight = async (isOn: boolean) => {
  try {
    await Torch.switchState(isOn);
  } catch (error) {
    console.log('Flashlight control error:', error);
  }
};

export default function App() {
  const windowDims = useWindowDimensions();
  // Enable dual-pane for large unfolded screens; lower threshold for Fold devices
  const isDualPane = windowDims.width >= 800 && windowDims.height >= 600;
  const guideSize = Math.min(windowDims.width * 0.6, 360);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [scannedHistory, setScannedHistory] = useState<string[]>([]);
  const [cameraKey, setCameraKey] = useState(0);
  const [isFlashOn, setIsFlashOn] = useState(false);
  useEffect(() => {
    // Sync native torch without flashing camera preview
    toggleFlashlight(isFlashOn);
  }, [isFlashOn]);
  const lastValueRef = useRef<string | null>(null);
  const lastAtRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        setHasPermission(true);
      }
    };
    requestPermission();

    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev.match(/inactive|background/) && nextState === 'active') {
        // App returned to foreground: ensure permission and remount camera
        try {
          if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
          }
        } catch {}
        setCameraKey((k) => k + 1);
        setIsScanning(true);
      } else if (nextState.match(/inactive|background/)) {
        // Going to background: pause scanning to reduce native issues
        setIsScanning(false);
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const shouldAcceptScan = useCallback((value: string) => {
    const now = Date.now();
    const isDuplicate = value === lastValueRef.current && now - lastAtRef.current < 1500;
    if (isDuplicate) return false;
    lastValueRef.current = value;
    lastAtRef.current = now;
    return true;
  }, []);

  const onReadCode = useCallback(async (event: any) => {
    const value: string | undefined = event?.nativeEvent?.codeStringValue;
    if (!value) return;
    if (!shouldAcceptScan(value)) return;

    // Play beep sound
    playBeepSound();

    // Always save to history
    setScannedHistory(prev => [value, ...prev].slice(0, 100));

    if (isDualPane) {
      // In dual-pane mode, keep scanning and do not show popup
      return;
    }

    // Single-pane: pause and show popup as before
    setIsScanning(false);
    Alert.alert('바코드 인식 완료', `값: ${toBracketed(value)}`, [
      { text: '복사', onPress: async () => {
        try {
          await Clipboard.setString(toBracketed(value));
          Alert.alert('복사 완료', '클립보드에 복사되었습니다');
        } catch (e) {
          Alert.alert('복사 실패', '클립보드 복사에 실패했습니다');
        }
      } },
      { text: '다시 스캔', onPress: () => setIsScanning(true) },
      { text: '확인', onPress: () => setIsScanning(true) },
    ]);
  }, [shouldAcceptScan, isDualPane]);

  const copyAllHistoryBracketed = useCallback(async () => {
    if (!scannedHistory.length) {
      Alert.alert('복사할 항목이 없습니다');
      return;
    }
    try {
      const joined = '불량 ' + scannedHistory.map(v => toBracketed(v)).join(', ');
      await Clipboard.setString(joined);
      Alert.alert('복사 완료', "'불량 [값], [값]' 형태로 복사되었습니다");
    } catch (e) {
      Alert.alert('복사 실패', '클립보드 복사에 실패했습니다');
    }
  }, [scannedHistory]);

  if (!hasPermission) {
  return (
      <View style={styles.container}>
        <Text style={styles.message}>카메라 권한이 필요합니다</Text>
        <Text style={styles.subMessage}>설정에서 카메라 권한을 허용해주세요</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0F" />
      {isDualPane ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <View style={styles.cameraContainer}>
              <Camera
                key={`camera-${cameraKey}`}
                style={styles.camera}
                scanBarcode={true}
                onReadCode={onReadCode}
                showFrame={false}
                laserColor={'transparent'}
                torchMode={isFlashOn ? 'on' : 'off'}
              />
              <View style={styles.overlay}>
                <View style={[styles.scanArea, { width: guideSize, height: guideSize }]} />
                <TouchableOpacity 
                  style={styles.flashButton} 
                  onPress={() => {
                    setIsFlashOn((prev) => !prev);
                  }}
                >
                  <Text style={styles.flashButtonText}>{isFlashOn ? '🔦' : '💡'}</Text>
                </TouchableOpacity>
                <Text style={styles.instructionText}>불량배터리 바코드를 스캔 영역에 맞춰주세요</Text>
              </View>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <ScrollView style={styles.historyContainer}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>스캔 히스토리 ({scannedHistory.length})</Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={copyAllHistoryBracketed} style={styles.copyAllButton}>
                    <Text style={styles.copyAllButtonText}>모두 복사</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setScannedHistory([])} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>전체 삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {scannedHistory.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>스캔한 바코드가 없습니다</Text>
                  <Text style={styles.emptySubText}>스캔하면 목록에 표시됩니다</Text>
                </View>
              ) : (
                scannedHistory.map((code, idx) => (
                  <View key={`${code}-${idx}`} style={styles.historyItem}>
                    <View style={styles.historyContent}>
                      <Text style={styles.historyCode} numberOfLines={2}>{toBracketed(code)}</Text>
                    </View>
                    <View style={styles.historyActions}>
                      <TouchableOpacity style={styles.copyButton} onPress={async () => {
                        try {
                          await Clipboard.setString(toBracketed(code));
                          Alert.alert('복사 완료', '클립보드에 복사되었습니다');
                        } catch (e) {
                          Alert.alert('복사 실패', '클립보드 복사에 실패했습니다');
                        }
                      }}>
                        <Text style={styles.copyButtonText}>복사</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteButton} onPress={() => setScannedHistory(prev => prev.filter((_, i) => i !== idx))}>
                        <Text style={styles.deleteButtonText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
          {isScanning ? (
            <View style={styles.cameraContainer}>
              <Camera
                key={`camera-${cameraKey}`}
                style={styles.camera}
                scanBarcode={true}
                onReadCode={onReadCode}
                showFrame={false}
                laserColor={'transparent'}
                torchMode={isFlashOn ? 'on' : 'off'}
              />
              <View style={styles.overlay}>
                <View style={[styles.scanArea, { width: guideSize, height: guideSize }]} />
                <TouchableOpacity 
                  style={styles.flashButton} 
                  onPress={() => {
                    setIsFlashOn((prev) => !prev);
                  }}
                >
                  <Text style={styles.flashButtonText}>{isFlashOn ? '🔦' : '💡'}</Text>
                </TouchableOpacity>
                <Text style={styles.instructionText}>불량배터리 바코드를 스캔 영역에 맞춰주세요</Text>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.historyContainer}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>스캔 히스토리 ({scannedHistory.length})</Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={copyAllHistoryBracketed} style={styles.copyAllButton}>
                    <Text style={styles.copyAllButtonText}>모두 복사</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setScannedHistory([])} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>전체 삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {scannedHistory.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>스캔한 바코드가 없습니다</Text>
                  <Text style={styles.emptySubText}>스캔하면 목록에 표시됩니다</Text>
                </View>
              ) : (
                scannedHistory.map((code, idx) => (
                  <View key={`${code}-${idx}`} style={styles.historyItem}>
                    <View style={styles.historyContent}>
                      <Text style={styles.historyCode} numberOfLines={2}>{toBracketed(code)}</Text>
                    </View>
                    <View style={styles.historyActions}>
                      <TouchableOpacity style={styles.copyButton} onPress={async () => {
                        try {
                          await Clipboard.setString(toBracketed(code));
                          Alert.alert('복사 완료', '클립보드에 복사되었습니다');
                        } catch (e) {
                          Alert.alert('복사 실패', '클립보드 복사에 실패했습니다');
                        }
                      }}>
                        <Text style={styles.copyButtonText}>복사</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteButton} onPress={() => setScannedHistory(prev => prev.filter((_, i) => i !== idx))}>
                        <Text style={styles.deleteButtonText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, isScanning ? styles.stopButton : styles.startButton]}
              onPress={() => setIsScanning(!isScanning)}
            >
              <Text style={styles.buttonText}>
                {isScanning ? `스캔 중지 (${scannedHistory.length})` : '스캔 시작'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 32) : 0,
  },
  cameraContainer: { flex: 1 },
  camera: { 
    flex: 1, 
    backgroundColor: '#151821', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  cameraPlaceholder: {
    color: '#fff', 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center',
    marginBottom: 10
  },
  cameraSubText: {
    color: '#ccc', 
    fontSize: 16, 
    textAlign: 'center'
  },
  mockScanButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 20
  },
  mockScanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  scanArea: {
    borderWidth: 2, borderColor: '#FF3B30', backgroundColor: 'transparent',
    borderRadius: 12,
  },
  instructionText: {
    color: '#E6E6E6', fontSize: 16, marginTop: 20, textAlign: 'center',
    backgroundColor: 'rgba(15,15,20,0.85)', padding: 10, borderRadius: 5,
  },
  autoSaveText: {
    color: '#00E676', fontSize: 14, marginTop: 10, textAlign: 'center',
    backgroundColor: 'rgba(15,15,20,0.85)', padding: 5, borderRadius: 3,
  },
  historyButton: {
    backgroundColor: '#3D7EFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#1B2030',
  },
  historyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyContainer: { flex: 1, backgroundColor: '#0F121A' },
  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 15, backgroundColor: '#151821', borderBottomWidth: 1, borderBottomColor: '#2A2F3A',
  },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: '#E6E6E6' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  copyAllButton: {
    backgroundColor: '#3D7EFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5, marginRight: 8,
  },
  copyAllButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  clearButton: {
    backgroundColor: '#FF5252', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5,
  },
  clearButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 18, color: '#AAB2C0', marginBottom: 10 },
  emptySubText: { fontSize: 14, color: '#7E8696', textAlign: 'center' },
  historyItem: {
    backgroundColor: '#1E2230', padding: 15, borderBottomWidth: 1, borderBottomColor: '#2A2F3A',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  historyContent: { flex: 1, marginRight: 10 },
  historyCode: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#E6E6E6' },
  historyActions: { flexDirection: 'row' },
  copyButton: {
    backgroundColor: '#3D7EFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, marginRight: 8,
  },
  copyButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  deleteButton: {
    backgroundColor: '#FF5252', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4,
  },
  deleteButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  buttonContainer: { position: 'absolute', bottom: 50, left: 20, right: 20 },
  button: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 25, alignItems: 'center' },
  startButton: { backgroundColor: '#00C853' },
  stopButton: { backgroundColor: '#FF1744' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  message: { fontSize: 18, textAlign: 'center', marginTop: 50, color: '#E6E6E6' },
  subMessage: { fontSize: 14, textAlign: 'center', marginTop: 10, color: '#AAB2C0' },
  flashButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 32) + 10 : 10,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  flashButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});
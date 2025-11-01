import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, Pressable, ActivityIndicator, Alert, Platform, ScrollView, Modal, Linking, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import ResultView from './src/components/ResultView';
import Paywall from './src/components/Paywall';
import { getSubscriptionState, incrementFreeCount, setSubscribed, setTrialIfFirstOpen, startLocalTrial } from './src/store/subscription';
import { initIAP, requestPlan, restorePurchases } from './src/services/iap';
import { uploadImage } from './src/api/client';
import type { AnalysisResult } from './src/types';

export default function App() {
  const PROGRESS_MESSAGES = [
    'Uploading image…',
    'Analyzing content…',
    'Preparing results…',
  ];
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [assetName, setAssetName] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [manageSubVisible, setManageSubVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Premium animations
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const badgeAnim = React.useRef(new Animated.Value(1)).current;

  // Camera state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const cameraRef = React.useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  React.useEffect(() => {
    // First open: init counters and show paywall upfront
    (async () => {
      await setTrialIfFirstOpen();
      const s = await getSubscriptionState();
      setIsSubscribed(!!s.isSubscribed);
      // Initialize IAP connection unless explicitly disabled via env
      try {
        const disabled = String((process as any)?.env?.EXPO_PUBLIC_IAP_DISABLED || '').toLowerCase();
        if (disabled !== 'true' && disabled !== '1') {
          await initIAP();
        }
      } catch {}
      setPaywallVisible(true);
    })();
  }, []);

  // Premium glow pulse animation
  React.useEffect(() => {
    if (!isSubscribed) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isSubscribed]);

  // Premium badge pulse
  React.useEffect(() => {
    if (!isSubscribed) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(badgeAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(badgeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isSubscribed]);

  // Step through three progress stages once (no loop) while analyzing
  React.useEffect(() => {
    if (!loading) {
      setProgressIndex(0);
      return;
    }
    setProgressIndex(0);
    const t1 = setTimeout(() => setProgressIndex(1), 1000);
    const t2 = setTimeout(() => setProgressIndex(2), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  const openSourceChooser = () => {
    setSourceSheetOpen(true);
  };

  const pickFromLibrary = async () => {
    setResult(null);
    // iOS: Ask for Photos permission. If previously denied, offer Settings shortcut.
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      perm = req;
      if (!req.granted) {
        if (Platform.OS === 'ios') {
          Alert.alert(
            'Photos access needed',
            'Allow access to All Photos or Selected Photos to pick an image.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
            ]
          );
        } else {
          Alert.alert('Permission required', 'Please grant access to your gallery in Settings.');
        }
        return;
      }
    }
    // If user picked "Selected Photos" previously, iOS returns limited access. Proceed anyway.
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        quality: 1,
        allowsEditing: false,
        exif: false,
      });
      if (!picked.canceled) {
        const asset = picked.assets[0];
        setImageUri(asset.uri);
        setAssetName(asset.fileName ?? null);
      }
    } finally {
      setSourceSheetOpen(false);
    }
  };

  const openCamera = async () => {
    setResult(null);
    const status = cameraPermission?.granted ? true : (await requestCameraPermission()).granted;
    if (!status) {
      Alert.alert('Permission required', 'Camera access is required to take a photo.');
      return;
    }
    setCapturedPhotoUri(null);
    setCameraVisible(true);
    setSourceSheetOpen(false);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setCapturedPhotoUri(photo.uri);
    } catch (e: any) {
      Alert.alert('Xəta', e?.message || 'Şəkil çəkilə bilmədi');
    }
  };

  const acceptPhoto = () => {
    if (!capturedPhotoUri) return;
    setImageUri(capturedPhotoUri);
    setAssetName('camera.jpg');
    setCameraVisible(false);
  };

  const retakePhoto = () => {
    setCapturedPhotoUri(null);
  };

  const analyze = async () => {
    if (!imageUri) return;
    try {
      // Gate: free users can analyze once per day; subscribers/trial have unlimited
      const sub = await getSubscriptionState();
      setIsSubscribed(!!sub.isSubscribed);
      // Daily free limit: 1 per day
      if (!sub.isSubscribed && sub.freeAnalysesUsed >= 1) {
        setPaywallVisible(true);
        return;
      }

      setLoading(true);
      // Always convert to fast JPEG to avoid HEIC/unsupported types and reduce payload size.
      // Limit max width to ~1400px for faster uploads; keep aspect ratio.
      const jpeg = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const uploadUri = jpeg.uri;
      const baseName = (assetName || imageUri.split('/').pop() || 'image').replace(/\.[^.]+$/, '') || 'image';
      const uploadName = `${baseName}.jpg`;
      const uploadMime = 'image/jpeg';

      const form = new FormData();
      // @ts-ignore - React Native FormData file shape
  form.append('image', { uri: uploadUri, name: uploadName, type: uploadMime });

      const data: AnalysisResult = await uploadImage(form as any);
      setResult(data);

      // Increment free count on success if not subscribed
      const state = await getSubscriptionState();
      if (!state.isSubscribed) await incrementFreeCount();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analyzer</Text>
          <View style={styles.subtitleRow}>
            {isSubscribed ? (
              <Animated.View style={[styles.premiumBadge, { transform: [{ scale: badgeAnim }] }]}>
                <Text style={styles.premiumText}>PRO</Text>
              </Animated.View>
            ) : null}
            <Text style={styles.subtitle}>AI-powered vision</Text>
          </View>
          <View style={styles.headerActions}>
            {!isSubscribed && (
              <Pressable style={styles.upgradeButton} onPress={() => setPaywallVisible(true)}>
                <Text style={styles.upgradeButtonText}>Upgrade</Text>
              </Pressable>
            )}
            <Pressable style={styles.settingsButton} onPress={() => setSettingsVisible(true)}>
              <Text style={styles.settingsButtonText}>Settings</Text>
            </Pressable>
          </View>
        </View>

        {/* Pick Image Card */}
        {!imageUri && (
          <Pressable 
            style={({ pressed }) => [
              styles.uploadCard, 
              pressed && styles.uploadCardPressed
            ]} 
            onPress={openSourceChooser}
          >
            <View style={styles.uploadBorder}>
              <View style={styles.uploadContent}>
                <View style={styles.uploadIcon}>
                  <Text style={styles.uploadIconText}>+</Text>
                </View>
                <Text style={styles.uploadTitle}>Select Screenshot</Text>
                <Text style={styles.uploadHint}>Tap to choose from gallery</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Selected Image Card */}
        {imageUri && (
          <>
            <Pressable onPress={() => setPreviewOpen(true)}>
              <View style={styles.imageCard}>
                <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                <View style={styles.imageOverlay} />
              </View>
            </Pressable>
            
            <Pressable 
              style={({ pressed }) => [
                styles.analyzeButton, 
                loading && styles.analyzeButtonLoading,
                pressed && !loading && styles.analyzeButtonPressed
              ]} 
              onPress={analyze} 
              disabled={loading}
            >
              <View style={styles.analyzeGradient}>
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.analyzeButtonText}>Analyze</Text>
                )}
              </View>
            </Pressable>

            {imageUri && !loading && (
              <Pressable style={styles.changeButton} onPress={openSourceChooser}>
                <Text style={styles.changeButtonText}>Change Image</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Results */}
        <ResultView result={result} />
      </ScrollView>

  <StatusBar style="light" />

      {/* Paywall */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSubscribeMonthly={async () => {
          try {
            const ok = await requestPlan('weekly');
            if (ok) {
              const s = await getSubscriptionState();
              setIsSubscribed(!!s.isSubscribed);
              setPaywallVisible(false);
              return;
            }
            throw new Error('Purchase did not complete');
          } catch (e: any) {
            // Fallback: local 3-day trial for development/testing without charges
            await startLocalTrial(3);
            const s = await getSubscriptionState();
            setIsSubscribed(!!s.isSubscribed);
            setPaywallVisible(false);
            Alert.alert('Test mode', 'IAP not available in this build. Started a local 3‑day trial for testing.');
          }
        }}
        onSubscribeYearly={async () => {
          try {
            const ok = await requestPlan('yearly');
            if (ok) {
              const s = await getSubscriptionState();
              setIsSubscribed(!!s.isSubscribed);
              setPaywallVisible(false);
              return;
            }
            throw new Error('Purchase did not complete');
          } catch (e: any) {
            await startLocalTrial(3);
            const s = await getSubscriptionState();
            setIsSubscribed(!!s.isSubscribed);
            setPaywallVisible(false);
            Alert.alert('Test mode', 'IAP not available in this build. Started a local 3‑day trial for testing.');
          }
        }}
      />

      {/* Fullscreen image preview */}
      <Modal
        visible={!!previewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.modalRoot}>
          {/* Backdrop (tap to close) */}
          <Pressable style={styles.modalBackdrop} onPress={() => setPreviewOpen(false)} />
          <View style={styles.modalCenter}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.modalImage} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.modalClose} onPress={() => setPreviewOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Source chooser sheet */}
      <Modal
        transparent
        visible={sourceSheetOpen}
        animationType="fade"
        onRequestClose={() => setSourceSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSourceSheetOpen(false)} />
        <View style={styles.sheetContainer}>
          <Pressable style={styles.sheetButton} onPress={openCamera}>
            <Text style={styles.sheetButtonText}>Take Photo</Text>
          </Pressable>
          <Pressable style={styles.sheetButton} onPress={pickFromLibrary}>
            <Text style={styles.sheetButtonText}>Choose from Library</Text>
          </Pressable>
          <Pressable style={[styles.sheetButton, styles.sheetCancel]} onPress={() => setSourceSheetOpen(false)}>
            <Text style={[styles.sheetButtonText, styles.sheetCancelText]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Camera modal */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraRoot}>
          {/* Close */}
          <Pressable style={styles.cameraClose} onPress={() => setCameraVisible(false)}>
            <Text style={styles.cameraCloseText}>✕</Text>
          </Pressable>

          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            {capturedPhotoUri ? (
              <Image source={{ uri: capturedPhotoUri }} style={styles.cameraPreview} resizeMode="cover" />
            ) : null}
          </View>

          {/* Bottom controls */}
          {!capturedPhotoUri ? (
            <View style={styles.cameraControls}>
              <Pressable style={styles.shutterOuter} onPress={takePhoto}>
                <View style={styles.shutterInner} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraActions}>
              <Pressable style={styles.retakeBtn} onPress={retakePhoto}>
                <Text style={styles.retakeText}>Retake</Text>
              </Pressable>
              <Pressable style={styles.acceptBtn} onPress={acceptPhoto}>
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Fullscreen analyzing overlay */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingBackdrop}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#D4AF37" size="large" />
            <Text style={styles.loadingTitle}>Analyzing screenshot…</Text>
            <Text style={styles.loadingSubtitle}>{PROGRESS_MESSAGES[progressIndex]}</Text>
          </View>
        </View>
      </Modal>

      {/* Settings modal */}
      <Modal
        transparent
        visible={settingsVisible}
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSettingsVisible(false)} />
        <View style={styles.sheetContainer}>
          <Pressable style={styles.sheetButton} onPress={() => { setSettingsVisible(false); setManageSubVisible(true); }}>
            <Text style={styles.sheetButtonText}>Manage / Cancel Subscription</Text>
          </Pressable>
          <Pressable style={styles.sheetButton} onPress={() => { setSettingsVisible(false); setPrivacyVisible(true); }}>
            <Text style={styles.sheetButtonText}>Privacy Policy</Text>
          </Pressable>
          <Pressable
            style={styles.sheetButton}
            onPress={async () => {
              try {
                const restored = await restorePurchases();
                const s = await getSubscriptionState();
                setIsSubscribed(!!s.isSubscribed);
                Alert.alert(restored ? 'Restored' : 'No purchases', restored ? 'Your subscription has been restored.' : 'No active purchases found for this Apple/Google account.');
              } catch (e: any) {
                Alert.alert('Restore failed', e?.message || 'Unable to restore purchases.');
              } finally {
                setSettingsVisible(false);
              }
            }}
          >
            <Text style={styles.sheetButtonText}>Restore Purchases</Text>
          </Pressable>
          <Pressable style={[styles.sheetButton, styles.sheetCancel]} onPress={() => setSettingsVisible(false)}>
            <Text style={[styles.sheetButtonText, styles.sheetCancelText]}>Close</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Manage Subscription - full screen */}
      <Modal
        visible={manageSubVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setManageSubVisible(false)}
      >
        <View style={styles.infoRoot}>
          <View style={styles.infoHeader}>
            <Pressable onPress={() => setManageSubVisible(false)} style={styles.infoClose} hitSlop={12}>
              <Text style={styles.infoCloseText}>Close</Text>
            </Pressable>
            <Text style={styles.infoTitle}>Manage Subscription</Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.infoContent}>
            <Text style={styles.infoParagraph}>
              Subscriptions are billed by Apple and can be managed or canceled from your Apple ID.
              You can cancel anytime; access continues until the end of the billing period.
            </Text>
            <Pressable
              style={styles.infoPrimary}
              onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')}
            >
              <Text style={styles.infoPrimaryText}>Open iOS Subscriptions</Text>
            </Pressable>
            <Pressable
              style={styles.infoSecondary}
              onPress={() => Linking.openURL('app-settings:')}
            >
              <Text style={styles.infoSecondaryText}>Open App Settings</Text>
            </Pressable>
            <Text style={styles.infoSmall}>
              Refunds are handled by Apple at reportaproblem.apple.com
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Privacy Policy - full screen */}
      <Modal
        visible={privacyVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <View style={styles.infoRoot}>
          <View style={styles.infoHeader}>
            <Pressable onPress={() => setPrivacyVisible(false)} style={styles.infoClose} hitSlop={12}>
              <Text style={styles.infoCloseText}>Close</Text>
            </Pressable>
            <Text style={styles.infoTitle}>Privacy Policy</Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.infoContent}>
            <Text style={styles.infoParagraph}>
              Last updated: Oct 29, 2025
            </Text>

            <Text style={styles.infoParagraph}>
              We provide an AI-powered image analysis app. This policy explains what data we collect, how we use it, and your choices.
            </Text>

            <Text style={styles.infoParagraph}>
              1) Data we collect: Uploaded images/screenshots you select or take in-app; basic app diagnostics (e.g., crashes and performance); purchase status and receipts for subscriptions; an anonymous identifier or Apple user ID if you sign in.
            </Text>
            
            <Text style={styles.infoParagraph}>
              2) How we use data: To analyze your images and return results; to enrich results with public web data; to operate subscriptions; to prevent abuse; and to improve app quality.
            </Text>

            <Text style={styles.infoParagraph}>
              3) Sharing and processors: We do not sell personal data. We use processors strictly to provide the service (e.g., our backend, OpenAI for text/vision processing, and public information providers such as Wikipedia/OMDb). Data is transferred using TLS.
            </Text>

            <Text style={styles.infoParagraph}>
              4) Retention: Uploaded images and generated results are retained for a limited period needed to deliver the feature and maintain reliability, then deleted. Purchase records may be retained as required by law.
            </Text>

            <Text style={styles.infoParagraph}>
              5) Your choices: You may delete the app data on your device at any time. For account or server-side deletion requests, contact support. Subscriptions can be canceled in iOS Settings → Apple ID → Subscriptions.
            </Text>

            <Text style={styles.infoParagraph}>
              6) Children: The service is not intended for children under 13 (or local minimum age).
            </Text>

            <Text style={styles.infoParagraph}>
              7) Region-specific rights: Depending on your location (e.g., GDPR/CCPA), you may have rights to access, delete, or correct your data. Contact us to exercise these rights.
            </Text>

            <Text style={styles.infoParagraph}>
              8) Purchases & refunds: Purchases are processed by Apple. Refunds are handled by Apple at reportaproblem.apple.com.
            </Text>

            <Text style={styles.infoSmall}>Contact: support@example.com</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 40,
    position: 'relative',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.2,
    marginBottom: 12,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  premiumText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 15,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  headerActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    gap: 8,
  },
  upgradeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#D4AF37',
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  settingsButtonText: {
    fontSize: 13,
    color: '#D4AF37',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  uploadCard: {
    marginBottom: 24,
  },
  uploadCardPressed: {
    opacity: 0.85,
  },
  uploadBorder: {
    borderWidth: 2,
    borderColor: '#1F1F1F',
    borderRadius: 24,
    borderStyle: 'dashed',
    padding: 3,
  },
  uploadContent: {
    backgroundColor: '#141414',
    borderRadius: 22,
    paddingVertical: 60,
    alignItems: 'center',
  },
  uploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadIconText: {
    fontSize: 36,
    color: '#D4AF37',
    fontWeight: '300',
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  uploadHint: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  imageCard: {
    position: 'relative',
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#141414',
  },
  image: {
    width: '100%',
    height: 400,
    backgroundColor: '#1A1A1A',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'transparent',
  },
  // Modal preview styles
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  modalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalImage: {
    width: '90%',
    height: '70%',
  },
  modalClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    right: 20,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  modalCloseText: {
    color: '#000',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  analyzeButton: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  analyzeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  analyzeButtonLoading: {
    opacity: 0.7,
  },
  analyzeGradient: {
    backgroundColor: '#D4AF37',
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    fontSize: 20,
    marginRight: 8,
  },
  analyzeButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  changeButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  changeButtonText: {
    color: '#666666',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Analyzing overlay
  loadingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '86%',
    borderWidth: 1,
    borderColor: '#1F1F1F',
  },
  loadingTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 12,
    marginBottom: 6,
  },
  loadingSubtitle: {
    color: '#aaa',
    textAlign: 'center',
  },

  /* Action sheet styles */
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 + 20 : 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sheetButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  sheetCancel: {
    backgroundColor: '#141414',
  },
  sheetCancelText: {
    color: '#999',
    fontWeight: '700',
  },

  /* Camera styles */
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 24,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cameraCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cameraPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cameraControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 6,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  cameraActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  retakeBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  retakeText: {
    color: '#fff',
    fontWeight: '700',
  },
  acceptBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  acceptText: {
    color: '#000',
    fontWeight: '800',
  },

  // Info/Settings screens
  infoRoot: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  infoHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
    position: 'relative',
  },
  infoClose: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 60 : 36,
    padding: 8,
    zIndex: 20,
  },
  infoCloseText: {
    color: '#D4AF37',
    fontWeight: '800',
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  infoContent: {
    padding: 20,
    gap: 14,
  },
  infoParagraph: {
    color: '#CCCCCC',
    fontSize: 15,
    lineHeight: 22,
  },
  infoPrimary: {
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  infoPrimaryText: {
    color: '#000',
    fontWeight: '800',
  },
  infoSecondary: {
    backgroundColor: '#141414',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F1F1F',
  },
  infoSecondaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  infoSmall: {
    color: '#888',
    fontSize: 12,
    marginTop: 6,
  },
});

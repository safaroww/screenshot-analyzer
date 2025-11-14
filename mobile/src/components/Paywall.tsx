import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Platform, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubscribeMonthly: () => void;
  onSubscribeYearly: () => void;
  onRestore?: () => void;
};

export default function Paywall({ visible, onClose, onSubscribeMonthly, onSubscribeYearly, onRestore }: Props) {
  const [canClose, setCanClose] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [subscribing, setSubscribing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCanClose(false);
    const t = setTimeout(() => setCanClose(true), 5000);
    return () => clearTimeout(t);
  }, [visible]);

  const handleStartTrial = async () => {
    if (subscribing || restoring) return;
    setSubscribing(true);
    try {
      if (selectedPlan === 'monthly') {
        await onSubscribeMonthly();
      } else {
        await onSubscribeYearly();
      }
    } catch (error) {
      console.error('Purchase error in Paywall:', error);
    } finally {
      setSubscribing(false);
    }
  };

  const handleRestore = () => {
    if (restoring || subscribing || !onRestore) return;
    setRestoring(true);
    Promise.resolve(onRestore()).finally(() => setRestoring(false));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => canClose && onClose()}>
      <SafeAreaView style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.badge}>Pro plan</Text>
            <Text style={styles.title}>Efficient.{'\n'}Accessible.</Text>
          </View>

          {/* Features */}
          <View style={styles.features}>
            <FeatureRow icon="✨" title="Unlimited Analyses" />
            <FeatureRow icon="🌐" title="Rich Web Info" />
            <FeatureRow icon="⚡️" title="Priority Processing" />
            <FeatureRow icon="🔒" title="Privacy First" />
          </View>

          {/* Plans */}
          <View style={styles.plans}>
            {/* Monthly Plan */}
            <Pressable
              style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('monthly')}
              disabled={subscribing || restoring}
            >
              {selectedPlan === 'monthly' && <View style={styles.glowEffect} />}
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>1 week free</Text>
              </View>
              <View style={styles.radioOuter}>
                {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planPrice}>$8.99 / month</Text>
                <Text style={styles.planBilled}>
                  Then $8.99/month after free trial
                </Text>
              </View>
            </Pressable>

            {/* Yearly Plan */}
            <Pressable
              style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('yearly')}
              disabled={subscribing || restoring}
            >
              {selectedPlan === 'yearly' && <View style={styles.glowEffect} />}
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>1 week free</Text>
              </View>
              <View style={styles.radioOuter}>
                {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planPrice}>$59.99 / year</Text>
                <Text style={styles.planBilled}>
                  $4.99/month, then $59.99/year after free trial
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Bottom padding for sticky button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Sticky Subscribe Button */}
        <View style={styles.stickyButtonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.subscribeButton,
              pressed && !(subscribing || restoring) && styles.subscribeButtonPressed,
              (subscribing || restoring) && styles.subscribeButtonDisabled,
            ]}
            onPress={handleStartTrial}
            disabled={subscribing || restoring}
          >
            {subscribing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.subscribeButtonText}>Start Free Trial</Text>
            )}
          </Pressable>
          {onRestore ? (
            <Pressable 
              style={[styles.restoreLink, (restoring || subscribing) && styles.restoreLinkDisabled]}
              onPress={handleRestore}
              disabled={restoring || subscribing}
            >
              {restoring ? (
                <ActivityIndicator color="#D4AF37" size="small" />
              ) : (
                <Text style={styles.restoreLinkText}>Restore Purchases</Text>
              )}
            </Pressable>
          ) : null}
          
          {/* Terms below button */}
          <Text style={styles.terms}>
            Renews automatically after trial. Cancel anytime.{"\n"}
            <Text style={styles.termsLink} onPress={() => Linking.openURL('https://safaroww.github.io/screenshot-analyzer/terms-of-use.html')}>
              Terms of Use
            </Text>
            {" • "}
            <Text style={styles.termsLink} onPress={() => Linking.openURL('https://safaroww.github.io/screenshot-analyzer/privacy-policy.html')}>
              Privacy Policy
            </Text>
            {" • "}
            <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              Apple Standard EULA
            </Text>
          </Text>

          {/* Close button overlay - does not affect layout; enabled after 5s */}
          <Pressable 
            style={styles.closeButtonOverlay}
            onPress={onClose}
            pointerEvents={canClose ? 'auto' : 'none'}
          >
            <Text style={[styles.closeButtonText, { opacity: canClose ? 0.5 : 0 }]}>
              Not now
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FeatureRow({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconCircle}>
        <Text style={styles.featureIcon}>{icon}</Text>
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    marginBottom: 32,
  },
  badge: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
    opacity: 0.8,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    lineHeight: 48,
  },
  features: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIconCircle: {
    width: 32,
    height: 32,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureIcon: {
    fontSize: 18,
  },
  featureTitle: {
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
  },
  plans: {
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#D4AF37',
  },
  glowEffect: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 20,
    backgroundColor: '#D4AF37',
    opacity: 0.2,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  trialBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  trialBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4AF37',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D4AF37',
  },
  planInfo: {
    flex: 1,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planBilled: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  stickyButtonContainer: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  subscribeButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 12,
  },
  subscribeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000000',
  },
  terms: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  restoreLink: {
    alignItems: 'center',
    marginBottom: 8,
  },
  restoreLinkDisabled: {
    opacity: 0.6,
  },
  restoreLinkText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '700',
  },
  termsLink: {
    color: '#D4AF37',
  },
  closeButtonOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: Platform.OS === 'ios' ? 8 : 4,
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeButtonText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '400',
  },
});

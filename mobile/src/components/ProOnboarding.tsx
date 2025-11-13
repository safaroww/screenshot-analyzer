import React, { useMemo, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Platform, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Dimensions, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ProOnboarding({ visible, onClose }: Props) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const [width, setWidth] = useState<number>(Dimensions.get('window').width);
  const pages = useMemo(() => [
    {
      title: 'Welcome to Pro',
      subtitle: 'Unlimited analyses with priority processing and privacy-first by design.',
      icon: '🚀',
    },
    {
      title: 'Tips for Best Results',
      subtitle: 'Use clear screenshots. Crop to the relevant area. We enrich results with public info.',
      icon: '🧠',
    },
    {
      title: 'Manage Anytime',
      subtitle: 'Manage or cancel in your iOS Subscriptions. Access continues until the end of the period.',
      icon: '🔧',
    },
  ], []);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width;
    const idx = Math.round(x / Math.max(1, w));
    setPage(Math.min(Math.max(idx, 0), pages.length - 1));
  };

  const goTo = (idx: number) => {
    const clamped = Math.min(Math.max(idx, 0), pages.length - 1);
    const w = Math.max(1, width || Dimensions.get('window').width);
    scrollRef.current?.scrollTo({ x: clamped * w, animated: true });
  };

  const onNext = () => {
    if (page >= pages.length - 1) return onClose();
    setPage((p) => {
      const n = Math.min(p + 1, pages.length - 1);
      const w = Math.max(1, width || Dimensions.get('window').width);
      scrollRef.current?.scrollTo({ x: n * w, animated: true });
      return n;
    });
  };

  const onBack = () => {
    if (page <= 0) return;
    setPage((p) => {
      const n = Math.max(p - 1, 0);
      const w = Math.max(1, width || Dimensions.get('window').width);
      scrollRef.current?.scrollTo({ x: n * w, animated: true });
      return n;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>You’re Pro ✨</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          ref={scrollRef}
          onMomentumScrollEnd={onMomentumEnd}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          contentContainerStyle={{ alignItems: 'stretch' }}
          style={{ flex: 1 }}
        >
          {pages.map((p, idx) => (
            <View key={idx} style={styles.page}>
              <Text style={styles.pageIcon}>{p.icon}</Text>
              <Text style={styles.pageTitle}>{p.title}</Text>
              <Text style={styles.pageSubtitle}>{p.subtitle}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.dots}>
            {pages.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />)
            )}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onBack} disabled={page === 0} style={[styles.secondaryBtn, page === 0 && styles.secondaryDisabled]}>
              <Text style={[styles.secondaryText, page === 0 && styles.secondaryDisabledText]}>Back</Text>
            </Pressable>
            <Pressable onPress={onNext} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>{page === pages.length - 1 ? 'Finish' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 8,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  skipText: {
    color: '#D4AF37',
    fontWeight: '800',
  },
  page: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  pageSubtitle: {
    color: '#BDBDBD',
    fontSize: 15,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: '#D4AF37',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#1F1F1F',
  },
  secondaryDisabled: {
    opacity: 0.5,
  },
  secondaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryDisabledText: {
    color: '#999',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: {
    color: '#000',
    fontWeight: '800',
  },
});

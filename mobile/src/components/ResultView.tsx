import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import type { AnalysisResult } from '../types';

export default function ResultView({ result }: { result: AnalysisResult | null }) {
  if (!result) return null;
  
  return (
    <View style={styles.container}>
      {/* Summary Card */}
      {(result.summary?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>Summary</Text>
          <View style={styles.divider} />
          <View style={styles.bulletList}>
            {result.summary.map((s, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Extracted Text Card */}
      {(result.headings && result.headings.length > 0) || (result.text && result.text.trim()) ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Extracted Text</Text>
          <View style={styles.divider} />
          {result.headings && result.headings.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.subheading}>Headings</Text>
              <View style={{ height: 10 }} />
              {result.headings.map((h, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{h}</Text>
                </View>
              ))}
              <View style={styles.divider} />
            </View>
          )}
          {result.text && result.text.trim() ? (
            <Text selectable style={styles.extractedText}>
              {result.text}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Internet Enrichment */}
      {result.enrichment?.sources && result.enrichment.sources.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>Internet sources</Text>
          <View style={styles.divider} />
          {result.enrichment.sources.map((src, i) => (
            <View key={i} style={{ marginBottom: i !== (result.enrichment!.sources.length - 1) ? 16 : 0 }}>
              <Text style={styles.enrichTitle} numberOfLines={2}>{src.title}</Text>
              {src.description ? (
                <Text style={styles.enrichDesc} numberOfLines={4}>{src.description}</Text>
              ) : null}
              {src.url ? (
                <Pressable onPress={() => Linking.openURL(src.url!)}>
                  <Text style={[styles.enrichMeta, styles.enrichLink]} numberOfLines={1}>
                    {src.provider} • {src.url}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.enrichMeta}>{src.provider}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F1F1F',
    padding: 24,
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#1F1F1F',
    marginTop: 12,
    marginBottom: 20,
  },
  bulletList: {},
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
    marginBottom: 14,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4AF37',
    marginRight: 14,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#CCCCCC',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  extractedText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#AAAAAA',
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  enrichTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  enrichDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: '#BBBBBB',
    marginBottom: 4,
  },
  enrichMeta: {
    fontSize: 12,
    color: '#888888',
  },
  enrichLink: {
    color: '#D4AF37',
  }
});

require('dotenv').config();

module.exports = {
  expo: {
    name: "Screenshot Summarize",
    slug: "screenshot-summarize",
    scheme: "screenshot-summarize",
    version: "1.0.0",
    orientation: "portrait",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.asif.screenshotanalyzer",
      buildNumber: "1.0.0",
      infoPlist: {
        NSCameraUsageDescription: "Allow camera access to take a photo for analysis.",
        NSPhotoLibraryUsageDescription: "Allow access to your photos to select screenshots for analysis."
      }
    },
    android: {
      package: "com.safaroww.analyzer"
    },
    plugins: [
      "react-native-iap"
    ],
    extra: {
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://screenshot-analyzer-lovat.vercel.app/api',
      EXPO_PUBLIC_IAP_MONTHLY_ID: process.env.EXPO_PUBLIC_IAP_MONTHLY_ID || 'com.asif.screenshotanalyzer.promonthly',
      EXPO_PUBLIC_IAP_YEARLY_ID: process.env.EXPO_PUBLIC_IAP_YEARLY_ID || 'com.asif.screenshotanalyzer.proyearly',
    }
  }
};

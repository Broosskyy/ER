import type { ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const iosBuildNumber = process.env.EXPO_IOS_BUILD_NUMBER ?? '1';
const associatedDomain = process.env.EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN?.replace(/^https?:\/\//, '');

const config: ExpoConfig = {
  name: 'Eternal Rave',
  slug: 'eternal-rave',
  version: '0.2.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'eternal-rave',
  userInterfaceStyle: 'dark',
  ...(process.env.EXPO_ACCOUNT_OWNER ? { owner: process.env.EXPO_ACCOUNT_OWNER } : {}),
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.eternalrave.app',
    buildNumber: iosBuildNumber,
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'dark',
    requireFullScreen: true,
    associatedDomains: associatedDomain ? [`applinks:${associatedDomain}`] : [],
    infoPlist: {
      CFBundleDisplayName: 'Eternal Rave',
      LSApplicationQueriesSchemes: ['https', 'http', 'maps'],
      UIBackgroundModes: [],
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: 'com.eternalrave.app',
    versionCode: 5,
    adaptiveIcon: {
      backgroundColor: '#0B0B0F',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
    name: 'Eternal Rave',
    shortName: 'Eternal Rave',
    description:
      'Entdecke elektronische Musikveranstaltungen, speichere Events und bleibe über Updates informiert.',
    themeColor: '#0B0B0F',
    backgroundColor: '#0B0B0F',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'de',
    startUrl: '/',
    scope: '/',
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.1',
        },
        android: {
          minSdkVersion: 24,
        },
      },
    ],
    [
      'react-native-maps',
      {
        googleMapsApiKey: googleMapsApiKey,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0B0B0F',
        dark: {
          image: './assets/images/splash-icon.png',
          backgroundColor: '#0B0B0F',
        },
      },
    ],
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Eternal Rave uses your location to show your current city in the app header.',
        locationAlwaysAndWhenInUsePermission:
          'Eternal Rave uses your location to show your current city in the app header.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      'expo-navigation-bar',
      {
        hidden: false,
        style: 'light',
        enforceContrast: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
    router: {
      origin: process.env.EXPO_PUBLIC_WEB_BASE_URL,
    },
  },
};

export default config;

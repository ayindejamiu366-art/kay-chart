import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // `appId` is the Android application identity and is deliberately unchanged:
  // changing it would install the rebranded build as a different app and orphan
  // the existing install, its data and its signing configuration.
  appId: 'com.nocturne.music',
  // `appName` is the user-visible label shown on the launcher.
  appName: 'Kay Chart',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: '#0A0A0F',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0F',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
};

export default config;

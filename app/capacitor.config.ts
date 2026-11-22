import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.eyespy.game',
  appName: 'EyeSpy',
  webDir: 'dist',
  backgroundColor: '#0b1020',
  server: {
    // http://localhost lets guests open ws:// connections to the host's LAN
    // address (an https page would block them as mixed content). localhost is
    // still a secure context, so the camera works for QR scanning.
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#0b1020',
      showSpinner: false,
    },
  },
};

export default config;

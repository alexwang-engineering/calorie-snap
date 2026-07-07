import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wjl.caloriesnap',
  appName: 'Calorie Snap',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;

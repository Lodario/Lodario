import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lodario',
  appName: 'Lodario',
  webDir: 'native-shell',
  server: {
    url: 'https://lodario.vercel.app',
    cleartext: false,
    errorPath: 'offline.html'
  }
};

export default config;

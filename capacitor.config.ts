import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.wimm.budget",
  appName: "Wimm",
  webDir: "dist",
  bundledWebRuntime: false,
  // iOS 8.2+ : afficher aussi les alertes quand Wimm est au premier plan.
  plugins: {
    LocalNotifications: {
      presentationOptions: ["banner", "sound", "list"],
    },
  },
};

export default config;

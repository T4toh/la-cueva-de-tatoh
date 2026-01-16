import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Configurar StatusBar si la plataforma es nativa
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: '#1e1e48' });
  StatusBar.setOverlaysWebView({ overlay: false });
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
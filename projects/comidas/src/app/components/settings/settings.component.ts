import {
  Component,
  inject,
  signal,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Capacitor } from '@capacitor/core';

import { MealService } from '../../services/meal.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { Icon, Panel } from 'componentes';
import { ImportPreviewComponent } from '../import-preview/import-preview.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [Panel, AsyncPipe, Icon, ImportPreviewComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent {
  private dialogService = inject(DialogService);
  mealService = inject(MealService);
  authService = inject(AuthService);
  isAndroid = Capacitor.getPlatform() === 'android';
  readonly promptCopied = signal(false);
  readonly importOpen = signal(false);
  async refreshData(): Promise<void> {
    await this.mealService.refreshData();
    this.dialogService.alert('Sincronización', 'Datos descargados de la nube.');
  }

  async forceUpload(): Promise<void> {
    await this.mealService.forceUpload();
    this.dialogService.alert('Sincronización', 'Datos subidos a la nube.');
  }

  async logout(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Cerrar Sesión',
      '¿Estás seguro de que querés cerrar la sesión?'
    );
    if (confirmed) {
      await this.authService.logout();
    }
  }

  async copyLLMPrompt(): Promise<void> {
    const prompt = this.mealService.generateLLMPrompt();
    await navigator.clipboard.writeText(prompt);
    this.promptCopied.set(true);
    setTimeout(() => this.promptCopied.set(false), 2000);
  }
}

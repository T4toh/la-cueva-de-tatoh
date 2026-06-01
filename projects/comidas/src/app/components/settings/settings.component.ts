import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Capacitor } from '@capacitor/core';

import { MealService } from '../../services/meal.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { Icon, Panel } from 'componentes';
import {
  ImportMode,
  ImportPreviewComponent,
} from '../import-preview/import-preview.component';

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
  readonly importMode = signal<ImportMode>('meals');

  openPaste(mode: ImportMode): void {
    this.importMode.set(mode);
    this.importOpen.set(true);
  }

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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e): void => {
        const content = e.target?.result as string;
        this.mealService.importData(content);
      };
      reader.readAsText(file);
    }
  }

  onMealsFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e): void => {
        const content = e.target?.result as string;
        this.mealService.importMeals(content);
      };
      reader.readAsText(file);
    }
  }

  async copyLLMPrompt(): Promise<void> {
    const prompt = this.mealService.generateLLMPrompt();
    await navigator.clipboard.writeText(prompt);
    this.promptCopied.set(true);
    setTimeout(() => this.promptCopied.set(false), 2000);
  }
}

import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';

import { MealService } from '../../services/meal.service';
import { AuthService } from '../../services/auth.service';
import { Panel } from 'componentes';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [Panel, AsyncPipe],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  mealService = inject(MealService);
  authService = inject(AuthService);

  async refreshData(): Promise<void> {
    await this.mealService.refreshData();
    alert('Datos sincronizados con la nube.');
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
}
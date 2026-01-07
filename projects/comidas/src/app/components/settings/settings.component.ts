import { Component, inject } from '@angular/core';

import { MealService } from '../../services/meal.service';
import { Panel } from 'componentes';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [Panel],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  mealService = inject(MealService);

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

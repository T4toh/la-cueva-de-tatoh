import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MealService } from '../../services/meal.service';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shopping-list.component.html',
  styleUrls: ['./shopping-list.component.scss']
})
export class ShoppingListComponent {
  mealService = inject(MealService);

  print() {
    window.print();
  }
  
  copyToClipboard() {
    const list = this.mealService.shoppingList().map(i => `- ${i.name}: ${i.quantity}`).join('\n');
    navigator.clipboard.writeText(list).then(() => alert('Lista copiada!'));
  }
}

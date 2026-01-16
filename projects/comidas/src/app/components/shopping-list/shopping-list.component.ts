import { Component, inject } from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MealService } from '../../services/meal.service';
import { Tag } from 'componentes';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [ReactiveFormsModule, Tag],
  templateUrl: './shopping-list.component.html',
  styleUrls: ['./shopping-list.component.scss'],
})
export class ShoppingListComponent {
  mealService = inject(MealService);
  fb = inject(FormBuilder);
  dialogService = inject(DialogService);

  extraItemForm: FormGroup;
  tagForm: FormGroup;
  showTagForm = false;
  showExtraForm = false;

  constructor() {
    this.extraItemForm = this.fb.group({
      name: ['', Validators.required],
      quantity: ['', Validators.required],
      tagId: [''],
    });

    this.tagForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#000000', Validators.required],
    });
  }

  addExtraItem(): void {
    if (this.extraItemForm.valid) {
      const { name, quantity, tagId } = this.extraItemForm.value;
      this.mealService.addExtraItem(name, quantity, tagId);
      this.extraItemForm.reset({ tagId: '' }); // Keep tag selection? No, reset.
      this.showExtraForm = false;
    }
  }

  addTag(): void {
    if (this.tagForm.valid) {
      const { name, color } = this.tagForm.value;
      this.mealService.addTag(name, color);
      this.tagForm.reset({ color: '#000000' });
      this.showTagForm = false;
    }
  }

  updateItemTag(itemName: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.mealService.setIngredientTag(itemName, select.value);
  }

  async resetQuantities(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Resetear Cantidades',
      '¿Estás seguro de resetear todas las cantidades a los valores originales del menú?'
    );
    if (confirmed) {
      this.mealService.clearOverrides();
    }
  }

  editQuantity(itemName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mealService.overrideQuantity(itemName, input.value);
  }

  getTagColor(tagId?: string): string {
    if (!tagId) {
      return '#e0e0e0';
    } // Gray for no tag
    const tag = this.mealService.tags().find((t) => t.id === tagId);
    return tag ? tag.color : '#e0e0e0';
  }

  getTagName(tagId?: string): string {
    if (!tagId) {
      return '+';
    }
    const tag = this.mealService.tags().find((t) => t.id === tagId);
    return tag ? tag.name : '+';
  }

  deleteExtraItem(index: number): void {
    this.mealService.removeExtraItem(index);
  }

  print(): void {
    window.print();
  }

  async copyToClipboard(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Copiar Lista',
      '¿Quieres copiar la lista de compras al portapapeles?'
    );

    if (!confirmed) {
      return;
    }

    let text = `🛒 *Lista de Compras* (${this.mealService.weekRangeDisplay()})\n\n`;
    let hasItems = false;

    this.mealService.shoppingListGrouped().forEach((group) => {
      const remainingItems = group.items.filter((item) => !item.checked);

      if (remainingItems.length > 0) {
        hasItems = true;
        const groupName = group.tag ? group.tag.name.toUpperCase() : 'OTROS';
        text += `*${groupName}*\n`;
        remainingItems.forEach((item) => {
          const quantity = item.quantityOverride || item.quantity;
          text += `• ${item.name}: ${quantity}\n`;
        });
        text += '\n';
      }
    });

    if (!hasItems) {
      alert('No hay items pendientes para copiar.');
      return;
    }

    text += '_Generado por Comidas - La Cueva de Tatoh_';

    navigator.clipboard
      .writeText(text)
      .then(() => alert('¡Lista copiada al portapapeles!'));
  }
}

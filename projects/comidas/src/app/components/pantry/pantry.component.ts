import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DialogService } from '../../services/dialog.service';
import { MealService } from '../../services/meal.service';

@Component({
  selector: 'app-pantry',
  standalone: true,
  imports: [ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './pantry.component.html',
  styleUrls: ['./pantry.component.scss'],
})
export class PantryComponent {
  mealService = inject(MealService);
  dialogService = inject(DialogService);
  fb = inject(FormBuilder);

  addForm: FormGroup;
  groupForm: FormGroup;
  showAddForm = false;
  showGroupForm = false;
  editingName: string | null = null;
  editingQuantity = '';
  editingUnit = '';
  subtractingName: string | null = null;
  subtractingAmount = '';
  subtractingUnit = '';

  constructor() {
    this.addForm = this.fb.group({
      name: ['', Validators.required],
      quantity: ['', Validators.required],
      unit: [''],
      groupId: [''],
    });
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#888888'],
    });
  }

  addItem(): void {
    if (this.addForm.valid) {
      const { name, quantity, unit, groupId } = this.addForm.value as {
        name: string;
        quantity: string;
        unit: string | null;
        groupId: string;
      };
      const qStr = String(quantity ?? '').trim();
      const uStr = String(unit ?? '').trim();
      const combined = uStr ? `${qStr} ${uStr}` : qStr;
      this.mealService.addToPantry(name, combined, groupId || undefined);
      this.addForm.reset({ groupId: '', unit: '' });
      this.showAddForm = false;
    }
  }

  addGroup(): void {
    if (this.groupForm.valid) {
      const { name, color } = this.groupForm.value as { name: string; color: string };
      this.mealService.addPantryGroup(name, color || undefined);
      this.groupForm.reset({ color: '#888888' });
      this.showGroupForm = false;
    }
  }

  startEdit(name: string, quantity: string): void {
    this.cancelSubtract();
    this.editingName = name;
    const { value, unit } = this.splitQuantity(quantity);
    this.editingQuantity = value;
    this.editingUnit = unit;
  }

  saveEdit(): void {
    const qStr = String(this.editingQuantity ?? '').trim();
    const uStr = String(this.editingUnit ?? '').trim();
    if (this.editingName !== null && qStr) {
      const combined = uStr ? `${qStr} ${uStr}` : qStr;
      this.mealService.updatePantryQuantity(this.editingName, combined);
    }
    this.editingName = null;
    this.editingQuantity = '';
    this.editingUnit = '';
  }

  cancelEdit(): void {
    this.editingName = null;
    this.editingQuantity = '';
    this.editingUnit = '';
  }

  startSubtract(name: string): void {
    this.cancelEdit();
    this.subtractingName = name;
    this.subtractingAmount = '';
    const item = this.mealService.pantry().find((i) => i.name === name);
    this.subtractingUnit = item ? this.splitQuantity(item.quantity).unit : '';
  }

  saveSubtract(): void {
    const aStr = String(this.subtractingAmount ?? '').trim();
    const uStr = String(this.subtractingUnit ?? '').trim();
    if (this.subtractingName !== null && aStr) {
      const combined = uStr ? `${aStr} ${uStr}` : aStr;
      this.mealService.subtractFromPantry(this.subtractingName, combined);
    }
    this.subtractingName = null;
    this.subtractingAmount = '';
    this.subtractingUnit = '';
  }

  cancelSubtract(): void {
    this.subtractingName = null;
    this.subtractingAmount = '';
    this.subtractingUnit = '';
  }

  private splitQuantity(quantity: string): { value: string; unit: string } {
    const qStr = String(quantity ?? '').trim();
    const match = qStr.match(/^(\d+(\.\d+)?)\s*(.*)$/);
    if (match) {
      return { value: match[1], unit: match[3].trim() };
    }
    return { value: qStr, unit: '' };
  }

  removeItem(name: string): void {
    this.mealService.removeFromPantry(name);
  }

  updateGroup(name: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.mealService.updatePantryGroup(name, select.value);
  }

  updateGroupColor(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mealService.updatePantryGroupColor(id, input.value);
  }

  async removeGroup(id: string, groupName: string): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Eliminar grupo',
      `¿Eliminar el grupo "${groupName}"? Los ítems del grupo quedarán sin categoría.`
    );
    if (confirmed) {
      this.mealService.removePantryGroup(id);
    }
  }

  async clearPantry(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Vaciar despensa',
      '¿Estás seguro de que querés vaciar toda la despensa?'
    );
    if (confirmed) {
      this.mealService.clearPantry();
    }
  }

  async applyCartToPantry(): Promise<void> {
    const diff = this.mealService.getCartPantryDiff();
    if (diff.length === 0) {
      this.dialogService.alert('Sin cambios', 'No hay ítems del carrito que coincidan con la despensa.');
      return;
    }

    const lines = diff.map(({ name, needed, inPantry, remaining, covered }) => {
      if (covered) {
        return `• ${name}: tenés ${inPantry}, necesitás ${needed} → ya lo cubrís, quedarían 0 (o más)`;
      }
      return `• ${name}: tenés ${inPantry}, necesitás ${needed} → comprás ${remaining}`;
    });

    const message =
      'Revisá las cuentas antes de confirmar (las cantidades pueden tener unidades distintas):\n\n' +
      lines.join('\n');

    const confirmed = await this.dialogService.confirm('Restar del carrito', message);
    if (confirmed) {
      this.mealService.applyCartToPantry();
    }
  }

  itemsByGroup(groupId: string | undefined): ReturnType<typeof this.mealService.pantry> {
    return this.mealService.pantry().filter((i) => i.groupId === groupId);
  }

  ungroupedItems(): ReturnType<typeof this.mealService.pantry> {
    const groupIds = new Set(this.mealService.pantryGroups().map((g) => g.id));
    return this.mealService.pantry().filter((i) => !i.groupId || !groupIds.has(i.groupId));
  }
}

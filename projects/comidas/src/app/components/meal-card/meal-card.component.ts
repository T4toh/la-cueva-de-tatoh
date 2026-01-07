import { Component, input, output } from '@angular/core';

import { Meal } from '../../models/meal.model';
import { Panel, Tag } from 'componentes';

@Component({
  selector: 'app-meal-card',
  standalone: true,
  imports: [Panel, Tag],
  templateUrl: './meal-card.component.html',
  styleUrls: ['./meal-card.component.scss'],
})
export class MealCardComponent {
  readonly meal = input.required<Meal>();
  readonly showDelete = input<boolean>(false);
  readonly showEdit = input<boolean>(false);
  readonly showDuplicate = input<boolean>(false);
  readonly delete = output<string>();
  readonly edit = output<string>();
  readonly duplicate = output<string>();
  readonly cardClick = output<void>();

  onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.meal().id);
  }

  onEdit(event: Event): void {
    event.stopPropagation();
    this.edit.emit(this.meal().id);
  }

  onDuplicate(event: Event): void {
    event.stopPropagation();
    this.duplicate.emit(this.meal().id);
  }

  onCardClick(): void {
    this.cardClick.emit();
  }
}

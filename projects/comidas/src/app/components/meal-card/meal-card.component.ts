import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Meal } from '../../models/meal.model';
import { Panel } from 'componentes';

@Component({
  selector: 'app-meal-card',
  standalone: true,
  imports: [CommonModule, Panel],
  templateUrl: './meal-card.component.html',
  styleUrls: ['./meal-card.component.scss']
})
export class MealCardComponent {
  @Input({ required: true }) meal!: Meal;
  @Input() showDelete: boolean = false;
  @Input() showEdit: boolean = false;
  @Input() showDuplicate: boolean = false;
  @Output() delete = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() cardClick = new EventEmitter<void>();

  onDelete(event: Event) {
    event.stopPropagation();
    this.delete.emit(this.meal.id);
  }

  onEdit(event: Event) {
    event.stopPropagation();
    this.edit.emit(this.meal.id);
  }

  onDuplicate(event: Event) {
    event.stopPropagation();
    this.duplicate.emit(this.meal.id);
  }

  onCardClick() {
    this.cardClick.emit();
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { Panel } from 'componentes';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, Panel],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  mealService = inject(MealService);

  getMealName(id: string | null): string {
    const meal = this.mealService.getMeal(id);
    return meal ? meal.name : 'Seleccionar';
  }

  isToday(dayName: string): boolean {
    const today = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = dayNames[today.getDay()];
    
    // Also check if we are in the current week
    const startOfCurrentWeek = this.getStartOfWeek(new Date());
    const startOfDisplayWeek = this.mealService.currentWeekStart();
    
    return todayName === dayName && startOfCurrentWeek.getTime() === startOfDisplayWeek.getTime();
  }

  isPast(dayName: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const dayIndex = dayNames.indexOf(dayName);
    
    const displayWeekStart = new Date(this.mealService.currentWeekStart());
    const dayDate = new Date(displayWeekStart);
    dayDate.setDate(displayWeekStart.getDate() + dayIndex);
    
    return dayDate < today;
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

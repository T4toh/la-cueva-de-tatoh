import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { Meal } from '../../models/meal.model';

@Component({
  selector: 'app-meal-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './meal-editor.component.html',
  styleUrls: ['./meal-editor.component.scss']
})
export class MealEditorComponent implements OnInit {
  fb = inject(FormBuilder);
  mealService = inject(MealService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  mealId: string | null = null;
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      ingredients: this.fb.array([])
    });
  }

  get ingredients() {
    return this.form.get('ingredients') as FormArray;
  }

  ngOnInit() {
    this.mealId = this.route.snapshot.paramMap.get('id');
    if (this.mealId) {
      const meal = this.mealService.getMeal(this.mealId);
      if (meal) {
        this.form.patchValue({
          name: meal.name,
          description: meal.description
        });
        meal.ingredients.forEach(ing => {
          this.addIngredient(ing.name, ing.quantity);
        });
      } else {
        this.router.navigate(['/meals']);
      }
    } else {
      // Start with one empty ingredient row
      this.addIngredient();
    }
  }

  addIngredient(name = '', quantity = '') {
    const ingredientGroup = this.fb.group({
      name: [name, Validators.required],
      quantity: [quantity, Validators.required]
    });
    this.ingredients.push(ingredientGroup);
  }

  removeIngredient(index: number) {
    this.ingredients.removeAt(index);
  }

  save() {
    if (this.form.valid) {
      const formValue = this.form.value;
      const mealData: Omit<Meal, 'id'> = {
        name: formValue.name,
        description: formValue.description,
        ingredients: formValue.ingredients
      };

      if (this.mealId) {
        this.mealService.updateMeal(this.mealId, mealData);
      } else {
        this.mealService.addMeal(mealData);
      }
      this.router.navigate(['/meals']);
    }
  }
}

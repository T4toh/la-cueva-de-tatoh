import { Component, inject, OnInit } from '@angular/core';

import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { Ingredient, Meal } from '../../models/meal.model';
import { Tag } from 'componentes';

@Component({
  selector: 'app-meal-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, Tag],
  templateUrl: './meal-editor.component.html',
  styleUrls: ['./meal-editor.component.scss'],
})
export class MealEditorComponent implements OnInit {
  fb = inject(FormBuilder);
  mealService = inject(MealService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  mealId: string | null = null;
  form: FormGroup;
  newTagControl = new FormControl('');

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      ingredients: this.fb.array([]),
      tags: this.fb.array([]),
    });
  }

  get ingredients(): FormArray {
    return this.form.get('ingredients') as FormArray;
  }

  get tags(): FormArray {
    return this.form.get('tags') as FormArray;
  }

  ngOnInit(): void {
    this.mealId = this.route.snapshot.paramMap.get('id');
    if (this.mealId) {
      const meal = this.mealService.getMeal(this.mealId);
      if (meal) {
        this.form.patchValue({
          name: meal.name,
          description: meal.description,
        });
        meal.ingredients.forEach((ing) => {
          this.addIngredient(ing.name, ing.quantity);
        });
        if (meal.tags) {
          meal.tags.forEach((tag) => {
            this.tags.push(this.fb.control(tag));
          });
        }
      } else {
        this.router.navigate(['/meals']);
      }
    }
  }

  addIngredient(name = '', quantity = ''): void {
    const ingredientGroup = this.fb.group({
      name: [name], // Removed Validators.required to allow saving even if an empty row exists (we'll filter it)
      quantity: [quantity],
    });
    this.ingredients.push(ingredientGroup);
  }

  removeIngredient(index: number): void {
    this.ingredients.removeAt(index);
  }

  addTag(event?: Event): void {
    if (event) {
      event.preventDefault(); // Prevent form submission if enter is pressed
    }
    const val = this.newTagControl.value?.trim();
    if (val) {
      this.tags.push(this.fb.control(val));
      this.newTagControl.setValue('');
    }
  }

  removeTag(index: number): void {
    this.tags.removeAt(index);
  }

  save(): void {
    if (this.form.valid) {
      const formValue = this.form.value;

      // Filter out ingredients with no name
      const validIngredients = formValue.ingredients.filter(
        (ing: Ingredient) => ing.name && ing.name.trim() !== ''
      );

      const mealData: Omit<Meal, 'id'> = {
        name: formValue.name,
        description: formValue.description,
        ingredients: validIngredients,
        tags: formValue.tags,
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

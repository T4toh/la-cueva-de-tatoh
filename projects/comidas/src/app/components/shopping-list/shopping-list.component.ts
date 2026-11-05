import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ShoppingItem } from '../../models/meal.model';
import { MealService } from '../../services/meal.service';
import { Icon, Tag } from 'componentes';
import { textoPorDia, textoPorGondola } from '../../compras/copiar';
import { DiasChips } from './dias-chips.component';
import { ListaPorDia } from './lista-por-dia.component';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [ReactiveFormsModule, Tag, Icon, ListaPorDia, DiasChips],
  templateUrl: './shopping-list.component.html',
  styleUrls: ['./shopping-list.component.scss'],
})
export class ShoppingListComponent implements OnInit {
  mealService = inject(MealService);
  fb = inject(FormBuilder);
  dialogService = inject(DialogService);

  extraItemForm: FormGroup;
  tagForm: FormGroup;
  showTagForm = false;
  showExtraForm = false;

  // El aviso de lo que entró o salió de la despensa al tildar. Se borra solo.
  readonly aviso = signal('');
  private avisoTimer?: ReturnType<typeof setTimeout>;

  // La vista se recuerda por dispositivo; localStorage puede no estar o tirar.
  private static readonly VISTA_KEY = 'comidas_vista_lista';
  readonly vista = signal<'gondola' | 'dia'>(ShoppingListComponent.vistaGuardada());

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

  ngOnInit(): void {
    this.mealService.refreshTodayTimestamp();
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

  private static vistaGuardada(): 'gondola' | 'dia' {
    try {
      return localStorage.getItem(ShoppingListComponent.VISTA_KEY) === 'dia' ? 'dia' : 'gondola';
    } catch {
      return 'gondola';
    }
  }

  elegirVista(vista: 'gondola' | 'dia'): void {
    this.vista.set(vista);
    try {
      localStorage.setItem(ShoppingListComponent.VISTA_KEY, vista);
    } catch {
      // Sin almacenamiento, la elección dura lo que dure la pantalla.
    }
  }

  // Un clic que no cambia el ítem (lo cubre la despensa) no cambia el
  // `[checked]`, y Angular no corrige la casilla que el navegador ya dio vuelta.
  marcar(nombre: string, event: Event): void {
    this.mostrarAviso(this.mealService.toggleItemCheck(nombre));
    const item = this.mealService.shoppingList().find((i) => i.name === nombre);
    (event.target as HTMLInputElement).checked = !!item?.checked;
  }

  // fecha null es la parte manual: la que no tiene día.
  marcarParte(nombre: string, fecha: string | null, casilla: HTMLInputElement): void {
    this.mostrarAviso(this.mealService.toggleItemCheck(nombre, fecha));
    const dia = this.mealService.listaPorDia().find((d) => d.fecha === fecha);
    casilla.checked = !!dia?.items.find((i) => i.name === nombre)?.checked;
  }

  private mostrarAviso(aviso: string | null): void {
    if (!aviso) {
      return;
    }
    this.aviso.set(aviso);
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(''), 3000);
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

  sendToPantry(item: {
    name: string;
    quantity: string;
    unit?: string;
    quantityOverride?: string;
  }): void {
    this.mealService.addToPantry(item.name, this.displayQty(item));
  }

  subtractFromPantry(item: {
    name: string;
    quantity: string;
    unit?: string;
    quantityOverride?: string;
    usas?: string;
  }): void {
    // Lo que se usa de la despensa, no lo redondeado a lo que se compra.
    const quantity = item.usas ?? this.displayQty(item);
    this.mealService.subtractFromPantry(item.name, quantity);
    // If pantry only partially covers the need, persist the remaining as a stored
    // override so the cart doesn't revert to the full quantity after pantry is depleted.
    if (item.quantityOverride) {
      this.mealService.overrideQuantity(item.name, item.quantityOverride);
    }
    // El renglón de ahora, no el de antes de restar: si ya se ve tildado,
    // tildarlo lo destildaría, y con él los días ya comprados.
    const renglon = this.mealService.shoppingList().find((i) => i.name === item.name);
    if (renglon && !renglon.checked) {
      this.mealService.toggleItemCheck(item.name);
    }
  }

  async applyCartToPantry(): Promise<void> {
    const diff = this.mealService.getCartPantryDiff();
    if (diff.length === 0) {
      this.dialogService.alert(
        'Sin cambios',
        'No hay ítems del carrito que coincidan con la despensa.'
      );
      return;
    }
    const lines = diff.map(({ name, needed, inPantry, remaining, covered }) => {
      if (covered) {
        return `• ${name}: tenés ${inPantry}, necesitás ${needed} → ya lo cubrís`;
      }
      return `• ${name}: tenés ${inPantry}, necesitás ${needed} → comprás ${remaining}`;
    });
    const confirmed = await this.dialogService.confirm(
      'Restar del carrito',
      'Se van a restar las siguientes cantidades de la despensa:\n\n' +
        lines.join('\n')
    );
    if (confirmed) {
      this.mealService.applyCartToPantry();
    }
  }

  displayQty(item: {
    quantity: string;
    unit?: string;
    quantityOverride?: string;
  }): string {
    if (item.quantityOverride) {
      return item.quantityOverride;
    }
    return [item.quantity, item.unit].filter(Boolean).join(' ');
  }

  reAddFromHistory(item: {
    name: string;
    quantity: string;
    unit?: string;
    tagId?: string;
  }): void {
    this.mealService.addExtraItem(
      item.name,
      item.quantity,
      item.tagId,
      item.unit
    );
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

    const rango = this.mealService.weekRangeDisplay();
    const cantidad = (item: ShoppingItem): string => this.displayQty(item);
    const text =
      this.vista() === 'dia'
        ? textoPorDia(this.mealService.listaPorDia(), rango, cantidad)
        : textoPorGondola(this.mealService.shoppingListGrouped(), rango, cantidad);

    if (text === null) {
      this.dialogService.alert(
        'Lista vacía',
        'No hay items pendientes para copiar.'
      );
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() =>
        this.dialogService.alert('Copiado', '¡Lista copiada al portapapeles!')
      );
  }
}

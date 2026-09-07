import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { filter } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { UpdateService } from './services/update.service';
import { AuthService } from './services/auth.service';
import { Dialogo, Footer, Icon, TemaService } from 'componentes';
import { DialogService } from './services/dialog.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, AsyncPipe, Dialogo, Footer, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'comidas';
  updateService = inject(UpdateService);
  authService = inject(AuthService);
  dialogService = inject(DialogService);
  // El TemaService tiene que existir desde el arranque, no cuando monta el
  // toggle: es el que aplica la elección guardada y el que pinta el
  // theme-color. En comidas el toggle vive sólo en /settings, así que sin esto
  // el servicio no corría hasta entrar ahí.
  readonly tema = inject(TemaService);
  private router = inject(Router);
  isAndroid = Capacitor.getPlatform() === 'android';

  // La ruta pública (/r/...) esconde el <nav> entero en el template, así que
  // deja de ser estático: la consulta tiene que ser { static: false } o
  // ngAfterViewInit lee undefined para siempre, también en las pantallas
  // normales donde la nav sí existe.
  @ViewChild('mainNav', { static: false }) mainNav?: ElementRef<HTMLElement>;

  readonly esPublica = signal(false);

  ngOnInit(): void {
    this.updateService.checkForUpdates();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.esPublica.set(this.router.url.startsWith('/r/'));
        this.scrollActiveNavItemIntoView();
      });
  }

  ngAfterViewInit(): void {
    this.scrollActiveNavItemIntoView();
  }

  private scrollActiveNavItemIntoView(): void {
    setTimeout(() => {
      const nav = this.mainNav?.nativeElement;
      if (!nav) {
        return;
      }
      const activeEl = nav.querySelector<HTMLElement>('.active');
      if (!activeEl) {
        return;
      }
      const navWidth = nav.offsetWidth;
      const itemLeft = activeEl.offsetLeft;
      const itemWidth = activeEl.offsetWidth;
      nav.scrollTo({
        left: itemLeft - navWidth / 2 + itemWidth / 2,
        behavior: 'smooth',
      });
    }, 0);
  }

  login(): void {
    this.authService.loginWithGoogle();
  }
}

import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { filter } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { UpdateService } from './services/update.service';
import { AuthService } from './services/auth.service';
import { Dialogo, Footer } from 'componentes';
import { DialogService } from './services/dialog.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, AsyncPipe, Dialogo, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'comidas';
  updateService = inject(UpdateService);
  authService = inject(AuthService);
  dialogService = inject(DialogService);
  private router = inject(Router);
  isAndroid = Capacitor.getPlatform() === 'android';

  @ViewChild('mainNav', { static: true }) mainNav!: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.updateService.checkForUpdates();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.scrollActiveNavItemIntoView());
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

import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { UpdateService } from './services/update.service';
import { AuthService } from './services/auth.service';
import { Dialogo } from 'componentes';
import { DialogService } from './services/dialog.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, AsyncPipe, Dialogo],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent implements OnInit {
  title = 'comidas';
  updateService = inject(UpdateService);
  authService = inject(AuthService);
  dialogService = inject(DialogService);
  isAndroid = Capacitor.getPlatform() === 'android';

  ngOnInit(): void {
    this.updateService.checkForUpdates();
  }

  login(): void {
    this.authService.loginWithGoogle();
  }
}

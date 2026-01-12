import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';
import { UpdateService } from './services/update.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, AsyncPipe, NgIf],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  title = 'comidas';
  updateService = inject(UpdateService);
  authService = inject(AuthService);

  ngOnInit(): void {
    this.updateService.checkForUpdates();
  }

  login() {
    this.authService.loginWithGoogle();
  }
}

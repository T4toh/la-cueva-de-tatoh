import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UpdateService } from './services/update.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  title = 'comidas';
  updateService = inject(UpdateService);

  ngOnInit(): void {
    this.updateService.checkForUpdates();
  }
}
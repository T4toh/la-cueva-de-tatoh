import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { beforeEach, describe, expect, it } from 'vitest';

import { appConfig } from './app.config';

// Humo: @angular/fire 20 no tiene release para Angular 22, así que este test
// verifica que sus providers sigan resolviendo contra el injector actual.
describe('appConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
  });

  it('resuelve Auth y Firestore de @angular/fire', () => {
    expect(TestBed.inject(Auth)).toBeTruthy();
    expect(TestBed.inject(Firestore)).toBeTruthy();
  });
});

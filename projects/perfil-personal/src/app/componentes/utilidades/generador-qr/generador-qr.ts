import { Component, effect, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import QRCodeStyling from 'qr-code-styling';

@Component({
  selector: 'app-generador-qr',
  imports: [FormsModule],
  templateUrl: './generador-qr.html',
  styleUrl: './generador-qr.scss',
})
export class GeneradorQr {
  readonly qrCanvas = viewChild<ElementRef<HTMLDivElement>>('qrCanvas');

  qrCode: QRCodeStyling | null = null;
  data = 'https://example.com';
  imageUrl = '';
  isLoadingImage = false;
  imageError = '';

  // Nuevas opciones de configuración
  qrColor = '#000000';
  dotType: 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded' =
    'rounded';
  cornerSquareType: 'square' | 'dot' | 'extra-rounded' = 'square';
  cornerSquareColor = '#000000';
  cornerDotType: 'square' | 'dot' = 'dot';
  cornerDotColor = '#000000';

  // Modo WiFi
  isWifiMode = false;
  wifiSSID = '';
  wifiPassword = '';
  wifiSecurity: 'WPA' | 'WEP' | 'nopass' = 'WPA';

  constructor() {
    effect(() => {
      const canvas = this.qrCanvas();
      if (canvas && !this.qrCode) {
        this.initializeQR();
      }
    });
  }

  private initializeQR(): void {
    const canvas = this.qrCanvas();
    if (!canvas) {
      return;
    }

    this.qrCode = new QRCodeStyling({
      width: 300,
      height: 300,
      data: this.getQRData(),
      image: this.imageUrl || undefined,
      dotsOptions: {
        color: this.qrColor,
        type: this.dotType,
      },
      cornersSquareOptions: {
        color: this.cornerSquareColor,
        type: this.cornerSquareType,
      },
      cornersDotOptions: {
        color: this.cornerDotColor,
        type: this.cornerDotType,
      },
      backgroundOptions: {
        color: '#ffffff',
      },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 20,
      },
    });
    this.qrCode.append(canvas.nativeElement);
  }

  private getQRData(): string {
    if (this.isWifiMode) {
      return `WIFI:T:${this.wifiSecurity};S:${this.wifiSSID};P:${this.wifiPassword};;`;
    }
    return this.data;
  }

  private async validateImage(url: string): Promise<boolean> {
    if (!url) {
      return true;
    }

    try {
      this.isLoadingImage = true;
      this.imageError = '';

      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error('La URL no apunta a una imagen válida');
      }

      return true;
    } catch (error) {
      this.imageError = error instanceof Error ? error.message : 'Error al cargar la imagen';
      console.error('Error validating image:', error);
      return false;
    } finally {
      this.isLoadingImage = false;
    }
  }

  async generateQR(): Promise<void> {
    if (this.imageUrl) {
      const isValidImage = await this.validateImage(this.imageUrl);
      if (!isValidImage) {
        // Si la imagen no es válida, generar QR sin imagen
        this.imageUrl = '';
      }
    }

    if (this.qrCode) {
      this.qrCode.update({
        data: this.getQRData(),
        image: this.imageUrl || undefined,
        dotsOptions: {
          color: this.qrColor,
          type: this.dotType,
        },
        cornersSquareOptions: {
          color: this.cornerSquareColor,
          type: this.cornerSquareType,
        },
        cornersDotOptions: {
          color: this.cornerDotColor,
          type: this.cornerDotType,
        },
      });
    } else {
      this.initializeQR();
    }
  }

  onDataChange(): void {
    this.generateQR();
  }

  async onImageChange(): Promise<void> {
    await this.generateQR();
  }

  onColorChange(): void {
    this.generateQR();
  }

  onDotTypeChange(): void {
    this.generateQR();
  }

  onCornerSquareChange(): void {
    this.generateQR();
  }

  onCornerDotChange(): void {
    this.generateQR();
  }

  onWifiModeChange(): void {
    this.generateQR();
  }

  onWifiChange(): void {
    if (this.isWifiMode) {
      this.generateQR();
    }
  }

  downloadQR(): void {
    if (this.qrCode) {
      try {
        this.qrCode.download({ extension: 'png', name: 'qr-code' });
      } catch (error) {
        console.error('Error downloading QR:', error);
        alert('Error al descargar el QR. Inténtalo de nuevo.');
      }
    }
  }
}

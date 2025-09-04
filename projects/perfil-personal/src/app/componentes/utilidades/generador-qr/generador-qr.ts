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
  imageData = '';
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
      image: this.imageData || undefined,
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

  async generateQR(): Promise<void> {
    if (this.qrCode) {
      this.qrCode.update({
        data: this.getQRData(),
        image: this.imageData || undefined,
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

  async onImageFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.imageData = '';
      this.generateQR();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.imageError = 'Por favor, selecciona un archivo de imagen válido.';
      return;
    }

    try {
      this.isLoadingImage = true;
      this.imageError = '';

      const reader = new FileReader();
      reader.onload = async (e): Promise<void> => {
        this.imageData = e.target?.result as string;
        await this.generateQR();
        this.isLoadingImage = false;
      };
      reader.onerror = (): void => {
        this.imageError = 'Error al leer el archivo.';
        this.isLoadingImage = false;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      this.imageError = 'Error al procesar la imagen.';
      this.isLoadingImage = false;
      console.error('Error processing image:', error);
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

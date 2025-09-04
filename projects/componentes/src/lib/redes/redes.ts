import { Component, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

type Red = {
  nombre: string;
  usuario: string;
  tipo?: 'logo' | 'tc';
  formato?: 'svg' | 'png';
  size?: number;
};

const TWITTER_SVG = `<svg name="twitter" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="#55ACE3" />
    <path
        d="M30.6 14.9C29.9 15.2 29.1 15.4 28.3 15.5C29.1 15 29.8 14.2 30.1 13.3C29.3 13.8 28.5 14.1 27.5 14.3C26.8 13.5 25.7 13 24.6 13C22.4 13 20.6 14.8 20.6 17C20.6 17.3 20.6 17.6 20.7 17.9C17.4 17.7 14.4 16.1 12.4 13.7C12.1 14.3 11.9 15 11.9 15.7C11.9 17.1 12.6 18.3 13.7 19C13 19 12.4 18.8 11.9 18.5C11.9 20.4 13.3 22.1 15.1 22.4C14.8 22.5 14.4 22.5 14 22.5C13.7 22.5 13.5 22.5 13.2 22.4C13.7 24 15.2 25.2 17 25.2C15.6 26.3 13.9 26.9 12 26.9C11.7 26.9 11.4 26.9 11 26.8C12.8 27.9 14.9 28.6 17.2 28.6C24.6 28.6 28.6 22.5 28.6 17.2V16.7C29.4 16.4 30.1 15.7 30.6 14.9Z"
        fill="white" />
</svg>`;

const GITHUB_SVG = `<svg name='github' viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 0H0V40H40V0Z" fill="#231E1B" />
    <path fill-rule="evenodd" clip-rule="evenodd"
        d="M19.9694 10.24C14.4648 10.24 10 14.7048 10 20.2094C10 24.6131 12.8746 28.344 16.789 29.6895C17.2783 29.7507 17.4618 29.4449 17.4618 29.2003C17.4618 28.9556 17.4618 28.344 17.4618 27.4877C14.7095 28.0993 14.0979 26.1421 14.0979 26.1421C13.6697 24.9801 12.9969 24.6743 12.9969 24.6743C12.0795 24.0626 13.0581 24.0626 13.0581 24.0626C14.0367 24.1238 14.5872 25.1024 14.5872 25.1024C15.5046 26.6314 16.9113 26.2033 17.4618 25.9587C17.5229 25.2859 17.8287 24.8577 18.0734 24.6131C15.8716 24.3684 13.5474 23.5122 13.5474 19.659C13.5474 18.558 13.9144 17.7018 14.5872 16.9678C14.526 16.7843 14.159 15.7446 14.7095 14.399C14.7095 14.399 15.5657 14.1544 17.4618 15.4388C18.2569 15.1941 19.1131 15.133 19.9694 15.133C20.8257 15.133 21.682 15.2553 22.4771 15.4388C24.3731 14.1544 25.2294 14.399 25.2294 14.399C25.7798 15.7446 25.4128 16.7843 25.3517 17.029C25.9633 17.7018 26.3914 18.6192 26.3914 19.7201C26.3914 23.5733 24.0673 24.3684 21.8654 24.6131C22.2324 24.9189 22.5382 25.5305 22.5382 26.448C22.5382 27.7935 22.5382 28.8333 22.5382 29.2003C22.5382 29.4449 22.7217 29.7507 23.211 29.6895C27.1865 28.344 30 24.6131 30 20.2094C29.9388 14.7048 25.474 10.24 19.9694 10.24Z"
        fill="white" />
</svg>`;

const LINKEDIN_SVG = `<svg name="linkedin" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="#2878B7" />
    <path
        d="M28 20.7444V26.2601H24.7713V21.0807C24.7713 19.8027 24.3004 18.9283 23.157 18.9283C22.2825 18.9283 21.7444 19.5336 21.5426 20.0718C21.4753 20.2735 21.4081 20.5426 21.4081 20.8789V26.2601H18.1794C18.1794 26.2601 18.2466 17.5157 18.1794 16.6413H21.4081V17.9865C21.8117 17.3139 22.6188 16.3722 24.3004 16.3722C26.3856 16.3722 28 17.7848 28 20.7444ZM14.8161 12C13.7399 12 13 12.7399 13 13.6816C13 14.6233 13.6726 15.3632 14.7489 15.3632C15.8924 15.3632 16.565 14.6233 16.565 13.6816C16.6323 12.6726 15.9596 12 14.8161 12ZM13.2018 26.2601H16.4305V16.6413H13.2018V26.2601Z"
        fill="white" />
</svg>`;

@Component({
  selector: 'lib-redes',
  templateUrl: './redes.html',
  styleUrl: './redes.scss',
})
export class Redes {
  private sanitizer = inject(DomSanitizer);

  readonly redes = input<Red[]>([]);

  /**
   * Devuelve el SVG del ícono de la red social.
   *
   * @param name - Nombre de la red social.
   * @returns SVG como SafeHtml.
   */
  getSvg(name: string): SafeHtml {
    const svgs: Record<string, string> = {
      twitter: TWITTER_SVG,
      github: GITHUB_SVG,
      linkedin: LINKEDIN_SVG,
    };

    const svg = svgs[name.toLowerCase()] || '';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Devuelve la URL del perfil en la red social.
   *
   * @param name - Nombre de la red social.
   * @param usuario - Nombre de usuario.
   * @returns URL del perfil.
   */
  getProfileUrl(name: string, usuario: string): string {
    const baseUrls: Record<string, string> = {
      twitter: 'https://twitter.com/',
      facebook: 'https://facebook.com/',
      instagram: 'https://instagram.com/',
      linkedin: 'https://linkedin.com/in/',
      github: 'https://github.com/',
      youtube: 'https://youtube.com/@',
      // Agregar más según necesidad
    };

    const base = baseUrls[name.toLowerCase()] || '#';
    return base + usuario;
  }
}

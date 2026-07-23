# Raspberry Pi — Pi-hole + API pública (Cloudflare Tunnel)

Runbook de la infra self-hosted. La Pi corre en la LAN de casa y expone servicios
a internet **sin abrir puertos** (hay doble NAT del ISP), vía Cloudflare Tunnel.

## Hardware / OS

- **Raspberry Pi 3 Model B** (BCM2837, quad A53, 1GB RAM, wifi+BT onboard).
- **Raspbian GNU/Linux 12 (bookworm)**, 32-bit (armhf), kernel 6.12.93.
- SD 28G. NetworkManager para la red.

## Acceso

| Cómo | Valor |
|------|-------|
| SSH (recomendado, IP-independiente) | `ssh tatoh@raspberrypi.local` (mDNS/avahi) |
| SSH por IP (cable, eth0) | `ssh tatoh@192.168.68.55` |
| SSH por IP (wifi, wlan0) | `ssh tatoh@192.168.68.50` |
| Usuario | `tatoh` (con sudo) |
| Pi-hole admin | `http://raspberrypi.local/admin` o `http://192.168.68.55/admin` |

> ⚠️ La subred LAN puede cambiar si reseteás el router/deco (pasó: `192.168.0.x` → `192.168.68.x`).
> Por eso preferí **`raspberrypi.local`** (mDNS) y **Tailscale** (`100.120.101.24`) — no dependen
> de la IP LAN. Las IPs de abajo son las actuales (`192.168.68.x/22`, gateway `.68.1`).

> Pendiente recomendado: `ssh-copy-id tatoh@raspberrypi.local` para dejar de tipear password.

## Red (eth0 + wifi backup)

- **eth0** (cable) es primario — route metric 100. MAC `b8:27:eb:28:17:cc` → `192.168.68.55`.
- **wlan0** (wifi de casa, perfil guardado en NetworkManager) es backup — metric 600, autoconnect. MAC `b8:27:eb:7d:42:99` → `192.168.68.50`.
- Si se cae el cable, wlan0 toma solo. El túnel/API **no se enteran** (son salientes).
- **Ojo IP + DNS**: en wifi-only la IP local cambia (`.55` → `.50`). El túnel da igual,
  pero clientes que usen la Pi como **DNS de Pi-hole** apuntando a `.55` la pierden.
  Fijar IPs con **reserva DHCP en el router** (el que da IPs LAN): eth0 → `192.168.68.55`.
  Para SSH usar `raspberrypi.local` y olvidarse de la IP.

## Cloudflare Tunnel — `api.tatoh.ar`

Túnel **manejado localmente** (sin Zero Trust, sin tarjeta). El dominio `tatoh.ar`
tiene el DNS en Cloudflare (registrado en nic.ar). El front sigue en Cloudflare aparte;
la Pi vive en subdominios.

- Túnel: **`raspi`** (id en `/etc/cloudflared/config.yml`; acá redactado como `<TUNNEL_ID>`).
- Ruteo actual: **`https://api.tatoh.ar`** → `http://localhost:8000` en la Pi.
- Corre como servicio systemd `cloudflared` (enabled, sobrevive reboot).
- Config: `/etc/cloudflared/config.yml` (+ `cert.pem` y `<uuid>.json` ahí; son secretos).

### Usarla desde este repo (el front)

Cualquier app del monorepo (p.ej. `comidas`) puede pegarle a la API pública:

```ts
const API = 'https://api.tatoh.ar';
const res = await fetch(`${API}/algo`, { method: 'POST', body: JSON.stringify(data) });
```

HTTPS con cert de Cloudflare automático. CORS: configurarlo en la API de la Pi
(permitir el origin del front). Hoy `api.tatoh.ar` sirve una página de test
(`<h1>Tunnel OK</h1>`) desde un `python3 -m http.server 8000` — reemplazar por la API real.

### Apuntar el túnel a tu API real

1. Levantá tu API en la Pi en un puerto (ej `:8000`) como servicio systemd.
2. Si cambiás puerto/hostname, editá el ingress en `/etc/cloudflared/config.yml`:
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /etc/cloudflared/<TUNNEL_ID>.json
   ingress:
     - hostname: api.tatoh.ar
       service: http://localhost:8000
     - service: http_status:404
   ```
3. `sudo systemctl restart cloudflared`.
4. Agregar más subdominios: `cloudflared tunnel route dns raspi otro.tatoh.ar` + otra
   regla `hostname` en el ingress.

## Comandos útiles (en la Pi)

```bash
# Túnel
systemctl status cloudflared
sudo journalctl -u cloudflared -f
cloudflared tunnel list
cloudflared tunnel info raspi

# Test server temporal (unidad transient, NO sobrevive reboot)
sudo systemctl status testweb          # python http.server :8000

# Pi-hole
pihole -v                              # versiones (core/web/FTL v6)
pihole status
sudo systemctl restart pihole-FTL

# Sistema
sudo apt update && sudo apt full-upgrade -y
```

## Remoto: Tailscale (SSH desde afuera + Pi-hole en 4G)

Tailscale corriendo en la Pi (`tailscaled` enabled, nodo autorizado, `--ssh` on).
VPN privada, gratis, sin exponer nada público. Da **SSH desde afuera** y **Pi-hole DNS en 4G**.

- **IP tailnet de la Pi**: `100.120.101.24` (MagicDNS: `raspberrypi`).
- Pi-hole seteado con `dns.listeningMode = ALL` para responder por la interfaz tailscale
  (probado: resuelve y bloquea vía `100.120.101.24`).

**SSH desde afuera** (ya funciona): `ssh tatoh@raspberrypi` desde cualquier device del
tailnet. Sin abrir puertos, sin password expuesto.

**Pi-hole en 4G** — falta el paso en la consola web de Tailscale:

1. `https://login.tailscale.com/admin/dns` → **Nameservers** → Add → Custom →
   `100.120.101.24`, activar **Override local DNS**.
2. En el teléfono: app Tailscale, misma cuenta, toggle ON.
3. Con 4G + Tailscale → DNS pasa por Pi-hole → ads filtrados afuera.

(El túnel Cloudflare NO sirve para esto — lleva HTTP, no DNS.)

Comandos: `tailscale status`, `tailscale ip -4`, `sudo tailscale up --ssh` (re-auth).

### Guía rápida — conectar dispositivos

**Teléfono (Pi-hole en 4G):**
1. App Tailscale (Play Store / App Store) → login misma cuenta.
2. Aceptar config de VPN → activar toggle.
3. Ya filtra (por el Override DNS activo). Test: `http://100.120.101.24/admin` o una web con ads.

**SSH desde otra PC:**
1. Instalar Tailscale en la PC (misma cuenta) → activar.
2. `ssh tatoh@raspberrypi` (o `ssh tatoh@100.120.101.24`).
3. Con `--ssh` puede entrar sin password (identidad Tailscale); si pide, es el pass normal.

> La PC/teléfono necesita Tailscale activo (es privado). En casa por LAN: `ssh tatoh@raspberrypi.local`.

## Pendientes / opciones

- **`pihole.tatoh.ar` (admin remoto)**: se puede exponer el admin de Pi-hole por el
  túnel (regla ingress → `http://localhost:80`). ⚠️ Deja el login de Pi-hole público en
  internet — protegido solo por password. Sin Cloudflare Access (requiere tarjeta) no hay
  gate extra. Evaluar antes de exponer.
- **Filtrar ads en TODA la LAN (recomendado)**: setear el DNS a nivel router. En el router
  que da DHCP a la LAN (gateway, hoy `192.168.68.1`), opción DHCP **"DNS server" → IP de la
  Pi (`192.168.68.55`)**. Cada device recibe la Pi como DNS y filtra solo. **Requiere IP
  fija**: reservar eth0 `b8:27:eb:28:17:cc` → `192.168.68.55` (el router apunta a IP, no a
  `raspberrypi.local`). Caveat: en wifi-only (`.55` cae) la LAN pierde DNS; con cable, ok.
  Si el router está capado y no deja DNS custom → apagar su DHCP y usar el **DHCP integrado
  de Pi-hole** (dnsmasq), o DNS por dispositivo.
- **Ad-blocking en 4G + SSH remoto**: ver sección **Tailscale** arriba (ya instalado,
  falta autorizar el nodo).
- **API real**: definir stack (FastAPI/Flask + SQLite, o Node). La Pi 3B lo aguanta de sobra.
- **SSH key**: `ssh-copy-id tatoh@raspberrypi.local` para dejar de usar password.

---
_Última actualización: 2026-07-22. Setup vía SSH: OS al día, Pi-hole v5→v6, túnel
Cloudflare local (`api.tatoh.ar` funcionando), wifi backup, Tailscale instalado
(falta autorizar nodo). Repo público → sin passwords ni credenciales acá._

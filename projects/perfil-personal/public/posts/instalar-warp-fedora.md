# Instalar Warp (la consola) en Fedora

## Preámbulo

Como todo gordo linuxero ando saltando de distros tanto para trabajar como para vivir, pero hace un par de años encontré el paraíso y se llama Fedora (ya sé, no es Arch). Fedora tiene un poco de los dos mundos; los paquetes y el kernel son modernos (no tanto como Arch) y tiene bocha de soporte en todos sus sabores. Así que me quedé acá en Nobara tanto para trabajar como para vivir (jugar).

## Warp

Una de las cosas que uno necesita para vivir en Linux es una buena consola y, por suerte, hay de todos los colores y sabores en los pagos del pingüino. Después de usar muchas, terminé quedándome con Warp (antes de que fuera 100% IA) y es lo que me acostumbré a usar. Uno de los problemas que siempre he tenido es la instalación. No porque sea un problema, sino porque es difícil de actualizar, ya que hasta hace poco no tenían repo en RPM. Ahora, y por eso estoy escribiendo esto, es más fácil.

```bash
# Importar la clave GPG del repositorio
sudo rpm --import https://releases.warp.dev/linux/keys/warp.asc

# Agregar el repo de Warp
sudo sh -c 'echo -e "[warpdotdev]
name=warpdotdev
baseurl=https://releases.warp.dev/linux/rpm/stable
enabled=1
gpgcheck=1
gpgkey=https://releases.warp.dev/linux/keys/warp.asc" > /etc/yum.repos.d/warpdotdev.repo'

# Instalar Warp
sudo dnf install warp-terminal
```

¿Solo copiar y pegar? Sé, gracias.

## Enlaces relacionados

- [Documentación oficial](<[url](https://docs.warp.dev/getting-started/readme/installation-and-setup#linux)>)

- [Nobara Linux](<[url](https://nobaraproject.org)>)

Tags: #warp #consolas #sistemas

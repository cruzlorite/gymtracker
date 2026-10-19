# GymTracker

Apunta tus entrenos, compite con tus amigos y descubre quién va más y quién mejora más.

Es una app **solo frontend**: HTML, CSS y JavaScript sin build ni servidor. Se publica como web estática en GitHub Pages y los datos viven en **Google Sheets**, en el Drive de quien crea cada grupo.

## Cómo funciona

- **Login**: Google Identity Services (OAuth en el navegador). Con el token del usuario, el navegador llama directamente a las APIs de Sheets y Drive.
- **Permisos mínimos**: solo pide `drive.file`, así que la app únicamente ve las hojas que ha creado ella o que el usuario ha elegido con el selector de Google (Picker). No puede leer el resto de su Drive.
- **Un grupo = una hoja de cálculo** llamada `GymTracker · <nombre>`:

  | Pestaña | Contenido |
  |---|---|
  | `_grupo` | Versión del esquema y marca de la app (protegida: solo la edita quien crea el grupo) |
  | `_miembros` | `email, nombre, foto, alta` |
  | `_retos` | `id, titulo, tipo, ejercicio, inicio, fin, creado_por` |
  | `<email>` (una por persona) | `id, fecha, ejercicio, series, reps, kg, notas`. Está protegida para que solo la edite su dueño |

- **Invitar**: solo puede hacerlo quien crea el grupo. La app comparte la hoja desde su Drive (rol *editor*) y Google envía un correo con el enlace `?group=<id>`. La primera vez, el invitado elige la hoja en el Picker para que la app tenga acceso a ella. Los demás miembros no pueden volver a compartirla (`writersCanShare: false`).
- **Modo demo**: botón *Probar con datos de ejemplo*, con datos inventados en memoria. Funciona sin configurar nada.

## Estructura

```
index.html        página única
privacy.html      política de privacidad (enlazada desde la app y la pantalla de consentimiento)
styles.css        estilos (modo claro y oscuro)
config.js         IDs públicos de Google Cloud
js/app.js         estado, vistas y acciones
js/google.js      login, Drive, Sheets y Picker (SheetStore)
js/demo.js        DemoStore: misma interfaz que SheetStore, en memoria
js/stats.js       cálculos puros (asistencia, volumen, 1RM, rachas, retos)
vendor/           Chart.js servido desde el repo (hash verificado en vendor/README.md)
```

## Configurar Google

En [Google Cloud Console](https://console.cloud.google.com/):

1. **Crea un proyecto**, o usa uno existente. Apunta su **número de proyecto** (en el panel de inicio; son solo dígitos).
2. **Activa las APIs** (*APIs y servicios → Biblioteca*): **Google Sheets API**, **Google Drive API** y **Google Picker API**.
3. **Pantalla de consentimiento OAuth** (*Google Auth Platform*):
   - Tipo de usuario: *Externo*.
   - Ámbitos: `openid`, `email`, `profile` y `.../auth/drive.file`. Ninguno es sensible, así que no hace falta pasar la verificación de Google.
   - En *Branding*, pon como enlace de la política de privacidad `https://<tu-usuario>.github.io/<repo>/privacy.html`.
   - Mientras esté en modo *Prueba*, solo pueden entrar los usuarios que añadas como *usuarios de prueba*. Para abrirlo a cualquiera, pulsa *Publicar app* (ver [Seguridad y privacidad](#seguridad-y-privacidad)).
   - **No vincules una cuenta de facturación al proyecto.** No hace falta y así nadie puede generarte gastos.
4. **Crea un ID de cliente OAuth** (*Credenciales → Crear credenciales → ID de cliente de OAuth*):
   - Tipo: *Aplicación web*.
   - Orígenes de JavaScript autorizados:
     - `https://<tu-usuario>.github.io`
     - `http://localhost:8000` (para desarrollo local)
   - No hacen falta URIs de redirección.
5. **Crea una clave de API** (*Credenciales → Crear credenciales → Clave de API*). Solo la usa el Picker. Restríngela:
   - Restricción de aplicación: *Sitios web*, con `https://<tu-usuario>.github.io/*` y `http://localhost:8000/*`.
   - Restricción de API: solo *Google Picker API*.
6. **Rellena [config.js](config.js)**:

   ```js
   export const CONFIG = {
     CLIENT_ID: '1234567890-abc123.apps.googleusercontent.com',
     API_KEY: 'AIza...',
     APP_ID: '1234567890',   // número del proyecto
     APP_TAG: 'gymtracker',
   };
   ```

   Estos valores son públicos por diseño: el navegador los necesita y no dan acceso a ningún dato sin el login del usuario. La protección la dan los orígenes autorizados y las restricciones de la clave. No hay ningún secreto en el repo.

## Desarrollo local

Los módulos ES no funcionan abriendo el archivo con `file://`, así que hace falta un servidor estático:

```sh
python3 -m http.server 8000
```

Abre <http://localhost:8000>. El puerto tiene que coincidir con el origen autorizado en el paso 4.

## Publicar en GitHub Pages

1. Sube el repo a GitHub con la rama `main`.
2. En *Settings → Pages → Build and deployment*, elige **Source: GitHub Actions**.
3. Cada push a `main` despliega con [.github/workflows/pages.yml](.github/workflows/pages.yml). La web queda en `https://<tu-usuario>.github.io/<repo>/`.

Las rutas son relativas, así que funciona igual en un subdirectorio (`/<repo>/`) que en un dominio propio. Si usas un dominio propio, añádelo también a los orígenes autorizados y a las restricciones de la clave de API.

## Seguridad y privacidad

### Configuración recomendada

- **App OAuth en modo *Prueba***, con los miembros añadidos como usuarios de prueba (máximo 100). La web es pública, pero solo esa gente puede iniciar sesión.
- **Proyecto de Google Cloud sin facturación.**
- **2FA en GitHub y protección de la rama `main`**: quien pueda publicar en este repo puede publicar código que vea el token de Google de cada usuario.
- **Sin dependencias de CDN**: Chart.js se sirve desde [vendor/](vendor/). Los únicos scripts externos son los de Google (login y Picker), que no admiten SRI porque Google los actualiza.

### Qué protege la app

- **Permisos mínimos.** Solo pide `drive.file`: un token robado solo da acceso a las hojas de GymTracker de esa persona.
- **Sin XSS por datos de la hoja.** Todo lo que se lee de la hoja se escapa antes de pintarlo.
- **Fotos de perfil.** Solo se cargan fotos de `*.googleusercontent.com`, para que nadie pueda meter una URL suya en la hoja y ver la IP de quien abre la app.
- **Pestañas personales.** Cada pestaña está protegida a nombre de su dueño. Si alguien crea una pestaña con el email de otra persona, la app la ignora y lo avisa en dos casos: cuando la pestaña no tiene protección, y cuando mira el dueño de la hoja o la propia persona suplantada. Son los únicos que pueden ver los editores de la protección. Además, la persona suplantada no puede unirse hasta que se borre esa pestaña.
- **Membresía.** Una fila en `_miembros` sin pestaña válida no cuenta como miembro.
- **Datos mal escritos.** Las fechas y retos inválidos, por ejemplo editados a mano, se ignoran en vez de romper la vista.

### Qué no puede proteger (riesgos aceptados)

- Todos los miembros de un grupo ven y pueden descargar la hoja entera (emails y entrenos de todos).
- El creador del grupo es dueño de la hoja: puede editar o borrar cualquier dato.
- `_miembros` y `_retos` las puede editar cualquier miembro. Por ejemplo, alguien podría cambiar el nombre visible de otro o borrar retos. Sheets guarda un historial de versiones para recuperar cambios.
- Cada uno apunta lo que quiere en su pestaña: hacer trampas es trivial.
- El nombre y el email de soporte del proyecto de Cloud aparecen en la pantalla de login.
- Si se borra el proyecto de Cloud o Google cambia sus APIs, el login deja de funcionar. Los datos siguen en las hojas.

## Licencia

[MIT](LICENSE).

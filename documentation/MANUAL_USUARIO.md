# Manual de usuario — PRIVATE DRIVE PRO

## Crear y activar una cuenta

1. En la pantalla de inicio de sesión, selecciona **Crear cuenta**.
2. Completa nombre, apellido, nombre de usuario, correo y contraseña (mínimo 12 caracteres).
3. Envía la solicitud. El registro queda **pendiente de aprobación administrativa**; todavía no permite iniciar sesión.
4. Cuando el administrador apruebe la solicitud, recibirás un código de verificación de seis dígitos en tu correo.
5. Regresa al inicio de sesión y selecciona **Activar mi cuenta con código**. Ingresa el correo y el código recibido.
6. Si no recibiste el código, utiliza **Reenviar verificación de correo** e ingresa tu correo o nombre de usuario.
7. Después de verificar el correo, completa el acceso a la sala privada si el sistema te solicita su código.

Si la solicitud aún no ha sido aprobada, contacta al administrador: reenviar el código no sustituye la aprobación.

## 1. Propósito
PRIVATE DRIVE PRO permite gestionar documentos y carpetas en un espacio privado. El acceso depende de una cuenta aprobada y de los permisos que valide el servidor.

## 2. Requisitos para acceder
- Tener una cuenta registrada.
- Esperar la aprobación administrativa cuando el registro esté pendiente.
- Completar la verificación o cambio de contraseña si el sistema lo solicita.
- Usar un navegador actualizado y una conexión con el servidor.

## 3. Inicio de sesión
1. Abre el frontend de usuario en `http://localhost:5173`.
2. Escribe tu correo o identificador y contraseña.
3. Pulsa **Iniciar sesión**.
4. Si no puedes entrar, revisa el mensaje mostrado. No compartas tu contraseña ni códigos de verificación.

## 4. Archivos
Desde el espacio de archivos puedes, según los permisos de tu cuenta:
- Consultar los archivos disponibles.
- Subir uno o varios archivos mediante el selector de carga.
- Descargar archivos autorizados.
- Abrir la vista previa de los formatos compatibles.
- Cambiar el nombre, marcar favoritos o enviar elementos a la papelera.
- Consultar archivos recientes y papelera.

La versión actual contempla vista previa para PDF, imágenes PNG/JPG/JPEG/WEBP, texto/CSV y algunos formatos multimedia. Otros tipos pueden estar disponibles solo para descarga. La vista previa de Excel debe validarse con los archivos reales de tu entorno antes de darla por aceptada.

## 5. Carpetas
1. Usa **Nueva carpeta** para crear una carpeta.
2. Comprueba que aparezca en el listado.
3. Ábrela para consultar su contenido.
4. Usa la ruta o navegación de retorno para volver a la ubicación anterior.
5. Para renombrar o eliminar, utiliza las acciones disponibles en el elemento.

La eliminación de carpetas vacías es la opción segura prevista por el backend; no asumas que se permite eliminar carpetas con contenido.

## 6. Papelera
- **Restaurar** devuelve un elemento a su ubicación original cuando esa ubicación sigue disponible.
- **Eliminar permanentemente** no es reversible.
- Revisa el elemento antes de confirmar una eliminación definitiva.

## 7. Salas privadas
La activación de sala depende del flujo habilitado para la cuenta y del código de acceso enviado por el administrador. No compartas el código con personas no autorizadas.

## 8. Perfil y seguridad
- Cierra sesión al terminar, especialmente en equipos compartidos.
- Utiliza una contraseña única y robusta.
- No guardes credenciales en documentos o capturas.
- Informa al administrador si detectas actividad desconocida.

## 9. Problemas frecuentes
| Situación | Qué revisar |
|---|---|
| No inicia sesión | Estado de aprobación, correo, contraseña y disponibilidad de la API |
| No aparecen archivos | Sala activa, permisos, filtros y conexión |
| La carga falla | Tamaño máximo, formato admitido, espacio y conexión |
| No se visualiza un archivo | El formato puede permitir solo descarga |
| No aparece una carpeta | Actualiza el listado y verifica que la operación terminó sin error |
| Sesión expirada | Inicia sesión nuevamente |

## 10. Buenas prácticas
No subas ejecutables o documentos sospechosos. Mantén una copia independiente de los documentos importantes. La papelera de la aplicación no sustituye una copia de seguridad.


## Compartir archivos (V9)
1. Abre «Todos los archivos» y localiza el archivo propio.
2. Pulsa el icono de compartir o abre el menú de opciones y selecciona «Compartir».
3. Escribe el correo de una cuenta activa.
4. Selecciona el permiso: `VIEW` permite vista previa; `DOWNLOAD` permite vista previa y descarga; `EDIT` actualmente permite vista previa y descarga (la edición colaborativa no está habilitada).
5. La otra persona encontrará el elemento en «Compartidos conmigo».

El propietario puede consultar y revocar permisos mediante los endpoints documentados en `V9_IMPLEMENTACION_Y_PRUEBAS.md`. Un archivo compartido no concede permiso para renombrar, eliminar ni marcar como favorito el archivo original.

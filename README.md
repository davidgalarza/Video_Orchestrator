# Vidgen Studio

Editor de vídeo de uso general, basado en [Video Orchestrator de Rajjit Laishram](https://github.com/rajjitlai/Video_Orchestrator). Interfaz en español, React 19 + TypeScript + Vite, almacenamiento local y despliegue estático en Vercel.

## Qué puedes hacer

- Generar vídeos con **Gemini Omni 1.1 Flash** usando tu propia API key de Google AI Studio. También se mantiene Veo 3.1.
- Organizar cada proyecto como una biblioteca de clips, con búsqueda, filtros, prompts, referencias y versiones.
- Marcar favoritos y ocultar descartados sin borrar sus vídeos; recuperarlos desde el filtro **Descartados**.
- Comparar dos clips con reproducción, desplazamiento y selección de audio compartidos. Los clips derivados permiten **Comparar con origen** directamente.
- Usar **Crear otro parecido** para abrir un borrador con el prompt, los ajustes y las referencias reutilizados, sin iniciar una generación.
- Editar, duplicar, ordenar y eliminar escenas, con guardado local automático.
- Recuperar clips eliminados desde la papelera o con **Deshacer**, conservando sus versiones y su posición en la secuencia.
- Usar fotogramas inicial/final y hasta tres referencias de personaje, producto o estilo en Omni.
- Elegir referencias desde una galería con búsqueda, miniaturas completas y vista ampliada. Subir imágenes por botón o arrastrándolas al selector; quedan guardadas en Referencias para reutilizarlas. La selección se aplica al confirmar, y cancelar conserva las imágenes que ya usaba el clip.
- Elegir formato vertical/horizontal, duración y resolución por escena.
- Crear clips editados o extendidos a partir de una toma con Omni, conservando el original y su enlace de origen. La extensión admite hasta 40 segundos.
- Generar escenas pendientes en secuencia. La tanda se detiene ante un error para evitar solicitudes adicionales.
- Elegir de 1 a 20 clips por solicitud y seguir preparando o enviando clips mientras avanza una cola en segundo plano.
- Pausar el seguimiento y recuperar una operación guardada después de recargar, sin lanzar otra generación.
- Crear imágenes de referencia con Gemini 3.1 Flash Image.
- Descargar clips individuales o en ZIP en resolución original, 720p, 1080p o 4K; conservar siempre los originales. Incluir opcionalmente `clips.json` con prompts, ajustes y datos de la descarga.
- Montar una secuencia opcional con los clips elegidos, ordenarla y exportarla en un MP4. Quitar un clip de la secuencia conserva el clip en el proyecto.

## Dos formas de trabajar

El proyecto abre en **Clips del proyecto**. Usa **Nuevo clip** o abre uno existente para generar, revisar versiones y descargarlo en un modal individual. Al cerrarlo, vuelves a la biblioteca y los cambios quedan guardados. Para seguir en un editor local, selecciona clips y pulsa **Descargar seleccionados · ZIP**: se incluye la versión activa de cada vídeo. La resolución **Original** la conserva sin recomprimir. Los borradores se excluyen y los nombres llevan un índice para evitar colisiones. El ZIP admite hasta 4 GB; para más material, descarga por grupos.

**Descargar clips** permite elegir seleccionados, favoritos o todos los disponibles. Puedes usar los nombres de los clips, un nombre común numerado o personalizar cada archivo. La vista previa muestra los nombres seguros definitivos y resuelve duplicados. Los prompts, ajustes, duración y origen se incluyen opcionalmente en `clips.json`. Los descartados se excluyen de Favoritos y Todos; puedes seleccionarlos explícitamente si quieres descargarlos.

**Resolución de descarga** funciona desde las tarjetas, el editor, Mis vídeos y el ZIP. La vista individual muestra las dimensiones reales antes y después del cambio. 720p, 1080p y 4K conservan la proporción vertical u horizontal. El nombre añade la resolución; los ajustes de generación del manifiesto permanecen separados de los datos de descarga. Si el archivo ya tiene las dimensiones solicitadas, se entrega sin recomprimir.

El escalado usa [Lanczos de FFmpeg](https://ffmpeg.org/ffmpeg-scaler.html) con H.264 CRF 18 y preset `veryfast`. Se ejecuta en este dispositivo, sin enviar los vídeos a un servicio ni consumir cuota de Google. Conserva el audio por copia, la duración y la velocidad de los clips individuales. Es interpolación, no restauración con IA: aumenta la resolución sin recuperar detalle perdido. 1080p ofrece un equilibrio práctico; 4K puede tardar varios minutos y consumir mucha memoria. El motor se carga bajo demanda, muestra progreso y permite cancelar; mantén la pestaña abierta. Los ZIP procesan un clip cada vez. Archivos individuales mayores de 512 MB y salidas mayores de 8,3 megapíxeles requieren un editor local. Las secuencias se codifican directamente en la resolución elegida, con audio normalizado y 24 fps como antes.

La alternativa de restauración [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) requiere otro entorno de ejecución (Python, un binario nativo o un servicio externo); no se incluye en el despliegue estático. [ffmpeg.wasm es más lento que FFmpeg nativo](https://ffmpegwasm.netlify.app/docs/faq/), por lo que para trabajo largo en 4K conviene el editor local.

Selecciona exactamente dos clips con vídeo y pulsa **Comparar 2 clips**. Ambos comparten reproducción y desplazamiento; puedes escuchar uno a la vez y marcar el favorito sin salir. Si las duraciones difieren, el más corto conserva su último fotograma mientras continúa el otro.

Para un montaje rápido, selecciona clips y pulsa **Añadir a secuencia**. Ordena las tomas con las flechas, usa **Quitar de secuencia** para excluirlas y **Exportar vídeo** para unirlas. **Todos los clips** vuelve a la biblioteca. El orden del montaje se guarda aparte; los proyectos antiguos conservan su secuencia original.

En el modal, escribe el prompt y ajusta la salida; las referencias son opcionales y se despliegan cuando las necesitas. Las instrucciones de edición y extensión también se guardan. Puedes preparar otro clip mientras se genera uno y volver desde Ajustes al clip abierto. En móvil, alterna entre **Configurar** y **Vista previa**. En la biblioteca puedes ordenar, filtrar los clips **Por revisar** y recuperar resultados pendientes directamente.

**Cantidad de clips** indica cuántos vídeos crear. Cada resultado aparece en una tarjeta independiente, listo para seleccionar, descargar, eliminar o añadir al montaje. Al aceptarlos, el modal se cierra y la biblioteca muestra el estado de Google y los clips pendientes. Cada solicitud conserva el prompt, los ajustes y las referencias enviados aunque después cambies el borrador.

**Editar** crea un clip nuevo con los cambios; **Extender** crea otro que incluye el vídeo original y 10 segundos de continuación. El clip de origen se conserva y los resultados tienen un enlace **Ver origen**. Si solicitas varios, todos parten de la misma toma seleccionada. Puedes extender de nuevo el resultado cuando quieras continuar desde él.

Los resultados guardados con el flujo anterior siguen disponibles en **Resultados anteriores**. **Separar en clips** conserva la toma activa en su tarjeta y convierte las demás en clips independientes, sin volver a generar ni perder archivos.

La cola procesa una solicitud cada vez y puedes añadir otras mientras trabaja. **Cancelar pendientes** retira las solicitudes que todavía no han empezado de ese clip. **Pausar seguimiento** detiene el seguimiento local y la cola, sin cancelar la operación que Google ya recibió. Mantén la pestaña abierta para que siga avanzando. Tras recargar, las solicitudes pendientes se conservan pausadas: usa **Recuperar resultado** si hay una operación interrumpida o **Continuar cola** para las que aún no se enviaron. Un error detiene la cola y conserva lo restante. **Reintentar clip** utiliza la solicitud guardada en esa misma tarjeta, incluyendo el vídeo base de una edición o extensión.

La cola no añade pasos al generar. **Ver actividad** abre un panel opcional con el clip activo y los próximos. La flecha adelanta un clip al siguiente turno; puedes cancelar una solicitud o los pendientes de una tanda completa. Las prioridades y cancelaciones se conservan al recargar. La solicitud en curso permanece intacta. El panel también muestra resultados por recuperar.

## Inicio local

Requiere Node.js 22.12+ y un navegador moderno.

```bash
npm ci
npm run dev
```

Abre http://localhost:5173. En **Ajustes**, pega tu clave de Google y pulsa **Guardar clave**. No requiere `.env`, credenciales de servicio, una base de datos externa ni un backend.

**Comprobar conexión** consulta el catálogo de Google sin generar contenido. Confirma que Google acepta la clave, pero no garantiza permiso o cuota para un modelo concreto. La primera generación comprueba ese acceso. Necesitas una clave de la API oficial de Google, no una clave de un intermediario.

## Desplegar en Vercel

1. Importa tu fork de este repositorio en Vercel.
2. Selecciona **Vite**, con `npm run build` y directorio de salida `dist`.
3. Despliega y abre la URL. Introduce tu clave dentro de **Ajustes**.

El archivo `vercel.json` ya contiene la configuración y los encabezados para la exportación de vídeo. No añadas una clave compartida mediante `VITE_*`: esas variables se incluyen en los archivos públicos. Cada navegador utiliza la clave que su usuario introduce.

Vercel sirve archivos estáticos. Las generaciones y su seguimiento se realizan entre el navegador y Google; no dependen de los tiempos máximos de una función serverless. El motor FFmpeg se carga bajo demanda desde el mismo despliegue, sin un CDN externo.

## Datos, recuperación y límites

- Los proyectos, imágenes y vídeos se guardan en IndexedDB. No se sincronizan entre dispositivos. Descarga los vídeos importantes antes de borrar los datos del navegador.
- La papelera conserva los archivos para poder restaurarlos; mover un clip a ella no libera espacio. Eliminar el proyecto elimina también sus clips de la papelera.
- Se conserva el nombre y esquema de la base de datos del proyecto original. Sus vídeos se leen desde el blob almacenado, creando URLs nuevas al reproducirlos.
- Cada iteración conserva las versiones anteriores. Pausar detiene el seguimiento local; Google puede continuar procesando y facturando la solicitud.
- Omni se lee desde `steps → model_output → content` en REST; `output_video` es una comodidad del SDK. Se admiten vídeos en base64 y por URI, esperando a que el archivo esté `ACTIVE` antes de descargarlo.
- Si ya se recibió el identificador de una operación, **Recuperar resultado** solo consulta y descarga. Si la conexión falla antes de recibirlo, revisa tu actividad de Google antes de crear otra generación: no es posible garantizar que el servidor no haya aceptado la primera.
- El contexto de Omni para edición y extensión caduca según la retención de Google. Los vídeos descargados al navegador permanecen disponibles aunque caduque ese contexto.
- Omni permite elegir 360p/720p y salidas reescaladas de 1080p/4K. La extensión solicitada añade 10 segundos, hasta un total de 40; su resultado depende del modelo.
- La exportación de varias escenas normaliza a **720p, H.264/AAC, 24 fps**, conservando el encuadre mediante bandas cuando los formatos difieren. Los clips individuales se descargan con su calidad original. La guía de zona segura es solo una ayuda visual y no se incrusta en el archivo.
- La exportación usa memoria y CPU de tu dispositivo; funciona mejor en escritorio. El motor se descarga una vez (aproximadamente 32 MB sin comprimir). Puedes descargar clips por separado en dispositivos con pocos recursos.
- No se muestran costes ficticios ni se estiman cargos: consulta el consumo real en Google AI Studio.

## Desarrollo y validación

```bash
npm run test       # contratos HTTP, recuperación, referencias y almacenamiento
npm run lint
npm run build
npm run dev        # mantener activo para las pruebas de navegador
npm run test:e2e   # flujo completo y exportación real con clips sintéticos
```

Las pruebas de generación interceptan Google con respuestas simuladas y no consumen cuota. La exportación sí ejecuta FFmpeg real en el navegador. La comprobación con una clave real y acceso a Omni es un paso independiente; las pruebas simuladas no certifican disponibilidad, facturación, CORS o comportamiento real del proveedor.

Si Chrome no está instalado en macOS, instala Chromium con `npx playwright install chromium`. Puedes indicar un ejecutable mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Fuentes técnicas

- [Omni: generación, referencias, edición y extensión](https://ai.google.dev/gemini-api/docs/omni)
- [Contrato de Interactions API](https://ai.google.dev/api/interactions-api)
- [Veo: contrato de generación](https://ai.google.dev/gemini-api/docs/veo)

## Licencias

La aplicación conserva la licencia MIT y la atribución del proyecto original en [LICENSE](./LICENSE). La distribución de FFmpeg incluida tiene su propia licencia GPL-2.0-or-later; consulta [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

### Errores al procesar archivos de Google

Las generaciones nuevas en 360p y 720p usan entrega directa; 1080p, 4K y edición/extensión conservan entrega por URI para salidas grandes, siguiendo la [guía de Omni](https://ai.google.dev/gemini-api/docs/omni#retrieving-videos-with-an-uri). Si Google falla al preparar el archivo de salida, la app intenta recuperar datos del mismo resultado una sola vez mediante GET, sin repetir la generación. Un fallo terminal confirmado permite un reintento explícito; las interrupciones de red conservan la opción de recuperar. Un fallo de Google no garantiza que exista un vídeo recuperable.

Antes de enviar referencias, la app prepara copias JPEG con orientación aplicada, fondo blanco para transparencias y un máximo de 2048 px por lado. Las imágenes originales y las solicitudes guardadas se conservan. Esta preparación mejora la compatibilidad de entrada, pero no corrige un fallo del servicio de archivos de salida de Google.

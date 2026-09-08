# Vidgen Studio

Editor de vídeo de uso general, basado en [Video Orchestrator de Rajjit Laishram](https://github.com/rajjitlai/Video_Orchestrator). Interfaz en español, React 19 + TypeScript + Vite, almacenamiento local y despliegue estático en Vercel.

## Qué puedes hacer

- Generar vídeos con **Gemini Omni 1.1 Flash** usando tu propia API key de Google AI Studio. También se mantiene Veo 3.1.
- Organizar cada proyecto como una biblioteca de clips, con búsqueda, filtros, prompts, referencias y versiones.
- Editar, duplicar, ordenar y eliminar escenas, con guardado local automático.
- Recuperar clips eliminados desde la papelera o con **Deshacer**, conservando sus versiones y su posición en la secuencia.
- Usar fotogramas inicial/final y hasta tres referencias de personaje, producto o estilo en Omni.
- Elegir formato vertical/horizontal, duración y resolución por escena.
- Crear clips editados o extendidos a partir de una toma con Omni, conservando el original y su enlace de origen. La extensión admite hasta 40 segundos.
- Generar escenas pendientes en secuencia. La tanda se detiene ante un error para evitar solicitudes adicionales.
- Elegir de 1 a 20 clips por solicitud y seguir preparando o enviando clips mientras avanza una cola en segundo plano.
- Pausar el seguimiento y recuperar una operación guardada después de recargar, sin lanzar otra generación.
- Crear imágenes de referencia con Gemini 3.1 Flash Image.
- Descargar un clip o seleccionar varios para obtener un ZIP con sus vídeos originales y un archivo `clips.json` con prompts y ajustes.
- Montar una secuencia opcional con los clips elegidos, ordenarla y exportarla en un MP4. Quitar un clip de la secuencia conserva el clip en el proyecto.

## Dos formas de trabajar

El proyecto abre en **Clips del proyecto**. Usa **Nuevo clip** o abre uno existente para generar, revisar versiones y descargarlo en un modal individual. Al cerrarlo, vuelves a la biblioteca y los cambios quedan guardados. Para seguir en un editor local, selecciona clips y pulsa **Descargar seleccionados · ZIP**: se incluye la versión activa de cada vídeo, sin recomprimir. Los borradores se excluyen y los nombres llevan un índice para evitar colisiones. El ZIP admite hasta 4 GB; para más material, descarga por grupos.

Para un montaje rápido, selecciona clips y pulsa **Añadir a secuencia**. Ordena las tomas con las flechas, usa **Quitar de secuencia** para excluirlas y **Exportar vídeo** para unirlas. **Todos los clips** vuelve a la biblioteca. El orden del montaje se guarda aparte; los proyectos antiguos conservan su secuencia original.

En el modal, escribe el prompt y ajusta la salida; las referencias son opcionales y se despliegan cuando las necesitas. Las instrucciones de edición y extensión también se guardan. Puedes preparar otro clip mientras se genera uno y volver desde Ajustes al clip abierto. En móvil, alterna entre **Configurar** y **Vista previa**. En la biblioteca puedes ordenar, filtrar los clips **Por revisar** y recuperar resultados pendientes directamente.

**Cantidad de clips** indica cuántos vídeos crear. Cada resultado aparece en una tarjeta independiente, listo para seleccionar, descargar, eliminar o añadir al montaje. Al aceptarlos, el modal se cierra y la biblioteca muestra el estado de Google y los clips pendientes. Cada solicitud conserva el prompt, los ajustes y las referencias enviados aunque después cambies el borrador.

**Editar** crea un clip nuevo con los cambios; **Extender** crea otro que incluye el vídeo original y 10 segundos de continuación. El clip de origen se conserva y los resultados tienen un enlace **Ver origen**. Si solicitas varios, todos parten de la misma toma seleccionada. Puedes extender de nuevo el resultado cuando quieras continuar desde él.

Los resultados guardados con el flujo anterior siguen disponibles en **Resultados anteriores**. **Separar en clips** conserva la toma activa en su tarjeta y convierte las demás en clips independientes, sin volver a generar ni perder archivos.

La cola procesa una solicitud cada vez y puedes añadir otras mientras trabaja. **Cancelar pendientes** retira las solicitudes que todavía no han empezado de ese clip. **Pausar seguimiento** detiene el seguimiento local y la cola, sin cancelar la operación que Google ya recibió. Mantén la pestaña abierta para que siga avanzando. Tras recargar, las solicitudes pendientes se conservan pausadas: usa **Recuperar resultado** si hay una operación interrumpida o **Continuar cola** para las que aún no se enviaron. Un error detiene la cola y conserva lo restante. **Reintentar clip** utiliza la solicitud guardada en esa misma tarjeta, incluyendo el vídeo base de una edición o extensión.

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

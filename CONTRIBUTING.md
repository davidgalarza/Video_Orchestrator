# Contribuir a Vidgen Studio

Se aceptan correcciones, mejoras de documentación, accesibilidad y funciones coherentes con un editor de vídeo de uso general. Puedes enviar documentación y arreglos pequeños directamente. Para un cambio amplio de arquitectura o de producto, abre primero una propuesta que explique el problema y el flujo deseado.

## Preparar el entorno

1. Haz un fork y clónalo.
2. Instala Node.js 22.12+ y ejecuta `npm ci`.
3. Crea una rama para el cambio, por ejemplo `git switch -c fix/clip-selection`.
4. Ejecuta `npm run dev` y consulta [desarrollo y pruebas](docs/development.md).

No necesitas una API key para las pruebas automatizadas. No incluyas claves, contenido personal ni respuestas de usuarios reales como fixtures.

## Criterios del proyecto

- Interfaz en español, de uso general y sin plantillas impuestas al crear proyectos.
- Preservar vídeos originales, referencias y lectura de proyectos anteriores.
- Generaciones facturables solo tras una acción explícita; diferenciar recuperación y reintento.
- Controles claros y utilizables con teclado, ratón y pantallas pequeñas.
- Mantener alineadas la previsualización y la exportación del montaje.
- Estado real del proveedor, sin estimaciones inventadas de progreso o coste.

Consulta [arquitectura](docs/architecture.md), [contrato de Google](docs/google-api.md), [PRODUCT.md](PRODUCT.md) y [DESIGN.md](DESIGN.md). Los componentes usan React y TypeScript; los estilos compartidos están en `src/ui/studio.css` y los del montaje en `src/ui/sequence.css`.

## Antes de enviar un PR

```bash
npm test
npm run lint
npm run build
```

Ejecuta las pruebas de navegador relevantes cuando cambie un flujo. Documenta los comandos y resultados. Las pruebas con Google simulado no acreditan un modelo en producción; si realizas una comprobación real, usa tu cuenta y redacta cualquier dato privado antes de compartir el resultado.

El PR debe explicar el problema, el comportamiento final, cómo se validó y las limitaciones. Incluye capturas para cambios visuales cuando ayuden, usando contenido que puedas publicar. Mantén el diff centrado y actualiza la documentación o el changelog cuando cambie el comportamiento.

## Incidencias

Busca primero si el problema ya está reportado y usa las plantillas de GitHub. Aporta pasos reproducibles, navegador/sistema y revisión del código. No adjuntes trazas completas, claves, cabeceras o vídeos privados. Para problemas de seguridad usa [SECURITY.md](SECURITY.md).

## Colaboración y licencia

Mantén conversaciones respetuosas y centradas en el trabajo. No se aceptan acoso, ataques personales ni divulgación de datos privados. Sigue el [código de conducta](CODE_OF_CONDUCT.md).

Envía únicamente material sobre el que tengas derecho a contribuir. Las contribuciones al código de la aplicación se aceptan bajo su [licencia MIT](LICENSE); conserva atribuciones y documenta las licencias de dependencias o recursos añadidos. No se exige un CLA adicional en este repositorio.

La revisión depende de la disponibilidad de los mantenedores; no se promete un plazo de respuesta ni aceptación automática.

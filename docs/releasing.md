# Preparar una publicación open source

[Documentación](README.md)

Esta guía es para quien mantiene un fork o prepara una release. No cambia automáticamente la visibilidad, la configuración de GitHub o los despliegues.

## Revisar el contenido

- Mantener `LICENSE`, atribución al proyecto original y `THIRD_PARTY_NOTICES.md`.
- Revisar el árbol que se publicará y el historial completo con una herramienta de detección de secretos. Una revisión por patrones del estado actual no es una auditoría del historial ni garantiza que no exista ningún secreto.
- No incluir `.env`, claves, bases de datos personales, trazas, capturas de sesiones reales, `node_modules` ni `dist` en los commits. Revisar también archivos binarios y metadatos.
- Usar capturas y clips de demostración con permiso de publicación. No publicar resultados privados de usuarios como ejemplo.
- Ajustar enlaces y nombres si el fork cambia de propietario o de repositorio.

`.gitignore` excluye los archivos habituales de desarrollo y las trazas; no protege un archivo que ya estuviera versionado. Si aparece una credencial, revocarla primero y coordinar la limpieza del historial.

## Verificar la versión

Desde una copia limpia, instalar con `npm ci`, ejecutar `npm test`, `npm run lint`, `npm run build` y las pruebas de navegador descritas en [desarrollo](development.md). Confirmar proyecto vacío, generación simulada, recuperación, referencias, recortes y exportación real con los medios de prueba.

Si la release anuncia cambios de contrato de Google, realizar y registrar una comprobación separada con acceso real al modelo. No describir mocks como prueba de permisos, disponibilidad o facturación.

## Licencias de la distribución

El código de la aplicación conserva MIT; el build también entrega componentes con otras licencias. Antes de publicar un binario o un sitio que sirva el núcleo FFmpeg, revisar las obligaciones de su versión concreta, la disponibilidad del código fuente correspondiente y las instrucciones de compilación. Los enlaces y textos de licencia de los avisos no son una certificación automática de cumplimiento. Conservar los avisos en cualquier paquete o despliegue publicado.

Consulta [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), el texto de licencia incluido y las fuentes oficiales indicadas allí. No elimines la atribución original al renombrar el fork.

## GitHub

1. Revisar y habilitar Issues y reportes privados de vulnerabilidades si se van a usar.
2. Comprobar las plantillas de incidencias y PR, y que exista un canal privado acordado para reportes sensibles.
3. Configurar protección de ramas y comprobaciones de CI según la política del mantenedor. Este repositorio documenta comandos; no presupone que esos controles estén habilitados.
4. Si el repositorio es privado y se va a publicar, cambiar la visibilidad solo después de la revisión del contenido e historial.
5. Completar la descripción con el propósito real y enlazar una demo solo si existe y se mantiene. No añadir badges de pruebas que no estén conectados a una ejecución real.

## Crear una release

El archivo `CHANGELOG.md` separa cambios pendientes del historial heredado. No cambies fechas ni atribuyas cambios del fork a releases antiguas.

Cuando se decida publicar una versión numerada, actualizar la versión y el lockfile, mover los cambios pertinentes de Unreleased a esa versión, ejecutar las comprobaciones y crear un tag desde el commit verificado. Publicar notas con cambios, compatibilidad de datos, validación y límites conocidos. `private: true` en `package.json` puede mantenerse: esta aplicación se distribuye desde el repositorio y su build, no necesita publicarse en npm.

No se han creado tags ni releases por seguir o añadir esta documentación.

## Después de desplegar

Comprobar la carga de los archivos, los encabezados de aislamiento, la persistencia en el dominio final y una exportación pequeña. No presentar un cambio de dominio como migración automática de datos: el almacenamiento pertenece al origen anterior. Descargar los medios antes de retirar un despliegue que se esté utilizando.

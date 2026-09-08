import { ArrowUp, LoaderCircle, X } from "lucide-react";
import type { WorkspaceController } from "../lib/useWorkspace";
import { StudioDialog } from "./StudioDialog";
export function QueueActivity({
  workspace: w,
  onClose,
  openProject,
}: {
  workspace: WorkspaceController;
  onClose: () => void;
  openProject: (id: string) => void;
}) {
  const active = w.scenes.find((s) => s.id === w.job?.sceneId);
  const recoverable = w.scenes.filter(
    (s) =>
      s.task?.remoteId &&
      s.id !== active?.id &&
      !w.queue.some((q) => q.sceneId === s.id && q.resume),
  );
  return (
    <StudioDialog title="Actividad" onClose={onClose}>
      <p className="hint">
        Seguimos creando tus clips automáticamente, uno tras otro. Puedes cerrar
        este panel y seguir trabajando.
      </p>
      {w.job && (
        <div className="activity-current" role="status">
          <LoaderCircle size={18} className="spin" />
          <div>
            <strong>{active?.title || "Clip en curso"}</strong>
            <p>{w.job.text}</p>
            <small>Esta solicitud ya se envió a Google.</small>
          </div>
        </div>
      )}
      {!w.job && !!w.queue.length && (
        <div className="activity-current">
          <div>
            <strong>Creación pausada</strong>
            <p>Lo pendiente está guardado. Continúa cuando estés listo.</p>
          </div>
          <button className="button" onClick={w.continueQueue}>
            Continuar
          </button>
        </div>
      )}
      <h3>
        {w.queue.length
          ? `A continuación · ${w.queue.length}`
          : w.job
            ? "No hay más clips esperando"
            : recoverable.length
              ? "No hay solicitudes pendientes de envío"
              : "Todo al día"}
      </h3>
      <ol className="activity-list">
        {w.queue.map((item, index) => {
          const scene = w.scenes.find((s) => s.id === item.sceneId);
          const batch = w.queue.filter(
            (q) => q.batchId && q.batchId === item.batchId,
          );
          const first =
            item.batchId &&
            w.queue.findIndex((q) => q.batchId === item.batchId) === index;
          return (
            <li key={item.id}>
              <span className="activity-number">{index + 1}</span>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    if (scene) {
                      onClose();
                      openProject(scene.project_id);
                    }
                  }}
                >
                  {scene?.title || "Clip"}
                </button>
                <small>
                  {w.projects.find((p) => p.id === scene?.project_id)?.name}
                </small>
                {first && batch.length > 1 && (
                  <button
                    className="text-button cancel-batch"
                    onClick={() =>
                      void w.cancelRequests(batch.map((q) => q.id))
                    }
                  >
                    Cancelar tanda · {batch.length} pendientes
                  </button>
                )}
              </div>
              <button
                className="icon-button"
                aria-label={`Generar antes: ${scene?.title}`}
                title="Generar después del clip en curso"
                disabled={index === 0}
                onClick={() => void w.prioritize(item.id)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={`Cancelar solicitud: ${scene?.title}`}
                onClick={() => void w.cancelRequests([item.id])}
              >
                <X size={17} />
              </button>
            </li>
          );
        })}
      </ol>
      {!!recoverable.length && (
        <section>
          <h3>Resultados por recuperar</h3>
          <p className="hint">
            Google ya recibió estos clips. Recuperar consulta su estado sin
            generar otro vídeo.
          </p>
          <ul className="activity-list">
            {recoverable.map((scene) => (
              <li key={scene.id}>
                <div>{scene.title}</div>
                <button
                  className="button compact"
                  disabled={!!w.job}
                  onClick={() =>
                    void w.run([scene.id], "generate", undefined, true)
                  }
                >
                  Recuperar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {w.notice?.error && (
        <p className="inline-error" role="alert">
          {w.notice.text}
        </p>
      )}
      {!!w.queue.length && (
        <p className="hint">
          Adelantar un clip cambia su turno. Cancelar pendientes no afecta al
          vídeo que ya está generándose.
        </p>
      )}
    </StudioDialog>
  );
}

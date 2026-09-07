import { useState } from "react";
import {
  ArrowRight,
  Plus,
  Search,
  ChevronRight,
  Clapperboard,
  Clock3,
} from "lucide-react";
import { templates } from "../lib/templates";
import type { WorkspaceController } from "../lib/useWorkspace";
import { sceneBlob } from "../types";
import { Clip, Empty } from "./common";

export function Home({
  workspace: w,
  create,
  open,
}: {
  workspace: WorkspaceController;
  create: (templateId?: string) => void;
  open: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const projects = w.projects.filter((p) =>
    p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="page home-page">
      <div className="home-intro">
        <div>
          <span className="kicker">Tu espacio creativo</span>
          <h1>
            De una idea
            <br />a la próxima historia.
          </h1>
          <p>
            Planea tus escenas, encuentra la toma
            <br className="desktop-break" /> y crea algo que merezca otro
            vistazo.
          </p>
          <button className="button primary" onClick={() => create()}>
            <Plus size={17} />
            Nuevo proyecto
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="workflow-note" aria-label="Flujo de creación">
          <span className="workflow-caption">
            Una buena historia empieza con un plan.
          </span>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Encuentra el gancho</strong>
                <small>La primera escena cuenta.</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Dale forma a la idea</strong>
                <small>Una toma, una intención.</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Hazlo tuyo</strong>
                <small>Prueba, compara y afina.</small>
              </div>
            </li>
          </ol>
          <span className="subtle">Omni 1.1 Flash + tu clave de Google</span>
        </div>
      </div>
      <section className="template-section">
        <div className="section-heading">
          <h2>Empieza con una estructura</h2>
          <span>Plantillas de prompts · editables</span>
        </div>
        <div className="template-list">
          {templates.map((template, index) => (
            <button
              key={template.id}
              className="template"
              onClick={() => create(template.id)}
            >
              <div className={`template-mark mark-${index}`} aria-hidden="true">
                {index === 0 ? (
                  <>
                    <i />
                    <i />
                    <i />
                  </>
                ) : index === 1 ? (
                  <span />
                ) : (
                  <b>↺</b>
                )}
              </div>
              <div>
                <small>{template.label}</small>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
              </div>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading projects-heading">
          <h2>
            Tus proyectos <span className="count">{w.projects.length}</span>
          </h2>
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Buscar proyectos"
              aria-label="Buscar proyectos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {projects.length ? (
          <div className="project-list">
            {projects.map((project) => {
              const scenes = w.scenes.filter(
                  (s) => s.project_id === project.id,
                ),
                ready = scenes.filter((s) => sceneBlob(s));
              const first = scenes[0],
                poster = w.assets.find(
                  (a) => a.id === first?.first_frame_asset_id,
                )?.data_url;
              return (
                <button
                  className="project-row"
                  key={project.id}
                  onClick={() => open(project.id)}
                >
                  <Clip
                    blob={first ? sceneBlob(first) : undefined}
                    poster={poster}
                    controls={false}
                  />
                  <div className="project-name">
                    <strong>{project.name}</strong>
                    <small>
                      <Clapperboard size={13} />
                      {scenes.length} escenas<span>·</span>
                      {ready.length} listas
                    </small>
                  </div>
                  <span className="project-date">
                    <Clock3 size={13} />
                    {new Intl.DateTimeFormat("es", {
                      day: "numeric",
                      month: "short",
                    }).format(
                      new Date(project.updated_at || project.created_at),
                    )}
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        ) : (
          <Empty
            title={
              search ? "No hay coincidencias" : "Aquí vivirán tus historias"
            }
          >
            {search
              ? "Prueba con otro nombre de proyecto."
              : "Crea un proyecto en blanco o elige una estructura para empezar."}
          </Empty>
        )}
      </section>
    </div>
  );
}

import { useState } from "react";
import { Plus, Search, ChevronRight, Clapperboard, Clock3 } from "lucide-react";
import type { WorkspaceController } from "../lib/useWorkspace";
import { sceneBlob } from "../types";
import { Clip, Empty } from "./common";

export function Home({
  workspace: w,
  create,
  open,
}: {
  workspace: WorkspaceController;
  create: () => void;
  open: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const projects = w.projects.filter((p) =>
    p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="page home-page">
      <header className="projects-header">
        <div>
          <h1>Proyectos</h1>
          <p>Crea y edita vídeos con tus propias escenas y referencias.</p>
        </div>
        <button className="button primary" onClick={create}>
          <Plus size={17} />
          Nuevo proyecto
        </button>
      </header>
      <section>
        <div className="section-heading projects-heading">
          <h2>
            Guardados <span className="count">{w.projects.length}</span>
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
            title={search ? "No hay coincidencias" : "Todavía no hay proyectos"}
          >
            {search
              ? "Prueba con otro nombre de proyecto."
              : "Crea un proyecto para empezar a añadir escenas."}
          </Empty>
        )}
      </section>
    </div>
  );
}

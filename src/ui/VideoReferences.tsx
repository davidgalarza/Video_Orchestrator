import { useState } from "react";
import { ChevronDown, ImagePlus, Plus, X } from "lucide-react";
import { OMNI_MODEL, type Asset, type Scene } from "../types";
import { ReferencePicker, type ReferenceRole } from "./ReferencePicker";
export function VideoReferences({
  scene,
  assets,
  disabled,
  onChange,
  onRefresh,
}: {
  scene: Scene;
  assets: Asset[];
  disabled: boolean;
  onChange: (patch: Partial<Scene>) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
}) {
  const [role, setRole] = useState<ReferenceRole>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const referenceIds = scene.reference_asset_ids || [];
  const change = async (patch: Partial<Scene>) => {
    setSaving(true);
    setError("");
    try {
      await onChange(patch);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la referencia.",
      );
      throw e;
    } finally {
      setSaving(false);
    }
  };
  const selected =
    role === "reference"
      ? referenceIds
      : [
          role === "first"
            ? scene.first_frame_asset_id
            : scene.last_frame_asset_id,
        ].filter((id): id is string => !!id);
  return (
    <details
      className="reference-details"
      open={
        !!(
          scene.first_frame_asset_id ||
          scene.last_frame_asset_id ||
          referenceIds.length
        )
      }
    >
      <summary>
        <ImagePlus size={16} />
        <span>
          Referencias visuales
          <small>Opcionales · inicio, final y guías visuales</small>
        </span>
        <ChevronDown size={14} />
      </summary>
      <div className="video-references">
        <h3>Cómo empieza y termina</h3>
        <p>
          Elige una imagen para definir el primer fotograma. Añade otra si
          quieres guiar también el final.
        </p>
        <div className="reference-frames">
          {(["first", "last"] as const).map((frame) => {
            const id =
              frame === "first"
                ? scene.first_frame_asset_id
                : scene.last_frame_asset_id;
            const asset = assets.find((a) => a.id === id);
            const label =
              frame === "first" ? "Fotograma inicial" : "Fotograma final";
            return (
              <div className="reference-frame" key={frame}>
                <button
                  className="reference-frame-select"
                  aria-label={`Elegir ${label.toLowerCase()}`}
                  disabled={
                    disabled ||
                    saving ||
                    (frame === "last" && !scene.first_frame_asset_id)
                  }
                  onClick={() => setRole(frame)}
                >
                  {asset ? (
                    <img src={asset.data_url} alt={asset.file_name} />
                  ) : (
                    <span className="reference-frame-empty">
                      <ImagePlus size={23} />
                    </span>
                  )}
                  <strong>{label}</strong>
                  <small>
                    {asset
                      ? asset.file_name
                      : frame === "last" && !scene.first_frame_asset_id
                        ? "Añade primero el inicial"
                        : "Elegir o subir imagen"}
                  </small>
                </button>
                {asset && (
                  <button
                    className="icon-button reference-remove"
                    aria-label={`Quitar ${label.toLowerCase()}`}
                    title={
                      frame === "first" && scene.last_frame_asset_id
                        ? "También se quitará el fotograma final"
                        : undefined
                    }
                    disabled={disabled || saving}
                    onClick={() => {
                      void change(
                        frame === "first"
                          ? {
                              first_frame_asset_id: undefined,
                              last_frame_asset_id: undefined,
                            }
                          : { last_frame_asset_id: undefined },
                      ).catch(() => {});
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {(scene.settings?.model || OMNI_MODEL) === OMNI_MODEL && (
          <section className="reference-guides">
            <header>
              <h3>Personajes, objetos y estilo</h3>
              <span>{referenceIds.length}/3</span>
            </header>
            <p>
              Guías para el aspecto del vídeo; no fijan un fotograma. Explica en
              el prompt qué debe aportar cada imagen.
            </p>
            <div className="reference-guide-list">
              {referenceIds.map((id) => {
                const asset = assets.find((a) => a.id === id);
                return asset ? (
                  <div key={id}>
                    <button
                      className="reference-guide-open"
                      aria-label={`Cambiar referencia ${asset.file_name}`}
                      disabled={disabled || saving}
                      onClick={() => setRole("reference")}
                    >
                      <img src={asset.data_url} alt="" />
                      <span>{asset.file_name}</span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Quitar referencia ${asset.file_name}`}
                      disabled={disabled || saving}
                      onClick={() => {
                        void change({
                          reference_asset_ids: referenceIds.filter(
                            (item) => item !== id,
                          ),
                        }).catch(() => {});
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null;
              })}
            </div>
            <button
              className="button full"
              disabled={disabled || saving}
              onClick={() => setRole("reference")}
            >
              <Plus size={15} />
              {referenceIds.length
                ? "Cambiar referencias"
                : "Elegir referencias"}
            </button>
          </section>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {role && (
        <ReferencePicker
          key={role}
          role={role}
          assets={assets}
          selectedIds={selected}
          onRefresh={onRefresh}
          onClose={() => setRole(undefined)}
          onApply={(ids) =>
            change(
              role === "first"
                ? {
                    first_frame_asset_id: ids[0],
                    ...(!ids[0] ? { last_frame_asset_id: undefined } : {}),
                  }
                : role === "last"
                  ? { last_frame_asset_id: ids[0] }
                  : { reference_asset_ids: ids },
            )
          }
        />
      )}
    </details>
  );
}

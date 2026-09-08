import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function StudioDialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const label = useId();
  useEffect(() => {
    const element = ref.current!;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (focus?.isConnected) focus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`studio-dialog ${wide ? "is-wide" : ""}`}
      aria-labelledby={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={label}>{title}</h2>
        <button
          className="icon-button"
          aria-label={`Cerrar ${title.toLocaleLowerCase()}`}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="studio-dialog-content">{children}</div>
    </dialog>
  );
}

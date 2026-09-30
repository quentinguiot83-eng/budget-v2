import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ChevronRight } from "lucide-react";
export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  options?: [string, string][];
  hint?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
};
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="sheet">
        <header>
          <h2>{title}</h2>
          <button className="icon" aria-label="Fermer" onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Form({
  fields,
  submit,
  label = "Enregistrer",
}: {
  fields: Field[];
  submit: (v: Record<string, string>) => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const v = Object.fromEntries(
          new FormData(e.currentTarget).entries(),
        ) as Record<string, string>;
        setBusy(true);
        setError("");
        try {
          await submit(v);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Impossible d’enregistrer. Réessayez.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {fields.map((f) => (
          <label key={f.name} className="field">
            <span>{f.label}</span>
            {f.options ? (
              <select
                name={f.name}
                defaultValue={f.value ?? ""}
                required={f.required !== false}
              >
                {f.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.name}
                type={f.type || "text"}
                defaultValue={f.value ?? ""}
                required={f.required !== false}
                min={f.min}
                max={f.max}
                step={f.step ?? (f.type === "number" ? "0.01" : undefined)}
                autoComplete={
                  f.type === "password" ? "current-password" : undefined
                }
              />
            )}{" "}
            {f.hint && <small>{f.hint}</small>}
          </label>
        ))}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide" type="submit">
          {busy ? "Enregistrement…" : label}
        </button>
      </fieldset>
    </form>
  );
}
export function Progress({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const ratio = max > 0 ? (value / max) * 100 : value > 0 ? 100 : 0;
  return (
    <div
      className={"progress " + (value > max ? "over" : "")}
      role="progressbar"
      aria-valuenow={Math.round(ratio)}
      aria-label={`${Math.round(ratio)} % du budget consommé`}
    >
      <span
        style={{
          width: Math.max(0, Math.min(100, ratio)) + "%",
          background: color,
        }}
      />
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">＋</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Row({
  icon,
  title,
  sub,
  value,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  sub?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="row-icon">{icon}</span>
      <span className="row-label">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </span>
      <span className="row-value">{value}</span>
      {onClick && <ChevronRight size={16} />}
    </>
  );
  return onClick ? (
    <button className="row" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="row">{content}</div>
  );
}

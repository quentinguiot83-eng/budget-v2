import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { CategoryGlyph } from "./CategoryGlyph";
import { X, ChevronRight, Info } from "lucide-react";
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
  showWhen?:
    | {
        field: string;
        values?: string[];
        nonZero?: boolean;
      }
    | {
        any: {
          field: string;
          values?: string[];
          nonZero?: boolean;
        }[];
      };
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
export function BlockInfo({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="block-info" aria-label={`Informations : ${title}`} title={`Informations : ${title}`} onClick={() => setOpen(true)}><Info size={17} /></button>
    {open && <Modal title={title} close={() => setOpen(false)}><div className="block-info-content">{children}</div></Modal>}
  </>;
}

export function Form({
  fields,
  submit,
  label = "Enregistrer",
  extra,
  assist,
  onFieldChange,
}: {
  fields: Field[];
  submit: (v: Record<string, string>) => Promise<void>;
  label?: string;
  extra?: ReactNode;
  assist?: (values: Record<string, string>, apply: (patch: Record<string, string>) => void) => ReactNode;
  onFieldChange?: (name: string, value: string, values: Record<string, string>) => Record<string, string> | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [values, setValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        fields.map((f) => [
          f.name,
          String(f.value ?? ""),
        ]),
      ),
  );

  const patchValues = (patch: Record<string, string>) =>
    setValues(current => ({ ...current, ...patch }));

  const updateValue = (name: string, value: string) => {
    const inferred = onFieldChange?.(name, value, values) ?? {};
    setValues(current => ({ ...current, [name]: value, ...inferred }));
  };

  const matchesVisibility = (
    rule: {
      field: string;
      values?: string[];
      nonZero?: boolean;
    },
  ) => {
    const value =
      values[rule.field] ?? "";

    if (rule.nonZero) {
      const n = Number(
        value.replace(",", "."),
      );

      return (
        Number.isFinite(n) &&
        n > 0
      );
    }

    if (rule.values)
      return rule.values.includes(
        value,
      );

    return true;
  };

  const visibleFields =
    fields.filter((f) => {
      if (!f.showWhen)
        return true;

      if ("any" in f.showWhen)
        return f.showWhen.any.some(
          matchesVisibility,
        );

      return matchesVisibility(
        f.showWhen,
      );
    });

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
        {visibleFields.map((f) => <Fragment key={f.name}>
          {f.type === "emoji" && f.options ? (
          <div className="field">
            <span>{f.label}</span>
            <input type="hidden" name={f.name} value={values[f.name]} />
            <div className="emoji-picker" role="group" aria-label={f.label}>
              {f.options.map(([value, label]) => <button key={value} type="button"
                aria-label={label} aria-pressed={values[f.name] === value}
                onClick={() => setValues(current => ({ ...current, [f.name]: value }))}>
                <span className="emoji-picker-glyph" aria-hidden="true"><CategoryGlyph icon={value} size={22} /></span>
              </button>)}
            </div>
            {f.hint && <small>{f.hint}</small>}
          </div>
        ) : (
          <label className="field">
            <span>{f.label}</span>
            {f.options ? (
              <select
                name={f.name}
                value={values[f.name] ?? ""}
                required={f.required !== false}
                onChange={e => updateValue(f.name, e.target.value)}
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
                value={values[f.name] ?? ""}
                required={f.required !== false}
                min={f.min}
                max={f.max}
                step={f.step ?? (f.type === "number" ? "0.01" : undefined)}
                autoComplete={
                  f.type === "password"
                    ? "current-password"
                    : undefined
                }
                onChange={e => updateValue(f.name, e.target.value)}
              />
            )}{" "}
            {f.hint && <small>{f.hint}</small>}
          </label>
        )}
          {f.name === "description" && assist?.(values, patchValues)}
        </Fragment>)}
        {extra}
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
  const clamped = Math.max(0, Math.min(100, ratio));
  // La même couleur s'assombrit progressivement en fonction du remplissage.
  // Les couleurs spécifiques (ex. catégories de voyage) conservent leur teinte.
  const base = color || "var(--chart)";
  const light = `color-mix(in srgb, ${base} 52%, white)`;
  const dark = `color-mix(in srgb, ${base} 74%, #183439)`;
  const fill = `color-mix(in srgb, ${light} ${100 - clamped}%, ${dark} ${clamped}%)`;
  return (
    <div
      className={"progress " + (value > max ? "over" : "")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={`${Math.round(ratio)} % du budget consommé`}
    >
      <span
        style={{
          width: clamped + "%",
          background: value > max ? "#cf8a91" : fill,
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

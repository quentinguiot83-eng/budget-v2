import { CalendarDays, Clock3 } from "lucide-react";
import "./pro-date-time-input.css";

type DateTimeKind = "date" | "time" | "datetime-local";
type InputChange = { target: { value: string } };

type ProDateTimeInputProps = {
  type: DateTimeKind;
  value?: string | null;
  onChange: (event: InputChange) => void;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
};

function displayValue(type: DateTimeKind, value: string) {
  if (!value) return type === "time" ? "Choisir une heure" : "Choisir une date";
  if (type === "time") return value.slice(0, 5);
  const datePart = value.slice(0, 10);
  const date = new Date(datePart + "T12:00:00");
  const formatted = Number.isNaN(date.getTime())
    ? datePart
    : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
  return type === "datetime-local" ? formatted + " · " + value.slice(11, 16) : formatted;
}

/**
 * Keep the native iOS picker accessible, but avoid the intrinsic sizing of
 * Safari's date/time controls (which overflows compact modal forms).
 */
export default function ProDateTimeInput({
  type, value, onChange, required, min, max, disabled,
}: ProDateTimeInputProps) {
  const current = value ?? "";
  return (
    <span className={"pro-date-time-control" + (!current ? " is-empty" : "")}>
      <span className="pro-date-time-value" aria-hidden="true">{displayValue(type, current)}</span>
      {type === "time" ? <Clock3 aria-hidden="true" size={17}/> : <CalendarDays aria-hidden="true" size={17}/>}
      <input
        type={type}
        lang="fr"
        value={current}
        required={required}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={type === "time" ? "Choisir une heure" : "Choisir une date"}
        onChange={event => onChange({ target: { value: event.currentTarget.value } })}
      />
    </span>
  );
}

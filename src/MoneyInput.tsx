import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

// A zero balance starts as an empty field. Keep the raw keystrokes (0, 0., 0.5)
// while synchronizing the integer cents used in calculations.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value: number;
  onChange: (cents: number) => void;
};
const formatAmount = (cents: number) => cents === 0 ? "" : (cents / 100).toFixed(2);

export default function MoneyInput({ value, onChange, ...props }: Props) {
  const [raw, setRaw] = useState(() => formatAmount(value));
  const lastEmitted = useRef<number | null>(null);
  useEffect(() => {
    if (value !== lastEmitted.current) setRaw(formatAmount(value));
  }, [value]);
  return <input {...props} type="number" value={raw} onChange={event => {
    const next = event.target.value;
    const cents = Math.round((Number(next.replace(",", ".")) || 0) * 100);
    setRaw(next);
    lastEmitted.current = cents;
    onChange(cents);
  }}/>;
}

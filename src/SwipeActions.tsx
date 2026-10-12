import { useRef, useState, type PointerEvent, type CSSProperties, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export type SwipeAction = {
  label: string;
  onClick: () => void;
  tone?: "danger" | "normal";
  icon?: ReactNode;
};

type Props = {
  children: ReactNode;
  actions: SwipeAction[];
  className?: string;
  label: string;
};

export default function SwipeActions({ children, actions, className = "", label }: Props) {
  const [opened, setOpened] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const justSwiped = useRef(false);
  if (!actions.length) return <>{children}</>;

  function pointerStart(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest(".swipe-actions-rail")) return;
    start.current = { x: event.clientX, y: event.clientY };
    justSwiped.current = false;
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    start.current = null;
    if (!origin || event.pointerType === "mouse") return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setOpened(dx < 0);
      justSwiped.current = true;
    }
  }

  const run = (action: SwipeAction) => {
    setOpened(false);
    action.onClick();
  };

  return (
    <div className={`swipe-actions${opened ? " is-open" : ""} ${className}`}
      style={{ "--swipe-distance": `${actions.length * 80}px` } as CSSProperties}
      onPointerDown={pointerStart} onPointerUp={pointerEnd}
      onPointerCancel={() => { start.current = null; }}
      onClickCapture={event => {
        if (justSwiped.current) {
          justSwiped.current = false;
          event.preventDefault();
          event.stopPropagation();
        } else if (opened && !(event.target as HTMLElement).closest(".swipe-actions-rail")) {
          setOpened(false);
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="swipe-actions-rail" aria-label={"Actions pour " + label}>
        {actions.map(action => (
          <button key={action.label} type="button"
            className={action.tone === "danger" ? "swipe-action danger-action" : "swipe-action"}
            onClick={() => run(action)} aria-label={action.label + " : " + label}>
            {action.icon}<span>{action.label}</span>
          </button>
        ))}
      </div>
      <div className="swipe-actions-content">{children}</div>
      <details className="swipe-actions-desktop-menu">
        <summary aria-label={"Actions pour " + label} title={"Actions pour " + label}>
          <MoreHorizontal size={19}/>
        </summary>
        <div className="swipe-actions-desktop-options">
          {actions.map(action => (
            <button key={action.label} type="button"
              className={action.tone === "danger" ? "danger-action" : ""}
              onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); run(action); }}>
              {action.icon}{action.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

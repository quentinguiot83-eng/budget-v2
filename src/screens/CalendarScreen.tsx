import { monthLabel, dues, month, today } from "../engine";
import type { WimmView } from "../app/buildView";

export default function CalendarScreen({ view }: { view: WimmView }) {
  const {
    alerts, dueList, explain, s, selectedMonth,
  } = view;
  return (
    <div className="ws-stack wimm-calendar">
      <section className="ws-card">
        <div className="ws-head">
          <h2 className="ws-card-title">À valider</h2>
          <span className="ws-muted">{alerts.length}</span>
        </div>
        {alerts.length ? (
          dueList(alerts)
        ) : (
          <p className="ws-muted">Tu es à jour : aucun paiement en attente de validation.</p>
        )}
      </section>
      <section className="ws-card ws-calendar">
        <div className="calendar-grid">
          {["L", "M", "M", "J", "V", "S", "D"].map((n, i) => (
            <span className="day-name" key={"n" + i}>
              {n}
            </span>
          ))}
          {Array.from(
            {
              length:
                (new Date(selectedMonth + "-01T12:00:00").getDay() +
                  6) %
                7,
            },
            (_, i) => (
              <div key={"empty" + i} />
            ),
          )}
          {Array.from(
            {
              length: new Date(
                Number(selectedMonth.slice(0, 4)),
                Number(selectedMonth.slice(5)),
                0,
              ).getDate(),
            },
            (_, i) => {
              const ds = dues(s, selectedMonth).filter(
                (d) => Number(d.date.slice(8)) === i + 1,
              );
              const dayIsToday = selectedMonth === month() && i + 1 === Number(today().slice(8));
              return (
                <button
                  key={i}
                  className={"day " + (ds.length ? "has-due " : "") + (dayIsToday ? "today" : "")}
                  aria-current={dayIsToday ? "date" : undefined}
                  aria-label={dayIsToday ? "Aujourd’hui, " + (i + 1) + " " + monthLabel(selectedMonth) : undefined}
                  onClick={() =>
                    ds.length &&
                    explain("Paiements du " + (i + 1), dueList(ds))
                  }
                >
                  <strong>{i + 1}</strong>
                  {ds.length > 0 && (
                    <small>
                      {ds.length}
                    </small>
                  )}
                </button>
              );
            },
          )}
        </div>
      </section>
      <section className="ws-card">
        <h2 className="ws-card-title">Échéances de {monthLabel(selectedMonth)}</h2>
        <div>{dueList(dues(s, selectedMonth))}</div>
      </section>
    </div>
  );
}

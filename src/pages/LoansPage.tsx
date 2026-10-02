import { Row } from "../ui";

import {
  type State,
  type Rule,
  today,
  addMonths,
  money,
  dateLabel,
  loanRemaining,
} from "../engine";

type LoansPageProps = {
  state: State;

  editRule: (
    rule?: Rule,
    kind?: Rule["kind"],
  ) => void;

  newLoan: () => void;

  repay: (
    id: string,
  ) => void;
};

export default function LoansPage({
  state,
  editRule,
  newLoan,
  repay,
}: LoansPageProps) {

  return (
    <>
      <div className="toolbar">

        <button
          className="primary"
          onClick={() =>
            editRule(
              undefined,
              "credit",
            )
          }
        >
          Achat en plusieurs fois
        </button>

        <button
          className="secondary"
          onClick={newLoan}
        >
          Prêter de l’argent
        </button>

      </div>


      <section className="card">

        <h2>
          Mensualités de crédits
        </h2>

        {state.rules
          .filter(
            (r) =>
              r.kind ===
                "credit" &&
              (
                !r.end ||
                r.end >= today()
              ),
          )
          .map((r) => {

            let remaining = 0;
            let count = 0;

            for (
              let i = 0;
              i <
              (r.count || 0);
              i++
            ) {

              const date =
                addMonths(
                  r.start,
                  i *
                    r.interval,
                );

              const key =
                r.id +
                ":" +
                date;

              if (
                (
                  !r.end ||
                  date <= r.end
                ) &&
                !state.transactions.some(
                  (t) =>
                    t.dueKey ===
                    key,
                ) &&
                !state.cancelled.includes(
                  key,
                )
              ) {

                remaining +=
                  r.amount;

                count++;

              }

            }

            return (
              <div
                className="rule-row"
                key={r.id}
              >

                <div className="grow">

                  <strong>
                    {r.name}
                  </strong>

                  <small>
                    {money(
                      r.amount,
                    )}{" "}
                    par mensualité ·{" "}
                    {count} restantes
                  </small>

                  <small>
                    Restant prévu :{" "}
                    {money(
                      remaining,
                    )}
                  </small>

                </div>

                <button
                  className="secondary compact"
                  onClick={() =>
                    editRule(
                      r,
                      "credit",
                    )
                  }
                >
                  Modifier
                </button>

              </div>
            );

          })}

        <p className="footnote">
          Ces achats ne débitent le
          compte qu’à validation des
          mensualités. Les alertes
          apparaissent dans le
          calendrier.
        </p>

      </section>


      <section className="card">

        <h2>
          Argent prêté
        </h2>

        {state.loans.map(
          (loan) => {

            const remaining =
              loanRemaining(
                state,
                loan.id,
              );

            return (
              <Row
                key={loan.id}
                title={loan.name}
                sub={
                  `Prêt initial ${money(
                    loan.amount,
                  )} · ${dateLabel(
                    loan.date,
                  )}`
                }
                value={
                  <>
                    <strong>
                      {money(
                        remaining,
                      )}
                    </strong>

                    <small>
                      à récupérer
                    </small>

                    {remaining >
                      0 && (
                      <button
                        className="text"
                        onClick={() =>
                          repay(
                            loan.id,
                          )
                        }
                      >
                        Remboursement reçu
                      </button>
                    )}
                  </>
                }
              />
            );

          },
        )}

        {!state.loans.length && (
          <p className="muted">
            Aucun prêt en cours.
          </p>
        )}

      </section>
    </>
  );

}

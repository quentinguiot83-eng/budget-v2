import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Users,
  ChevronRight,
  Plane,
  FileSpreadsheet,
} from "lucide-react";
import type { ReactNode } from "react";

import { Row, BlockInfo } from "../ui";
import type { Trip } from "../engine";

type AddPageProps = {
  trips: Trip[];
  navigate: (route: string) => void;
  operation: (
    type?: "expense" | "income",
    trip?: Trip,
  ) => void;
  transfer: () => void;
  newLoan: () => void;
  quickEntry: ReactNode;
  bankReconciliation: () => void;
};

export default function AddPage({
  trips,
  navigate,
  operation,
  transfer,
  newLoan,
  quickEntry,
  bankReconciliation,
}: AddPageProps) {
  return (
    <div className="add-page-layout">
      <div className="section-head">
        <div className="block-title"><h2>Que souhaitez-vous enregistrer ?</h2><BlockInfo title="Enregistrer une opération"><p>Pour une charge déjà planifiée, utilisez « Valider » dans le calendrier afin d’éviter un doublon.</p></BlockInfo></div>

        <button
          className="text"
          onClick={() =>
            navigate("loans")
          }
        >
          Voir mes crédits et prêts
        </button>
      </div>

      {quickEntry}
      <div className="add-grid">
        {[
          {
            title: "Une dépense",
            desc:
              "Ponctuelle, fixe ou en plusieurs fois",
            icon: <ArrowUpRight />,
            fn: () => operation(),
          },
          {
            title: "Un revenu",
            desc:
              "Salaire, prime, vente ou remboursement",
            icon: <ArrowDownLeft />,
            fn: () =>
              operation("income"),
          },
          {
            title: "Un virement",
            desc:
              "Déplacer de l’argent entre vos comptes",
            icon: <ArrowLeftRight />,
            fn: transfer,
          },
          {
            title:
              "Un prêt d’argent",
            desc:
              "Suivre l’argent prêté et récupéré",
            icon: <Users />,
            fn: newLoan,
          },
        ].map((item) => (
          <button
            className="add-card"
            key={item.title}
            onClick={item.fn}
          >
            <span>
              {item.icon}
            </span>

            <h3>
              {item.title}
            </h3>

            <p>
              {item.desc}
            </p>

            <ChevronRight
              className="add-arrow"
              size={18}
            />
          </button>
        ))}
      </div>

      {trips.some(
        (t) => !t.closedAt,
      ) && (
        <section className="card">
          <h2>
            Une dépense de voyage
          </h2>

          {trips
            .filter(
              (t) =>
                !t.closedAt,
            )
            .map((t) => (
              <Row
                key={t.id}
                icon={<Plane />}
                title={t.name}
                sub="Compte courant et budget voyage uniquement"
                onClick={() =>
                  operation(
                    "expense",
                    t,
                  )
                }
              />
            ))}
        </section>
      )}
      <section className="card">
        <div className="section-head"><div className="block-title"><h2><FileSpreadsheet size={18}/> Rapprochement bancaire</h2></div></div>
        <p className="muted">Importer un relevé CSV pour retrouver les opérations manquantes, sans doublons ni connexion à votre banque.</p>
        <button className="secondary" type="button" onClick={bankReconciliation}>Comparer un relevé CSV <ChevronRight size={16}/></button>
      </section>
    </div>
  );
}

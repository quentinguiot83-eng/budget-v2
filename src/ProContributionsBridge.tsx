import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { api, rpc } from "./api";

type ProProfile = {
  contributionRate: number;
  taxRate: number;
};

type ProTransaction = {
  id: string;
  kind: string;
  label?: string;
  amount: number;
  date: string;
  paid: boolean;
  contributionPeriodKey?: string | null;
  taxPeriodKey?: string | null;
};

type ProData = {
  enabled: boolean;
  profile?: ProProfile;
  transactions?: ProTransaction[];
};

type Period = {
  mode: "month" | "year";
  key: string;
  label: string;
};

type PaymentKind = "contribution" | "tax";

const euro = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const toCents = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);

function detectPeriod(): Period {
  const toolbar = document.querySelector<HTMLElement>(".pro-period-toolbar");
  const month = toolbar?.querySelector<HTMLInputElement>('input[type="month"]');
  if (month?.value) {
    return {
      mode: "month",
      key: month.value,
      label: new Date(`${month.value}-01T12:00:00`).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      }),
    };
  }

  const year = toolbar?.querySelector<HTMLSelectElement>("select")?.value ?? today().slice(0, 4);
  return { mode: "year", key: year, label: `année ${year}` };
}

export default function ProContributionsBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<ProData | null>(null);
  const [period, setPeriod] = useState<Period>(detectPeriod());
  const [openKind, setOpenKind] = useState<PaymentKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const operationFingerprint = useRef("");

  useEffect(() => {
    const syncTarget = () => {
      const card = Array.from(document.querySelectorAll<HTMLElement>(".pro-card")).find(
        (item) => item.querySelector("h2")?.textContent?.trim() === "Réserves estimées",
      );
      setTarget((current) => (current === card ? current : card ?? null));
      setPeriod(detectPeriod());

      const fingerprint = Array.from(document.querySelectorAll<HTMLElement>(".pro-operation"))
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .join("||");
      if (operationFingerprint.current && operationFingerprint.current !== fingerprint) {
        setRefreshVersion((version) => version + 1);
      }
      operationFingerprint.current = fingerprint;
    };

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("change", syncTarget);

    return () => {
      observer.disconnect();
      document.removeEventListener("change", syncTarget);
    };
  }, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;

    async function load() {
      const { data: session } = await api.auth.getSession();
      if (!session.session || cancelled) return;
      try {
        const next = (await rpc("budget_pro_load")) as ProData;
        if (!cancelled) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [target, refreshVersion]);

  const summary = useMemo(() => {
    const transactions = data?.transactions ?? [];
    const matchesPeriod = (tx: ProTransaction) =>
      period.mode === "month"
        ? tx.date.slice(0, 7) === period.key
        : tx.date.slice(0, 4) === period.key;

    const income = transactions
      .filter((tx) => tx.paid && tx.kind === "income" && matchesPeriod(tx))
      .reduce((sum, tx) => sum + tx.amount, 0);

    const contributionEstimated = Math.round(
      income * ((data?.profile?.contributionRate ?? 0) / 100),
    );
    const taxEstimated = Math.round(income * ((data?.profile?.taxRate ?? 0) / 100));

    const contributionPaid = transactions
      .filter((tx) => {
        if (tx.kind !== "contribution_payment") return false;
        const key = tx.contributionPeriodKey ?? tx.date.slice(0, 7);
        return period.mode === "month" ? key === period.key : key.startsWith(period.key);
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const taxPaid = transactions
      .filter((tx) => {
        if (tx.kind !== "tax_payment") return false;
        const key = tx.taxPeriodKey ?? tx.date.slice(0, 7);
        return period.mode === "month" ? key === period.key : key.startsWith(period.key);
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      contribution: {
        estimated: contributionEstimated,
        paid: contributionPaid,
        remaining: Math.max(0, contributionEstimated - contributionPaid),
        overpaid: Math.max(0, contributionPaid - contributionEstimated),
      },
      tax: {
        estimated: taxEstimated,
        paid: taxPaid,
        remaining: Math.max(0, taxEstimated - taxPaid),
        overpaid: Math.max(0, taxPaid - taxEstimated),
      },
    };
  }, [data, period]);

  const payments = useMemo(
    () =>
      (data?.transactions ?? [])
        .filter((tx) => tx.kind === "contribution_payment" || tx.kind === "tax_payment")
        .slice(0, 8),
    [data],
  );

  if (!target || !data?.enabled) return null;

  return createPortal(
    <>
      <PaymentSummary
        title="Suivi des cotisations"
        periodLabel={period.label}
        summary={summary.contribution}
        actionLabel="Marquer comme payées"
        onAction={() => setOpenKind("contribution")}
      />

      <PaymentSummary
        title="Suivi de l’impôt"
        periodLabel={period.label}
        summary={summary.tax}
        actionLabel="Enregistrer un paiement"
        onAction={() => setOpenKind("tax")}
      />

      {error && <div className="pro-error">{error}</div>}

      {payments.length > 0 && (
        <div className="pro-contribution-history pro-tax-history">
          <strong className="pro-payment-history-title">Paiements enregistrés</strong>
          {payments.map((payment) => {
            const isTax = payment.kind === "tax_payment";
            const key = isTax ? payment.taxPeriodKey : payment.contributionPeriodKey;
            return (
              <div key={payment.id}>
                <span>
                  <b>{isTax ? "Impôt" : "Cotisations"}</b> · {new Date(`${payment.date}T12:00:00`).toLocaleDateString("fr-FR")}
                  {key ? ` · période ${key}` : ""}
                </span>
                <strong>{euro(payment.amount)}</strong>
                <button
                  type="button"
                  className="pro-delete"
                  aria-label={`Supprimer ce paiement ${isTax ? "d’impôt" : "de cotisations"}`}
                  disabled={busy}
                  onClick={() => void removePayment(payment.id, isTax ? "tax" : "contribution")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {openKind && (
        <PaymentModal
          kind={openKind}
          estimatedRemaining={openKind === "tax" ? summary.tax.remaining : summary.contribution.remaining}
          defaultPeriod={period.mode === "month" ? period.key : thisMonth()}
          busy={busy}
          close={() => setOpenKind(null)}
          submit={savePayment}
        />
      )}
    </>,
    target,
  );

  async function savePayment(kind: PaymentKind, values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const rpcName =
        kind === "tax" ? "budget_pro_tax_payment_save" : "budget_pro_contribution_payment_save";
      const next = (await rpc(rpcName, { p_payment: values })) as ProData;
      setData(next);
      setOpenKind(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removePayment(id: string, kind: PaymentKind) {
    const label = kind === "tax" ? "ce paiement d’impôt" : "ce paiement de cotisations";
    if (!confirm(`Supprimer ${label} ?`)) return;
    setBusy(true);
    setError("");
    try {
      const next = (await rpc("budget_pro_transaction_delete", { p_id: id })) as ProData;
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
}

function PaymentSummary({
  title,
  periodLabel,
  summary,
  actionLabel,
  onAction,
}: {
  title: string;
  periodLabel: string;
  summary: { estimated: number; paid: number; remaining: number; overpaid: number };
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="pro-contribution-box">
      <div className="pro-contribution-head">
        <div>
          <strong>{title}</strong>
          <small>{periodLabel}</small>
        </div>
        <button className="pro-text-button" type="button" onClick={onAction}>
          <CheckCircle2 size={16} /> {actionLabel}
        </button>
      </div>

      <div className="pro-contribution-values">
        <span>Estimé <strong>{euro(summary.estimated)}</strong></span>
        <span>Déjà payé <strong>{euro(summary.paid)}</strong></span>
        <span>Reste à payer <strong>{euro(summary.remaining)}</strong></span>
      </div>

      {summary.overpaid > 0 && (
        <div className="pro-info">Paiement supérieur à l’estimation de {euro(summary.overpaid)}.</div>
      )}
    </div>
  );
}

function PaymentModal({
  kind,
  estimatedRemaining,
  defaultPeriod,
  busy,
  close,
  submit,
}: {
  kind: PaymentKind;
  estimatedRemaining: number;
  defaultPeriod: string;
  busy: boolean;
  close: () => void;
  submit: (kind: PaymentKind, values: Record<string, unknown>) => Promise<void>;
}) {
  const [amount, setAmount] = useState(
    estimatedRemaining > 0 ? (estimatedRemaining / 100).toFixed(2) : "",
  );
  const [paidDate, setPaidDate] = useState(today());
  const [periodKey, setPeriodKey] = useState(defaultPeriod);
  const [notes, setNotes] = useState("");
  const isTax = kind === "tax";

  return (
    <div className="pro-modal-layer">
      <button type="button" className="pro-modal-backdrop" aria-label="Fermer" onClick={close} />
      <section className="pro-modal">
        <button type="button" className="pro-modal-close" onClick={close} aria-label="Fermer">
          <X size={20} />
        </button>
        <form
          className="pro-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(kind, {
              amount: toCents(amount),
              paidDate,
              periodKey,
              notes,
            });
          }}
        >
          <div>
            <p className="pro-eyebrow">{isTax ? "IMPÔT" : "COTISATIONS"}</p>
            <h2>Enregistrer un paiement</h2>
            <p>
              Le paiement diminuera la trésorerie Pro mais ne sera pas compté comme une dépense professionnelle.
            </p>
          </div>
          <div className="pro-form-two">
            <label>
              Montant payé (€)
              <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label>
              Date du paiement
              <input required type="date" max={today()} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </label>
          </div>
          <label>
            Période concernée
            <input required type="month" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
          </label>
          <label>
            Note facultative
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isTax ? "Ex. Acompte impôt" : "Ex. Déclaration URSSAF"} />
          </label>
          <button className="pro-primary" type="submit" disabled={busy}>
            <Plus size={16} /> Enregistrer le paiement
          </button>
        </form>
      </section>
    </div>
  );
}

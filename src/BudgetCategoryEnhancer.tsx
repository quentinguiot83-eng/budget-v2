import { useEffect } from "react";

function buttonWithText(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => (button.textContent || "").replace(/\s+/g, " ").trim() === label,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForButton(label: string, timeout = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const button = buttonWithText(label);
    if (button) return button;
    await sleep(50);
  }
  return null;
}

async function waitForFilter(timeout = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const select = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Filtrer les transactions"]',
    );
    if (select) return select;
    await sleep(50);
  }
  return null;
}

async function openTransactionsForCategory(categoryName: string) {
  // Si le bouton Transactions n'est pas présent (notamment depuis Accueil),
  // on passe d'abord par Budget. On ne dépend volontairement d'aucun titre
  // ou nom de classe de page.
  let transactionsButton = buttonWithText("Transactions");
  if (!transactionsButton) {
    const budgetButton = buttonWithText("Budget");
    budgetButton?.click();
    transactionsButton = await waitForButton("Transactions");
  }

  if (!transactionsButton) return;
  transactionsButton.click();

  const select = await waitForFilter();
  if (!select) return;

  const option = Array.from(select.options).find(
    (item) => item.textContent?.replace(" (archivée)", "").trim() === categoryName,
  );
  if (!option) return;

  // React écoute l'événement change et met txFilter à jour.
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  setter?.call(select, option.value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function BudgetCategoryEnhancer() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>("article.category");
      if (!card) return;

      // Les boutons Modifier / Archiver / Virement conservent leur action.
      if (target?.closest("button, a, input, select, textarea")) return;

      const categoryName = card.querySelector(".grow strong")?.textContent?.trim();
      if (!categoryName) return;

      void openTransactionsForCategory(categoryName);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

import { useEffect } from "react";

function findButton(root: ParentNode, label: string) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => (button.textContent || "").replace(/\s+/g, " ").trim() === label,
  );
}

function waitFor<T extends Element>(selector: string, timeout = 1800): Promise<T | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<T>(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => {
      const node = document.querySelector<T>(selector);
      if (node || Date.now() - started >= timeout) {
        window.clearInterval(timer);
        resolve(node);
      }
    }, 40);
  });
}

async function openTransactionsForCategory(categoryName: string) {
  const heading = document.querySelector(".page-heading h1")?.textContent?.trim();

  if (heading === "Accueil") {
    const budgetCard = Array.from(document.querySelectorAll<HTMLElement>("section.card")).find(
      (section) => section.querySelector("h2")?.textContent?.trim() === "Budget du mois",
    );
    findButton(budgetCard || document, "Tout voir")?.click();
    await waitFor(".toolbar");
  }

  const transactionsButton = findButton(document, "Transactions");
  if (!transactionsButton) return;
  transactionsButton.click();

  const select = await waitFor<HTMLSelectElement>('select[aria-label="Filtrer les transactions"]');
  if (!select) return;

  const option = Array.from(select.options).find((item) =>
    item.textContent?.replace(" (archivée)", "").trim() === categoryName,
  );
  if (!option) return;

  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function BudgetCategoryEnhancer() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>("article.category");
      if (!card) return;

      // Les actions propres à la carte (modifier, archiver, virement perso…)
      // gardent leur comportement normal.
      if (target?.closest("button, a, input, select, textarea")) return;

      const categoryName = card.querySelector(".grow > strong")?.textContent?.trim();
      if (!categoryName) return;

      const heading = document.querySelector(".page-heading h1")?.textContent?.trim();
      if (heading !== "Accueil" && heading !== "Budget") return;

      void openTransactionsForCategory(categoryName);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

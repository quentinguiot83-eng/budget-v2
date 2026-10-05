import { useEffect } from "react";

function buttonWithText(label: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => (button.textContent || "").replace(/\s+/g, " ").trim() === label,
    ) || null
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function waitForButton(
  label: string,
  timeout = 2000,
): Promise<HTMLButtonElement | null> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const button = buttonWithText(label);
    if (button) return button;
    await sleep(50);
  }
  return null;
}

async function waitForFilter(timeout = 2000): Promise<HTMLSelectElement | null> {
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
  let transactionsButton: HTMLButtonElement | null = buttonWithText("Transactions");

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

  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;

  if (setter) setter.call(select, option.value);
  else select.value = option.value;

  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function BudgetCategoryEnhancer() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>("article.category");
      if (!card) return;

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

"""Parcours d'interactions sur Wimm en mode démonstration.

Usage : python3 tools/visual/smoke.py DOSSIER_DE_SORTIE [URL]

Chaque parcours part d'une page neuve, effectue quelques actions, vérifie
un résultat attendu et enregistre une capture « parcours-<nom>.png »
(comparée ensuite comme les autres captures). Le script échoue si un
parcours n'aboutit pas ou si la page lève une erreur JavaScript.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from capture import FREEZE_MOTION, FROZEN_NOW, click_nav, route_requests, stable_screenshot


def click_button(page, text: str):
    """Clique le premier bouton dont le texte commence ou finit par `text`."""
    found = page.evaluate(
        """(t) => {
            const b = [...document.querySelectorAll("button")]
              .find(x => { const s = x.innerText.trim(); return s.startsWith(t) || s.endsWith(t); });
            if (!b) return false;
            b.scrollIntoView(); b.click(); return true;
        }""",
        text,
    )
    if not found:
        raise AssertionError(f"bouton « {text} » introuvable")
    page.wait_for_timeout(600)


def go(page, label: str):
    if not click_nav(page, label):
        raise AssertionError(f"onglet « {label} » introuvable")
    page.wait_for_timeout(600)


def new_category(page):
    go(page, "Budget")
    click_button(page, "Catégorie")
    page.get_by_label("Nom", exact=True).last.fill("Animaux")
    page.get_by_label("Budget variable mensuel (€)").first.fill("150")
    page.locator("button", has_text="Enregistrer").first.click()
    page.wait_for_timeout(1000)
    assert page.locator("article.category", has_text="Animaux").count() == 1, "catégorie non ajoutée"


def category_transactions(page):
    go(page, "Budget")
    page.locator("article.category", has_text="Courses").first.click(position={"x": 40, "y": 40})
    page.wait_for_timeout(1200)
    assert "Toutes les transactions" in page.locator("h1").first.inner_text(), "écran des transactions non ouvert"
    assert page.get_by_text("Courses du mois").count() > 0, "filtre de catégorie non appliqué"


def quick_add_menu(page):
    go(page, "Accueil")
    page.locator("button[aria-label*='Ajouter']").first.click()
    page.wait_for_timeout(600)
    assert page.get_by_text("Dépense", exact=True).count() > 0, "menu Ajouter non ouvert"


def settings(page):
    page.locator("button.mobile-profile-trigger").first.click()
    page.wait_for_timeout(600)
    assert page.get_by_text("Foyer et finances").count() > 0, "réglages non ouverts"


def calendar(page):
    page.locator("button.bell").first.click()
    page.wait_for_timeout(600)
    assert "Calendrier" in page.locator("h1").first.inner_text(), "calendrier non ouvert"


def income(page):
    go(page, "Accueil")
    try:
        click_button(page, "Revenus")
    except AssertionError:  # ancien accueil (avant l'allègement)
        click_button(page, "Voir les revenus")
    assert "Toutes les transactions" in page.locator("h1").first.inner_text(), "revenus non ouverts"


SCENARIOS = [
    ("nouvelle-categorie", new_category, True),
    ("clic-categorie", category_transactions, False),
    ("menu-ajouter", quick_add_menu, False),
    ("reglages", settings, False),
    ("calendrier", calendar, False),
    ("revenus", income, False),
]


def main():
    out = Path(sys.argv[1])
    url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:4173"
    out.mkdir(parents=True, exist_ok=True)
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for name, run, full_page in SCENARIOS:
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844}, device_scale_factor=2,
                is_mobile=True, has_touch=True, locale="fr-FR", timezone_id="Europe/Paris")
            ctx.route("**/*", route_requests(url))
            ctx.add_init_script("localStorage.setItem('wimm-appearance-mode', 'light');")
            page = ctx.new_page()
            page.clock.set_fixed_time(FROZEN_NOW)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url + "/?demo=1")
            page.add_style_tag(content=FREEZE_MOTION)
            page.wait_for_timeout(1000)
            try:
                run(page)
                stable_screenshot(page, out / f"parcours-{name}.png", full_page=full_page)
            except Exception as e:  # noqa: BLE001 - on veut tous les échecs d'un coup
                failures.append(f"{name} : {e}")
            failures.extend(f"{name} : erreur JavaScript : {e}" for e in errors)
            ctx.close()
        browser.close()
    for f in failures:
        print("ÉCHEC", f)
    print(f"{len(SCENARIOS)} parcours, {len(failures)} échec(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()

"""Capture chaque écran de Wimm en mode démonstration, pour comparer avant/après.

Usage : python3 tools/visual/capture.py DOSSIER_DE_SORTIE [URL]

Prérequis : `pip install playwright` et Google Chrome installé.
L'application doit déjà tourner (voir tools/visual/run.sh, qui s'en charge).

Les captures sont déterministes : date figée, aucun appel réseau sortant
(les polices Google sont servies depuis tools/visual/fonts), animations
coupées. Deux captures du même code donnent les mêmes images.
"""

import base64
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

FROZEN_NOW = "2026-11-16T10:00:00+01:00"

# Écrans atteints par la navigation principale. Le libellé est le texte
# exact du bouton de navigation.
SCREENS = [
    ("accueil", "Accueil"),
    ("budget", "Budget"),
    ("transactions", "Transactions"),
    ("patrimoine", "Patrimoine"),
    ("depenses-fixes", "Dépenses fixes"),
    ("credits-prets", "Crédits et prêts"),
    ("compte-perso", "Compte perso"),
    ("projections", "Projections"),
    ("projets", "Projets"),
]

VIEWPORTS = [
    # (nom, largeur, hauteur, mobile, modes d'apparence)
    ("iphone", 390, 844, True, ["light", "dark"]),
    ("ordinateur", 1280, 900, False, ["light"]),
]

FONTS_DIR = Path(__file__).resolve().parent / "fonts"


def _font_face(family: str, weights: str, file: str) -> str:
    data = base64.b64encode((FONTS_DIR / file).read_bytes()).decode()
    return (f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{weights};'
            f'font-display:block;src:url(data:font/woff2;base64,{data}) format("woff2")}}')


# Remplace la feuille Google Fonts par les mêmes polices (versions variables,
# licence OFL) embarquées dans tools/visual/fonts : rendu réel, sans réseau.
FONTS_CSS = _font_face("DM Sans", "100 1000", "dm-sans.woff2") + _font_face("Manrope", "200 800", "manrope.woff2")


def route_requests(base_url: str):
    def handle(route):
        u = route.request.url
        if u.startswith(base_url):
            return route.continue_()
        if u.startswith("https://fonts.googleapis.com/"):
            return route.fulfill(status=200, content_type="text/css", body=FONTS_CSS)
        return route.abort()
    return handle


FREEZE_MOTION = """
*, *::before, *::after {
  animation-duration: 0s !important; animation-delay: 0s !important;
  transition-duration: 0s !important; transition-delay: 0s !important;
  caret-color: transparent !important;
}
"""


def click_nav(page, label: str) -> bool:
    """Clique le premier bouton de navigation portant exactement ce libellé."""
    return page.evaluate(
        """(label) => {
            const buttons = [...document.querySelectorAll("nav button, nav a")];
            const target = buttons.find(b => b.innerText.trim() === label
                || b.getAttribute("aria-label") === label);
            if (!target) return false;
            target.click();
            return true;
        }""",
        label,
    )


def settle(page):
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(600)


def stable_screenshot(page, path, full_page=True, attempts=6):
    """Recapture jusqu'à obtenir deux images identiques de suite.

    Certains éléments (graphiques, mesures de largeur) finissent de se
    placer après le chargement ; sans cela, une même page peut varier
    d'un pixel d'une capture à l'autre.
    """
    previous = page.screenshot(full_page=full_page)
    for _ in range(attempts):
        page.wait_for_timeout(400)
        current = page.screenshot(full_page=full_page)
        if current == previous:
            break
        previous = current
    Path(path).write_bytes(previous)


def main():
    out = Path(sys.argv[1])
    url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:4173"
    out.mkdir(parents=True, exist_ok=True)
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for vp_name, width, height, mobile, modes in VIEWPORTS:
            for mode in modes:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=2 if mobile else 1,
                    is_mobile=mobile, has_touch=mobile,
                    locale="fr-FR", timezone_id="Europe/Paris",
                    color_scheme="dark" if mode == "dark" else "light",
                )
                ctx.route("**/*", route_requests(url))
                ctx.add_init_script(
                    f"localStorage.setItem('wimm-appearance-mode', '{mode}');")
                page = ctx.new_page()
                page.clock.set_fixed_time(FROZEN_NOW)
                page.on("pageerror", lambda e: problems.append(f"{vp_name}/{mode}: {e}"))
                page.goto(url + "/?demo=1")
                page.add_style_tag(content=FREEZE_MOTION)
                settle(page)

                for slug, label in SCREENS:
                    if not click_nav(page, label):
                        problems.append(f"{vp_name}/{mode}: bouton « {label} » introuvable")
                        continue
                    settle(page)
                    stable_screenshot(page, out / f"{vp_name}-{mode}-{slug}.png")

                # Menu « Ajouter » ouvert depuis l'accueil (mobile uniquement).
                if mobile and click_nav(page, "Accueil"):
                    settle(page)
                    add = page.locator("button[aria-label*='Ajouter']").first
                    if add.count():
                        add.click()
                        settle(page)
                        stable_screenshot(page, out / f"{vp_name}-{mode}-menu-ajouter.png",
                                          full_page=False)
                ctx.close()
        browser.close()

    count = len(list(out.glob("*.png")))
    print(f"{count} captures dans {out}")
    for problem in problems:
        print("ATTENTION", problem)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

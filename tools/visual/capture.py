"""Capture chaque écran de Wimm en mode démonstration, pour comparer avant/après.

Usage : python3 tools/visual/capture.py DOSSIER_DE_SORTIE [URL]

Prérequis : `pip install playwright` et Google Chrome installé.
L'application doit déjà tourner (voir tools/visual/run.sh, qui s'en charge).

Les captures sont déterministes : date figée, aucun appel réseau sortant
(les polices Google sont servies depuis tools/visual/fonts), animations
coupées. Deux captures du même code donnent les mêmes images.
"""

import base64
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

FROZEN_NOW = "2026-11-16T10:00:00+01:00"

# Écrans atteints par la navigation principale. Le libellé est le texte
# exact du bouton de navigation (« A|B » : A, sinon B).
SCREENS = [
    ("accueil", "Accueil"),
    ("budget", "Budget"),
    ("transactions", "Opérations|Transactions"),
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


PRO_FIXTURE = json.loads((Path(__file__).resolve().parent / "fixtures" / "pro.json").read_text())


def route_requests(base_url: str, pro: bool = False):
    """Sert l'app locale et les polices ; avec pro=True, répond aussi aux
    appels Supabase de Wimm Pro avec des données fictives (fixtures/pro.json)."""
    def handle(route):
        u = route.request.url
        if u.startswith(base_url):
            return route.continue_()
        if pro and "/rest/v1/rpc/" in u:
            name = u.rsplit("/", 1)[-1].split("?")[0]
            return route.fulfill(status=200, content_type="application/json",
                                 body=json.dumps(PRO_FIXTURE.get(name)))
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
    """Clique le premier bouton de navigation portant exactement ce libellé
    (plusieurs libellés possibles séparés par « | », pour comparer deux versions)."""
    return any(_click_nav(page, one) for one in label.split("|"))


def _click_nav(page, label: str) -> bool:
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


# Écrans hors navigation principale : premier lancement, visite, aide,
# compte perso créé dans la démo, et Wimm Pro avec des données fictives.
# Chaque entrée : (nom, adresse, étapes, page entière). Étapes : "click:CSS",
# "text:libellé de bouton", "fill:aria-label=valeur", "nav:onglet".
EXTRAS = [
    ("premier-bienvenue", "?demo=1&welcome_preview=1", [], True),
    ("premier-rejoindre", "?demo=1&welcome_preview=1", ["text:Rejoindre un foyer"], True),
    ("premier-solde", "?demo=1&onboarding_preview=1", ["fill:Solde du compte courant=1250"], True),
    ("premier-revenu", "?demo=1&onboarding_preview=1",
     ["fill:Solde du compte courant=1250", "text:Continuer", "fill:Revenu mensuel=2100"], True),
    ("premier-ce-mois", "?demo=1&onboarding_preview=1",
     ["fill:Solde du compte courant=1250", "text:Continuer", "fill:Revenu mensuel=2100", "text:Continuer"], True),
    ("visite-etape-1", "?demo=1&onboarding_journey=1", [], False),
    ("visite-etape-3", "?demo=1&onboarding_journey=1", ["click:.wimm-journey-next", "click:.wimm-journey-next"], False),
    ("accueil-premiers-pas", "?demo=1&onboarding_checklist=1", [], True),
    ("aide-budget", "?demo=1", ["nav:Budget", "click:.page-info"], False),
    ("projets-voyage", "?demo=1", ["nav:Projets", "text:Voir le voyage"], True),
    ("projets-budget-du-bien", "?demo=1", ["nav:Projets", "text:Budget du bien"], False),
    ("projets-nouveau", "?demo=1", ["nav:Projets", "text:Nouveau projet"], False),
    ("perso-accueil", "?demo=1", ["nav:Compte perso", "text:Créer mon compte perso",
     "fill:Solde actuel (€)=420", "click:.sheet button.primary, [role=dialog] button.primary, dialog button.primary"], True),
    ("perso-budgets", "?demo=1", ["nav:Compte perso", "text:Créer mon compte perso",
     "fill:Solde actuel (€)=420", "click:.sheet button.primary, [role=dialog] button.primary, dialog button.primary",
     "click:.personal-ws-tabs button:nth-child(3)"], True),
] + [("reglages-" + ("menu" if k < 0 else str(k + 1)), "?demo=1", ["click:button.mobile-profile-trigger"] + ([] if k < 0 else [f"click:.wimm-settings-entry >> nth={k}"]), True)
     for k in range(-1, 5)] + [("ordi-reglages-" + ("menu" if k < 0 else str(k + 1)), "?demo=1", ["click:.sidebar-bottom button"] + ([] if k < 0 else [f"click:.wimm-settings-entry >> nth={k}"]), True)
     for k in range(-1, 5)] + [("ordi-ajouter", "?demo=1", ["click:.desktop-quick-add"], True)] + [("pro-" + slug, "?demo=1&screen=pro", [] if label == "Accueil" else ["click:.pro-v4-nav button >> text=" + label], True)
     for slug, label in [("accueil", "Accueil"), ("facturation", "Facturation"), ("clients", "Clients"),
                         ("agenda", "Agenda"), ("analyse", "Analyse")]]


def capture_extras(browser, url: str, out: Path):
    problems = []
    for name, query, steps, full_page in EXTRAS:
        desktop = name.startswith("ordi-")
        ctx = browser.new_context(viewport={"width": 1280, "height": 900} if desktop else {"width": 390, "height": 844},
                                  device_scale_factor=1 if desktop else 2,
                                  is_mobile=not desktop, has_touch=not desktop, locale="fr-FR", timezone_id="Europe/Paris")
        ctx.route("**/*", route_requests(url, pro=name.startswith("pro-")))
        ctx.add_init_script("localStorage.setItem('wimm-appearance-mode', 'light');")
        page = ctx.new_page()
        page.clock.set_fixed_time(FROZEN_NOW)
        page.on("pageerror", lambda e, n=name: problems.append(f"{n}: {e}"))
        page.goto(url + "/" + query)
        page.add_style_tag(content=FREEZE_MOTION)
        settle(page)
        try:
            for step in steps:
                kind, _, arg = step.partition(":")
                if kind == "click":
                    page.locator(arg).first.click()
                elif kind == "text":
                    page.locator("button", has_text=arg).first.click()
                elif kind == "fill":
                    label, _, value = arg.partition("=")
                    page.get_by_label(label).last.fill(value)
                elif kind == "nav" and not click_nav(page, arg):
                    raise AssertionError(f"onglet « {arg} » introuvable")
                page.wait_for_timeout(700)
            settle(page)
            stable_screenshot(page, out / f"extra-{name}.png", full_page=full_page)
        except Exception as e:  # noqa: BLE001
            problems.append(f"{name}: {e}")
        ctx.close()
    return problems


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

        problems.extend(capture_extras(browser, url, out))
        browser.close()

    count = len(list(out.glob("*.png")))
    print(f"{count} captures dans {out}")
    for problem in problems:
        print("ATTENTION", problem)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

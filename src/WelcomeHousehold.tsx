import { useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, House, Users } from "lucide-react";
import { WimmWordmark } from "./WimmWordmark";
import "./onboarding.css";

// Premier écran après la connexion : créer son foyer ou rejoindre celui
// de son ou sa partenaire.
export default function WelcomeHousehold({ create, join, initialCode, signOut, error: outerError }: {
  create: (name: string) => Promise<void>;
  join: (code: string) => Promise<void>;
  initialCode: string;
  signOut: () => void;
  error?: string;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "join">(initialCode ? "join" : "choose");
  const [name, setName] = useState("Notre foyer");
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (working) return;
    setWorking(true); setError("");
    try {
      if (mode === "create") {
        if (!name.trim()) throw Error("Donne un nom à ton foyer.");
        await create(name.trim());
      } else {
        if (!code.trim()) throw Error("Saisis le code d’invitation.");
        await join(code.trim());
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); }
    finally { setWorking(false); }
  };
  const shownError = error || outerError;

  if (mode === "choose") return <main className="wob-page"><div className="wob-shell">
    <WimmWordmark />
    <header className="wob-head">
      <h1>Bienvenue sur Wimm</h1>
      <p>Deux minutes pour démarrer : ton solde, ton revenu, et c’est parti. Le reste se complète ensuite, à ton rythme.</p>
    </header>
    <section className="wob-card wob-welcome-list">
      <button type="button" className="wob-choice" onClick={() => setMode("create")}>
        <span className="wob-choice-icon" aria-hidden="true"><House size={20}/></span>
        <span className="wob-choice-text"><strong>Créer mon foyer</strong><span>Je commence et j’inviterai mon ou ma partenaire</span></span>
        <ChevronRight size={18} aria-hidden="true"/>
      </button>
      <button type="button" className="wob-choice" onClick={() => setMode("join")}>
        <span className="wob-choice-icon" aria-hidden="true"><Users size={20}/></span>
        <span className="wob-choice-text"><strong>Rejoindre un foyer</strong><span>J’ai reçu un code ou un lien d’invitation</span></span>
        <ChevronRight size={18} aria-hidden="true"/>
      </button>
    </section>
    {shownError && <p className="wob-error" role="alert">{shownError}</p>}
    <footer className="wob-foot">
      <p className="wob-note">Tes données ne sont visibles que par les membres de ton foyer.</p>
      <button type="button" className="wob-secondary" onClick={signOut}>Se déconnecter</button>
    </footer>
  </div></main>;

  return <main className="wob-page"><form className="wob-shell" onSubmit={submit} noValidate>
    <div className="wob-top">
      <button type="button" className="wob-back" aria-label="Retour" onClick={() => { setMode("choose"); setError(""); }}><ArrowLeft size={18}/></button>
    </div>
    <header className="wob-head">
      <h1>{mode === "create" ? "Ton foyer" : "Rejoindre un foyer"}</h1>
      <p>{mode === "create"
        ? "Le nom qui s’affichera en haut de l’appli. Tu pourras inviter ton ou ta partenaire ensuite."
        : "Entre le code que ton ou ta partenaire t’a envoyé. Le foyer est déjà configuré : tu arriveras directement sur l’accueil."}</p>
    </header>
    <section className="wob-card wob-form">
      {mode === "create"
        ? <label>Nom du foyer<input value={name} onChange={e => setName(e.target.value)} autoFocus/></label>
        : <label>Code d’invitation<input className="wob-code" value={code} onChange={e => setCode(e.target.value)} autoFocus autoCapitalize="characters"/></label>}
    </section>
    {shownError && <p className="wob-error" role="alert">{shownError}</p>}
    <footer className="wob-foot">
      <button type="submit" className="wob-primary" disabled={working}>
        {working ? "Un instant…" : mode === "create" ? "Créer mon foyer" : "Rejoindre le foyer"}
      </button>
    </footer>
  </form></main>;
}

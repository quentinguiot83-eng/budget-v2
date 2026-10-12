import { useRef, useState } from "react";
import { ImageOff, ImagePlus, MoveVertical, Plane } from "lucide-react";
import type { Trip } from "./engine";

type Props = {
  trip: Trip | undefined;
  initialUrl?: string;
  onUpload: (file: File) => Promise<string>;
  onRemove: () => Promise<void>;
  onReposition: (position: number) => Promise<void>;
};

/** Photo editing controls belong to the trip edit form, never the cover itself. */
export default function TripCoverEditor({
  trip, initialUrl, onUpload, onRemove, onReposition,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasCover, setHasCover] = useState(Boolean(trip?.coverPath));
  const [previewUrl, setPreviewUrl] = useState(initialUrl || "");
  const [position, setPosition] = useState(trip?.coverPosition ?? 50);
  const [editingPosition, setEditingPosition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const signedUrl = await onUpload(file);
      setHasCover(true);
      setPreviewUrl(signedUrl);
      setPosition(50);
      setEditingPosition(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’ajouter cette photo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !hasCover) return;
    setBusy(true);
    setError("");
    try {
      await onRemove();
      setPreviewUrl("");
      setHasCover(false);
      setEditingPosition(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de supprimer la photo.");
    } finally {
      setBusy(false);
    }
  }

  async function savePosition() {
    if (busy || !hasCover) return;
    setBusy(true);
    setError("");
    try {
      await onReposition(position);
      setEditingPosition(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’enregistrer le cadrage.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="trip-edit-photo" aria-label="Photo de couverture du voyage">
      <div className="trip-edit-photo-heading">
        <strong>Photo de couverture</strong>
        <small>Facultatif · format paysage</small>
      </div>
      {!trip ? (
        <p className="trip-edit-photo-hint">Enregistrez ce voyage pour pouvoir ajouter sa photo.</p>
      ) : (
        <>
          <div className={"trip-edit-photo-preview" + (previewUrl ? " has-image" : "")}>
            {previewUrl ? (
              <img src={previewUrl} alt=""
                onError={() => {
                  setPreviewUrl("");
                  setError("La photo ne peut pas être affichée. Fermez puis rouvrez la modification pour actualiser son accès.");
                }}
                style={{ objectPosition: "50% " + position + "%" }}/>
            ) : (
              <div className="trip-edit-photo-fallback"><Plane size={27}/><span>{hasCover ? "Aperçu indisponible" : "Aucune photo"}</span></div>
            )}
          </div>
          <div className="trip-edit-photo-actions">
            <input ref={inputRef} className="trip-edit-photo-input" type="file"
              accept="image/*,.heic,.heif" aria-label="Choisir une couverture"
              disabled={busy}
              onChange={e => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                void upload(file);
              }}/>
            <button type="button" className="secondary" disabled={busy}
              onClick={() => inputRef.current?.click()}>
              <ImagePlus size={16}/>{busy ? "Enregistrement…" : hasCover ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {hasCover && (
              <>
                <button type="button" className="secondary" disabled={busy}
                  onClick={() => setEditingPosition(value => !value)}>
                  <MoveVertical size={16}/> Repositionner
                </button>
                <button type="button" className="secondary trip-edit-photo-remove" disabled={busy}
                  onClick={() => void remove()}>
                  <ImageOff size={16}/> Supprimer
                </button>
              </>
            )}
          </div>
          {editingPosition && hasCover && (
            <div className="trip-edit-photo-position">
              <label htmlFor="trip-edit-photo-position">Cadrage vertical</label>
              <input id="trip-edit-photo-position" type="range"
                min={0} max={100} value={position}
                disabled={busy} onChange={e => setPosition(Number(e.target.value))}/>
              <button type="button" className="primary" disabled={busy}
                onClick={() => void savePosition()}>Valider le cadrage</button>
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}

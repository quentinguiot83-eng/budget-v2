import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

/**
 * Charge un écran lourd seulement quand il est affiché pour la première fois.
 * Le composant renvoyé s'utilise exactement comme l'original : le découpage
 * du bundle reste invisible pour le reste de l'application.
 */
export function deferred<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  fallback: ReactNode = null,
) {
  const Lazy = lazy(load);
  function Deferred(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return Deferred;
}

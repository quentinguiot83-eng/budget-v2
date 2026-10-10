import { uid, type State } from './engine';

/** Seed the first account setup without altering any pre-existing categories. */
export function seedStarterCategories(state: State, period: string) {
  if (state.categories.length) return;
  state.categories = [
    ['Maison', 'home'],
    ['Courses', 'food'],
    ['Sorties', 'out'],
    ['Transports', 'transport'],
  ].map(([name, icon]) => ({ id: uid(), name, icon, budgets: { [period]: 0 } }));
}

import {
  Baby, BookOpen, Briefcase, Bus, Car, Carrot, Coffee, CreditCard,
  Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, Heart, House,
  Music2, PawPrint, Plane, Shirt, ShoppingCart, Smartphone,
  Stethoscope, Utensils, Wifi, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/** La clé enregistrée reste celle de l'emoji choisi, seul son rendu est épuré. */
const categoryGlyphs: Record<string, LucideIcon> = {
  home: House,
  food: Carrot,
  out: Utensils,
  shopping: ShoppingCart,
  car: Car,
  transport: Bus,
  fuel: Fuel,
  travel: Plane,
  coffee: Coffee,
  health: Heart,
  doctor: Stethoscope,
  sport: Dumbbell,
  clothes: Shirt,
  gift: Gift,
  pets: PawPrint,
  baby: Baby,
  education: GraduationCap,
  work: Briefcase,
  repair: Wrench,
  phone: Smartphone,
  internet: Wifi,
  energy: Zap,
  games: Gamepad2,
  music: Music2,
  books: BookOpen,
  other: CreditCard,
};

export function CategoryGlyph({ icon, size = 21 }: { icon?: string | null; size?: number }) {
  const Glyph = categoryGlyphs[icon || "other"] || CreditCard;
  return <Glyph size={size} strokeWidth={1.9} className="category-glyph" aria-hidden="true" />;
}

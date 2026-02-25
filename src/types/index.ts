// ════════════════════════════════
// OLDA Studio — TypeScript Types
// ════════════════════════════════

export interface Color {
  n: string;  // name
  h: string;  // hex
}

export interface LogoEntry {
  id: string;
  n: string;   // display name
  s?: string;  // SVG string (for atelier logos)
  url?: string; // URL (for pay01.svg etc)
  back?: { x: number; y: number; w: number; h?: number };
}

export interface LogoCollection {
  [key: string]: LogoEntry[];
}

export interface Reference {
  fournisseur: string;
  prix: number;
  bio: boolean;
  largeurs: Record<string, number>;
}

export interface ReferenceMap {
  [code: string]: Reference;
}

export interface LogoPlacement {
  id: string | null;       // logo id or null
  type: 'atelier' | 'upload' | null;
  svg: string | null;      // SVG string for atelier logos
  url: string | null;      // Data URL for uploads
  name: string | null;
  x: number;               // % from left
  y: number;               // % from top
  w: number;               // % width
  color: string;           // logo color (for SVG fill)
}

export interface CartItem {
  id: string;
  famille: 'textile' | 'mug' | string;
  collection: string;
  reference: string;
  couleur: Color;
  taille: string;
  dtfArriere: string;      // largeur DTF arrière en mm
  logoAvant: LogoPlacement;
  logoArriere: LogoPlacement;
  note: string;
  prix: {
    tshirt: number;
    personnalisation: number;
    total: number;
  };
  addedAt: string;
}

export interface ClientInfo {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  deadline: string;
}

export type Step = 'studio' | 'client' | 'payment';

export type PaymentStatus = 'paid' | 'unpaid';

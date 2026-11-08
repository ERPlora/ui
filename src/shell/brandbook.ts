export const BRAND_PALETTE_IDS = [
  'erplora',
  'terracotta',
  'corporate',
  'minimal',
  'forest',
  'ocean',
  'violet',
] as const;

export type BrandPaletteId = (typeof BRAND_PALETTE_IDS)[number];

export interface BrandPaletteMode {
  primary: string;
  canvas: string;
  ink: string;
}

export interface BrandPalette {
  id: BrandPaletteId;
  name: string;
  description: string;
  light: BrandPaletteMode;
  dark: BrandPaletteMode;
}

export const BRAND_PALETTES = [
  {
    id: 'erplora',
    name: 'ERPlora',
    description: 'Azul de plataforma sobre un lienzo neutro.',
    light: { primary: '#1496d6', canvas: '#f6f7f9', ink: '#1a1c20' },
    dark: { primary: '#2aa6e4', canvas: '#0b0c0e', ink: '#f4f5f7' },
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    description: 'Acento cálido y artesanal sobre papel claro.',
    light: { primary: '#E8552A', canvas: '#FAF8F4', ink: '#1A1612' },
    dark: { primary: '#E8552A', canvas: '#0B0A09', ink: '#F5F1EA' },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Azul marino sobrio para entornos empresariales.',
    light: { primary: '#0F3F9C', canvas: '#F6F8FB', ink: '#0F1626' },
    dark: { primary: '#176EC8', canvas: '#0A0E14', ink: '#EEF2F8' },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Tinta monocroma, sin color de acento competitivo.',
    light: { primary: '#111111', canvas: '#ffffff', ink: '#0A0A0A' },
    dark: { primary: '#FAFAFA', canvas: '#0A0A0A', ink: '#FAFAFA' },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Verde bosque con superficies inspiradas en tierra.',
    light: { primary: '#1F542A', canvas: '#FAF6EE', ink: '#1B1810' },
    dark: { primary: '#3B874A', canvas: '#14110D', ink: '#F1ECE0' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cian tecnológico sobre azules muy suaves.',
    light: { primary: '#008CBD', canvas: '#F4F8FC', ink: '#0A1626' },
    dark: { primary: '#00B1DA', canvas: '#060B14', ink: '#ECF3FA' },
  },
  {
    id: 'violet',
    name: 'Violet',
    description: 'Violeta creativo con neutros ligeramente violáceos.',
    light: { primary: '#742AD9', canvas: '#FBF7FA', ink: '#1A1024' },
    dark: { primary: '#7F3BE7', canvas: '#0D0814', ink: '#F2EDF8' },
  },
] as const satisfies readonly BrandPalette[];

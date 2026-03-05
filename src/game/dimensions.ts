export type DimensionId = 'prime' | 'nebula' | 'shadow';

export type DimensionDefinition = {
  id: DimensionId;
  label: string;
  icon: string;
  bgColor: string;
  accentColor: string;
  description: string;
};

export const DEFAULT_DIMENSION_ID: DimensionId = 'prime';

export const DIMENSIONS: readonly DimensionDefinition[] = [
  {
    id: 'prime',
    label: 'Prime',
    icon: '🌍',
    bgColor: '#111625',
    accentColor: '#8ec5ff',
    description: 'Balanced baseline reality.',
  },
  {
    id: 'nebula',
    label: 'Nebula',
    icon: '🌌',
    bgColor: '#20133b',
    accentColor: '#d0a8ff',
    description: 'Dreamlike pockets and cosmic drift.',
  },
  {
    id: 'shadow',
    label: 'Shadow',
    icon: '🌑',
    bgColor: '#111216',
    accentColor: '#88ffd6',
    description: 'Low-light stealth with tense ambience.',
  },
];

export function getDimensionById(id: string | null | undefined): DimensionDefinition {
  return DIMENSIONS.find((dimension) => dimension.id === id) ?? DIMENSIONS[0];
}


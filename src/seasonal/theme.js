// Configuration centrale des thèmes saisonniers.
// `default` correspond au design ClickOne d'origine (aucune saison appliquée).
// Les autres ids sont reflétés dans `data-season=...` sur <html>.
import { FlowerLotus, Leaf, Snowflake, Sun } from '@phosphor-icons/react';

export const STORAGE_KEY = 'clickone:season';

export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

export const SEASONS = {
  spring: {
    id: 'spring',
    label: 'Printemps',
    accentRgb: '120, 150, 111',
    Icon: FlowerLotus,
    particles: {
      type: 'petal',
      desktop: 18,
      mobile: 9,
      durationRange: [12000, 18000],
      sizeRange: [6, 11],
      opacityRange: [0.25, 0.55],
    },
  },
  summer: {
    id: 'summer',
    label: 'Été',
    accentRgb: '232, 174, 60',
    Icon: Sun,
    particles: {
      type: 'dust',
      desktop: 22,
      mobile: 10,
      durationRange: [9000, 16000],
      sizeRange: [2, 4],
      opacityRange: [0.25, 0.55],
    },
  },
  autumn: {
    id: 'autumn',
    label: 'Automne',
    accentRgb: '169, 87, 50',
    Icon: Leaf,
    particles: {
      type: 'leaf',
      desktop: 16,
      mobile: 8,
      durationRange: [10000, 16000],
      sizeRange: [10, 16],
      opacityRange: [0.3, 0.65],
    },
  },
  winter: {
    id: 'winter',
    label: 'Hiver',
    accentRgb: '169, 214, 255',
    Icon: Snowflake,
    particles: {
      type: 'snow',
      desktop: 28,
      mobile: 14,
      durationRange: [8000, 18000],
      sizeRange: [2, 5],
      opacityRange: [0.35, 0.85],
    },
  },
};

export function isValidSeason(value) {
  return value === 'spring' || value === 'summer' || value === 'autumn' || value === 'winter';
}

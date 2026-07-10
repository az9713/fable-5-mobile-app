export type BackgroundEntry = {
  id: string;
  name: string;
  source: number | null;
};

export const BACKGROUNDS: BackgroundEntry[] = [
  {
    id: 'seurat',
    name: 'A Sunday on La Grande Jatte',
    source: require('../../assets/backgrounds/seurat-grande-jatte.jpg'),
  },
  {
    id: 'monet',
    name: 'Impression, Sunrise',
    source: require('../../assets/backgrounds/monet-impression.jpg'),
  },
  {
    id: 'vangogh',
    name: 'The Starry Night',
    source: require('../../assets/backgrounds/vangogh-starry-night.jpg'),
  },
  {
    id: 'aurora',
    name: 'Aurora',
    source: null,
  },
];

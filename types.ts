export enum PlantType {
  TALL_FLOWER = 'TALL_FLOWER',   // Spikes (Bird of paradise, Canna)
  BUSH_FLOWER = 'BUSH_FLOWER',   // Round bushes (Hibiscus, Ixora)
  TREE_SMALL = 'TREE_SMALL',     // Small trees (Plumeria, Rubber Fig)
  BROAD_LEAF = 'BROAD_LEAF',     // Ground cover/Fern like (Monstera, Alocasia)
  VINE = 'VINE',                 // Climbing (Bougainvillea)
  ORCHID = 'ORCHID'              // Delicate hanging (Phalaenopsis)
}

export interface PlantData {
  id: number;
  name: string;
  latinName: string;
  chineseName: string;
  feature: string;
  type: PlantType;
  colors: {
    primary: string;   // Flower/Leaf highlight
    secondary?: string;// Center/Accent
    foliage: string;   // Leaf color
  };
  position: [number, number, number];
}

export interface VoxelData {
  x: number;
  y: number;
  z: number;
  color: string;
}

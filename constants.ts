import { PlantData, PlantType } from './types';

// Helper to distribute positions in a spiral/random layout
const generateGardenLayout = (): PlantData[] => {
  const plants = [
    {
      name: "Bird of Paradise",
      latinName: "Strelitzia reginae",
      chineseName: "鹤望兰",
      feature: "Iconic orange and blue flowers resembling a crane.",
      type: PlantType.TALL_FLOWER,
      colors: { primary: "#FF6600", secondary: "#0000FF", foliage: "#006400" }
    },
    {
      name: "Hibiscus",
      latinName: "Hibiscus rosa-sinensis",
      chineseName: "扶桑",
      feature: "Large trumpet-shaped flowers with prominent stamens.",
      type: PlantType.BUSH_FLOWER,
      colors: { primary: "#FF0033", secondary: "#FFFF00", foliage: "#004d00" }
    },
    {
      name: "Frangipani",
      latinName: "Plumeria rubra",
      chineseName: "鸡蛋花",
      feature: "Fragrant, spiral-shaped waxy flowers.",
      type: PlantType.TREE_SMALL,
      colors: { primary: "#FFFACD", secondary: "#FFD700", foliage: "#228B22" }
    },
    {
      name: "Bougainvillea",
      latinName: "Bougainvillea spectabilis",
      chineseName: "三角梅",
      feature: "Vigorous climber with paper-like colorful bracts.",
      type: PlantType.VINE,
      colors: { primary: "#FF00FF", foliage: "#006400" }
    },
    {
      name: "Flamingo Flower",
      latinName: "Anthurium andraeanum",
      chineseName: "红掌",
      feature: "Glossy, heart-shaped red spathes.",
      type: PlantType.BROAD_LEAF,
      colors: { primary: "#DC143C", secondary: "#FFFFE0", foliage: "#004d00" }
    },
    {
      name: "Lobster Claw",
      latinName: "Heliconia rostrata",
      chineseName: "垂花赫蕉",
      feature: "Hanging beak-like bracts like lobster claws.",
      type: PlantType.TALL_FLOWER,
      colors: { primary: "#FF4500", secondary: "#FFFF00", foliage: "#2E8B57" }
    },
    {
      name: "Moth Orchid",
      latinName: "Phalaenopsis aphrodite",
      chineseName: "蝴蝶兰",
      feature: "Elegant flowers resembling butterflies in flight.",
      type: PlantType.ORCHID,
      colors: { primary: "#DA70D6", secondary: "#FFFFFF", foliage: "#556B2F" }
    },
    {
      name: "Canna Lily",
      latinName: "Canna indica",
      chineseName: "美人蕉",
      feature: "Tall spikes of iris-like flowers and banana-like leaves.",
      type: PlantType.TALL_FLOWER,
      colors: { primary: "#FF8C00", foliage: "#6B8E23" }
    },
    {
      name: "Jungle Geranium",
      latinName: "Ixora coccinea",
      chineseName: "龙船花",
      feature: "Dense clusters of fiery red or orange flowers.",
      type: PlantType.BUSH_FLOWER,
      colors: { primary: "#FF4500", foliage: "#005000" }
    },
    {
      name: "Golden Trumpet",
      latinName: "Allamanda cathartica",
      chineseName: "软枝黄蝉",
      feature: "Climbing shrub with bright yellow trumpet blossoms.",
      type: PlantType.VINE,
      colors: { primary: "#FFD700", foliage: "#32CD32" }
    },
    {
      name: "White Ginger Lily",
      latinName: "Hedychium coronarium",
      chineseName: "姜花",
      feature: "Fragrant white flowers that look like butterflies.",
      type: PlantType.TALL_FLOWER,
      colors: { primary: "#F0F8FF", foliage: "#228B22" }
    },
    {
      name: "Passion Flower",
      latinName: "Passiflora caerulea",
      chineseName: "西番莲",
      feature: "Intricate flowers with a unique central crown.",
      type: PlantType.VINE,
      colors: { primary: "#9400D3", secondary: "#FFFFFF", foliage: "#006400" }
    },
    {
      name: "Lotus",
      latinName: "Nelumbo nucifera",
      chineseName: "荷花",
      feature: "Sacred aquatic plant with large round leaves.",
      type: PlantType.BROAD_LEAF,
      colors: { primary: "#FF69B4", secondary: "#FFFFE0", foliage: "#2E8B57" }
    },
    {
      name: "Monstera",
      latinName: "Monstera deliciosa",
      chineseName: "龟背竹",
      feature: "Huge, glossy leaves with natural holes.",
      type: PlantType.BROAD_LEAF,
      colors: { primary: "#004d00", foliage: "#004d00" } // Deep Green
    },
    {
      name: "Croton",
      latinName: "Codiaeum variegatum",
      chineseName: "变叶木",
      feature: "Leathery leaves with spectacular variegation.",
      type: PlantType.BUSH_FLOWER, // Treated as colorful bush
      colors: { primary: "#FF8C00", secondary: "#FF0000", foliage: "#006400" }
    },
    {
      name: "Elephant Ear",
      latinName: "Alocasia macrorrhizos",
      chineseName: "海芋",
      feature: "Dramatic, giant arrow-shaped leaves.",
      type: PlantType.BROAD_LEAF,
      colors: { primary: "#006400", foliage: "#006400" }
    },
    {
      name: "Silver Vase Bromeliad",
      latinName: "Aechmea fasciata",
      chineseName: "蜻蜓凤梨",
      feature: "Rosette of silver-banded leaves with pink spike.",
      type: PlantType.ORCHID, // Similar structure
      colors: { primary: "#FF1493", foliage: "#708090" } // Silver/Grey green
    },
    {
      name: "Rubber Fig",
      latinName: "Ficus elastica",
      chineseName: "橡皮树",
      feature: "Thick, shiny, dark green structural leaves.",
      type: PlantType.TREE_SMALL,
      colors: { primary: "#1a1a1a", foliage: "#2F4F4F" }
    },
    {
      name: "Peace Lily",
      latinName: "Spathiphyllum wallisii",
      chineseName: "白掌",
      feature: "Dark green foliage with white spoon-shaped flowers.",
      type: PlantType.BROAD_LEAF,
      colors: { primary: "#FFFFFF", foliage: "#004d00" }
    },
    {
      name: "Golden Pothos",
      latinName: "Epipremnum aureum",
      chineseName: "绿萝",
      feature: "Hardy trailing vine with marbled heart leaves.",
      type: PlantType.VINE,
      colors: { primary: "#ADFF2F", foliage: "#006400" }
    }
  ];

  const layout: PlantData[] = [];
  
  plants.forEach((p, i) => {
    // Spiral placement with more spacing for larger plants
    const r = 4 + (i * 1.0); 
    const theta = i * 2.4; 
    
    layout.push({
      ...p,
      id: i,
      position: [r * Math.cos(theta), 0, r * Math.sin(theta)]
    });
  });

  return layout;
};

export const GARDEN_DATA = generateGardenLayout();
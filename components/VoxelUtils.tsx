import { PlantType, VoxelData } from '../types';

export const generateVoxels = (type: PlantType, colors: { primary: string, secondary?: string, foliage: string }): VoxelData[] => {
  const voxels: VoxelData[] = [];
  const { primary, secondary, foliage } = colors;
  
  // Helper to add a box
  const add = (x: number, y: number, z: number, color: string) => {
    // Simple check to avoid exact duplicates
    if (!voxels.some(v => v.x === x && v.y === y && v.z === z)) {
      voxels.push({ x, y, z, color });
    }
  };

  // Helper for randomness
  const noise = (x: number, y: number) => Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;

  switch (type) {
    case PlantType.TALL_FLOWER:
      // Bird of Paradise / Heliconia / Ginger
      // Clump of stalks
      for (let i = 0; i < 4; i++) {
        const ox = (i % 2) * 2 - 1;
        const oz = Math.floor(i / 2) * 2 - 1;
        const height = 12 + Math.floor(Math.random() * 6);
        
        // Stalk
        for(let y=0; y<height; y++) add(ox, y, oz, foliage);
        
        // Leaf blades at various heights
        for(let y=2; y<height-4; y+=3) {
           add(ox + 1, y, oz, foliage);
           add(ox + 2, y+1, oz, foliage);
           add(ox - 1, y+1, oz, foliage);
        }

        // Flower Head (Detailed)
        if (i < 3) { // Not all stalks have flowers
          const fy = height;
          // The "Bird" head shape
          add(ox, fy, oz, primary);
          add(ox+1, fy, oz, primary);
          add(ox+2, fy, oz, primary);
          add(ox+3, fy+1, oz, primary);
          
          // Crest/Feathers
          if (secondary) {
            add(ox+1, fy+1, oz, secondary);
            add(ox+2, fy+2, oz, secondary);
            add(ox, fy+1, oz, secondary);
          } else {
             add(ox+1, fy+1, oz, primary);
             add(ox+2, fy+2, oz, primary);
          }
        }
      }
      break;

    case PlantType.BUSH_FLOWER:
      // Hibiscus / Ixora
      // Larger, rounder bush shape
      const radius = 3.5;
      const centerY = 5;
      
      // Main Foliage volume
      for(let x=-4; x<=4; x++) {
        for(let z=-4; z<=4; z++) {
          for(let y=0; y<=9; y++) {
            const dist = Math.sqrt(x*x + z*z + (y-centerY)*(y-centerY));
            // Add noise to surface
            if (dist < radius + (Math.random() * 0.5)) {
               // Leave some gaps for airiness
               if (Math.random() > 0.1) add(x, y, z, foliage);
            }
          }
        }
      }
      
      // Trunk/Stem visible at bottom
      for(let y=0; y<3; y++) add(0, y, 0, '#4a3c31');

      // Vivid Flowers dotted around
      for(let i=0; i<8; i++) {
         // Random point on sphere
         const u = Math.random();
         const v = Math.random();
         const theta = 2 * Math.PI * u;
         const phi = Math.acos(2 * v - 1);
         
         const fx = Math.round(radius * Math.sin(phi) * Math.cos(theta));
         const fz = Math.round(radius * Math.sin(phi) * Math.sin(theta));
         const fy = Math.round(radius * Math.cos(phi)) + centerY;
         
         if (fy > 2) {
            // Flower center
            add(fx, fy, fz, secondary || '#FFFF00');
            // Petals
            add(fx+1, fy, fz, primary);
            add(fx-1, fy, fz, primary);
            add(fx, fy+1, fz, primary);
            add(fx, fy-1, fz, primary);
            // Stamen pop
            if(secondary) add(fx, fy, fz+1, secondary);
         }
      }
      break;

    case PlantType.TREE_SMALL:
      // Plumeria / Rubber Fig
      // Solid Trunk
      for(let y=0; y<8; y++) {
        add(0, y, 0, '#5D4037');
        if(y<4) { add(1,y,0,'#5D4037'); add(0,y,1,'#5D4037'); } // Thick base
      }
      
      // Branches
      const branches = [[2, 8], [-2, 8], [0, 9], [2, 10, 2], [-2, 10, -2]];
      
      branches.forEach(([bx, by, bz = 0], idx) => {
         // Draw line to branch
         const steps = 4;
         for(let s=0; s<=steps; s++) {
            add(Math.round(bx * (s/steps)), 7 + s, Math.round(bz * (s/steps)), '#5D4037');
         }

         // Canopy at branch end
         for(let lx=-2; lx<=2; lx++) {
            for(let lz=-2; lz<=2; lz++) {
               if (Math.abs(lx)+Math.abs(lz) < 3) {
                 add(Math.round(bx)+lx, 10+idx%2, Math.round(bz)+lz, foliage);
               }
            }
         }
         
         // Flower clusters
         if (primary) {
           add(Math.round(bx), 11+idx%2, Math.round(bz), primary);
           add(Math.round(bx)+1, 11+idx%2, Math.round(bz), primary);
           if(secondary) add(Math.round(bx), 11+idx%2, Math.round(bz)+1, secondary);
         }
      });
      break;
      
    case PlantType.BROAD_LEAF:
      // Monstera / Alocasia / Anthurium
      // Central clump
      for(let y=0; y<3; y++) { add(0,y,0, foliage); add(1,y,1, foliage); }

      const leafDirs = [[2,2], [-2,2], [0,3], [2,-1], [-2,-1]];
      leafDirs.forEach(([dirX, dirZ], i) => {
         // Stalk out
         let cx = 0, cy = 0, cz = 0;
         for(let s=0; s<4; s++) {
            cx += dirX * 0.3;
            cy += 1;
            cz += dirZ * 0.3;
            add(Math.round(cx), Math.round(cy), Math.round(cz), foliage);
         }
         
         // The Big Leaf
         const leafSize = 3;
         for(let lx=-leafSize; lx<=leafSize; lx++) {
            for(let lz=-leafSize; lz<=leafSize; lz++) {
                // Heart shape math
                if (Math.abs(lx) + Math.abs(lz) <= leafSize + 1) {
                   // Fenestration (holes) for Monstera feel
                   if (!((lx === 1 && lz === 1) || (lx === -1 && lz === 2))) {
                      // Tilt leaf
                      const ly = Math.round(-Math.abs(lx)*0.5);
                      add(Math.round(cx)+lx, Math.round(cy)+ly, Math.round(cz)+lz, foliage);
                   }
                }
            }
         }
      });
      
      // Feature Flower (Anthurium/Peace Lily)
      if (primary !== foliage) {
         // Stalk
         for(let y=0; y<12; y++) add(0, y, 1, '#2E8B57');
         // Spathe
         for(let fx=-1; fx<=1; fx++) {
            for(let fy=11; fy<=13; fy++) {
               add(fx, fy, 2, primary);
            }
         }
         // Spadix
         if(secondary) {
            add(0, 12, 3, secondary);
            add(0, 13, 3, secondary);
         }
      }
      break;

    case PlantType.VINE:
      // Bougainvillea / Passion Flower
      // Trellis / Chaotic structure
      const height = 18;
      for(let y=0; y<height; y++) {
         // Main vine winding up
         const vx = Math.round(Math.sin(y * 0.5) * 2);
         const vz = Math.round(Math.cos(y * 0.5) * 2);
         add(vx, y, vz, '#4a3c31');
         
         // Foliage clouds
         if (y % 2 === 0) {
            for(let ox=-1; ox<=1; ox++) {
               for(let oz=-1; oz<=1; oz++) {
                  if (Math.random() > 0.3) add(vx+ox, y, vz+oz, foliage);
               }
            }
         }

         // Hanging flowers
         if (y % 3 === 0 && y > 3) {
            add(vx+1, y, vz, primary);
            add(vx+1, y-1, vz, primary);
            add(vx+2, y, vz, primary);
            if (secondary) add(vx+1, y, vz+1, secondary);
         }
      }
      break;

    case PlantType.ORCHID:
       // Pot
       for(let x=-1; x<=1; x++) for(let z=-1; z<=1; z++) add(x,0,z, '#8B4513');
       
       // Leaves at base
       add(1,1,0, foliage); add(2,2,0, foliage);
       add(-1,1,0, foliage); add(-2,2,0, foliage);
       
       // Arching Stem
       let sx = 0, sy = 1, sz = 0;
       for(let i=0; i<15; i++) {
          sy += 1;
          if (i > 5) sx += 1; // Start arching
          if (i > 10) sy -= 1; // Droop
          add(Math.round(sx), Math.round(sy), Math.round(sz), '#556B2F');
          
          // Flowers along the arch
          if (i > 6 && i % 2 === 0) {
             const fx = Math.round(sx);
             const fy = Math.round(sy);
             // Butterfly shape
             add(fx, fy-1, 1, primary);
             add(fx+1, fy-1, 1, primary);
             add(fx-1, fy-1, 1, primary);
             if (secondary) add(fx, fy-1, 2, secondary);
          }
       }
       break;
       
    default:
       for(let y=0; y<10; y++) add(0,y,0, foliage);
       break;
  }
  return voxels;
};

export const generateCharacterVoxels = (): VoxelData[] => {
  const voxels: VoxelData[] = [];
  const skin = '#FFDCB1'; // Yellowish skin
  const hair = '#1a1a1a'; // Black hair
  const shirt = '#FFFFFF';
  const shorts = '#1a1a1a';
  const shoes = '#333333';
  
  const add = (x: number, y: number, z: number, color: string) => voxels.push({ x, y, z, color });

  // Standard Humanoid - Approx 9 voxels tall (1.35m in world scale)
  
  // Left Leg
  add(-1, 0, 0, shoes);
  add(-1, 1, 0, skin);
  add(-1, 2, 0, shorts);
  
  // Right Leg
  add(1, 0, 0, shoes);
  add(1, 1, 0, skin);
  add(1, 2, 0, shorts);
  
  // Torso (Shorts/Hips)
  add(0, 2, 0, shorts);
  add(-1, 2, 0, shorts);
  add(1, 2, 0, shorts);
  
  // Torso (Shirt)
  for(let y=3; y<=5; y++) {
    for(let x=-1; x<=1; x++) {
      add(x, y, 0, shirt);
    }
  }
  
  // Arms
  add(-2, 5, 0, shirt);
  add(-2, 4, 0, skin); // Hand
  add(2, 5, 0, shirt);
  add(2, 4, 0, skin); // Hand

  // Head
  for(let y=6; y<=8; y++) {
    for(let x=-1; x<=1; x++) {
      for(let z=-1; z<=1; z++) {
        add(x, y, z, skin);
      }
    }
  }
  
  // Hair (Bowl cut)
  // Top
  for(let x=-1; x<=1; x++) {
     for(let z=-1; z<=1; z++) {
        add(x, 9, z, hair);
     }
  }
  // Sides/Back
  add(-2, 8, 0, hair);
  add(2, 8, 0, hair);
  add(0, 8, -2, hair);
  add(-1, 8, -2, hair);
  add(1, 8, -2, hair);
  
  // Bangs
  add(-1, 8, 1, hair);
  add(1, 8, 1, hair);
  add(0, 8, 1, hair);

  return voxels;
}
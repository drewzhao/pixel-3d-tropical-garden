import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh, Color, InstancedMesh, Object3D, MeshBasicMaterial, DoubleSide } from 'three';
import { OrbitControls, Html, ContactShadows, useCursor } from '@react-three/drei';
import { GARDEN_DATA } from './constants';
import { PlantData, VoxelData, PlantType } from './types';
import { generateVoxels, generateCharacterVoxels } from './components/VoxelUtils';

// --- Components ---

const VOXEL_SIZE = 0.15; // Size of each voxel in world units

interface VoxelMeshProps {
  voxels: VoxelData[];
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const VoxelMesh: React.FC<VoxelMeshProps> = ({ voxels, position, rotation }) => {
  // Offset y so that y=0 in voxel space implies resting on the ground.
  // A cube at y=0 has center at 0. But boxGeometry centers at 0.
  // So if we want the bottom of voxel y=0 to be at local y=0, we add VOXEL_SIZE/2.
  return (
    <group position={position} rotation={rotation}>
      {voxels.map((v, i) => (
        <mesh 
            key={i} 
            position={[
                v.x * VOXEL_SIZE, 
                (v.y * VOXEL_SIZE) + (VOXEL_SIZE / 2), 
                v.z * VOXEL_SIZE
            ]} 
            castShadow 
            receiveShadow
        >
          <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
          <meshStandardMaterial color={v.color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

interface PlantProps {
  data: PlantData;
  isHovered: boolean;
  onHover: (hover: boolean) => void;
}

const Plant: React.FC<PlantProps> = ({ data, isHovered, onHover }) => {
  const voxels = useMemo(() => generateVoxels(data.type, data.colors), [data]);
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current && isHovered) {
      // Gentle bounce when hovered
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 5) * 0.05;
    } else if (groupRef.current) {
        groupRef.current.position.y = 0;
    }
  });

  return (
    <group 
      position={data.position} 
      ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(false); }}
    >
       <VoxelMesh voxels={voxels} />
       {/* Shadow using PolygonOffset to avoid Z-Fighting */}
       <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
         <circleGeometry args={[1.2, 16]} />
         <meshBasicMaterial 
            color="#000000" 
            opacity={0.3} 
            transparent 
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1} 
         />
       </mesh>
    </group>
  );
};

interface CharacterProps {
  targetPosition: Vector3;
  onPositionChange: (pos: Vector3) => void;
}

// Collision radii based on plant type (roughly matching visual size)
const getPlantRadius = (type: PlantType): number => {
    switch(type) {
        case PlantType.BUSH_FLOWER: return 1.5;
        case PlantType.BROAD_LEAF: return 1.2;
        case PlantType.TREE_SMALL: return 1.0;
        case PlantType.VINE: return 0.8;
        default: return 0.8;
    }
};

const Character: React.FC<CharacterProps> = ({ targetPosition, onPositionChange }) => {
  const voxels = useMemo(() => generateCharacterVoxels(), []);
  const groupRef = useRef<Group>(null);
  const visualRef = useRef<Group>(null);
  const position = useRef(new Vector3(0, 0, 0));
  const CHARACTER_RADIUS = 0.4;

  useFrame((state, delta) => {
    if (!groupRef.current || !visualRef.current) return;

    const speed = 4;
    const step = speed * delta;
    const distToTarget = position.current.distanceTo(targetPosition);
    
    // Logic: Move towards target, but check collisions along the way
    if (distToTarget > 0.1) {
      // 1. Calculate desired next position
      const direction = new Vector3().subVectors(targetPosition, position.current).normalize();
      const moveVector = direction.multiplyScalar(step);
      // Don't overshoot
      if (moveVector.length() > distToTarget) moveVector.setLength(distToTarget);
      
      const proposedPos = position.current.clone().add(moveVector);

      // 2. Collision Detection against Plants
      let correctedPos = proposedPos.clone();
      
      GARDEN_DATA.forEach(plant => {
          const plantPos = new Vector3(plant.position[0], 0, plant.position[2]);
          const collisionDist = getPlantRadius(plant.type) + CHARACTER_RADIUS;
          const dist = correctedPos.distanceTo(plantPos);
          
          if (dist < collisionDist) {
              // Collision detected! Push character out along the normal vector
              const normal = new Vector3().subVectors(correctedPos, plantPos).normalize();
              // Prevent NaN if positions are identical
              if (normal.lengthSq() === 0) normal.set(1, 0, 0);
              
              // New position is at the perimeter
              correctedPos.copy(plantPos).add(normal.multiplyScalar(collisionDist));
          }
      });

      // 3. Update actual position
      position.current.copy(correctedPos);

      // 4. Update Rotation (Strictly Y-axis)
      // Look at the target, but keep the look target at the same Y level as the character
      const lookTarget = new Vector3(targetPosition.x, position.current.y, targetPosition.z);
      groupRef.current.lookAt(lookTarget);
      
      // Bobbing animation
      visualRef.current.position.y = Math.abs(Math.sin(state.clock.getElapsedTime() * 12)) * 0.15;
    } else {
       visualRef.current.position.y = 0;
    }

    groupRef.current.position.copy(position.current);
    onPositionChange(position.current.clone());
  });

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <VoxelMesh voxels={voxels} position={[0, 0, 0]} />
      </group>
      {/* Character Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
         <circleGeometry args={[0.35, 16]} />
         <meshBasicMaterial 
            color="#000000" 
            opacity={0.3} 
            transparent 
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2} // Slightly higher priority than plant shadows
         />
      </mesh>
    </group>
  );
};

interface GroundDetailsProps {
  count?: number;
}

const GroundDetails: React.FC<GroundDetailsProps> = ({ count = 600 }) => {
  const meshRef = useRef<InstancedMesh>(null);
  
  const dummy = useMemo(() => new Object3D(), []);
  const details = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
       const r = Math.random() * 38; 
       const theta = Math.random() * Math.PI * 2;
       const x = r * Math.cos(theta);
       const z = r * Math.sin(theta);
       const s = Math.random() * 0.5 + 0.3;
       
       const type = Math.random();
       let color = "#228B22"; 
       if (type > 0.95) color = "#808080"; 
       else if (type > 0.90) color = "#FF69B4";
       else if (type > 0.6) color = "#006400"; 
       else if (type > 0.3) color = "#32CD32"; 
       
       data.push({ x, z, s, color });
    }
    return data;
  }, [count]);

  useEffect(() => {
    if (meshRef.current) {
      details.forEach((d, i) => {
        // Position slightly embedded but tops visible
        // Since we adjusted VoxelMesh to sit ON y=0, we place these at y=0
        dummy.position.set(d.x, 0, d.z);
        dummy.scale.set(d.s, d.s * (Math.random() + 0.5), d.s);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        meshRef.current!.setColorAt(i, new Color(d.color));
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      meshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [dummy, details]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
};

interface GardenFloorProps {
  onFloorClick: (point: Vector3) => void;
}

const GardenFloor: React.FC<GardenFloorProps> = ({ onFloorClick }) => {
  return (
    <group>
      {/* Main Base - Dark Rainforest Soil/Moss color */}
      {/* Positioned at y=-0.01 to allow shadows at y=0+ to show without fighting */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
        onPointerMove={(e) => {
           // Only track floor hits
           if (e.object.name === "floor") {
             onFloorClick(e.point);
           }
        }}
        name="floor"
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#2d4c1e" /> 
      </mesh>
      <GroundDetails />
    </group>
  );
};

interface GameSceneProps {
  setHoveredPlant: (p: PlantData | null) => void;
}

const GameScene: React.FC<GameSceneProps> = ({ setHoveredPlant }) => {
  const [targetPos, setTargetPos] = useState(new Vector3(0, 0, 0));
  const [charPos, setCharPos] = useState(new Vector3(0, 0, 0));
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Check proximity for UI
  useEffect(() => {
     let nearest: PlantData | null = null;
     let minDist = 4.0; 

     GARDEN_DATA.forEach(p => {
        const pPos = new Vector3(...p.position);
        const dist = pPos.distanceTo(charPos);
        if (dist < minDist) {
           minDist = dist;
           nearest = p;
        }
     });

     if (hoveredId === null) {
        setHoveredPlant(nearest);
     } else {
        setHoveredPlant(GARDEN_DATA.find(p => p.id === hoveredId) || null);
     }
  }, [charPos, hoveredId]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight 
        position={[20, 30, 15]} 
        intensity={1.2} 
        color="#FFF9E0"
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-bias={-0.0005} // Adjusted bias for self-shadowing artifacts
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      
      <GardenFloor onFloorClick={(pt) => setTargetPos(pt)} />

      {GARDEN_DATA.map((plant) => (
        <Plant 
          key={plant.id} 
          data={plant} 
          isHovered={hoveredId === plant.id}
          onHover={(h) => setHoveredId(h ? plant.id : null)}
        />
      ))}

      <Character targetPosition={targetPos} onPositionChange={setCharPos} />
    </>
  );
};

interface UIProps {
  plant: PlantData | null;
}

const UI: React.FC<UIProps> = ({ plant }) => {
  if (!plant) return (
     <div className="absolute bottom-4 left-4 p-4 font-pixel text-white/90 pointer-events-none select-none drop-shadow-lg">
        <p className="text-xl">Click on the ground to explore the lush garden.</p>
     </div>
  );

  return (
    <div className="absolute top-4 right-4 max-w-sm p-5 bg-[#fff8e7]/95 border-[6px] border-emerald-800 rounded-lg shadow-2xl font-pixel transition-all duration-300 transform translate-y-0">
      <div className="absolute -top-3 -left-3 w-8 h-8 bg-emerald-600 border-4 border-emerald-900 rounded-full"></div>
      <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-yellow-500 border-4 border-yellow-800 rounded-full"></div>
      
      <h2 className="text-4xl font-bold text-emerald-900 mb-1 leading-none tracking-wide">{plant.chineseName}</h2>
      <h3 className="text-2xl text-emerald-700 italic mb-1">{plant.name}</h3>
      <div className="text-sm text-emerald-600/70 mb-3 font-mono border-b-2 border-emerald-200 pb-2">{plant.latinName}</div>
      <p className="text-xl text-emerald-950 leading-snug">
        {plant.feature}
      </p>
      <div className="mt-4 flex gap-2">
         <span className="text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 px-2 py-1 rounded shadow-sm border-b-2 border-emerald-800">
            {plant.type.replace('_', ' ')}
         </span>
      </div>
    </div>
  );
};

const App = () => {
  const [activePlant, setActivePlant] = useState<PlantData | null>(null);

  return (
    <div className="relative w-full h-full bg-[#4db6ac] cursor-crosshair overflow-hidden">
      {/* Set near/far planes to optimize depth buffer precision */}
      <Canvas shadows camera={{ position: [20, 20, 20], fov: 28, near: 0.1, far: 200 }}>
        <GameScene setHoveredPlant={setActivePlant} />
        <OrbitControls 
          enableZoom={true} 
          maxPolarAngle={Math.PI / 2.1} // Prevent camera from going under ground
          minPolarAngle={Math.PI / 8}
          minDistance={10}
          maxDistance={60}
          target={[0, 0, 0]}
        />
        {/* Adjusted ContactShadows to lift slightly off ground */}
        <ContactShadows resolution={1024} scale={80} blur={3} opacity={0.4} far={10} color="#001a00" position={[0, 0.01, 0]} />
        <fog attach="fog" args={['#4db6ac', 25, 80]} /> 
      </Canvas>
      <UI plant={activePlant} />
      
      <div className="absolute bottom-2 right-2 text-xs font-pixel text-white/60 pointer-events-none drop-shadow-md">
         Pixel Tropical Garden v1.2
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
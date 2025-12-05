import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh, Color, InstancedMesh, Object3D } from 'three';
import { OrbitControls, Html, ContactShadows, useCursor } from '@react-three/drei';
import { GARDEN_DATA } from './constants';
import { PlantData, VoxelData } from './types';
import { generateVoxels, generateCharacterVoxels } from './components/VoxelUtils';

// --- Components ---

const VOXEL_SIZE = 0.15; // Size of each voxel in world units

interface VoxelMeshProps {
  voxels: VoxelData[];
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const VoxelMesh: React.FC<VoxelMeshProps> = ({ voxels, position, rotation }) => {
  return (
    <group position={position} rotation={rotation}>
      {voxels.map((v, i) => (
        <mesh key={i} position={[v.x * VOXEL_SIZE, v.y * VOXEL_SIZE, v.z * VOXEL_SIZE]} castShadow receiveShadow>
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
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 5) * 0.05 + 0.1;
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
       {/* Simple shadow for plant */}
       <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
         <circleGeometry args={[0.8, 16]} />
         <meshBasicMaterial color="#000000" opacity={0.3} transparent />
       </mesh>
    </group>
  );
};

interface CharacterProps {
  targetPosition: Vector3;
  onPositionChange: (pos: Vector3) => void;
}

const Character: React.FC<CharacterProps> = ({ targetPosition, onPositionChange }) => {
  const voxels = useMemo(() => generateCharacterVoxels(), []);
  const groupRef = useRef<Group>(null); // Controls position and rotation
  const visualRef = useRef<Group>(null); // Controls bobbing
  const position = useRef(new Vector3(0, 0, 0));

  useFrame((state, delta) => {
    if (!groupRef.current || !visualRef.current) return;

    // Move towards target
    const step = 4 * delta; // Speed
    const dist = position.current.distanceTo(targetPosition);
    
    if (dist > 0.1) {
      const direction = new Vector3().subVectors(targetPosition, position.current).normalize();
      
      // Update position
      position.current.add(direction.multiplyScalar(step));
      
      // Update rotation to look at target - STRICTLY Y AXIS
      // We create a target vector that shares the exact same Y as the current position
      // This prevents the "LookAt" function from tilting the character up or down
      const lookTarget = new Vector3(targetPosition.x, position.current.y, targetPosition.z);
      groupRef.current.lookAt(lookTarget);
      
      // Bobbing animation on child visual mesh
      visualRef.current.position.y = Math.abs(Math.sin(state.clock.getElapsedTime() * 12)) * 0.15;
    } else {
       // Idle return to ground
       visualRef.current.position.y = 0;
    }

    groupRef.current.position.x = position.current.x;
    groupRef.current.position.y = position.current.y;
    groupRef.current.position.z = position.current.z;
    
    onPositionChange(position.current.clone());
  });

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <VoxelMesh voxels={voxels} position={[0, 0, 0]} />
      </group>
      {/* Character Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
         <circleGeometry args={[0.3, 16]} />
         <meshBasicMaterial color="#000000" opacity={0.3} transparent />
      </mesh>
    </group>
  );
};

interface GroundDetailsProps {
  count?: number;
}

const GroundDetails: React.FC<GroundDetailsProps> = ({ count = 600 }) => {
  // Instanced mesh for grass tufts and small stones
  const meshRef = useRef<InstancedMesh>(null);
  const { scene } = useThree();
  
  const dummy = useMemo(() => new Object3D(), []);
  const details = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
       // Random position on floor, excluding center slightly?
       const r = Math.random() * 35; // Radius
       const theta = Math.random() * Math.PI * 2;
       const x = r * Math.cos(theta);
       const z = r * Math.sin(theta);
       
       // Scale variation
       const s = Math.random() * 0.5 + 0.5;
       
       // Color variation
       const type = Math.random();
       let color = "#228B22"; // Forest Green
       if (type > 0.95) color = "#808080"; // Rock
       else if (type > 0.90) color = "#FF69B4"; // Fallen petal
       else if (type > 0.6) color = "#006400"; // Dark Green
       else if (type > 0.3) color = "#32CD32"; // Lime Green
       
       data.push({ x, z, s, color });
    }
    return data;
  }, [count]);

  useEffect(() => {
    if (meshRef.current) {
      details.forEach((d, i) => {
        dummy.position.set(d.x, 0, d.z);
        dummy.scale.set(d.s, d.s * (Math.random() + 0.5), d.s); // Varying heights
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
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.05, 0]} 
        receiveShadow
        onPointerMove={(e) => {
           onFloorClick(e.point);
        }}
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#2d4c1e" /> 
      </mesh>
      
      {/* Scattered Voxel Details */}
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

  // Check proximity to plants
  useEffect(() => {
     let nearest: PlantData | null = null;
     let minDist = 3.5; // Interaction radius (Increased for bigger plants)

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
      <ambientLight intensity={0.6} />
      {/* Warmer sunlight for tropical feel */}
      <directionalLight 
        position={[15, 25, 10]} 
        intensity={1.5} 
        color="#FFFAF0"
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-bias={-0.0001}
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
     <div className="absolute bottom-4 left-4 p-4 font-pixel text-white/80 pointer-events-none select-none">
        <p className="text-xl drop-shadow-md">Move the cursor to explore the lush garden.</p>
     </div>
  );

  return (
    <div className="absolute top-4 right-4 max-w-sm p-4 bg-white/95 border-4 border-emerald-800 rounded shadow-xl font-pixel transition-all duration-300 transform translate-y-0">
      <h2 className="text-3xl font-bold text-emerald-900 mb-1">{plant.chineseName}</h2>
      <h3 className="text-xl text-emerald-700 italic mb-2">{plant.name}</h3>
      <div className="text-sm text-gray-500 mb-2 font-mono">{plant.latinName}</div>
      <p className="text-lg text-gray-800 leading-tight border-t-2 border-emerald-100 pt-2">
        {plant.feature}
      </p>
      <div className="mt-2 text-xs uppercase tracking-wider text-emerald-600 bg-emerald-100 inline-block px-2 py-1 rounded">
         {plant.type.replace('_', ' ')}
      </div>
    </div>
  );
};

const App = () => {
  const [activePlant, setActivePlant] = useState<PlantData | null>(null);

  return (
    <div className="relative w-full h-full bg-sky-300 cursor-crosshair">
      <Canvas shadows camera={{ position: [15, 15, 15], fov: 30 }}>
        <GameScene setHoveredPlant={setActivePlant} />
        <OrbitControls 
          enableZoom={true} 
          maxPolarAngle={Math.PI / 2.2} 
          minPolarAngle={Math.PI / 6}
          minDistance={10}
          maxDistance={40}
        />
        <ContactShadows resolution={512} scale={60} blur={2} opacity={0.5} far={10} color="#001a00" />
        <fog attach="fog" args={['#87CEEB', 20, 60]} /> 
      </Canvas>
      <UI plant={activePlant} />
      
      <div className="absolute bottom-2 right-2 text-xs font-pixel text-white/50 pointer-events-none">
         Pixel Tropical Garden
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
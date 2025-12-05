import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Vector3, Group, Mesh, Color, InstancedMesh, Object3D, MeshBasicMaterial, DoubleSide, AdditiveBlending, ShaderMaterial, FogExp2 } from 'three';
import { OrbitControls, Html, ContactShadows, useCursor } from '@react-three/drei';
import { GARDEN_DATA } from './constants';
import { PlantData, VoxelData, PlantType, WeatherCondition } from './types';
import { generateVoxels, generateCharacterVoxels } from './components/VoxelUtils';

// --- Components ---

const VOXEL_SIZE = 0.15; // Size of each voxel in world units

// --- Shaders ---

const RainShaderMaterial = new ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new Color('#AACCFF') },
    uHeight: { value: 40.0 }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uHeight;
    attribute float aSpeed;
    attribute float aOffset;
    varying float vAlpha;
    
    void main() {
      vec3 pos = position;
      // Fall down
      float y = pos.y - uTime * aSpeed * 5.0;
      // Loop
      pos.y = mod(y, uHeight);
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Streak stretching based on camera view not implemented for simplicity, 
      // just rely on motion
      gl_PointSize = 2.0;
      
      // Fade near top/bottom
      float h = pos.y / uHeight;
      vAlpha = 1.0 - abs(h - 0.5) * 2.0;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vAlpha;
    
    void main() {
      if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
      gl_FragColor = vec4(uColor, vAlpha * 0.6);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending
});

interface VoxelMeshProps {
  voxels: VoxelData[];
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const VoxelMesh: React.FC<VoxelMeshProps> = ({ voxels, position, rotation }) => {
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
  weather: WeatherCondition;
}

const Plant: React.FC<PlantProps> = ({ data, isHovered, onHover, weather }) => {
  const voxels = useMemo(() => generateVoxels(data.type, data.colors), [data]);
  const groupRef = useRef<Group>(null);
  
  // Random phase for wind
  const seed = useMemo(() => Math.random() * 100, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();

    let windX = 0;
    let windZ = 0;
    let bounceY = 0;

    if (weather === WeatherCondition.TROPICAL_THUNDERSTORM) {
        // Violent shaking
        const windSpeed = 8.0;
        windX = Math.sin(time * windSpeed + seed) * 0.15;
        windZ = Math.cos(time * (windSpeed * 0.8) + seed) * 0.15;
    } else if (weather === WeatherCondition.AFTERNOON_DELUGE) {
        // Heavy rain depression
        bounceY = -0.05 + Math.sin(time * 2 + seed) * 0.02;
    } else {
        // Gentle breeze
        windX = Math.sin(time + seed) * 0.03;
    }

    // Hover bounce overrides or adds
    if (isHovered) {
      bounceY += Math.sin(time * 5) * 0.05;
    }

    groupRef.current.position.y = bounceY;
    groupRef.current.rotation.z = windX;
    groupRef.current.rotation.x = windZ;
  });

  return (
    <group 
      position={data.position} 
      ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(false); }}
    >
       <VoxelMesh voxels={voxels} />
       {/* Shadow */}
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
  weather: WeatherCondition;
}

const GardenFloor: React.FC<GardenFloorProps> = ({ onFloorClick, weather }) => {
  const floorColor = useMemo(() => {
    switch (weather) {
        case WeatherCondition.AFTERNOON_DELUGE: return '#1a2e15';
        case WeatherCondition.TROPICAL_THUNDERSTORM: return '#0d1a0d';
        case WeatherCondition.EQUATORIAL_HEAT: return '#4d5c1e';
        default: return '#2d4c1e';
    }
  }, [weather]);

  return (
    <group>
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
        onPointerMove={(e) => {
           if (e.object.name === "floor") {
             onFloorClick(e.point);
           }
        }}
        name="floor"
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={floorColor} /> 
      </mesh>
      <GroundDetails />
    </group>
  );
};

// --- Weather FX Components ---

const RainFX = () => {
    const count = 3000;
    const geo = useMemo(() => {
        const p = new Float32Array(count * 3);
        const s = new Float32Array(count);
        for(let i=0; i<count; i++) {
            p[i*3] = (Math.random() - 0.5) * 60;
            p[i*3+1] = Math.random() * 40;
            p[i*3+2] = (Math.random() - 0.5) * 60;
            s[i] = Math.random() * 0.5 + 0.5;
        }
        return { p, s };
    }, []);

    const mat = useMemo(() => RainShaderMaterial.clone(), []);

    useFrame(({ clock }) => {
        mat.uniforms.uTime.value = clock.getElapsedTime();
    });

    return (
        <points>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={geo.p} itemSize={3} />
                <bufferAttribute attach="attributes-aSpeed" count={count} array={geo.s} itemSize={1} />
            </bufferGeometry>
            <primitive object={mat} attach="material" />
        </points>
    );
}

const DustFX = () => {
    const count = 500;
    const mesh = useRef<InstancedMesh>(null);
    const dummy = useMemo(() => new Object3D(), []);
    
    // Initial random positions
    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            x: (Math.random() - 0.5) * 50,
            y: Math.random() * 15,
            z: (Math.random() - 0.5) * 50,
            speedX: (Math.random() - 0.5) * 0.2,
            speedY: (Math.random() - 0.5) * 0.2,
            speedZ: (Math.random() - 0.5) * 0.2,
            scale: Math.random() * 0.05 + 0.02
        }))
    }, []);

    useFrame(({ clock }) => {
        if (!mesh.current) return;
        const t = clock.getElapsedTime();
        particles.forEach((p, i) => {
            // Browninan motion approximation
            const timeX = t * 0.5 + i;
            p.x += Math.sin(timeX) * 0.01 + p.speedX * 0.01;
            p.y += Math.cos(timeX * 0.8) * 0.01 + p.speedY * 0.01;
            p.z += Math.sin(timeX * 1.2) * 0.01 + p.speedZ * 0.01;

            // Loop bounds
            if (p.y > 15) p.y = 0;
            if (p.y < 0) p.y = 15;
            
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            mesh.current!.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshBasicMaterial color="#FFD700" transparent opacity={0.4} blending={AdditiveBlending} />
        </instancedMesh>
    )
}

const LightningFX = () => {
    const light = useRef<any>(null);
    
    useFrame(({ clock }) => {
        if (!light.current) return;
        // Random flashes
        if (Math.random() > 0.96) {
             light.current.intensity = 10 + Math.random() * 20;
             light.current.position.set(
                 (Math.random() - 0.5) * 40,
                 30,
                 (Math.random() - 0.5) * 40
             );
        } else {
             light.current.intensity *= 0.8; // Fast fade
        }
    });

    return <pointLight ref={light} distance={100} color="#a0c4ff" intensity={0} />
}

interface WeatherSystemProps {
    weather: WeatherCondition;
}

const WeatherSystem: React.FC<WeatherSystemProps> = ({ weather }) => {
    const { scene, gl } = useThree();

    useEffect(() => {
        let fogColor = '#4db6ac';
        let fogDensity = 0.02;
        let bg = '#4db6ac';

        switch(weather) {
            case WeatherCondition.LUCID_DREAM:
                fogColor = '#4db6ac';
                fogDensity = 0.015;
                bg = '#4db6ac';
                break;
            case WeatherCondition.AFTERNOON_DELUGE:
                fogColor = '#505557';
                fogDensity = 0.04;
                bg = '#505557';
                break;
            case WeatherCondition.SATURATED_STILLNESS:
                fogColor = '#dbe8d6';
                fogDensity = 0.06; // Heavy low fog
                bg = '#dbe8d6';
                break;
            case WeatherCondition.MORNING_MIST:
                fogColor = '#e0e0e0';
                fogDensity = 0.08;
                bg = '#e0e0e0';
                break;
            case WeatherCondition.EQUATORIAL_HEAT:
                fogColor = '#ffeebb';
                fogDensity = 0.01;
                bg = '#ffeebb';
                break;
            case WeatherCondition.TROPICAL_THUNDERSTORM:
                fogColor = '#1a1a2e';
                fogDensity = 0.04;
                bg = '#1a1a2e';
                break;
        }
        
        scene.fog = new FogExp2(fogColor, fogDensity);
        scene.background = new Color(bg);
        
        // Very basic "screen tint" via global clear color? No, we use background.
    }, [weather, scene]);

    // Lighting adjustments
    const ambientProps = useMemo(() => {
        switch(weather) {
            case WeatherCondition.AFTERNOON_DELUGE: return { intensity: 0.4, color: '#8899aa' };
            case WeatherCondition.TROPICAL_THUNDERSTORM: return { intensity: 0.2, color: '#222244' };
            case WeatherCondition.EQUATORIAL_HEAT: return { intensity: 0.9, color: '#ffaa66' };
            case WeatherCondition.MORNING_MIST: return { intensity: 0.8, color: '#ccddff' };
            default: return { intensity: 0.7, color: '#ffffff' };
        }
    }, [weather]);

    const dirLightProps = useMemo(() => {
        switch(weather) {
            case WeatherCondition.AFTERNOON_DELUGE: return { intensity: 0.2, color: '#aabbcc' };
            case WeatherCondition.TROPICAL_THUNDERSTORM: return { intensity: 0.1, color: '#444488' };
            case WeatherCondition.EQUATORIAL_HEAT: return { intensity: 1.8, color: '#fff0dd' }; // Blinding sun
             case WeatherCondition.MORNING_MIST: return { intensity: 0.5, color: '#ffffee' };
            default: return { intensity: 1.2, color: '#FFF9E0' };
        }
    }, [weather]);

    return (
        <>
            <ambientLight {...ambientProps} />
            <directionalLight 
                position={[20, 30, 15]} 
                castShadow 
                shadow-mapSize={[2048, 2048]} 
                shadow-bias={-0.0005} 
                shadow-camera-left={-30}
                shadow-camera-right={30}
                shadow-camera-top={30}
                shadow-camera-bottom={-30}
                {...dirLightProps}
            />

            {(weather === WeatherCondition.AFTERNOON_DELUGE || weather === WeatherCondition.TROPICAL_THUNDERSTORM) && <RainFX />}
            {weather === WeatherCondition.SATURATED_STILLNESS && <DustFX />}
            {weather === WeatherCondition.TROPICAL_THUNDERSTORM && <LightningFX />}
        </>
    );
};

interface GameSceneProps {
  setHoveredPlant: (p: PlantData | null) => void;
  weather: WeatherCondition;
}

const GameScene: React.FC<GameSceneProps> = ({ setHoveredPlant, weather }) => {
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
      <WeatherSystem weather={weather} />
      
      <GardenFloor onFloorClick={(pt) => setTargetPos(pt)} weather={weather} />

      {GARDEN_DATA.map((plant) => (
        <Plant 
          key={plant.id} 
          data={plant} 
          isHovered={hoveredId === plant.id}
          onHover={(h) => setHoveredId(h ? plant.id : null)}
          weather={weather}
        />
      ))}

      <Character targetPosition={targetPos} onPositionChange={setCharPos} />
    </>
  );
};

interface UIProps {
  plant: PlantData | null;
  weather: WeatherCondition;
  setWeather: (w: WeatherCondition) => void;
}

const UI: React.FC<UIProps> = ({ plant, weather, setWeather }) => {
  const weatherLabels: Record<WeatherCondition, string> = {
      [WeatherCondition.LUCID_DREAM]: "Lucid Dream",
      [WeatherCondition.AFTERNOON_DELUGE]: "Afternoon Deluge",
      [WeatherCondition.SATURATED_STILLNESS]: "Saturated Stillness",
      [WeatherCondition.MORNING_MIST]: "Morning Mist",
      [WeatherCondition.EQUATORIAL_HEAT]: "Equatorial Heat",
      [WeatherCondition.TROPICAL_THUNDERSTORM]: "Tropical Storm",
  };

  return (
    <>
      {/* Weather Controls */}
      <div className="absolute top-4 left-4 p-4 bg-[#fff8e7]/90 border-[4px] border-emerald-800 rounded-lg shadow-xl font-pixel z-10">
          <h3 className="text-emerald-900 text-xl mb-2 font-bold uppercase border-b border-emerald-600 pb-1">Atmosphere</h3>
          <div className="flex flex-col gap-1">
             {Object.values(WeatherCondition).map((w) => (
                 <button 
                    key={w}
                    onClick={() => setWeather(w)}
                    className={`text-left px-2 py-1 text-lg hover:bg-emerald-200 transition-colors rounded ${weather === w ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-800'}`}
                 >
                    {weatherLabels[w]}
                 </button>
             ))}
          </div>
      </div>

      {/* Plant Info */}
      {plant ? (
        <div className="absolute top-4 right-4 max-w-sm p-5 bg-[#fff8e7]/95 border-[6px] border-emerald-800 rounded-lg shadow-2xl font-pixel transition-all duration-300 transform translate-y-0 z-10">
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
      ) : (
         <div className="absolute bottom-4 left-4 p-4 font-pixel text-white/90 pointer-events-none select-none drop-shadow-lg z-0">
            <p className="text-xl">Click on the ground to explore the lush garden.</p>
         </div>
      )}
    </>
  );
};

const App = () => {
  const [activePlant, setActivePlant] = useState<PlantData | null>(null);
  const [weather, setWeather] = useState<WeatherCondition>(WeatherCondition.LUCID_DREAM);

  return (
    <div className="relative w-full h-full bg-[#4db6ac] cursor-crosshair overflow-hidden">
      <Canvas shadows camera={{ position: [20, 20, 20], fov: 28, near: 0.1, far: 200 }}>
        <GameScene setHoveredPlant={setActivePlant} weather={weather} />
        <OrbitControls 
          enableZoom={true} 
          maxPolarAngle={Math.PI / 2.1} 
          minPolarAngle={Math.PI / 8}
          minDistance={10}
          maxDistance={60}
          target={[0, 0, 0]}
        />
        <ContactShadows resolution={1024} scale={80} blur={3} opacity={0.4} far={10} color="#001a00" position={[0, 0.01, 0]} />
      </Canvas>
      <UI plant={activePlant} weather={weather} setWeather={setWeather} />
      
      <div className="absolute bottom-2 right-2 text-xs font-pixel text-white/60 pointer-events-none drop-shadow-md">
         Pixel Tropical Garden v1.2
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
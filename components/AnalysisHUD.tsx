import React, { useEffect, useRef, useState } from 'react';
import { SonicParameters } from '../types';

interface AnalysisHUDProps {
  imageSrc: string;
  isAnalyzing: boolean;
  isPlaying: boolean;
  sonicParams: SonicParameters | null;
  currentStep: number;
  onColorsDetected?: (colors: string[]) => void;
}

interface ScanBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  value: string;
}

const AnalysisHUD: React.FC<AnalysisHUDProps> = ({ imageSrc, isAnalyzing, isPlaying, sonicParams, currentStep, onColorsDetected }) => {
  const [colors, setColors] = useState<string[]>([]);
  const [scanBoxes, setScanBoxes] = useState<ScanBox[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Color Extraction
  useEffect(() => {
    if (!canvasRef.current || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return;
      
      // Draw small version for sampling
      canvasRef.current!.width = 100;
      canvasRef.current!.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);
      
      const newColors: string[] = [];
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(Math.random() * 80 + 10);
        const y = Math.floor(Math.random() * 80 + 10);
        const data = ctx.getImageData(x, y, 1, 1).data;
        const hex = `#${((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1)}`;
        newColors.push(hex);
      }
      setColors(newColors);
      if (onColorsDetected) {
        onColorsDetected(newColors);
      }
    };
  }, [imageSrc]); // Removed onColorsDetected from dependency to avoid loop if parent function is unstable

  // Scanning Animation
  useEffect(() => {
    if (!isAnalyzing) {
        setScanBoxes([]); 
        return;
    }

    const labels = ["CONTRAST_ZONE", "SHAPE_DETECT", "TEXTURE_LOCK", "LUMA_HISTOGRAM", "CHROMATIC_ABERRATION"];
    
    const interval = setInterval(() => {
        // Add a new random box
        const newBox = {
            id: Date.now(),
            x: Math.random() * 60 + 10, // 10-70%
            y: Math.random() * 60 + 10,
            w: Math.random() * 20 + 10,
            h: Math.random() * 20 + 10,
            label: labels[Math.floor(Math.random() * labels.length)],
            value: `[0.${Math.floor(Math.random() * 99)}]`
        };
        
        setScanBoxes(prev => [...prev.slice(-2), newBox]); // Keep last 3

        // Add log
        const logMessages = [
            "SEARCHING_FAUNA_DATABASE...",
            "CALCULATING_LUMA_HISTOGRAM",
            "IDENTIFYING_ENTITIES",
            "DETECTING_MOVEMENT_VECTORS",
            "ISOLATING_VOCAL_PATTERNS",
            "PARSING_GEOMETRY",
            "SYNTHESIZING_WAVEFORMS"
        ];
        setLogs(prev => [...prev.slice(-5), `> ${logMessages[Math.floor(Math.random() * logMessages.length)]}`]);

    }, 600);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Playback Zone Calculation
  // We map the 16 steps to a 4x4 grid on the image
  const getPlaybackZone = () => {
      const col = currentStep % 4;
      const row = Math.floor(currentStep / 4);
      
      // Add slight jitter so it doesn't look too rigid
      const jitterX = (Math.sin(Date.now() / 100) * 2); 
      const jitterY = (Math.cos(Date.now() / 100) * 2);

      return {
          left: `${(col * 25) + 2 + jitterX}%`,
          top: `${(row * 25) + 2 + jitterY}%`,
          width: '21%',
          height: '21%'
      };
  };

  return (
    <div ref={containerRef} className="relative w-full h-full rounded-lg overflow-hidden border border-blue-900 bg-black/50 backdrop-blur-sm shadow-[0_0_30px_rgba(0,100,255,0.1)]">
      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Image */}
      <img 
        src={imageSrc} 
        alt="Analysis Target" 
        className={`w-full h-full object-cover transition-all duration-1000 ${isAnalyzing ? 'opacity-80 grayscale-[30%] contrast-125' : 'opacity-40 grayscale-[80%]'}`} 
      />

      {/* Overlay Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Decorative Corners */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/50" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/50" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/50" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/50" />

      {/* Scanning Boxes (Analysis Mode) */}
      {isAnalyzing && scanBoxes.map(box => (
        <div 
            key={box.id}
            // UPDATED: White border with Blue Shadow/Glow
            className="absolute border border-white/70 shadow-[0_0_15px_rgba(0,140,255,0.6)] text-white font-mono text-[10px] animate-pulse"
            style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.w}%`,
                height: `${box.h}%`
            }}
        >
            {/* UPDATED: Blue background for label */}
            <div className="absolute -top-5 left-0 bg-blue-600/90 px-1 py-0.5 whitespace-nowrap border border-white/40 flex gap-2 shadow-sm backdrop-blur-md">
                <span className="font-bold tracking-wider">{box.label}</span>
                <span className="text-cyan-100">{box.value}</span>
            </div>
            
            {/* Corners (White) */}
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-white shadow-[0_0_5px_white]" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white shadow-[0_0_5px_white]" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border border-white" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border border-white" />
        </div>
      ))}

      {/* Playback Audio Source Zone (Play Mode) */}
      {isPlaying && (
          <div 
            className="absolute border-2 border-white/60 bg-cyan-400/10 shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all duration-100 ease-out"
            style={getPlaybackZone()}
          >
               <div className="absolute -top-5 left-0 bg-cyan-900/90 text-[10px] px-1 text-cyan-100 font-mono border border-cyan-500/50">
                  AUDIO_SOURCE: SECTOR {currentStep + 1}
               </div>
               {/* Decorative Crosshair */}
               <div className="absolute top-1/2 left-0 w-full h-[1px] bg-cyan-400/40" />
               <div className="absolute top-0 left-1/2 w-[1px] h-full bg-cyan-400/40" />
          </div>
      )}

      {/* Color Palette Analysis (Top Right) */}
      <div className="absolute top-8 right-8 flex flex-col gap-2 font-mono text-xs z-10">
         <div className="text-right text-cyan-100 border-b border-cyan-800 pb-1 mb-1">CHROMATIC_DATA</div>
         {colors.map((color, idx) => (
             <div key={idx} className="flex items-center gap-2 justify-end animate-fade-in-right" style={{ animationDelay: `${idx * 100}ms` }}>
                 <span className="text-gray-400 bg-black/50 px-1">{color.toUpperCase()}</span>
                 <div className="w-4 h-4 border border-white/20" style={{ backgroundColor: color }} />
             </div>
         ))}
      </div>

      {/* Processing Status / Logs (Bottom Left) */}
      <div className="absolute bottom-8 left-8 font-mono text-xs text-cyan-200/80 z-10">
         {isAnalyzing && (
             <div className="mb-2 bg-white text-blue-900 px-2 py-1 inline-block font-bold animate-pulse">
                 PROCESSING
             </div>
         )}
         <div className="flex flex-col gap-1">
             {logs.map((log, i) => (
                 <div key={i} className="opacity-70 drop-shadow-md">{log}</div>
             ))}
         </div>
      </div>

      {/* Final Parameters Overlay (When Ready) */}
      {sonicParams && !isAnalyzing && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="absolute bottom-20 w-full text-center">
                 <div className="inline-flex gap-8 text-[10px] text-cyan-200 font-mono tracking-[0.2em] border-t border-b border-cyan-500/30 py-2 bg-black/60 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    <span>WAVEFORM: {sonicParams.synthType.toUpperCase()}</span>
                    <span>FREQ: {sonicParams.baseNoteFrequency.toFixed(1)}HZ</span>
                    <span>SPACE: {(sonicParams.space * 100).toFixed(0)}%</span>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default AnalysisHUD;
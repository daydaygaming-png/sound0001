import React, { useRef, useEffect } from 'react';
import { HandGestures } from '../types';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  gestures: HandGestures;
  baseColor: string;
  colors?: string[]; // New prop for extracted colors
}

interface BlockParticle {
    x: number;
    y: number;
    z: number; // Depth 0-1
    w: number;
    h: number;
    color: string;
    baseW: number;
    baseH: number;
    speedX: number;
    speedY: number;
    freqIndex: number; // Which frequency bin modulates this block
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, gestures, baseColor, colors = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const blocksRef = useRef<BlockParticle[]>([]);

  // Initialize Blocks based on colors
  useEffect(() => {
    if (!colors.length) return;

    const blocks: BlockParticle[] = [];
    const numBlocks = 40;
    const palette = colors.length > 0 ? colors : [baseColor, '#ffffff', '#555555'];

    for (let i = 0; i < numBlocks; i++) {
        const depth = Math.random();
        blocks.push({
            x: Math.random(), // Normalized 0-1
            y: Math.random(), // Normalized 0-1
            z: depth,
            baseW: (Math.random() * 50 + 20) * (depth + 0.5),
            baseH: (Math.random() * 50 + 20) * (depth + 0.5),
            w: 0, 
            h: 0,
            color: palette[Math.floor(Math.random() * palette.length)],
            speedX: (Math.random() - 0.5) * 0.001,
            speedY: (Math.random() - 0.5) * 0.001,
            freqIndex: Math.floor(Math.random() * 50) // Map to low/mid freqs
        });
    }
    blocksRef.current = blocks;
  }, [colors, baseColor]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    let dataArray: Uint8Array;
    if (analyser) {
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);

      // Clear with heavy fade for trail effect
      ctx.fillStyle = gestures.isFist ? 'rgba(20, 0, 0, 0.3)' : 'rgba(5, 5, 5, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
      }

      const hasAudio = analyser && dataArray && dataArray.some(x => x > 0);
      const intensity = hasAudio ? dataArray.reduce((a,b)=>a+b,0) / dataArray.length : 0;
      
      // Use screen blend mode for glowing overlapping blocks
      ctx.globalCompositeOperation = 'screen';

      // Draw Blocks
      if (blocksRef.current.length > 0) {
          blocksRef.current.forEach(block => {
              // Modulate size with audio
              let scale = 1.0;
              if (hasAudio) {
                  // Use specific frequency bin + overall intensity
                  const freqVal = dataArray[block.freqIndex] || 0;
                  scale = 1 + (freqVal / 128) * 1.5 + (intensity / 100);
                  
                  // Fist gesture compresses the blocks (tension)
                  if (gestures.isFist) {
                      scale *= 0.5;
                      // Jitter position
                      block.x += (Math.random() - 0.5) * 0.01;
                      block.y += (Math.random() - 0.5) * 0.01;
                  }
              } else {
                  // Idle breathing
                  scale = 1 + Math.sin(Date.now() / 1000 + block.x * 10) * 0.1;
              }

              // Update Position
              block.x += block.speedX * (1 + intensity/50);
              block.y += block.speedY * (1 + intensity/50);

              // Wrap around screen
              if (block.x < -0.1) block.x = 1.1;
              if (block.x > 1.1) block.x = -0.1;
              if (block.y < -0.1) block.y = 1.1;
              if (block.y > 1.1) block.y = -0.1;

              const w = block.baseW * scale;
              const h = block.baseH * scale;
              const cx = block.x * canvas.width;
              const cy = block.y * canvas.height;

              ctx.fillStyle = block.color;
              // Opacity based on Z-depth and Audio
              const alpha = (0.3 + (hasAudio ? (dataArray[block.freqIndex]/255)*0.7 : 0.1)) * block.z;
              ctx.globalAlpha = alpha;

              ctx.fillRect(cx - w/2, cy - h/2, w, h);
          });
      } else {
         // Fallback if no colors yet (e.g. before analysis)
         // Draw a subtle grid or idle circle
         ctx.strokeStyle = '#333';
         ctx.lineWidth = 1;
         ctx.globalAlpha = 0.2;
         const time = Date.now() / 2000;
         ctx.beginPath();
         ctx.arc(canvas.width/2, canvas.height/2, 200 + Math.sin(time)*20, 0, Math.PI*2);
         ctx.stroke();
      }

      // Reset blend mode for UI
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;

      // --- HAND GESTURE VISUALS (Cursor) ---
      if (gestures.isVisible) {
          const cx = gestures.x * canvas.width;
          const cy = (1 - gestures.y) * canvas.height; // Un-invert for display
          
          ctx.beginPath();
          let radius = 20;
          let color = '#00ffff';
          
          if (gestures.isFist) {
              radius = 10;
              color = '#ff0044'; 
          } else if (gestures.isPinching) {
              radius = 5;
              color = '#ffff00';
          } else {
              radius = 25 + Math.sin(Date.now() / 200) * 5; 
          }

          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Fill for fist
          if (gestures.isFist) {
              ctx.fillStyle = 'rgba(255, 0, 68, 0.3)';
              ctx.fill();
          }

          // Crosshairs
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, canvas.height);
          ctx.moveTo(0, cy);
          ctx.lineTo(canvas.width, cy);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Param Labels
          ctx.fillStyle = '#888';
          ctx.font = '10px monospace';
          ctx.fillText(`FILTER: ${Math.round(gestures.x * 100)}%`, cx + 30, cy - 10);
          ctx.fillText(`RES: ${Math.round(gestures.y * 100)}%`, cx + 30, cy + 5);

          // Mode Label
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = color;
          let modeText = "FULL MIX";
          if (gestures.isFist) modeText = ">>> BUILD UP <<<";
          if (gestures.isPinching) modeText = "GLITCH FX";
          ctx.fillText(modeText, cx + 30, cy + 25);
      }
    };

    draw();

    return () => {
      window.cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [analyser, gestures, baseColor, colors]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-10" />;
};

export default Visualizer;
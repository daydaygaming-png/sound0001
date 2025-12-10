import React, { useRef, useEffect } from 'react';

interface RhythmScopeProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
}

const RhythmScope: React.FC<RhythmScopeProps> = ({ analyser, isActive, color = '#00f0ff' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let dataArray: Uint8Array;
    if (analyser) {
        dataArray = new Uint8Array(analyser.fftSize);
    } else {
        // Dummy data for idle state
        dataArray = new Uint8Array(2048).fill(128); 
    }

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);
      
      // Clear
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Trail effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid Lines
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      if (!isActive && !analyser) {
          // Flatline
          ctx.beginPath();
          ctx.strokeStyle = '#333';
          ctx.moveTo(0, canvas.height/2);
          ctx.lineTo(canvas.width, canvas.height/2);
          ctx.stroke();
          return;
      }

      if (analyser) {
        analyser.getByteTimeDomainData(dataArray);
      } else {
        // Simulate minor noise if active but no analyser yet
        for(let i=0; i<dataArray.length; i++) dataArray[i] = 128 + (Math.random() - 0.5) * 2;
      }

      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = canvas.width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => cancelAnimationFrame(requestRef.current);
  }, [analyser, isActive, color]);

  return (
    <div className="w-full h-32 bg-black/80 border-t border-b border-gray-800 relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="absolute top-2 left-2 text-[10px] font-mono text-gray-500 bg-black/50 px-1">
            OSCILLOSCOPE // MASTER_OUT
        </div>
    </div>
  );
};

export default RhythmScope;
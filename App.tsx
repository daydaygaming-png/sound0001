import React, { useState, useCallback, useRef } from 'react';
import { AudioEngine } from './services/audioEngine';
import { analyzeImageForSound } from './services/geminiService';
import HandTracker from './components/HandTracker';
import Visualizer from './components/Visualizer';
import AnalysisHUD from './components/AnalysisHUD';
import RhythmScope from './components/RhythmScope';
import { AppState, SonicParameters, HandGestures } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [sonicParams, setSonicParams] = useState<SonicParameters | null>(null);
  const [gestures, setGestures] = useState<HandGestures>({ x: 0.5, y: 0.5, isPinching: false, isFist: false, isPalmOpen: true, isVisible: false });
  const [errorMsg, setErrorMsg] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(false);
  
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Handle File Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        setErrorMsg("Please upload an image file.");
        return;
    }

    // Reset previous state
    handleStop();
    setAppState(AppState.ANALYZING);
    setExtractedColors([]);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Raw = e.target?.result as string;
        setImagePreview(base64Raw);
        
        // Strip prefix for API
        const base64Data = base64Raw.split(',')[1];
        
        try {
            const params = await analyzeImageForSound(base64Data, file.type);
            
            // Artificial delay to let the user enjoy the scanning animation
            setTimeout(() => {
                setSonicParams(params);
                
                // Initialize Audio Engine with params
                const engine = new AudioEngine(params);
                engine.setOnStepCallback((step) => setCurrentStep(step));
                engine.init(); // Pre-init context
                audioEngineRef.current = engine;
                analyserRef.current = engine.getAnalyser();

                setAppState(AppState.READY);
            }, 3000);
            
        } catch (err) {
            console.error(err);
            setAppState(AppState.ERROR);
            setErrorMsg("Failed to analyze image. Try again.");
        }
    };
    reader.readAsDataURL(file);
  };

  const handleStart = () => {
      if (audioEngineRef.current) {
          audioEngineRef.current.start();
          setAppState(AppState.PLAYING);
      }
  };

  const handleStop = () => {
    if (audioEngineRef.current) {
        audioEngineRef.current.stop();
        setAppState(AppState.READY);
    }
  };

  const handleReset = () => {
    handleStop();
    setSonicParams(null);
    setImagePreview(null);
    setAppState(AppState.IDLE);
    setExtractedColors([]);
  };

  const toggleCamera = () => {
      const nextState = !isCameraEnabled;
      setIsCameraEnabled(nextState);
      if (!nextState) {
          // Reset gestures to neutral when camera is turned off
          const neutralGestures = { x: 0.5, y: 0.5, isPinching: false, isFist: false, isPalmOpen: true, isVisible: false };
          setGestures(neutralGestures);
          if (audioEngineRef.current && appState === AppState.PLAYING) {
              audioEngineRef.current.updateControlParams(neutralGestures);
          }
      }
  };

  const onGesturesDetected = useCallback((newGestures: HandGestures) => {
      setGestures(newGestures);
      if (audioEngineRef.current && appState === AppState.PLAYING) {
          audioEngineRef.current.updateControlParams(newGestures);
      }
  }, [appState]);

  return (
    <div className="relative h-screen w-full bg-black text-white selection:bg-cyan-900 selection:text-cyan-100 flex flex-col overflow-hidden">
      
      {/* Background Audio Visualizer (Layer 0) */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${appState === AppState.PLAYING ? 'opacity-60' : 'opacity-10'}`}>
        <Visualizer 
            analyser={analyserRef.current} 
            gestures={gestures} 
            baseColor={sonicParams ? (sonicParams.darkness > 0.6 ? '#ff0044' : '#00ffd5') : '#333'} 
            colors={extractedColors}
        />
      </div>

      {/* Hand Tracker (Layer 2 - Only rendered if enabled) */}
      <HandTracker 
        isEnabled={appState === AppState.PLAYING && isCameraEnabled} 
        onGesturesDetected={onGesturesDetected} 
      />

      {/* Main Content Area (Layer 1) */}
      <div className="z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-8 gap-4 w-full">
        
        {/* Header */}
        <header className="absolute top-6 left-6 md:left-12 z-20">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tighter text-gray-100">
                SYNESTHESIA
            </h1>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${appState === AppState.PLAYING ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                    {appState === AppState.IDLE ? 'SYSTEM STANDBY' : 
                     appState === AppState.ANALYZING ? 'ANALYZING VISUAL DATA' : 
                     appState === AppState.PLAYING ? 'AUDIO SYNTHESIS ACTIVE' : 'PARAMETERS LOCKED'}
                </p>
            </div>
        </header>

        {/* Central Display: Image/HUD or Upload */}
        <div className="relative w-full max-w-4xl flex-1 max-h-[60vh] flex flex-col justify-center">
            
            {imagePreview ? (
                // Analysis HUD Container
                <div className="relative w-full h-full min-h-[300px]">
                    <AnalysisHUD 
                        imageSrc={imagePreview} 
                        isAnalyzing={appState === AppState.ANALYZING} 
                        isPlaying={appState === AppState.PLAYING}
                        sonicParams={sonicParams}
                        currentStep={currentStep}
                        onColorsDetected={setExtractedColors}
                    />
                    
                    {/* Floating Controls Overlay */}
                    {(appState === AppState.READY || appState === AppState.PLAYING) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="pointer-events-auto z-40">
                             {/* Play Button Group */}
                             <div className={`flex items-center gap-6 backdrop-blur-sm bg-black/40 p-6 rounded-2xl border border-white/10 shadow-2xl transform transition-all duration-500 ${appState === AppState.PLAYING ? 'opacity-0 hover:opacity-100 translate-y-32 scale-75' : 'opacity-100 scale-100'}`}>
                                {appState === AppState.READY ? (
                                    <button 
                                        onClick={handleStart}
                                        className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-white text-black hover:bg-cyan-400 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                                    >
                                        <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                        <span className="absolute -bottom-8 text-[10px] font-mono text-white opacity-0 group-hover:opacity-100 tracking-widest transition-opacity">INITIALIZE</span>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleStop}
                                        className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-500/10 transition-all"
                                    >
                                        <div className="w-6 h-6 bg-current rounded-sm" />
                                        <span className="absolute -bottom-8 text-[10px] font-mono text-red-400 opacity-0 group-hover:opacity-100 tracking-widest transition-opacity">TERMINATE</span>
                                    </button>
                                )}
                             </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Upload Area
                <div className="w-full h-full min-h-[300px] border border-dashed border-gray-800 rounded-lg bg-gray-900/20 flex flex-col items-center justify-center relative overflow-hidden group hover:border-cyan-900/50 transition-colors">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(6,182,212,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%] animate-[gradient_3s_linear_infinite] opacity-0 group-hover:opacity-100 pointer-events-none" />
                    
                    <input 
                        type="file" 
                        onChange={handleFileUpload} 
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    
                    <div className="text-center z-10 space-y-4">
                        <div className="w-20 h-20 mx-auto border border-gray-700 rounded-full flex items-center justify-center text-gray-500 group-hover:text-cyan-400 group-hover:border-cyan-500/50 transition-all duration-500">
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4"/></svg>
                        </div>
                        <div>
                            <p className="text-xl font-light tracking-wide text-gray-300">UPLOAD SOURCE IMAGE</p>
                            <p className="text-xs text-gray-600 font-mono mt-2">.JPG .PNG .WEBP</p>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Scope and Stats Area */}
        <div className="w-full max-w-4xl flex flex-col gap-0 border border-gray-900 rounded-b-lg overflow-hidden bg-gray-900/30 backdrop-blur-sm">
            
            <RhythmScope 
                analyser={analyserRef.current} 
                isActive={appState === AppState.PLAYING}
                color={sonicParams ? (sonicParams.darkness > 0.5 ? '#ff3366' : '#00ffff') : '#444'}
            />

            <div className="h-12 flex items-center justify-between text-xs font-mono text-gray-500 px-4 bg-black/40">
                <div className="flex gap-4">
                    {sonicParams && (
                        <>
                            <span className="text-cyan-700">STYLE: <span className="text-white bg-cyan-900/50 px-1">{sonicParams.style.toUpperCase()}</span></span>
                            <span className="text-cyan-700">BPM: <span className="text-cyan-400">{sonicParams.bpm}</span></span>
                            <span className="hidden sm:inline text-cyan-700">CMPX: <span className="text-cyan-400">{sonicParams.complexity.toFixed(2)}</span></span>
                        </>
                    )}
                </div>
                
                <div className="flex gap-4 items-center">
                    {/* Camera Toggle */}
                    {appState !== AppState.IDLE && (
                        <button 
                            onClick={toggleCamera} 
                            className={`px-2 py-1 border rounded transition-colors ${isCameraEnabled ? 'border-green-500/50 text-green-400 bg-green-900/20' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}
                        >
                            CAM: {isCameraEnabled ? 'ON' : 'OFF'}
                        </button>
                    )}

                    {imagePreview && (
                        <button onClick={handleReset} className="hover:text-white transition-colors border-l border-gray-800 pl-4">
                            [ RESET SYSTEM ]
                        </button>
                    )}
                </div>
            </div>
        </div>

        {appState === AppState.ERROR && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-6 py-3 rounded border border-red-500 backdrop-blur-md shadow-xl z-50">
                {errorMsg}
                <button onClick={handleReset} className="ml-4 underline text-xs">RETRY</button>
            </div>
        )}

      </div>
    </div>
  );
};

export default App;
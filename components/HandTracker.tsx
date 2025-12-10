import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandGestures } from '../types';

interface HandTrackerProps {
  onGesturesDetected: (gestures: HandGestures) => void;
  isEnabled: boolean;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onGesturesDetected, isEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const setupHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setIsLoaded(true);
      } catch (error) {
        console.error("Error loading hand landmarker:", error);
      }
    };

    setupHandLandmarker();

    return () => {
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    window.cancelAnimationFrame(requestRef.current);
  };

  const enableCam = async () => {
    // Ensure clean state before starting
    stopCamera();

    if (!handLandmarkerRef.current || !videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener("loadeddata", predictWebcam);
    } catch (err) {
      console.error("Camera denied:", err);
    }
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    // Check if video is actually ready
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
       requestRef.current = window.requestAnimationFrame(predictWebcam);
       return;
    }

    const nowInMs = performance.now();
    const results = handLandmarkerRef.current.detectForVideo(videoRef.current, nowInMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      const wrist = landmarks[0];
      const middleMCP = landmarks[9];
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];

      const handScale = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y);

      const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      const isPinching = pinchDist < (0.05 * (handScale / 0.15)); 

      const tips = [8, 12, 16, 20];
      let totalTipToWristDist = 0;
      tips.forEach(idx => {
          totalTipToWristDist += Math.hypot(landmarks[idx].x - wrist.x, landmarks[idx].y - wrist.y);
      });
      const avgTipDist = totalTipToWristDist / 4;

      const isFist = avgTipDist < (handScale * 1.2); 
      const isPalmOpen = avgTipDist > (handScale * 1.7);

      onGesturesDetected({
        x: 1 - indexTip.x, // Mirror X
        y: 1 - indexTip.y, // Invert Y
        isPinching,
        isFist,
        isPalmOpen,
        isVisible: true
      });
    } else {
      onGesturesDetected({
        x: 0.5,
        y: 0.5,
        isPinching: false,
        isFist: false,
        isPalmOpen: true, 
        isVisible: false
      });
    }

    if (isEnabled) {
       requestRef.current = window.requestAnimationFrame(predictWebcam);
    }
  };

  useEffect(() => {
    if (isEnabled && isLoaded) {
      enableCam();
    } else {
      stopCamera();
    }
    return () => {
        stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, isLoaded]);

  // If disabled, don't render the UI box at all
  if (!isEnabled) return null;

  return (
    <div className="absolute top-4 right-4 w-32 h-24 sm:w-48 sm:h-36 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-50 opacity-80 hover:opacity-100 transition-opacity shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        {!isLoaded && <div className="flex items-center justify-center h-full text-xs text-gray-500 animate-pulse">Initializing AI...</div>}
        <video 
            ref={videoRef} 
            className={`w-full h-full object-cover transform -scale-x-100 ${!isLoaded ? 'hidden' : ''}`} 
            autoPlay 
            playsInline 
            muted
        />
        {isLoaded && <div className="absolute bottom-1 right-2 text-[10px] text-green-400 font-mono bg-black/50 px-1">VISION ACTIVE</div>}
    </div>
  );
};

export default HandTracker;
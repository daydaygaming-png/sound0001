import { SonicParameters, HandGestures } from "../types";

// --- MUSIC THEORY CONSTANTS ---
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], // Natural Minor
  major: [0, 2, 4, 5, 7, 9, 11], // Major
  phrygian: [0, 1, 3, 5, 7, 8, 10], // Dark, Techno
  dorian: [0, 2, 3, 5, 7, 9, 10],   // Groovy, House
  pentatonic: [0, 3, 5, 7, 10],      // Neutral, Ambient
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11], // Classical, Dramatic
  lydian: [0, 2, 4, 6, 7, 9, 11] // Dreamy
};

// Chord Pools: Variations for different sections (A: Main, B: Tension/Bridge)
// Each progression is array of 4 scale degrees relative to root
const CHORD_POOLS = {
  techno: {
    A: [[0, 0, 0, 0], [0, -2, 0, -2], [0, 2, 0, -2]], // Static, hypnotic
    B: [[-4, -4, 0, 0], [0, 3, 0, 5], [-2, 0, -2, 0]] // Slight movement
  },
  house: {
    A: [[0, 3, 5, 3], [0, 2, 4, 2], [0, -2, 3, 5]], // Groovy
    B: [[5, 3, 0, -2], [4, 6, 0, 2], [3, 0, 3, 5]]  // Lifted
  },
  ambient: {
    A: [[0, 4, 2, 5], [0, -3, 2, 0], [0, 2, 4, 6]], // Dreamy
    B: [[5, 2, 6, 4], [4, 0, 5, 2]] // Floating
  },
  symphony: {
    A: [[0, 5, 2, 6], [0, 4, 5, 1]], // Epic i-VI-III-VII
    B: [[2, 6, 4, 5], [3, 0, 4, 1], [6, 4, 2, 5]] // Dramatic development
  },
  easy_listening: {
    A: [[0, 5, 3, 4], [0, 3, 0, 4]], // I-VI-IV-V ish
    B: [[3, 4, 0, 5], [5, 4, 3, 0]] // Chorus feel
  },
  industrial: {
    A: [[0, 6, 0, 6], [0, 1, 0, 1]], // Dissonant tritone/semitone
    B: [[6, 1, 6, 0], [0, 0, 1, 1]] 
  },
  glitch: {
    A: [[0, 0, 0, 0]], 
    B: [[0, -2, 2, -5]] // Random jumps
  }
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private nextNoteTime: number = 0;
  private current16thNote: number = 0;
  private globalBar: number = 0; // Total bars played
  private timerID: number | undefined;
  
  // UI Sync
  private onStepCallback: ((step: number) => void) | null = null;
  
  // Nodes
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private distortionNode: WaveShaperNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  
  // Params
  private params: SonicParameters;
  private currentGestures: HandGestures = { 
      x: 0.5, y: 0.5, isPinching: false, isFist: false, isPalmOpen: true, isVisible: false 
  };

  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // s

  // Modulatable Params
  private filterCutoff: number = 1000;
  private resonance: number = 0;

  // Music Theory & Structure State
  private scale: number[] = SCALES.minor;
  
  // Song Structure
  private form: number[] = []; // e.g. [0, 0, 1, 0] where 0=A section, 1=B section
  private sections: number[][] = []; // [ [progA1], [progB1] ]
  private activeSectionIdx: number = 0; // 0 or 1 usually
  private currentChordSequence: number[] = [0, 0, 0, 0];
  
  // Patterns
  private melodyPattern: (number | null)[] = [];
  private bassPattern: (number | null)[] = [];
  
  // Dynamic Flow State
  private flowLFO: number = 0; // 0 to 1, oscillates over time
  private intensity: number = 0; // Builds up over time

  constructor(initialParams: SonicParameters) {
    this.params = initialParams;
    this.generateComposition();
  }

  // --- COMPOSITION GENERATOR ---
  private generateComposition() {
      const styleKey = this.params.style as keyof typeof CHORD_POOLS;
      const pool = CHORD_POOLS[styleKey] || CHORD_POOLS.techno;

      // 1. Select Scale
      if (this.params.style === 'house') this.scale = SCALES.dorian;
      else if (this.params.style === 'techno') this.scale = SCALES.phrygian;
      else if (this.params.style === 'easy_listening') this.scale = SCALES.major;
      else if (this.params.style === 'symphony') this.scale = SCALES.harmonic_minor;
      else if (this.params.style === 'ambient') this.scale = SCALES.lydian;
      else this.scale = SCALES.minor;

      // 2. Generate Song Structure (Form) based on Complexity
      // High complexity = more changes (A B A C). Low complexity = A A A A.
      const isComplex = this.params.complexity > 0.6;
      const isRepetitive = this.params.complexity < 0.3;

      if (isRepetitive) {
          this.form = [0, 0, 0, 0]; // Loop Section A
      } else if (isComplex) {
          this.form = [0, 0, 1, 0, 0, 1, 1, 0]; // A A B A A B B A
      } else {
          this.form = [0, 0, 1, 0]; // Standard A A B A
      }

      // 3. Pick specific progressions for A and B sections from the Pool
      const pickProg = (arr: number[][]) => arr[Math.floor(Math.random() * arr.length)];
      
      this.sections = [
          pickProg(pool.A), // Section 0 (A)
          pickProg(pool.B)  // Section 1 (B)
      ];

      // Initialize first sequence
      this.currentChordSequence = this.sections[0];

      // 4. Generate Melody Pattern (16 steps)
      this.melodyPattern = new Array(16).fill(null);
      const density = this.params.complexity; 
      
      for (let i = 0; i < 16; i++) {
          const isStrongBeat = i % 4 === 0;
          let chance = density * 0.4;
          if (isStrongBeat) chance += 0.3;
          
          if (Math.random() < chance) {
              const range = this.params.style === 'techno' ? 5 : 12;
              const degree = Math.floor(Math.random() * range) % 7; // Keep within scale
              this.melodyPattern[i] = degree;
          }
      }

      // 5. Generate Bass Pattern
      this.bassPattern = new Array(16).fill(null);
      for(let i=0; i<16; i++) {
          if (this.params.style === 'techno' && (i % 2 !== 0)) { 
              this.bassPattern[i] = 0; // Offbeat bass
          } else if (this.params.style === 'house' && (i === 0 || i === 10 || i === 14)) {
              this.bassPattern[i] = 0;
          } else if (Math.random() < 0.25) {
              this.bassPattern[i] = 0;
          }
      }
      if (this.params.style !== 'ambient') this.bassPattern[0] = 0;
  }

  public setOnStepCallback(callback: (step: number) => void) {
    this.onStepCallback = callback;
  }

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -12;
    this.compressorNode.ratio.value = 12; // Hard limiter style for Techno
    this.compressorNode.attack.value = 0.003;

    // Filter (Hand Control)
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = this.filterCutoff;
    this.filterNode.Q.value = this.resonance;

    // Global Distortion (Darkness param)
    this.distortionNode = this.ctx.createWaveShaper();
    let distAmount = this.params.darkness * 400;
    if (this.params.style === 'industrial') distAmount *= 2;
    if (['ambient', 'easy_listening', 'symphony'].includes(this.params.style)) distAmount = 0; 
    
    this.distortionNode.curve = this.makeDistortionCurve(distAmount);
    this.distortionNode.oversample = '4x';

    // FX Sends
    this.delayNode = this.ctx.createDelay();
    const beatTime = 60 / this.params.bpm;
    let delayTime = beatTime * 0.75; 
    if (this.params.style === 'symphony') delayTime = beatTime / 2;
    this.delayNode.delayTime.value = delayTime;
    
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);

    this.reverbNode = this.ctx.createConvolver();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.4;
    
    let reverbSize = 3.0;
    if (this.params.style === 'symphony') reverbSize = 5.0; 
    if (this.params.style === 'ambient') reverbSize = 8.0; 
    if (this.params.style === 'techno') reverbSize = 2.0; 
    this.buildImpulseResponse(reverbSize);

    // Routing
    // Synth -> Distortion -> Filter -> Master
    this.distortionNode.connect(this.filterNode);
    this.filterNode.connect(this.masterGain);
    
    // FX Sends (from Filter Output)
    this.filterNode.connect(this.delayNode);
    this.filterNode.connect(this.reverbNode);
    
    this.delayNode.connect(this.masterGain);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    this.masterGain.connect(this.compressorNode);
    this.compressorNode.connect(this.ctx.destination);
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private buildImpulseResponse(duration: number) {
    if (!this.ctx || !this.reverbNode) return;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const decay = 2.0;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i < length - 1000 ? i : length - 1000;
      const env = Math.pow(1 - n / length, decay);
      impulseL[i] = (Math.random() * 2 - 1) * env;
      impulseR[i] = (Math.random() * 2 - 1) * env;
    }
    this.reverbNode.buffer = impulse;
  }

  public updateControlParams(gestures: HandGestures) {
    if (!this.ctx || !this.filterNode || !this.distortionNode) return;
    
    this.currentGestures = gestures;
    const { x, y, isPinching, isFist, isVisible } = gestures;

    if (!isVisible) return;

    // Filter Modulation (X Axis)
    const minFreq = 100;
    const maxFreq = 12000;
    // Apply LFO to filter for "breathing" effect
    const lfoMod = Math.sin(this.ctx.currentTime * 0.5) * 200 * this.params.space;
    const frequency = Math.max(minFreq, (minFreq * Math.pow(maxFreq / minFreq, x)) + lfoMod);
    
    this.filterNode.frequency.setTargetAtTime(frequency, this.ctx.currentTime, 0.1);

    // Resonance (Y Axis)
    this.filterNode.Q.setTargetAtTime(y * 15, this.ctx.currentTime, 0.1);

    // Gesture Modes
    if (isFist) {
         // Build-up / Tension
         this.masterGain!.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.5); 
         this.reverbGain?.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.5); // Wash out
         this.delayFeedback?.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.5);
    } else {
        // Normal
        this.masterGain!.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.5);
        this.reverbGain?.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.5);
        this.delayFeedback?.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.5);
    }

    if (isPinching && this.filterNode) {
       // Quick wobble
       this.filterNode.frequency.setTargetAtTime(frequency * 1.5, this.ctx.currentTime, 0.05); 
    }
  }

  public start() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    this.isPlaying = true;
    this.current16thNote = 0;
    this.globalBar = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    window.clearTimeout(this.timerID);
  }

  private scheduler() {
    if (!this.ctx || !this.isPlaying) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.nextNote();
    }
    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private nextNote() {
    const secondsPerBeat = 60.0 / this.params.bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat; // 16th note
    this.current16thNote++;
    
    if (this.current16thNote === 16) {
      this.current16thNote = 0;
      this.globalBar++;
      
      // --- DYNAMIC STRUCTURE LOGIC ---
      // Update Chord Sequence based on Song Form
      const formLength = this.form.length;
      const sectionIndex = Math.floor(this.globalBar / 4) % formLength; // Change section every 4 bars
      this.activeSectionIdx = this.form[sectionIndex]; // 0 = A, 1 = B
      
      this.currentChordSequence = this.sections[this.activeSectionIdx];
      
      // Evolve Intensity
      this.intensity = Math.min(1.0, this.globalBar / 64); // Full intensity after 64 bars
    }
  }

  // --- MUSIC THEORY HELPERS ---
  
  private getFreq(scaleDegree: number, octaveOffset: number = 0): number {
      const scaleLen = this.scale.length;
      // Handle negative scale degrees correctly
      const normDegree = ((scaleDegree % scaleLen) + scaleLen) % scaleLen;
      const octaveShift = Math.floor(scaleDegree / scaleLen);
      
      const semitones = this.scale[normDegree] + (octaveShift * 12) + (octaveOffset * 12);
      
      // Apply Key Change modulation based on Section? 
      // e.g. B section +2 semitones? Keeping it simple for now.
      
      const baseMidi = 69 + 12 * Math.log2(this.params.baseNoteFrequency / 440);
      const targetMidi = baseMidi + semitones;
      
      return 440 * Math.pow(2, (targetMidi - 69) / 12);
  }

  private scheduleNote(beat: number, time: number) {
    if (!this.ctx) return;

    // UI Sync
    const timeUntilNote = (time - this.ctx.currentTime) * 1000;
    if (timeUntilNote >= 0) {
        setTimeout(() => {
            if (this.isPlaying && this.onStepCallback) {
                this.onStepCallback(beat + ((this.globalBar % 4) * 16)); 
            }
        }, timeUntilNote);
    }

    const { isFist, isPinching } = this.currentGestures;

    // --- RHYTHM SECTION ---
    // Section B is often a breakdown (less drums) in high complexity modes
    const isBreakdown = this.activeSectionIdx === 1 && this.params.complexity > 0.5;

    // Kick
    const isKickStep = (beat % 4 === 0);
    if (isKickStep && !isFist && !isBreakdown) {
        if (this.params.style === 'easy_listening' || this.params.style === 'ambient') {
            this.playKick(time, 0.6, 0.3); 
        } else if (this.params.style === 'symphony') {
             if (beat === 0) this.playTimpani(time, 0.8);
        } else {
            this.playKick(time, 1.0, 0.5); 
        }
    }

    // Snare / Clap
    if ((beat === 4 || beat === 12) && !isFist && !isBreakdown) {
        if (this.params.style === 'techno' || this.params.style === 'industrial') {
             this.playNoiseSnare(time, 0.5);
        } else if (this.params.style === 'easy_listening') {
             this.playShaker(time, 0.2); 
        }
    }

    // HiHats (Evolving)
    // Add 16th notes as intensity increases
    const is16th = beat % 2 !== 0;
    const shouldPlayHat = !is16th || (this.intensity > 0.5) || isPinching;
    
    if (shouldPlayHat && !isFist) {
        if (this.params.style !== 'symphony') { 
             const vol = isPinching ? 0.6 : (is16th ? 0.15 : 0.3);
             this.playHiHat(time, vol, isPinching ? 0.02 : 0.05);
        }
    }

    // --- HARMONY & MELODY ---

    // 1. Chords (On Beat 0)
    // Dynamic Voicing: In B section, maybe play an octave higher for tension
    if (beat === 0) {
        const octaveShift = (this.activeSectionIdx === 1) ? 1 : 0;
        this.playChord(time, isFist, octaveShift);
    }

    // 2. Bassline
    // Techno/Industrial: Bass stays grounded.
    // House/Symphony: Bass follows root of chord.
    if (!isFist && !isBreakdown) {
        let bassNote = this.bassPattern[beat];
        
        // Dynamic Bass: Follow Chord Root
        if (bassNote !== null) {
            const currentChordRoot = this.currentChordSequence[this.globalBar % 4];
            // If scale degree is 0 (root), shift it to chord root
            if (bassNote === 0) bassNote = currentChordRoot;
            
            const freq = this.getFreq(bassNote, 0); 
            this.playBass(time, freq);
        }
    }

    // 3. Lead / Arpeggio
    // Arpeggiate if intensity is high or in Techno mode
    const shouldArp = (this.params.style === 'techno' || this.params.style === 'symphony') && (this.intensity > 0.3);
    
    if (shouldArp && beat % 2 === 0) {
        const chordRoot = this.currentChordSequence[this.globalBar % 4];
        // Arp Pattern: Root - 3rd - 5th - 7th
        const arpIntervals = [0, 2, 4, 6];
        // Evolve pattern based on bar measure
        const arpIdx = (beat / 2 + this.globalBar) % 4; 
        
        const freq = this.getFreq(chordRoot + arpIntervals[arpIdx], 2);
        const type = this.params.style === 'symphony' ? 'strings' : 'pluck';
        
        if (!isFist) this.playSynth(time, freq, 0.1, type);
    } else {
        // Standard Melody Pattern
        const melodyNote = this.melodyPattern[beat];
        if (melodyNote !== null) {
            const octave = isPinching ? 2 : 1;
            const freq = this.getFreq(melodyNote, octave);
            
            let type: 'pluck' | 'lead' | 'woodwind' | 'strings' = 'lead';
            if (this.params.style === 'symphony') type = 'woodwind';
            if (this.params.style === 'easy_listening') type = 'pluck';
            if (this.params.style === 'ambient') type = 'pluck';

            this.playSynth(time, freq, 0.2, type);
        }
    }
  }

  // --- INSTRUMENT SYNTHESIS ---

  private playChord(time: number, isBuilding: boolean, octaveShift: number) {
      const barInSequence = this.globalBar % 4;
      const rootDegree = this.currentChordSequence[barInSequence];
      
      // Construct Chord: Root, 3rd, 5th, sometimes 7th if complex
      const notes = [rootDegree, rootDegree + 2, rootDegree + 4];
      if (this.params.complexity > 0.7) notes.push(rootDegree + 6); // Add 7th
      
      const duration = 60 / this.params.bpm * 4; 
      
      notes.forEach((degree, i) => {
          // Spread voicing
          let octave = (i === 0) ? 0 : 1;
          octave += octaveShift;
          
          const freq = this.getFreq(degree, octave);
          
          let type: 'pad' | 'strings' | 'epiano' = 'pad';
          if (this.params.style === 'symphony') type = 'strings';
          if (this.params.style === 'easy_listening') type = 'epiano';

          // Random velocity for human feel
          const velocity = 0.8 + Math.random() * 0.2;
          this.playSynth(time, freq, duration, type, velocity);
      });
  }

  private playBass(time: number, freq: number) {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = this.params.style === 'techno' ? 'sawtooth' : 'triangle'; 
    if (this.params.style === 'symphony') osc.type = 'sawtooth'; 

    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, time);
    // Envelope modulation
    filter.frequency.exponentialRampToValueAtTime(800 + (this.params.darkness * 500), time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(200, time + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.distortionNode!); 

    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playKick(time: number, vol: number, decay: number) {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + decay);
    
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

    osc.connect(gain);
    gain.connect(this.masterGain!); 
    
    osc.start(time);
    osc.stop(time + decay);
  }

  private playTimpani(time: number, vol: number) {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, time);
      osc.frequency.exponentialRampToValueAtTime(50, time + 0.3);

      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.6);

      osc.connect(gain);
      gain.connect(this.reverbNode!); 
      gain.connect(this.masterGain!);
      
      osc.start(time);
      osc.stop(time + 0.6);
  }

  private playHiHat(time: number, vol: number, decay: number) {
    const bufferSize = this.ctx!.sampleRate * decay; 
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;

    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(time);
  }
  
  private playNoiseSnare(time: number, vol: number) {
      this.playHiHat(time, vol, 0.15); 
  }
  
  private playShaker(time: number, vol: number) {
      this.playHiHat(time, vol * 0.5, 0.05);
  }

  private playSynth(time: number, freq: number, duration: number, type: 'lead' | 'pad' | 'pluck' | 'strings' | 'woodwind' | 'epiano', velocity: number = 1.0) {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    switch(type) {
        case 'strings': osc.type = 'sawtooth'; break;
        case 'woodwind': osc.type = 'sine'; break;
        case 'epiano': osc.type = 'triangle'; break;
        case 'pad': osc.type = this.params.synthType; break;
        default: osc.type = this.params.synthType;
    }

    osc.frequency.setValueAtTime(freq, time);
    
    if (this.params.style === 'symphony' || type === 'lead') {
         const vibrato = this.ctx!.createOscillator();
         vibrato.frequency.value = 5; 
         const vibGain = this.ctx!.createGain();
         vibGain.gain.value = 3; 
         vibrato.connect(vibGain);
         vibGain.connect(osc.frequency);
         vibrato.start(time);
         vibrato.stop(time + duration);
    }

    const peak = 0.3 * velocity;

    // Envelope
    gain.gain.setValueAtTime(0, time);
    if (type === 'pad' || type === 'strings') {
        gain.gain.linearRampToValueAtTime(peak * 0.7, time + (duration * 0.4));
        gain.gain.linearRampToValueAtTime(0, time + duration);
    } else if (type === 'pluck' || type === 'epiano') {
        gain.gain.linearRampToValueAtTime(peak, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    } else {
        // Lead
        gain.gain.linearRampToValueAtTime(peak, time + 0.05);
        gain.gain.linearRampToValueAtTime(peak * 0.6, time + 0.1);
        gain.gain.linearRampToValueAtTime(0, time + duration);
    }

    osc.connect(gain);
    
    if (type === 'strings' || type === 'pad') {
         gain.connect(this.reverbNode!);
         gain.connect(this.masterGain!);
    } else if (type === 'epiano') {
         gain.connect(this.filterNode!); 
    } else {
         gain.connect(this.distortionNode!);
    }

    osc.start(time);
    osc.stop(time + duration);
  }

  public getAnalyser(): AnalyserNode | null {
     if (!this.ctx) return null;
     const analyser = this.ctx.createAnalyser();
     analyser.fftSize = 2048;
     if (this.compressorNode) {
         this.compressorNode.connect(analyser);
     }
     return analyser;
  }
}
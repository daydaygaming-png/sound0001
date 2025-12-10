import { GoogleGenAI, Type } from "@google/genai";
import { SonicParameters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeImageForSound = async (base64Image: string, mimeType: string): Promise<SonicParameters> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: `Analyze this image to generate an electronic soundscape parameters. 
            
            First, categorize the image into one of these musical styles:
            - "techno": For geometric, repetitive, urban, or abstract mechanical images.
            - "ambient": For nature, landscapes, soft colors, or ethereal/foggy images.
            - "industrial": For dark, high contrast, rusty, decay, or aggressive machinery images.
            - "house": For vibrant, warm, social, or energetic colorful images.
            - "glitch": For chaotic, high-texture, digital artifact, or surreal abstract images.
            - "symphony": For classical architecture, epic landscapes, historical scenes, or grand/dramatic compositions.
            - "easy_listening": For cozy interiors, food, cute animals, casual lifestyle, or soft pastel images.

            Then determine the parameters:
            - BPM: 
              - Ambient < 90
              - Symphony ~100-120 (Adagio to Allegro)
              - Easy Listening ~80-110
              - House ~124
              - Techno ~130
              - Glitch ~140
            - Darkness (0-1): 1 is scary/heavy, 0 is bright/happy.
            - Complexity (0-1): Visual clutter = high complexity.
            - Space (0-1): Depth of field / openness = high space.
            - Synth Type: 
              - Sawtooth (harsh/strings)
              - Square (retro/woodwind-ish)
              - Sine (smooth/flute)
              - Triangle (soft/keys).
            - Base Freq: 40-60Hz for deep bass, 60-100Hz for lighter bass.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            style: {
              type: Type.STRING,
              enum: ['techno', 'ambient', 'industrial', 'house', 'glitch', 'symphony', 'easy_listening'],
              description: "The music genre matching the image vibe."
            },
            bpm: { type: Type.NUMBER, description: "Tempo in beats per minute" },
            complexity: { type: Type.NUMBER, description: "0.0 to 1.0" },
            darkness: { type: Type.NUMBER, description: "0.0 to 1.0" },
            space: { type: Type.NUMBER, description: "0.0 to 1.0" },
            synthType: { 
              type: Type.STRING, 
              enum: ['sawtooth', 'square', 'sine', 'triangle'],
              description: "Oscillator waveform"
            },
            baseNoteFrequency: { type: Type.NUMBER, description: "Root frequency in Hz" }
          },
          required: ["style", "bpm", "complexity", "darkness", "space", "synthType", "baseNoteFrequency"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from Gemini");
    
    return JSON.parse(jsonText) as SonicParameters;

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Fallback default
    return {
      style: 'techno',
      bpm: 128,
      complexity: 0.5,
      darkness: 0.5,
      space: 0.5,
      synthType: 'sawtooth',
      baseNoteFrequency: 55.0
    };
  }
};
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { GoogleGenAI, Modality } from "@google/genai";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Configuration des middlewares
app.use(cors());
app.use(express.json());

// Initialisation de l'API Gemini
// Note : Le SDK nécessite la variable GEMINI_API_KEY dans l'environnement
const ai = new GoogleGenAI({});

// ==== DOSSIERS & STOCKAGE ====
const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const publicStoriesDir = path.join(publicDir, "stories");
const tempDir = path.join(rootDir, "temp");

// S'assurer que les dossiers existent
if (!fs.existsSync(publicStoriesDir)) {
  fs.mkdirSync(publicStoriesDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Fichier stories.json
const storiesJsonPath = path.join(publicStoriesDir, "stories.json");
if (!fs.existsSync(storiesJsonPath)) {
  fs.writeFileSync(storiesJsonPath, "[]", "utf-8");
}

// Servir statiquement le dossier public
// Cela permet à l'ESP32 d'accéder aux MP3 via http://<IP>:3000/audio/xxx.mp3
app.use(express.static(publicDir));

// Configuration de Multer pour gérer les uploads d'audio dans le dossier temp
const upload = multer({ dest: tempDir });

// ==== FONCTIONS UTILITAIRES ====

/**
 * Fonction utilitaire asynchrone pour convertir un flux/fichier audio 
 * avec les paramètres très stricts requis par l'ESP32 :
 * MP3, codec libmp3lame, 128 kbps CBR, 44100 Hz, Mono (1 canal), sans métadonnées.
 */
const convertToEsp32Audio = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")       // 128 kbps CBR
      .audioChannels(1)           // Mono
      .audioFrequency(44100)      // 44100 Hz
      .outputOptions([
        "-map_metadata -1",       // Suppression de toutes les métadonnées (ID3, etc.)
      ])
      .save(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err));
  });
};

const addStoryToJson = (title: string, url: string, thumbnail?: string) => {
  let stories = [];
  try {
    const data = fs.readFileSync(storiesJsonPath, "utf-8");
    stories = JSON.parse(data);
  } catch (err) {
    console.error("Erreur lecture stories.json", err);
  }
  
  const newStory = {
    id: randomUUID(),
    title: title || "Nouvelle histoire",
    thumbnail: thumbnail || "https://images.unsplash.com/photo-1519098901909-b1553a1190af?auto=format&fit=crop&w=200&q=80",
    url: url
  };
  
  stories.push(newStory);
  
  try {
    fs.writeFileSync(storiesJsonPath, JSON.stringify(stories, null, 2), "utf-8");
  } catch (err) {
    console.error("Erreur écriture stories.json", err);
  }
  return newStory;
};

// ==== ROUTES BACKEND ====

// 1. ROUTE : INVENTER (Génération de texte)
app.post("/api/generate-story", async (req, res) => {
  try {
    const { hero, place, companion, object } = req.body;
    
    // Garde-fous si champs manquants (optionnel)
    if (!hero || !place || !companion || !object) {
      return res.status(400).json({ error: "Tous les champs sont requis : hero, place, companion, object" });
    }

    const prompt = `Écris une courte histoire magique pour enfants d'environ 5 minutes en français. Le héros est : ${hero}. L'histoire se déroule à : ${place}. Le héros est accompagné par : ${companion}. L'objet important est : ${object}. L'histoire doit être douce, rythmée et se terminer par une petite morale ou une fin heureuse. Donne un titre à l'histoire. Réponds au format JSON: { "title": "...", "content": "..." }`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // À garder tel quel comme demandé
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    
    // Parse le JSON de Gemini (fail-safe avec '{}')
    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error) {
    console.error("Erreur /api/generate-story:", error);
    res.status(500).json({ error: "Failed to generate story" });
  }
});


// 2. ROUTE : GÉNÉRATION AUDIO (TTS)
app.post("/api/generate-audio", async (req, res) => {
  try {
    const { text, title } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Le champ 'text' est requis." });
    }

    // Demande au modèle TTS
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Lis cette histoire avec une voix douce et apaisante pour enfants : ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    // Extraction des données audio depuis la réponse de l'API
    // L'API renvoie généralement inlineData avec du base64, ou directement du texte en base64
    const parts = response.candidates?.[0]?.content?.parts;
    const audioPart = parts?.find(p => p.inlineData);
    
    let audioBuffer: Buffer;
    
    if (audioPart && audioPart.inlineData) {
       // Cas standard : inlineData reçu
       audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");
    } else if (response.text) {
       // Fallback : dans certains modèles TTS, response.text contient la chaîne base64 ou binaire
       audioBuffer = Buffer.from(response.text, /^[A-Za-z0-9+/=]+$/.test(response.text) ? "base64" : "binary");
    } else {
      throw new Error("No audio data received from Gemini");
    }

    const fileId = randomUUID();
    const tempInputPath = path.join(tempDir, `${fileId}.tmp`);
    const finalFilename = `${fileId}.mp3`;
    const finalOutputPath = path.join(publicStoriesDir, finalFilename);

    // 1ère étape : écriture du tampon audio brut renvoyé par Gemini
    fs.writeFileSync(tempInputPath, audioBuffer);

    // 2ème étape : conversion parfaite FFmpeg pour ESP32
    await convertToEsp32Audio(tempInputPath, finalOutputPath);

    // 3ème étape : nettoyage du fichier temporaire
    if (fs.existsSync(tempInputPath)) {
      fs.unlinkSync(tempInputPath);
    }

    const storyUrl = `/stories/${finalFilename}`;
    const newStory = addStoryToJson(title, storyUrl);

    // Retour au client
    res.json({ 
      success: true, 
      story: newStory
    });

  } catch (error) {
    console.error("Erreur /api/generate-audio:", error);
    res.status(500).json({ error: "Failed to generate audio via TTS" });
  }
});


// 3. ROUTE : IMPORTER (Upload depuis client frontend local)
app.post("/api/upload-audio", upload.fields([{ name: "audio", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.audio || !files.audio[0]) {
      return res.status(400).json({ error: "Aucun fichier audio fourni" });
    }

    const { title } = req.body;
    const fileId = randomUUID();
    
    // Traitement de l'audio
    const tempInputPath = files.audio[0].path;
    const finalFilename = `${fileId}.mp3`;
    const finalOutputPath = path.join(publicStoriesDir, finalFilename);

    // Repasser le fichier uploadé à la moulinette FFmpeg pour garantir
    // qu'il sera lisible par l'ESP32
    await convertToEsp32Audio(tempInputPath, finalOutputPath);

    // Nettoyer le fichier temporaire de multer
    if (fs.existsSync(tempInputPath)) {
      fs.unlinkSync(tempInputPath);
    }
    
    let thumbnailUrl;
    // Traitement de la miniature (si fournie)
    if (files.thumbnail && files.thumbnail[0]) {
       const thumbExt = path.extname(files.thumbnail[0].originalname) || '.jpg';
       const thumbFilename = `${fileId}${thumbExt}`;
       const thumbPath = path.join(publicStoriesDir, thumbFilename);
       fs.renameSync(files.thumbnail[0].path, thumbPath);
       thumbnailUrl = `/stories/${thumbFilename}`;
    }

    const storyUrl = `/stories/${finalFilename}`;
    const newStory = addStoryToJson(title, storyUrl, thumbnailUrl);

    res.json({ 
      success: true, 
      story: newStory
    });

  } catch (error) {
    console.error("Erreur /api/upload-audio:", error);
    // En cas d'erreur de la moulinette, on nettoie quand même le temp
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files && files.audio && files.audio[0] && fs.existsSync(files.audio[0].path)) {
      fs.unlinkSync(files.audio[0].path);
    }
    if (files && files.thumbnail && files.thumbnail[0] && fs.existsSync(files.thumbnail[0].path)) {
      fs.unlinkSync(files.thumbnail[0].path);
    }
    res.status(500).json({ error: "Failed to process the uploaded audio file" });
  }
});

// ==== DEMARRAGE VITE & EXPRESS ====
// Cette partie assure que l'application Vite fonctionne en mode dev
// à côté de vos routes d'API, sur un seul port (3000)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mode développement : on attache Vite.js
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Mode production
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Serveur Express actif sur http://localhost:${PORT}`);
    console.log(`[Backend] Routes API prêtes (/api/generate-story, /api/generate-audio, /api/upload-audio)`);
  });
}

startServer();

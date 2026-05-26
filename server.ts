import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
dotenv.config();
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { GoogleGenAI, Modality } from "@google/genai";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";

// Charger les variables depuis .env.local en priorité, puis .env
dotenv.config({ path: '.env.local' });

// Définir le chemin vers l'exécutable ffmpeg statique
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

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
const tempDir = path.join(rootDir, "temp");

// S'assurer que le dossier temporaire existe pour ffmpeg et multer
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
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
const convertToEsp32Audio = (inputPath: string, outputPath: string, inputMimeType?: string, isRawPcm?: boolean): Promise<void> => {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    
    if (isRawPcm || (inputMimeType && inputMimeType.includes("pcm"))) {
      // By default Gemini TTS returns 24000Hz PCM
      let rate = 24000;
      if (inputMimeType) {
        const rateMatch = inputMimeType.match(/rate=(\d+)/);
        if (rateMatch) rate = parseInt(rateMatch[1]);
      }
      
      command = command.inputOptions([
        '-f', 's16le',
        '-ar', rate.toString(),
        '-ac', '1'
      ]);
    }

    command
      .audioCodec("libmp3lame")
      .audioBitrate("128k")       // 128 kbps CBR
      .audioChannels(1)           // Mono
      .audioFrequency(44100)      // 44100 Hz
      .outputOptions([
        "-map_metadata -1",       // Suppression de toutes les métadonnées (ID3, etc.)
        "-vn"                     // Supprime les images/pochettes d'album intégrées !
      ])
      .save(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err));
  });
};

// ==== GITHUB API UTILS ====
const GITHUB_OWNER = 'laurieambr';
const GITHUB_REPO = 'application-conteuse';
const GITHUB_BRANCH = 'main';

async function getGithubFileSha(path: string): Promise<string | null> {
  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (!token) throw new Error("GITHUB_TOKEN manquant ou non défini dans les secrets");
  let authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  const response = await fetch(url, {
    headers: {
      "Authorization": authHeader,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Conteuse-App"
    }
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Github API error: ${response.statusText}`);
  const data = (await response.json()) as any;
  return data.sha;
}

async function uploadToGithub(path: string, contentBase64: string, message: string) {
  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (!token) throw new Error("GITHUB_TOKEN manquant");
  let authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  if (token.startsWith("ghp_")) {
    authHeader = `Bearer ${token}`;
  }

  const sha = await getGithubFileSha(path);
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  
  const body: any = {
    message: message,
    content: contentBase64,
    branch: GITHUB_BRANCH
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      "Authorization": authHeader,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Conteuse-App"
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errData = await response.text();
    if (response.status === 401) {
      throw new Error(`Erreur d'authentification GitHub: Le GITHUB_TOKEN est invalide (401). Jeton reçu : ${token.substring(0, 4)}... Vérifiez vos permissions de token ou la configuration des variables d'environnement.`);
    }
    throw new Error(`Failed to upload to Github: ${errData}`);
  }
}

async function getStoriesFromGithub() {
  const token = (process.env.GITHUB_TOKEN || "").trim();
  const headers: any = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Conteuse-App"
  };
  if (token) {
    let authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    headers["Authorization"] = authHeader;
  }
  
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/public/stories/stories.json?ref=${GITHUB_BRANCH}`;
  const response = await fetch(url, { headers });
  
  if (response.status === 404) return [];
  if (!response.ok) {
     console.error("Erreur getStoriesFromGithub:", await response.text());
     return [];
  }
  const data = (await response.json()) as any;
  const content = Buffer.from(data.content, 'base64').toString("utf-8");
  return JSON.parse(content);
}

async function addStoryToGithub(title: string, mp3Filename: string, thumbnailFilename?: string) {
  let stories = await getStoriesFromGithub();
  
  const newStory = {
    id: randomUUID(),
    title: title || "Nouvelle histoire",
    thumbnail: thumbnailFilename ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/public/stories/${thumbnailFilename}` : "https://images.unsplash.com/photo-1519098901909-b1553a1190af?auto=format&fit=crop&w=200&q=80",
    url: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/public/stories/${mp3Filename}`
  };
  
  stories.push(newStory);
  
  const contentBase64 = Buffer.from(JSON.stringify(stories, null, 2), "utf-8").toString("base64");
  await uploadToGithub("public/stories/stories.json", contentBase64, `Add story: ${newStory.title}`);
  return newStory;
}

// ==== ROUTES BACKEND ====

app.get("/api/stories", async (req, res) => {
  try {
    const stories = await getStoriesFromGithub();
    res.json(stories);
  } catch(error) {
    console.error("Erreur api/stories:", error);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
});

// PUT: Modifier une histoire (titre, miniature)
app.put("/api/stories", async (req, res) => {
  try {
    const { id, title, thumbnail, url } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "ID requis" });
    }

    // 1. On lit depuis GitHub !
    const storiesData = await getStoriesFromGithub();
    
    // 2. On trouve l'histoire
    const storyIndex = storiesData.findIndex((s: any) => s.id === id);
    if (storyIndex === -1) {
      return res.status(404).json({ error: "Histoire non trouvée" });
    }

    // 3. On met à jour
    storiesData[storyIndex] = {
      ...storiesData[storyIndex],
      title: title || storiesData[storyIndex].title,
      thumbnail: thumbnail || storiesData[storyIndex].thumbnail,
      url: url || storiesData[storyIndex].url // Au cas où
    };

    // 4. On sauvegarde sur GitHub ! (Plus d'écriture locale)
    const contentBase64 = Buffer.from(JSON.stringify(storiesData, null, 2)).toString('base64');
    await uploadToGithub("public/stories/stories.json", contentBase64, `Modification de l'histoire: ${title || id}`);

    res.json(storiesData[storyIndex]);
  } catch (error) {
    console.error("Erreur PUT /api/stories:", error);
    res.status(500).json({ error: "Failed to update story" });
  }
});

// DELETE: Supprimer une histoire
app.delete("/api/stories/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. On lit depuis GitHub !
    const storiesData = await getStoriesFromGithub();
    
    // 2. On filtre
    const filteredStories = storiesData.filter((s: any) => s.id !== id);
    
    if (filteredStories.length === storiesData.length) {
      return res.status(404).json({ error: "Histoire non trouvée" });
    }

    // 3. On sauvegarde sur GitHub ! (Plus d'écriture locale)
    const contentBase64 = Buffer.from(JSON.stringify(filteredStories, null, 2)).toString('base64');
    await uploadToGithub("public/stories/stories.json", contentBase64, `Suppression d'une histoire`);

    res.json({ success: true });
  } catch (error) {
    console.error("Erreur DELETE /api/stories:", error);
    res.status(500).json({ error: "Failed to delete story" });
  }
});

// POST: Uploader une miniature et obtenir son URL GitHub
app.post("/api/upload-thumbnail", upload.single("thumbnail"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    const fileId = randomUUID();
    const thumbExt = path.extname(req.file.originalname) || '.jpg';
    const thumbnailFilename = `${fileId}${thumbExt}`;
    
    const thumbBase64 = fs.readFileSync(req.file.path).toString('base64');
    await uploadToGithub(`public/stories/${thumbnailFilename}`, thumbBase64, `Upload thumbnail: ${thumbnailFilename}`);
    
    // Nettoyer le fichier temporaire
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    
    const thumbnailUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/public/stories/${thumbnailFilename}`;
    
    res.json({ 
      success: true, 
      url: thumbnailUrl
    });
  } catch (error) {
    console.error("Erreur /api/upload-thumbnail:", error);
    res.status(500).json({ error: "Failed to upload thumbnail" });
  }
});

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
    let mimeType: string | undefined;
    
    if (audioPart && audioPart.inlineData) {
       // Cas standard : inlineData reçu
       audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");
       mimeType = audioPart.inlineData.mimeType;
    } else if (response.text) {
       // Fallback : dans certains modèles TTS, response.text contient la chaîne base64 ou binaire
       audioBuffer = Buffer.from(response.text, /^[A-Za-z0-9+/=]+$/.test(response.text) ? "base64" : "binary");
    } else {
      throw new Error("No audio data received from Gemini");
    }

    // DÉTECTION DU FORMAT RÉEL POUR FFMPEG
    const header = audioBuffer.subarray(0, 12);
    let isRawPcm = true;
    
    if (header.subarray(0, 4).toString('utf8') === 'RIFF') {
      isRawPcm = false;
    } else if (header.subarray(0, 3).toString('utf8') === 'ID3' || (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0)) {
      isRawPcm = false;
    } else if (header.subarray(0, 4).toString('utf8') === 'OggS') {
      isRawPcm = false;
    } else if (header.subarray(0, 4).toString('utf8') === 'fLaC') {
      isRawPcm = false;
    }

    const fileId = randomUUID();
    const tempInputPath = path.join(tempDir, `${fileId}.tmp`);
    const tempOutputPath = path.join(tempDir, `${fileId}.mp3`);
    const finalFilename = `${fileId}.mp3`;

    // 1ère étape : écriture du tampon audio brut renvoyé par Gemini
    fs.writeFileSync(tempInputPath, audioBuffer);

    // 2ème étape : conversion parfaite FFmpeg pour ESP32 vers rec. temporaire
    await convertToEsp32Audio(tempInputPath, tempOutputPath, mimeType, isRawPcm);

    // 3ème étape : Envoi à GitHub public via API
    const mp3Base64 = fs.readFileSync(tempOutputPath).toString('base64');
    await uploadToGithub(`public/stories/${finalFilename}`, mp3Base64, `Add TTS audio: ${finalFilename}`);

    // Nettoyage fichiers temporaires
    if (fs.existsSync(tempInputPath)) {
      fs.unlinkSync(tempInputPath);
    }
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }

    const newStory = await addStoryToGithub(title, finalFilename);

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
    const originalExt = path.extname(files.audio[0].originalname);
    const tempInputPath = files.audio[0].path + originalExt;
    fs.renameSync(files.audio[0].path, tempInputPath); // renommer avec l'extension
    const tempOutputPath = path.join(tempDir, `${fileId}.mp3`);
    const finalFilename = `${fileId}.mp3`;

    // Repasser le fichier uploadé à la moulinette FFmpeg pour garantir
    // qu'il sera lisible par l'ESP32
    await convertToEsp32Audio(tempInputPath, tempOutputPath, files.audio[0].mimetype, false);

    // Envoi de l'audio converti à GitHub public via API
    const mp3Base64 = fs.readFileSync(tempOutputPath).toString('base64');
    
    // Envoi de l'audio à GitHub public via API
    await uploadToGithub(`public/stories/${finalFilename}`, mp3Base64, `Upload audio: ${finalFilename}`);

    // Nettoyer les fichiers temporaires audio
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    
    let thumbnailFilename;
    // Traitement de la miniature (si fournie)
    if (files.thumbnail && files.thumbnail[0]) {
       const thumbExt = path.extname(files.thumbnail[0].originalname) || '.jpg';
       thumbnailFilename = `${fileId}${thumbExt}`;
       const thumbBase64 = fs.readFileSync(files.thumbnail[0].path).toString('base64');
       await uploadToGithub(`public/stories/${thumbnailFilename}`, thumbBase64, `Upload thumbnail: ${thumbnailFilename}`);
       
       // Nettoyer fichier temporaire miniature
       if (fs.existsSync(files.thumbnail[0].path)) fs.unlinkSync(files.thumbnail[0].path);
    }

    const newStory = await addStoryToGithub(title, finalFilename, thumbnailFilename);

    res.json({ 
      success: true, 
      story: newStory
    });

  } catch (error: any) {
    console.error("Erreur /api/upload-audio:", error);
    // Nettoyer les fichiers temporaires même en cas d'erreur
    if (typeof tempInputPath === 'string' && fs.existsSync(tempInputPath)) {
      fs.unlinkSync(tempInputPath);
    }
    if (typeof tempOutputPath === 'string' && fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files && files.thumbnail && files.thumbnail[0] && fs.existsSync(files.thumbnail[0].path)) {
      fs.unlinkSync(files.thumbnail[0].path);
    }
    res.status(500).json({ error: error.message || "Failed to process the uploaded audio file" });
  }
});

// ==== DEMARRAGE VITE & EXPRESS ====

// Catch all unregistered API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route non trouvée : ${req.method} ${req.path}` });
});

// Custom error handler pour les routes API
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) {
    console.error("API Error middleware intercepted:", err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  } else {
    next(err);
  }
});

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

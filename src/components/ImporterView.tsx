import { Upload, Type, Music, Sparkles, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { Tab } from "../types";

export function ImporterView({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const [title, setTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const handleImport = async () => {
    if (!title || !audioFile) {
      setError("Veuillez saisir un titre et choisir un fichier MP3.");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("audio", audioFile);
      if (thumbnailFile) {
        formData.append("thumbnail", thumbnailFile);
      }

      const res = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      const dataContentType = res.headers.get("content-type");
      let data;
      if (dataContentType && dataContentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Erreur HTTP ${res.status}: ` + text.substring(0, 50));
      }
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'importation");

      setSuccess(true);
      
      setTimeout(() => {
        setActiveTab("bibliotheque");
      }, 2000);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full p-6 pt-12 overflow-y-auto pb-32">
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-purple-400 rounded-full flex items-center justify-center shadow-lg shadow-purple-300/50 mb-6">
          <Upload className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-purple-600 mb-1">Importer MP3</h1>
        <p className="text-gray-500 font-medium text-sm">Tes propres histoires en musique</p>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Type className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading || success}
            placeholder="Titre de l'histoire"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input 
             type="file" 
             accept="image/*" 
             className="hidden" 
             ref={thumbnailInputRef}
             onChange={(e) => {
               if (e.target.files && e.target.files[0]) {
                 setThumbnailFile(e.target.files[0]);
               }
             }}
          />
          <button 
             onClick={() => thumbnailInputRef.current?.click()}
             disabled={loading || success}
             className={`w-full py-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-colors bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed ${thumbnailFile ? 'border-purple-400 text-purple-500' : 'border-gray-300 hover:border-purple-300 text-gray-500 hover:text-purple-500'}`}>
            <ImageIcon className="w-8 h-8 mb-3" />
            <span className="text-xs font-medium text-center px-2">
              {thumbnailFile ? "Image sélec..." : "Choisir une image"}
            </span>
            <span className={`text-[10px] font-medium mt-1 ${thumbnailFile ? 'text-purple-400' : 'text-gray-400'}`}>
              Miniature
            </span>
          </button>

          <input 
             type="file" 
             accept="audio/mp3,audio/*" 
             className="hidden" 
             ref={audioInputRef}
             onChange={(e) => {
               if (e.target.files && e.target.files[0]) {
                 setAudioFile(e.target.files[0]);
               }
             }}
          />
          <button 
             onClick={() => audioInputRef.current?.click()}
             disabled={loading || success}
             className={`w-full py-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-colors bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed ${audioFile ? 'border-purple-400 text-purple-500' : 'border-gray-300 hover:border-purple-300 text-gray-500 hover:text-purple-500'}`}>
            <Music className="w-8 h-8 mb-3" />
            <span className="text-xs font-medium text-center px-2">
              {audioFile ? "Fichier sélec..." : "Choisir un fichier"}
            </span>
            <span className={`text-[10px] font-medium mt-1 ${audioFile ? 'text-purple-400' : 'text-gray-400'}`}>
              MP3
            </span>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-sm font-medium px-4 py-3 rounded-2xl flex items-center pr-2">
            <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 text-sm font-medium px-4 py-3 rounded-2xl flex items-center pr-2">
            <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
            <span className="leading-tight">Histoire importée !</span>
          </div>
        )}

        <button 
          onClick={handleImport}
          disabled={loading || success}
          className="w-full mt-4 bg-purple-300 hover:bg-purple-400 text-white font-bold py-4 rounded-3xl shadow-lg shadow-purple-300/50 flex items-center justify-center space-x-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
             <Loader2 className="w-5 h-5 animate-spin" />
          ) : success ? (
             <CheckCircle2 className="w-5 h-5" />
          ) : (
             <Sparkles className="w-5 h-5" />
          )}
          <span>
            {loading ? "Envoi en cours..." : success ? "Redirection..." : "Envoyer à la Conteuse"}
          </span>
        </button>
      </div>
    </div>
  );
}

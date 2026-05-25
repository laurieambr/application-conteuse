import { Sparkles, User, MapPin, Search, Diamond, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Tab } from "../types";

export function InventerView({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const [hero, setHero] = useState("");
  const [place, setPlace] = useState("");
  const [companion, setCompanion] = useState("");
  const [object, setObject] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    if (!hero || !place || !companion || !object) {
      setError("Veuillez remplir tous les champs !");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      setStep("1/2 : Génération de l'histoire magique...");
      const storyRes = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero, place, companion, object }),
      });
      
      const contentType = storyRes.headers.get("content-type");
      let storyData;
      if (contentType && contentType.includes("application/json")) {
        storyData = await storyRes.json();
      } else {
        const text = await storyRes.text();
        throw new Error(`Erreur HTTP ${storyRes.status}: ` + text.substring(0, 50));
      }
      if (!storyRes.ok) throw new Error(storyData.error || "Erreur de génération");

      setStep("2/2 : Création de la voix et envoi à la conteuse...");
      const audioRes = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: storyData.content, title: storyData.title }),
      });
      
      const audioContentType = audioRes.headers.get("content-type");
      let audioData;
      if (audioContentType && audioContentType.includes("application/json")) {
        audioData = await audioRes.json();
      } else {
        const text = await audioRes.text();
        throw new Error(`Erreur HTTP ${audioRes.status}: ` + text.substring(0, 50));
      }
      if (!audioRes.ok) throw new Error(audioData.error || "Erreur audio");

      setSuccess(true);
      setStep("Histoire magique prête !");
      
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
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-purple-600 mb-1">Fabrique à histoires</h1>
        <p className="text-gray-500 font-medium text-sm">Invoque la magie de la conteuse...</p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <User className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            value={hero}
            onChange={(e) => setHero(e.target.value)}
            disabled={loading || success}
            placeholder="Quel est le nom du héros ?"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MapPin className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            disabled={loading || success}
            placeholder="Dans quel monde merveilleux ?"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            value={companion}
            onChange={(e) => setCompanion(e.target.value)}
            disabled={loading || success}
            placeholder="Un petit compagnon (ex: un chat)"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Diamond className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            value={object}
            onChange={(e) => setObject(e.target.value)}
            disabled={loading || success}
            placeholder="Un objet magique (ex: Épée de feu)"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-sm font-medium px-4 py-3 rounded-2xl flex items-center pr-2">
            <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        <button 
          onClick={handleCreate}
          disabled={loading || success}
          className="w-full mt-6 bg-purple-300 hover:bg-purple-400 text-white font-bold py-4 rounded-3xl shadow-lg shadow-purple-300/50 flex items-center justify-center space-x-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
             <Loader2 className="w-5 h-5 animate-spin" />
          ) : success ? (
             <CheckCircle2 className="w-5 h-5" />
          ) : (
             <Sparkles className="w-5 h-5" />
          )}
          <span>
            {loading ? step : success ? "Redirection..." : "Créer l'histoire"}
          </span>
        </button>
      </div>
    </div>
  );
}

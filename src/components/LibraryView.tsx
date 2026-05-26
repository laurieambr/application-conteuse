import { useEffect, useState } from "react";
import { Story } from "../types";
import { Sparkles, Play, Pause, Square } from "lucide-react";

export function LibraryView() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingStoryId, setPlayingStoryId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [savedPositions, setSavedPositions] = useState<Record<string, number>>({});
  

  useEffect(() => {
    fetch("/api/stories")
      .then((res) => {
        if (!res.ok) throw new Error("Erreur de chargement");
        return res.json();
      })
      .then((data) => {
        setStories(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Gérer le compteur
  useEffect(() => {
    if (!playingStoryId || isPaused) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [playingStoryId, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const espIp = "http://192.168.1.100"; // Ton IP ESP32

  const handlePlay = async (storyId: string, url: string) => {
    try {
      const savedSec = savedPositions[storyId];
      let fullUrl = `${espIp}/play?url=${encodeURIComponent(url)}`;
      
      // Si on a des secondes sauvegardées, on les ajoute à la requête
      if (savedSec && savedSec > 0) {
        fullUrl += `&sec=${savedSec}`;
      }
      
      // Plus de mode "no-cors", l'ESP32 l'autorise nativement maintenant
      await fetch(fullUrl);
      
      // Mettre à jour l'état local
      if (playingStoryId === storyId) {
        setIsPaused(false);
      } else {
        setPlayingStoryId(storyId);
        setElapsed(0);
        setIsPaused(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePause = async (storyId: string) => {
    try {
      const response = await fetch(`${espIp}/pause`);
      const data = await response.json();
      
      // On sauvegarde les secondes renvoyées par l'ESP32
      if (data.position) {
        setSavedPositions(prev => ({ ...prev, [storyId]: data.position }));
      }
      
      setIsPaused(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStop = async (storyId: string) => {
    try {
      await fetch(`${espIp}/stop`);
      
      // On efface les secondes sauvegardées pour repartir de zéro
      setSavedPositions(prev => {
        const newPositions = { ...prev };
        delete newPositions[storyId];
        return newPositions;
      });
      
      setPlayingStoryId(null);
      setElapsed(0);
      setIsPaused(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 w-full h-full p-6 pt-12 overflow-y-auto pb-32">
      <h1 className="text-3xl font-bold text-purple-600 mb-1 leading-tight">
        Ma Conteuse<br />Magique
      </h1>
      <p className="text-gray-500 mb-8 font-medium">Boutique à rêves sur écoute</p>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
        </div>
      ) : stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
          <Sparkles className="w-16 h-16 mb-4 text-gray-300" strokeWidth={1.5} />
          <p>Aucune histoire magique en vue...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stories.map((story) => (
            <div
              key={story.id}
              className="bg-white/60 backdrop-blur-md rounded-3xl p-4 flex items-center shadow-sm border border-white/40"
            >
              <img
                src={story.thumbnail}
                alt={story.title}
                className="w-16 h-16 rounded-2xl object-cover shadow-sm mr-4"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate mb-2">
                  {story.title}
                </h3>
                {playingStoryId === story.id && (
                  <div className="text-sm font-mono text-purple-600 mb-2">
                    {formatTime(elapsed)}
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePlay(story.id, story.url)}
                    className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                  {/* <button
                    onClick={() => handlePause(story.id)}
                    className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full transition-colors"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                  </button> */}
                  <button
                    onClick={() => handleStop(story.id)}
                    className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

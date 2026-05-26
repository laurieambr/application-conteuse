import { useEffect, useState, useRef } from "react";
import { Story } from "../types";
import { Sparkles, Play, Square, Edit2, Trash2, X, Check, Plus, Minus, Image as ImageIcon, Loader2 } from "lucide-react";

export function LibraryView() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingStoryId, setPlayingStoryId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [savedPositions, setSavedPositions] = useState<Record<string, number>>({});
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [volume, setVolume] = useState(15);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  

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

  const handleVolumeChange = async (newVolume: number) => {
    // Sécurité stricte : rester entre 0 et 21
    const validVolume = Math.max(0, Math.min(21, newVolume));
    setVolume(validVolume);

    try {
      await fetch(`${espIp}/volume?val=${validVolume}`);
    } catch (err) {
      console.error("Erreur lors du changement de volume:", err);
    }
  };

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

  const uploadThumbnail = async (file: File) => {
    if (!file) return;

    setUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append("thumbnail", file);

      const response = await fetch("/api/upload-thumbnail", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'upload");
      }

      const data = await response.json();
      setEditThumbnail(data.url);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'upload de l'image");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const openEditModal = (story: Story) => {
    setEditingStory(story);
    setEditTitle(story.title);
    setEditThumbnail(story.thumbnail);
  };

  const saveEdit = async () => {
    if (!editingStory) return;

    const updatedStory: Story = {
      ...editingStory,
      title: editTitle,
      thumbnail: editThumbnail,
    };

    try {
      const response = await fetch("/api/stories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedStory),
      });

      if (response.ok) {
        setStories(stories.map(s => s.id === editingStory.id ? updatedStory : s));
        setEditingStory(null);
      } else {
        alert("Erreur lors de la sauvegarde");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de communication");
    }
  };

  const deleteStory = async (storyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette histoire ?")) return;

    try {
      const response = await fetch(`/api/stories/${storyId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setStories(stories.filter(s => s.id !== storyId));
      } else {
        alert("Erreur lors de la suppression");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de communication");
    }
  };

  return (
    <div className="flex-1 w-full h-full p-6 pt-12 overflow-y-auto pb-32">
      <h1 className="text-3xl font-bold text-purple-600 mb-1 leading-tight">
        Ma Conteuse<br />Magique
      </h1>
      <p className="text-gray-500 mb-8 font-medium">Boutique à rêves sur écoute</p>

      {/* Contrôle du volume */}
      <div className="mb-8 bg-white/40 backdrop-blur-md rounded-2xl p-4 border border-white/40">
        <div className="flex items-center justify-center gap-4">
          {/* Bouton - */}
          <button
            onClick={() => handleVolumeChange(volume - 1)}
            disabled={volume === 0}
            className="p-2 bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 text-purple-600 disabled:text-gray-400 rounded-full transition-colors"
          >
            <Minus className="w-5 h-5" />
          </button>

          {/* Jauge de volume */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 21 }).map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-8 rounded-sm transition-colors ${
                  index < volume
                    ? "bg-purple-600"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Bouton + */}
          <button
            onClick={() => handleVolumeChange(volume + 1)}
            disabled={volume === 21}
            className="p-2 bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 text-purple-600 disabled:text-gray-400 rounded-full transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Affichage du volume actuel */}
          <div className="text-sm font-mono text-purple-600 font-semibold min-w-[40px] text-center">
            {volume}
          </div>
        </div>
      </div>

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
                  <button
                    onClick={() => handleStop(story.id)}
                    className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    onClick={() => openEditModal(story)}
                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteStory(story.id)}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal d'édition */}
      {editingStory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Modifier l'histoire</h2>
              <button
                onClick={() => setEditingStory(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Miniature
                </label>
                
                {/* Input file caché */}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={thumbnailInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      uploadThumbnail(e.target.files[0]);
                    }
                  }}
                  disabled={uploadingThumbnail}
                />

                {/* Bouton d'upload */}
                <button
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={uploadingThumbnail}
                  className="w-full px-3 py-2 border-2 border-dashed border-purple-300 hover:border-purple-500 disabled:border-gray-300 rounded-lg bg-purple-50 hover:bg-purple-100 disabled:bg-gray-50 text-purple-600 disabled:text-gray-400 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {uploadingThumbnail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      Changer l'image
                    </>
                  )}
                </button>

                {/* Aperçu de la miniature */}
                {editThumbnail && (
                  <img
                    src={editThumbnail}
                    alt="Aperçu miniature"
                    className="w-20 h-20 rounded-lg mt-3 object-cover border border-purple-200"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setEditingStory(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
                <button
                  onClick={saveEdit}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { Sparkles, User, MapPin, Search, Diamond } from "lucide-react";

export function InventerView() {
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
            placeholder="Quel est le nom du héros ?"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MapPin className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            placeholder="Dans quel monde merveilleux ?"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            placeholder="Un petit compagnon (ex: un chat)"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Diamond className="w-5 h-5 text-purple-400" />
          </div>
          <input
            type="text"
            placeholder="Un objet magique (ex: Épée de feu)"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <button className="w-full mt-6 bg-purple-300 hover:bg-purple-400 text-white font-bold py-4 rounded-3xl shadow-lg shadow-purple-300/50 flex items-center justify-center space-x-2 transition-colors">
          <span>Créer l'histoire</span>
          <Sparkles className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

import { Upload, Type, Music, Sparkles, Image as ImageIcon } from "lucide-react";

export function ImporterView() {
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
            placeholder="Titre de l'histoire"
            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-white/50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button className="w-full py-8 border-2 border-dashed border-gray-300 hover:border-purple-300 rounded-3xl flex flex-col items-center justify-center text-gray-500 hover:text-purple-500 transition-colors bg-white/40">
            <ImageIcon className="w-8 h-8 mb-3" />
            <span className="text-xs font-medium text-center px-2">Choisir une image</span>
            <span className="text-[10px] font-medium text-gray-400 mt-1">Miniature</span>
          </button>

          <button className="w-full py-8 border-2 border-dashed border-gray-300 hover:border-purple-300 rounded-3xl flex flex-col items-center justify-center text-gray-500 hover:text-purple-500 transition-colors bg-white/40">
            <Music className="w-8 h-8 mb-3" />
            <span className="text-xs font-medium text-center px-2">Choisir un fichier</span>
            <span className="text-[10px] font-medium text-gray-400 mt-1">MP3</span>
          </button>
        </div>

        <button className="w-full mt-4 bg-purple-300 hover:bg-purple-400 text-white font-bold py-4 rounded-3xl shadow-lg shadow-purple-300/50 flex items-center justify-center space-x-2 transition-colors">
          <span>Envoyer à la Conteuse</span>
          <Sparkles className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

import { BookOpen, Sparkles, Upload } from "lucide-react";
import { Tab } from "../types";

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const tabs = [
    { id: "bibliotheque" as Tab, label: "Bibliothèque", icon: BookOpen },
    { id: "inventer" as Tab, label: "Inventer", icon: Sparkles },
    { id: "importer" as Tab, label: "Importer", icon: Upload },
  ];

  return (
    <div className="absolute bottom-6 left-6 right-6">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-2 flex justify-between items-center shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center w-1/3 py-3 rounded-2xl transition-all duration-300 ${
                isActive ? "bg-purple-100/50" : "hover:bg-purple-50/50"
              }`}
            >
              <Icon
                className={`w-6 h-6 mb-1 transition-colors ${
                  isActive ? "text-purple-600" : "text-gray-400"
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-purple-600" : "text-gray-400"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Tab } from "./types";
import { BottomNav } from "./components/BottomNav";
import { LibraryView } from "./components/LibraryView";
import { InventerView } from "./components/InventerView";
import { ImporterView } from "./components/ImporterView";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("bibliotheque");

  return (
    <div className="flex justify-center items-center h-screen w-full">
      <div className="w-full h-full max-w-md bg-gradient-to-b from-[#fdfbfd] to-[#f4ebfb] shadow-2xl overflow-hidden relative flex flex-col md:h-[90vh] md:rounded-[3rem] md:border-[8px] md:border-white">
        
        {/* Tab Content */}
        {activeTab === "bibliotheque" && <LibraryView />}
        {activeTab === "inventer" && <InventerView />}
        {activeTab === "importer" && <ImporterView />}

        {/* Bottom Navigation */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}

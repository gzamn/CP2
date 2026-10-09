import React from 'react';
import { CP2Module, TabType } from '../types';

interface ModulesViewProps {
  modules: CP2Module[];
  onSelectModule: (module: CP2Module, destinationTab?: TabType) => void;
}

export const ModulesView: React.FC<ModulesViewProps> = ({
  modules,
  onSelectModule,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      
      {/* Rectangles des modules avec grande miniature et nom au milieu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((m) => (
          <div
            key={m.id}
            onClick={() => onSelectModule(m)}
            className="group relative h-48 sm:h-56 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-900 cursor-pointer transition-all duration-300 hover:border-zinc-500 hover:shadow-2xl hover:shadow-zinc-950"
          >
            {/* Grande miniature sombre en arrière-plan */}
            <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500`} />
            
            {/* Texture subtile minimale */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            {/* Voile sombre pour contraste optimal */}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />

            {/* Texte dans le milieu de la miniature */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase drop-shadow-md group-hover:scale-105 transition-transform duration-300">
                {m.title}
              </h2>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

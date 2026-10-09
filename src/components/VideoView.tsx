import React, { useState } from 'react';
import { CP2Module, VideoDoc } from '../types';
import { ArrowLeft, ExternalLink, Tv, Play } from 'lucide-react';

interface VideoViewProps {
  modules: CP2Module[];
  selectedModuleId?: string | null;
  onSelectModuleId?: (id: string | null) => void;
  customResources?: any[];
}

interface ModuleVideoConfig {
  type: 'playlist' | 'channel';
  title: string;
  url: string;
  playlistId?: string;
  channelName?: string;
}

// EXACT links provided by the user — NO external suggestions or recommendations
const USER_EXACT_VIDEO_LINKS: Record<string, ModuleVideoConfig> = {
  'mecanique-rationnelle': {
    type: 'channel',
    title: 'Playlists Mécanique rationnelle',
    url: 'https://www.youtube.com/@QuestionSolutions/playlists',
    channelName: '@QuestionSolutions',
  },
  'chimie-3': {
    type: 'channel',
    title: 'Playlists Chimie',
    url: 'https://www.youtube.com/@prepachimie2020/playlists',
    channelName: '@prepachimie2020',
  },
  'analyse-3': {
    type: 'channel',
    title: 'Playlists Analyse',
    url: 'https://www.youtube.com/@exomaroc/playlists',
    channelName: '@exomaroc',
  },
  'analyse-numerique-1': {
    type: 'channel',
    title: 'Playlists Analyse numérique',
    url: 'https://www.youtube.com/@megdadii/playlists',
    channelName: '@megdadii',
  },
  'physique-3': {
    type: 'playlist',
    title: 'Playlist Physique 3',
    url: 'https://www.youtube.com/watch?v=Ia-Fypy5ltI&list=PLhzvRMulX_5bkpWb9Ql30YHqGGkT3_wAK',
    playlistId: 'PLhzvRMulX_5bkpWb9Ql30YHqGGkT3_wAK',
  },
  'mecanique-des-fluides': {
    type: 'playlist',
    title: 'Playlist MDF (Mécanique des fluides)',
    url: 'https://www.youtube.com/watch?v=if8KQ_6S458&list=PLNpt4ERW10ZKP1wAqo_gk0C39LqgKIGuD',
    playlistId: 'PLNpt4ERW10ZKP1wAqo_gk0C39LqgKIGuD',
  },
  'electricite-generale': {
    type: 'playlist',
    title: 'Playlist Électricité générale',
    url: 'https://www.youtube.com/watch?v=TkX96acvRYI&list=PLjswG_3CAC770Uqw4fivO0A9alZmREY7x',
    playlistId: 'PLjswG_3CAC770Uqw4fivO0A9alZmREY7x',
  },
  'informatique-3': {
    type: 'playlist',
    title: 'Playlist Info 3',
    url: 'https://www.youtube.com/watch?v=YYv2R1cCTa0&list=PLKKFDwVTfa-R7LBY8ck-t_H0nsa53kU2U',
    playlistId: 'PLKKFDwVTfa-R7LBY8ck-t_H0nsa53kU2U',
  },
};

export const VideoView: React.FC<VideoViewProps> = ({
  modules,
  selectedModuleId,
  onSelectModuleId,
}) => {
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(selectedModuleId || null);
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [activeCustomEmbed, setActiveCustomEmbed] = useState<string | null>(null);

  React.useEffect(() => {
    if (selectedModuleId) {
      setCurrentModuleId(selectedModuleId);
    }
  }, [selectedModuleId]);

  React.useEffect(() => {
    setActiveCustomEmbed(null);
    setCustomInputUrl('');
  }, [currentModuleId]);

  const activeModule = modules.find((m) => m.id === currentModuleId) || null;
  const videoConfig = currentModuleId ? USER_EXACT_VIDEO_LINKS[currentModuleId] : null;

  const handleSelectModuleCard = (m: CP2Module) => {
    setCurrentModuleId(m.id);
    if (onSelectModuleId) onSelectModuleId(m.id);
  };

  const handleBackToModules = () => {
    setCurrentModuleId(null);
    if (onSelectModuleId) onSelectModuleId(null);
  };

  const handleLoadCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInputUrl.trim()) return;

    let url = customInputUrl.trim();
    const listMatch = url.match(/[?&]list=([^#&?]+)/);
    if (listMatch && listMatch[1]) {
      setActiveCustomEmbed(`https://www.youtube-nocookie.com/embed/videoseries?list=${listMatch[1]}&rel=0`);
    } else {
      const vidMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (vidMatch && vidMatch[1]) {
        setActiveCustomEmbed(`https://www.youtube-nocookie.com/embed/${vidMatch[1]}?rel=0`);
      } else {
        setActiveCustomEmbed(url);
      }
    }
    setCustomInputUrl('');
  };

  // If no module is selected: show EXACT SAME MINIMALIST DESIGN AS MODULES PAGE
  if (!activeModule) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => (
            <div
              key={m.id}
              onClick={() => handleSelectModuleCard(m)}
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
  }

  // Determine embed source URL for this module
  let embedUrl = 'about:blank';
  if (activeCustomEmbed) {
    embedUrl = activeCustomEmbed;
  } else if (videoConfig) {
    if (videoConfig.type === 'playlist' && videoConfig.playlistId) {
      embedUrl = `https://www.youtube-nocookie.com/embed/videoseries?list=${videoConfig.playlistId}&rel=0`;
    } else if (videoConfig.type === 'channel' && videoConfig.channelName) {
      // Embed playlists view query
      embedUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(videoConfig.channelName + ' playlist')}&rel=0`;
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      
      {/* Navigation header with back arrow and module info */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <button
          onClick={handleBackToModules}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="uppercase tracking-wider">Tous les modules</span>
        </button>

        <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
          {activeModule.title}
        </h2>
      </div>

      {/* Main 16:9 Video Player */}
      <div className="space-y-4">
        <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-video border border-zinc-900 shadow-2xl">
          {embedUrl !== 'about:blank' ? (
            <iframe
              title={activeModule.title}
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2">
              <Tv className="w-8 h-8" />
              <p className="text-xs font-mono">Collez un lien YouTube ci-dessous pour visionner</p>
            </div>
          )}
        </div>

        {/* Video meta and exact channel/playlist action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-900">
          <div>
            <div className="text-xs text-zinc-500 font-mono">
              {activeModule.title}
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5">
              {videoConfig ? videoConfig.title : 'Lecteur YouTube'}
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {videoConfig && (
              <a
                href={videoConfig.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 transition-colors flex items-center justify-center gap-2 shrink-0"
              >
                <span>Ouvrir sur YouTube</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              </a>
            )}

            {/* Direct custom URL input */}
            <form onSubmit={handleLoadCustomUrl} className="flex gap-2">
              <input
                type="text"
                placeholder="Coller un lien YouTube..."
                value={customInputUrl}
                onChange={(e) => setCustomInputUrl(e.target.value)}
                className="px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-sans w-48 sm:w-60"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 rounded-md transition-colors cursor-pointer shrink-0"
              >
                Lire
              </button>
            </form>
          </div>
        </div>
      </div>

    </div>
  );
};

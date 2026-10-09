import React from 'react';
import { ArrowLeft, Download, ExternalLink, FileText, HardDrive } from 'lucide-react';
import { formatDrivePreviewUrl } from '../services/driveService';

interface FullScreenPdfViewerProps {
  title: string;
  moduleTitle: string;
  pdfUrl?: string;
  onClose: () => void;
}

export const FullScreenPdfViewer: React.FC<FullScreenPdfViewerProps> = ({
  title,
  moduleTitle,
  pdfUrl,
  onClose,
}) => {
  const isDriveUrl = pdfUrl && (pdfUrl.includes('drive.google.com') || pdfUrl.includes('docs.google.com'));
  const effectiveEmbedUrl = pdfUrl ? formatDrivePreviewUrl(pdfUrl) : '';

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col animate-fadeIn">
      
      {/* Top Header Bar with go-back arrow */}
      <header className="h-16 px-4 sm:px-6 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer flex items-center gap-2"
            title="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">
              Retour
            </span>
          </button>

          <div className="border-l border-zinc-800 pl-4 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block truncate">
                {moduleTitle}
              </span>
              {isDriveUrl && (
                <span className="text-[10px] font-mono text-emerald-400 border border-emerald-900/60 bg-emerald-950/40 px-1.5 py-0.2 rounded flex items-center gap-1">
                  <HardDrive className="w-2.5 h-2.5" />
                  <span>Google Drive</span>
                </span>
              )}
            </div>
            <h1 className="text-sm sm:text-base font-bold text-zinc-100 truncate">
              {title}
            </h1>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 shrink-0">
          {pdfUrl && (
            <>
              <a
                href={pdfUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-md border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Télécharger</span>
              </a>

              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-900 transition-colors cursor-pointer"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </>
          )}

          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 rounded-md transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </header>

      {/* Main Full-Screen Content */}
      <main className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        {effectiveEmbedUrl ? (
          <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-900 bg-zinc-900 shadow-2xl">
            <iframe
              src={effectiveEmbedUrl}
              title={title}
              className="w-full h-full border-0"
              allow="autoplay"
            />
          </div>
        ) : (
          <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <FileText className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">
                {title}
              </h2>
              <p className="text-xs font-mono text-zinc-400">
                {moduleTitle} · Document PDF
              </p>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              Ce document est prêt. Vous pouvez sélectionner ou associer un fichier depuis votre Google Drive dans l'espace Administrateur.
            </p>

            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              ← Revenir à la liste
            </button>
          </div>
        )}
      </main>

    </div>
  );
};

import React from 'react';
import { CP2Module, CourseDoc, CustomResource } from '../types';
import { FileText, RefreshCw } from 'lucide-react';

interface CoursesViewProps {
  modules: CP2Module[];
  selectedModuleId?: string | null;
  onSelectModuleId: (id: string | null) => void;
  onOpenPdf: (title: string, moduleTitle: string, pdfUrl?: string) => void;
  customResources?: CustomResource[];
  onTriggerDriveSync?: () => void;
  isSyncingDrive?: boolean;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  modules,
  selectedModuleId,
  onSelectModuleId,
  onOpenPdf,
  customResources = [],
  onTriggerDriveSync,
  isSyncingDrive = false,
}) => {
  const displayedModules = selectedModuleId
    ? modules.filter((m) => m.id === selectedModuleId)
    : modules;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* Sélecteur minimaliste de modules */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar border-b border-zinc-900">
        <button
          onClick={() => onSelectModuleId(null)}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            !selectedModuleId
              ? 'bg-zinc-100 text-zinc-950'
              : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          Tous les modules
        </button>

        {modules.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelectModuleId(m.id)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              selectedModuleId === m.id
                ? 'bg-zinc-100 text-zinc-950'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {m.title}
          </button>
        ))}
      </div>

      {/* Liste des cours par module */}
      <div className="space-y-10">
        {displayedModules.map((m) => {
          // Merge custom courses from Firestore / Drive sync
          const customCoursesForModule: CourseDoc[] = customResources
            .filter((r) => r.type === 'cours' && r.moduleId === m.id)
            .map((r) => ({
              id: r.id,
              chapter: r.chapterOrSeries || 0,
              title: r.title,
              pdfUrl: r.url,
            }));

          const allCourses = [...customCoursesForModule, ...m.courses];

          return (
            <div key={m.id} className="space-y-3">
              <h2 className="text-sm font-mono tracking-widest text-zinc-400 uppercase">
                {m.title}
              </h2>

              <div className="divide-y divide-zinc-900 rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
                {allCourses.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <p className="text-xs font-mono text-zinc-500">
                      Aucun fichier de cours synchronisé pour {m.title}.
                    </p>
                    {onTriggerDriveSync && (
                      <button
                        onClick={onTriggerDriveSync}
                        disabled={isSyncingDrive}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                        <span>Synchroniser avec le dossier S3 Google Drive</span>
                      </button>
                    )}
                  </div>
                ) : (
                  allCourses.map((course, idx) => (
                    <div
                      key={course.id || idx}
                      className="flex items-center justify-between p-4 sm:px-6 hover:bg-zinc-900/50 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="font-mono text-xs text-zinc-600 shrink-0">
                          CH {course.chapter > 0 ? (course.chapter < 10 ? `0${course.chapter}` : course.chapter) : 'DOC'}
                        </span>
                        <span className="text-sm font-medium text-zinc-200 truncate">
                          {course.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onOpenPdf(course.title, m.title, course.pdfUrl)}
                          className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-md border border-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { CP2_MODULES } from './data/cp2Data';
import { CP2Module, TabType, CustomResource } from './types';
import { Navbar } from './components/Navbar';
import { ModulesView } from './components/ModulesView';
import { CoursesView } from './components/CoursesView';
import { TDView } from './components/TDView';
import { TPView } from './components/TPView';
import { VideoView } from './components/VideoView';
import { AdminView } from './components/AdminView';
import { FullScreenPdfViewer } from './components/FullScreenPdfViewer';
import { auth, googleProvider, db, getAccessToken, setCachedAccessToken, ADMIN_EMAIL } from './firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { fastScanDriveForS3, syncDiscoveredResourcesToFirestore, S3_FOLDER_ID } from './services/driveService';
import DEFAULT_S3_DRIVE_DATA from './data/driveExtractedData.json';
import { BookOpen, FileText, FlaskConical, Play, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('modules');
  const [selectedModule, setSelectedModule] = useState<CP2Module | null>(null);
  const [moduleModal, setModuleModal] = useState<CP2Module | null>(null);
  
  // Full-screen PDF viewer state
  const [fullScreenPdf, setFullScreenPdf] = useState<{
    title: string;
    moduleTitle: string;
    pdfUrl?: string;
  } | null>(null);

  // Real-time custom resources (initialized with extracted S3 Drive data for instant loading)
  const [customResources, setCustomResources] = useState<CustomResource[]>(() => {
    try {
      const cached = localStorage.getItem('cp2_cached_drive_resources');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return (DEFAULT_S3_DRIVE_DATA as any[]) || [];
  });

  // Direct Drive Sync State
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncToast, setSyncToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Sync with Firestore in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'resources'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CustomResource[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...(doc.data() as any) });
          });
          setCustomResources(list);
          try {
            localStorage.setItem('cp2_cached_drive_resources', JSON.stringify(list));
          } catch (e) {
            console.warn(e);
          }
        }
      },
      (err) => {
        console.warn('Snapshot on resources (operating with local cache):', err.message);
      }
    );
    return () => unsubscribe();
  }, []);

  // Listen to auth state to restore access token if available
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      // Keep session in sync
    });
    return () => unsub();
  }, []);

  // 1-Click Direct Drive Synchronization without going to admin dashboard
  const handleDirectDriveSync = async () => {
    setIsSyncingDrive(true);
    setSyncToast({ msg: 'Connexion Google Drive & analyse instantanée du dossier S3...', type: 'info' });

    try {
      let token = getAccessToken();
      if (!token) {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          token = credential.accessToken;
          setCachedAccessToken(token);
        }
      }

      if (!token) {
        setSyncToast({ msg: 'Autorisation Google Drive requise pour accéder au dossier S3.', type: 'error' });
        setIsSyncingDrive(false);
        return;
      }

      // Run sub-second fast batch scan of Drive
      const discovered = await fastScanDriveForS3(token);

      if (discovered.length === 0) {
        setSyncToast({
          msg: 'Analyse terminée : aucun document PDF détecté dans votre dossier S3.',
          type: 'info'
        });
      } else {
        // Immediately update React state for instant UI update
        setCustomResources(discovered as any);
        setSyncToast({
          msg: `✓ ${discovered.length} documents PDF du dossier S3 synchronisés avec succès !`,
          type: 'success'
        });

        // Background write to Firestore for persistence
        const adminEmail = auth.currentUser?.email || ADMIN_EMAIL;
        syncDiscoveredResourcesToFirestore(discovered, adminEmail).catch((e) =>
          console.warn('Background Firestore persistence note:', e)
        );
      }
    } catch (err: any) {
      setSyncToast({ msg: `Erreur Drive : ${err.message || 'Impossible de synchroniser'}`, type: 'error' });
    } finally {
      setIsSyncingDrive(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  const handleSelectModuleFromGrid = (module: CP2Module) => {
    setModuleModal(module);
  };

  const handleOpenSectionForModule = (module: CP2Module, tab: TabType) => {
    setSelectedModule(module);
    setActiveTab(tab);
    setModuleModal(null);
  };

  const handleClearModuleFilter = () => {
    setSelectedModule(null);
  };

  const handleOpenFullScreenPdf = (title: string, moduleTitle: string, pdfUrl?: string) => {
    setFullScreenPdf({ title, moduleTitle, pdfUrl });
  };

  // Helper count of resources for this module
  const getResourceCountForModule = (moduleId: string, type: 'cours' | 'td' | 'tp' | 'video') => {
    const mod = CP2_MODULES.find((m) => m.id === moduleId);
    const customCount = customResources.filter((r) => r.moduleId === moduleId && r.type === type).length;
    if (type === 'cours') return customCount + (mod?.courses.length || 0);
    if (type === 'td') return customCount + (mod?.td.length || 0);
    if (type === 'tp') return customCount + (mod?.tp.length || 0);
    if (type === 'video') return customCount + (mod?.videos.length || 0);
    return 0;
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col selection:bg-zinc-800 selection:text-white">
      
      {/* Barre de navigation sombre et minimale avec bouton de synchronisation Drive direct */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
        }}
        selectedModuleTitle={selectedModule ? selectedModule.title : undefined}
        onClearModuleFilter={handleClearModuleFilter}
        onTriggerDriveSync={handleDirectDriveSync}
        isSyncingDrive={isSyncingDrive}
        syncedDriveCount={customResources.length}
      />

      {/* Toast de statut de synchronisation Drive direct */}
      {syncToast && (
        <div className="fixed top-20 right-4 z-50 max-w-md animate-fadeIn">
          <div className={`p-3.5 rounded-xl border text-xs font-mono shadow-2xl flex items-center justify-between gap-3 ${
            syncToast.type === 'success'
              ? 'bg-zinc-950 border-emerald-800 text-emerald-300'
              : syncToast.type === 'error'
              ? 'bg-zinc-950 border-red-800 text-red-300'
              : 'bg-zinc-950 border-zinc-700 text-zinc-200'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              {syncToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : syncToast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
              )}
              <span className="truncate">{syncToast.msg}</span>
            </div>
            <button
              onClick={() => setSyncToast(null)}
              className="text-zinc-500 hover:text-white p-0.5 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Vue séparée (pas de scroll infini entre sections) */}
      <main className="flex-1">
        {activeTab === 'modules' && (
          <ModulesView
            modules={CP2_MODULES}
            onSelectModule={handleSelectModuleFromGrid}
          />
        )}

        {activeTab === 'cours' && (
          <CoursesView
            modules={CP2_MODULES}
            selectedModuleId={selectedModule ? selectedModule.id : null}
            onSelectModuleId={(id) => {
              const found = CP2_MODULES.find((m) => m.id === id);
              setSelectedModule(found || null);
            }}
            onOpenPdf={handleOpenFullScreenPdf}
            customResources={customResources}
            onTriggerDriveSync={handleDirectDriveSync}
            isSyncingDrive={isSyncingDrive}
          />
        )}

        {activeTab === 'td' && (
          <TDView
            modules={CP2_MODULES}
            selectedModuleId={selectedModule ? selectedModule.id : null}
            onSelectModuleId={(id) => {
              const found = CP2_MODULES.find((m) => m.id === id);
              setSelectedModule(found || null);
            }}
            onOpenPdf={handleOpenFullScreenPdf}
            customResources={customResources}
            onTriggerDriveSync={handleDirectDriveSync}
            isSyncingDrive={isSyncingDrive}
          />
        )}

        {activeTab === 'tp' && (
          <TPView
            modules={CP2_MODULES}
            selectedModuleId={selectedModule ? selectedModule.id : null}
            onSelectModuleId={(id) => {
              const found = CP2_MODULES.find((m) => m.id === id);
              setSelectedModule(found || null);
            }}
            onOpenPdf={handleOpenFullScreenPdf}
            customResources={customResources}
            onTriggerDriveSync={handleDirectDriveSync}
            isSyncingDrive={isSyncingDrive}
          />
        )}

        {activeTab === 'video' && (
          <VideoView
            modules={CP2_MODULES}
            selectedModuleId={selectedModule ? selectedModule.id : null}
            onSelectModuleId={(id) => {
              const found = CP2_MODULES.find((m) => m.id === id);
              setSelectedModule(found || null);
            }}
            customResources={customResources}
          />
        )}

        {activeTab === 'admin' && (
          <AdminView
            modules={CP2_MODULES}
          />
        )}
      </main>

      {/* Modal minimaliste de sélection de section pour le module sélectionné */}
      {moduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-5 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs text-zinc-500 uppercase">
                  {moduleModal.semester}
                </span>
                <h3 className="text-xl font-black text-white mt-0.5 uppercase tracking-wide">
                  {moduleModal.title}
                </h3>
              </div>
              <button
                onClick={() => setModuleModal(null)}
                className="text-zinc-500 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => handleOpenSectionForModule(moduleModal, 'cours')}
                className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                  <span className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                    Cours
                  </span>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {getResourceCountForModule(moduleModal.id, 'cours')}
                </span>
              </button>

              <button
                onClick={() => handleOpenSectionForModule(moduleModal, 'td')}
                className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                  <span className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                    Travaux Dirigés (TD)
                  </span>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {getResourceCountForModule(moduleModal.id, 'td')}
                </span>
              </button>

              <button
                onClick={() => handleOpenSectionForModule(moduleModal, 'tp')}
                className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <FlaskConical className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                  <span className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                    Travaux Pratiques (TP)
                  </span>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {getResourceCountForModule(moduleModal.id, 'tp')}
                </span>
              </button>

              <button
                onClick={() => handleOpenSectionForModule(moduleModal, 'video')}
                className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <Play className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                  <span className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                    Vidéothèque
                  </span>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {getResourceCountForModule(moduleModal.id, 'video')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plein écran pour consultation des PDF avec flèche de retour */}
      {fullScreenPdf && (
        <FullScreenPdfViewer
          title={fullScreenPdf.title}
          moduleTitle={fullScreenPdf.moduleTitle}
          pdfUrl={fullScreenPdf.pdfUrl}
          onClose={() => setFullScreenPdf(null)}
        />
      )}

      {/* Footer minimaliste ultra sobre */}
      <footer className="border-t border-zinc-900/60 py-6 text-center text-xs font-mono text-zinc-600">
        CP2 · DEUXIÈME ANNÉE PRÉPARATOIRE
      </footer>

    </div>
  );
}

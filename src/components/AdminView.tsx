import React, { useState, useEffect } from 'react';
import { CP2Module, CustomResource } from '../types';
import { 
  auth, googleProvider, ADMIN_EMAIL, db, handleFirestoreError, OperationType,
  setCachedAccessToken, getAccessToken 
} from '../firebase';
import { 
  signInWithPopup, signOut, onAuthStateChanged, User, GoogleAuthProvider 
} from 'firebase/auth';
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  listDrivePdfFiles, DriveFileItem, formatDrivePreviewUrl,
  fastScanDriveForS3, DiscoveredDriveResource,
  syncDiscoveredResourcesToFirestore, S3_FOLDER_ID 
} from '../services/driveService';
import { 
  Lock, LogOut, Plus, Trash2, BookOpen, FileText, FlaskConical, Play, 
  AlertCircle, HardDrive, Search, RefreshCw, X, Check, FolderSync, CheckCircle2, ChevronRight 
} from 'lucide-react';

interface AdminViewProps {
  modules: CP2Module[];
}

export const AdminView: React.FC<AdminViewProps> = ({ modules }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Resources state from Firestore
  const [resources, setResources] = useState<CustomResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);

  // Form state
  const [selectedType, setSelectedType] = useState<'cours' | 'td' | 'tp' | 'video'>('cours');
  const [selectedModuleId, setSelectedModuleId] = useState<string>(modules[0]?.id || 'analyse-3');
  const [itemTitle, setItemTitle] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [itemSecondaryUrl, setItemSecondaryUrl] = useState('');
  const [itemChannel, setItemChannel] = useState('');
  const [itemNumber, setItemNumber] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Google Drive browser state
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveTargetField, setDriveTargetField] = useState<'main' | 'secondary'>('main');

  // S3 Folder Sync State
  const [isScanningS3, setIsScanningS3] = useState(false);
  const [s3ScanStatus, setS3ScanStatus] = useState<string | null>(null);
  const [s3DiscoveredFiles, setS3DiscoveredFiles] = useState<DiscoveredDriveResource[]>([]);
  const [s3SyncSuccessCount, setS3SyncSuccessCount] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
      if (!user) {
        setCachedAccessToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to Firestore resources
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'resources'),
      (snapshot) => {
        const list: CustomResource[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setResources(list);
        setLoadingResources(false);
      },
      (err) => {
        console.error('Error fetching resources:', err);
        setLoadingResources(false);
      }
    );
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erreur lors de la connexion Google');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCachedAccessToken(null);
    } catch (err) {
      console.error(err);
    }
  };

  const isAdmin = currentUser && currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Load files from Google Drive
  const handleOpenDrivePicker = async (target: 'main' | 'secondary' = 'main') => {
    setDriveTargetField(target);
    setIsDrivePickerOpen(true);
    setDriveError(null);

    const token = getAccessToken();
    if (!token) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setCachedAccessToken(credential.accessToken);
          fetchDriveFiles(credential.accessToken);
        } else {
          setDriveError('Token d\'accès Google Drive introuvable. Veuillez vous reconnecter.');
        }
      } catch (e: any) {
        setDriveError(e.message || 'Connexion Drive impossible');
      }
      return;
    }

    fetchDriveFiles(token);
  };

  const fetchDriveFiles = async (token: string, search: string = '') => {
    setLoadingDrive(true);
    setDriveError(null);
    try {
      const files = await listDrivePdfFiles(token, search);
      setDriveFiles(files);
    } catch (err: any) {
      setDriveError(err.message || 'Erreur lors du chargement des fichiers Drive');
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleSelectDriveFile = (file: DriveFileItem) => {
    const rawUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    const previewUrl = formatDrivePreviewUrl(rawUrl);

    if (driveTargetField === 'main') {
      setItemUrl(previewUrl);
      if (!itemTitle) {
        setItemTitle(file.name.replace(/\.pdf$/i, ''));
      }
    } else {
      setItemSecondaryUrl(previewUrl);
    }

    setIsDrivePickerOpen(false);
  };

  // Automated S3 Folder scan & synchronizer
  const handleScanS3Folder = async () => {
    let token = getAccessToken();
    if (!token) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          token = credential.accessToken;
          setCachedAccessToken(token);
        }
      } catch (e: any) {
        setS3ScanStatus(`Erreur de connexion Drive: ${e.message}`);
        return;
      }
    }

    if (!token) {
      setS3ScanStatus('Veuillez vous reconnecter pour autoriser Google Drive.');
      return;
    }

    setIsScanningS3(true);
    setS3ScanStatus('Analyse rapide et instantanée du dossier S3 dans votre Google Drive...');
    setS3SyncSuccessCount(null);

    try {
      const discovered = await fastScanDriveForS3(token);
      setS3DiscoveredFiles(discovered);

      if (discovered.length === 0) {
        setS3ScanStatus(`Analyse terminée : aucun document PDF trouvé dans le dossier S3 ou avec les mots-clés de modules CP2.`);
      } else {
        setS3ScanStatus(`${discovered.length} document(s) PDF détecté(s) dans le dossier S3 ! Prêt pour la synchronisation.`);
      }
    } catch (err: any) {
      setS3ScanStatus(`Erreur lors de l'analyse : ${err.message}`);
    } finally {
      setIsScanningS3(false);
    }
  };

  const handleApplyS3Sync = async () => {
    if (s3DiscoveredFiles.length === 0 || !currentUser) return;
    setIsScanningS3(true);
    setS3ScanStatus('Synchronisation en cours vers la base de données du site...');

    try {
      const count = await syncDiscoveredResourcesToFirestore(s3DiscoveredFiles, currentUser.email || ADMIN_EMAIL);
      setS3SyncSuccessCount(count);
      setS3ScanStatus(`${count} documents PDF du dossier S3 synchronisés avec succès sur le site !`);
      setS3DiscoveredFiles([]);
    } catch (err: any) {
      setS3ScanStatus(`Erreur d'enregistrement : ${err.message}`);
    } finally {
      setIsScanningS3(false);
    }
  };

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || !itemUrl.trim() || !isAdmin) return;

    setIsSubmitting(true);
    const newId = `res_${Date.now()}`;
    const newResource: any = {
      id: newId,
      moduleId: selectedModuleId,
      type: selectedType,
      title: itemTitle.trim(),
      url: formatDrivePreviewUrl(itemUrl.trim()),
      authorEmail: currentUser?.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (selectedType === 'td' && itemSecondaryUrl.trim()) {
      newResource.secondaryUrl = formatDrivePreviewUrl(itemSecondaryUrl.trim());
    }
    if (selectedType === 'video' && itemChannel.trim()) {
      newResource.channel = itemChannel.trim();
    }
    if (itemNumber) {
      newResource.chapterOrSeries = Number(itemNumber);
    }

    try {
      await setDoc(doc(db, 'resources', newId), newResource);
      setFeedbackMsg('Ressource enregistrée avec succès !');
      setItemTitle('');
      setItemUrl('');
      setItemSecondaryUrl('');
      setItemChannel('');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `resources/${newId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'resources', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `resources/${id}`);
    }
  };

  if (loadingAuth) {
    return (
      <div className="max-w-md mx-auto py-24 text-center text-xs font-mono text-zinc-500">
        Chargement de l'authentification...
      </div>
    );
  }

  // If not logged in
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-24 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
          <Lock className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-black text-white uppercase tracking-wide">
            Espace Administrateur & Google Drive
          </h2>
          <p className="text-xs text-zinc-400">
            Synchronisation du dossier S3 et gestion des PDF de cours, TD, TP et vidéos
          </p>
        </div>

        {authError && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-xs text-red-300">
            {authError}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="w-full py-3 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Connexion Google ({ADMIN_EMAIL})</span>
        </button>

        <p className="text-[11px] font-mono text-zinc-600">
          Accès sécurisé avec autorisation Google Drive (Dossier S3)
        </p>
      </div>
    );
  }

  // If logged in but not the designated admin
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-950/40 border border-amber-800 flex items-center justify-center mx-auto text-amber-500">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">
            Accès Refusé
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Vous êtes connecté avec l'adresse <strong className="text-zinc-200">{currentUser.email}</strong>. Seul l'administrateur <strong className="text-zinc-200">{ADMIN_EMAIL}</strong> est autorisé à éditer les ressources.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  // Authorized Admin Panel
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      
      {/* Admin header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-950 border border-zinc-900">
        <div>
          <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest font-bold">
            ● Administrateur Actif
          </span>
          <h2 className="text-lg font-black text-white uppercase tracking-wide mt-0.5">
            Tableau de Bord & Google Drive
          </h2>
          <p className="text-xs text-zinc-400 font-mono">
            {currentUser.email}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-md border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Déconnexion</span>
        </button>
      </div>

      {/* AUTOMATED S3 FOLDER SYNC PANEL */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-emerald-900/40 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
              <FolderSync className="w-4 h-4" />
              <span>Synchronisation Google Drive · Dossier S3</span>
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Analyse et Intégration Automatique du Dossier S3
            </h3>
            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
              Dossier cible lié :{' '}
              <a
                href={`https://drive.google.com/drive/folders/${S3_FOLDER_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline font-mono hover:text-emerald-300"
              >
                Dossier S3 officiel
              </a>
              . Scanne tous les modules (Cours, TD, TP) et synchronise les noms exacts des PDF.
            </p>
          </div>

          <button
            onClick={handleScanS3Folder}
            disabled={isScanningS3}
            className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningS3 ? 'animate-spin' : ''}`} />
            <span>{isScanningS3 ? 'Analyse en cours...' : 'Analyser le dossier S3'}</span>
          </button>
        </div>

        {/* Status message */}
        {s3ScanStatus && (
          <div className="p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300 flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{s3ScanStatus}</span>
          </div>
        )}

        {/* Discovered files preview & sync confirm */}
        {s3DiscoveredFiles.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-300 font-bold uppercase">
                {s3DiscoveredFiles.length} documents détectés prêts à être synchronisés :
              </span>

              <button
                onClick={handleApplyS3Sync}
                disabled={isScanningS3}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white hover:bg-zinc-200 text-black rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirmer & Intégrer au site</span>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-zinc-900 rounded-xl border border-zinc-800 bg-black/60">
              {s3DiscoveredFiles.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-200 truncate">
                      {item.title}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                      {item.folderPath} · Module: {item.moduleId} · Type: {item.type.toUpperCase()}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Add Resource Form */}
      <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <h3 className="text-sm font-mono tracking-widest text-zinc-300 uppercase font-bold flex items-center gap-2">
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>Ajout manuel ou ponctuel de ressource</span>
          </h3>

          {feedbackMsg && (
            <span className="text-xs font-semibold text-emerald-400 font-mono animate-fadeIn">
              {feedbackMsg}
            </span>
          )}
        </div>

        {/* Type selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'cours', label: 'Cours PDF', icon: BookOpen },
            { id: 'td', label: 'Travaux Dirigés (TD)', icon: FileText },
            { id: 'tp', label: 'Travaux Pratiques (TP)', icon: FlaskConical },
            { id: 'video', label: 'Vidéo / Playlist YouTube', icon: Play },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedType(tab.id as any)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isSelected
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleCreateResource} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-400 uppercase">
                Module CP2 concerné
              </label>
              <select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-400 uppercase">
                Titre de la ressource (exactement comme le PDF)
              </label>
              <input
                type="text"
                placeholder="Ex: Chapitre 1 - Séries numériques..."
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-zinc-400 uppercase">
                  {selectedType === 'video' ? 'Lien YouTube (Vidéo ou Playlist)' : 'Lien URL du fichier PDF'}
                </label>
                {selectedType !== 'video' && (
                  <button
                    type="button"
                    onClick={() => handleOpenDrivePicker('main')}
                    className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <HardDrive className="w-3 h-3" />
                    <span>Choisir depuis Google Drive</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder={selectedType === 'video' ? 'https://youtube.com/watch?v=... ou playlist' : 'https://drive.google.com/... ou lien PDF'}
                value={itemUrl}
                onChange={(e) => setItemUrl(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
              />
            </div>

            {selectedType === 'td' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-zinc-400 uppercase">
                    Lien URL du Corrigé PDF (optionnel)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenDrivePicker('secondary')}
                    className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <HardDrive className="w-3 h-3" />
                    <span>Choisir corrigé (Drive)</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://drive.google.com/... lien corrigé"
                  value={itemSecondaryUrl}
                  onChange={(e) => setItemSecondaryUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
              </div>
            ) : selectedType === 'video' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400 uppercase">
                  Nom de la chaîne / Enseignant (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Exo7 / Polytechnique..."
                  value={itemChannel}
                  onChange={(e) => setItemChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-400 uppercase">
                  Numéro de chapitre ou séance
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={itemNumber}
                  onChange={(e) => setItemNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer la ressource'}
            </button>
          </div>
        </form>
      </div>

      {/* List of Managed Resources */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
          Ressources actives sur le site ({resources.length})
        </h3>

        {resources.length === 0 ? (
          <div className="p-8 text-center bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-mono text-zinc-600">
            Aucun fichier personnalisé n'a encore été ajouté. Cliquez sur "Analyser le dossier S3" ci-dessus pour synchroniser vos PDF.
          </div>
        ) : (
          <div className="divide-y divide-zinc-900 rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
            {resources.map((res) => {
              const mod = modules.find((m) => m.id === res.moduleId);
              const isDrive = res.url.includes('drive.google.com');

              return (
                <div
                  key={res.id}
                  className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase">
                      <span className="font-bold text-zinc-300">{mod ? mod.title : res.moduleId}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-400">{res.type}</span>
                      {isDrive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400">Google Drive</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-zinc-200 truncate mt-0.5">
                      {res.title}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-600 truncate mt-0.5">
                      {res.url}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteResource(res.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Supprimer la ressource"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Google Drive Picker Modal */}
      {isDrivePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 animate-fadeIn max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Google Drive</span>
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Sélectionner un fichier PDF depuis votre Drive
                </h3>
              </div>
              <button
                onClick={() => setIsDrivePickerOpen(false)}
                className="text-zinc-500 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search in drive bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un fichier PDF dans votre Drive..."
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const token = getAccessToken();
                      if (token) fetchDriveFiles(token, driveSearch);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const token = getAccessToken();
                  if (token) fetchDriveFiles(token, driveSearch);
                }}
                className="px-3 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
            </div>

            {driveError && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-xs text-red-300 rounded-lg">
                {driveError}
              </div>
            )}

            {/* Files List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {loadingDrive ? (
                <div className="py-16 text-center text-xs font-mono text-zinc-500">
                  Recherche dans votre Google Drive...
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="py-16 text-center text-xs font-mono text-zinc-500">
                  Aucun fichier PDF trouvé dans votre Drive correspondant à la recherche.
                </div>
              ) : (
                driveFiles.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleSelectDriveFile(f)}
                    className="p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-black border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                          {f.name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : 'PDF'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-800 group-hover:bg-emerald-600 text-zinc-300 group-hover:text-white rounded-md transition-colors shrink-0"
                    >
                      Sélectionner
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setIsDrivePickerOpen(false)}
                className="px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

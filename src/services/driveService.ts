import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface DiscoveredDriveResource {
  id: string;
  fileId: string;
  moduleId: string;
  type: 'cours' | 'td' | 'tp';
  title: string;
  url: string;
  folderPath: string;
  chapterOrSeries?: number;
  fileName: string;
  authorEmail?: string;
}

/**
 * Converts a Google Drive link or file ID into an embeddable preview URL
 */
export function formatDrivePreviewUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  if (urlOrId.includes('/preview')) return urlOrId;

  const matchId = urlOrId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://drive.google.com/file/d/${matchId[1]}/preview`;
  }

  const matchParam = urlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchParam && matchParam[1]) {
    return `https://drive.google.com/file/d/${matchParam[1]}/preview`;
  }

  if (/^[a-zA-Z0-9_-]{25,}$/.test(urlOrId.trim())) {
    return `https://drive.google.com/file/d/${urlOrId.trim()}/preview`;
  }

  return urlOrId;
}

/**
 * Normalizes text for matching (lowercase, no accents)
 */
export function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Maps folder or file text to one of the 11 CP2 module IDs
 */
export function matchModuleFromText(text: string): string {
  const norm = normalize(text);

  if (norm.includes('analyse num') || norm.includes('numerique') || norm.includes('num 1') || norm.includes('anglais num')) {
    // If text specifically says "anglais", check context
    if (norm.includes('anglais num')) return 'analyse-numerique-1';
    return 'analyse-numerique-1';
  }
  if (norm.includes('analyse 3') || norm.includes('analyse iii') || norm.includes('analyse') || norm.includes('math 3') || norm.includes('maths 3')) {
    return 'analyse-3';
  }
  if (norm.includes('physique 3') || norm.includes('phys 3') || norm.includes('physique') || norm.includes('maxwell') || norm.includes('electromag') || norm.includes('onde')) {
    return 'physique-3';
  }
  if (norm.includes('chimie 3') || norm.includes('chim 3') || norm.includes('chimie')) {
    return 'chimie-3';
  }
  if (norm.includes('fluide') || norm.includes('mdf') || norm.includes('meca flu') || norm.includes('bernoulli')) {
    return 'mecanique-des-fluides';
  }
  if (norm.includes('rationnelle') || norm.includes('meca r') || norm.includes('torseur') || norm.includes('mecanique 3') || norm.includes('mecanique')) {
    return 'mecanique-rationnelle';
  }
  if (norm.includes('informatique') || norm.includes('info 3') || norm.includes('info') || norm.includes('algorithme') || norm.includes('abr') || norm.includes('langage c')) {
    return 'informatique-3';
  }
  if (norm.includes('electricite') || norm.includes('elec') || norm.includes('rlc') || norm.includes('triphase')) {
    return 'electricite-generale';
  }
  if (norm.includes('ingenierie') || norm.includes('rdm') || norm.includes('dessin') || norm.includes('cao')) {
    return 'ingenierie-1';
  }
  if (norm.includes('anglais') || norm.includes('english')) {
    return 'anglais';
  }
  if (norm.includes("technique d'expression") || norm.includes('expression') || norm.includes('synthese') || norm.includes('resume')) {
    return 'technique-expression';
  }

  // Fallback default
  return 'analyse-3';
}

/**
 * Determines whether a file/folder represents a cours, td or tp
 */
export function matchTypeFromText(fileName: string, folderName: string = ''): 'cours' | 'td' | 'tp' {
  const combined = normalize(`${folderName} ${fileName}`);

  if (combined.includes('tp') || combined.includes('travaux pratiq') || combined.includes('manip') || combined.includes('laboratoire') || combined.includes('compte rendu')) {
    return 'tp';
  }
  if (combined.includes('td') || combined.includes('travaux dirig') || combined.includes('serie') || combined.includes('exercice') || combined.includes('corrige') || combined.includes('fiche')) {
    return 'td';
  }
  return 'cours';
}

/**
 * Extracts sequence number from title or filename (e.g. "Chapitre 2" -> 2, "TD 3" -> 3)
 */
export function extractChapterOrSeriesNumber(text: string): number | undefined {
  const norm = normalize(text);
  const match = norm.match(/(?:chapitre|ch|serie|td|tp|seance|partie|s)\s*[-_.]?\s*(\d+)/i) || norm.match(/(\d+)/);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num < 100) return num;
  }
  return undefined;
}

export const S3_FOLDER_ID = '1hr3YolUHeBEn4M9Q1CE4Ua3Kvp-EPoLX';

/**
 * High-performance, fast scan of Google Drive for folder S3 and its contents
 * Executes in a single batch pass (sub-second) instead of slow sequential crawling
 */
export async function fastScanDriveForS3(
  accessToken: string,
  targetFolderId: string = S3_FOLDER_ID
): Promise<DiscoveredDriveResource[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Run concurrent queries for folders and PDF files
  const foldersQuery = encodeURIComponent("trashed = false and mimeType = 'application/vnd.google-apps.folder'");
  const pdfsQuery = encodeURIComponent("trashed = false and (mimeType = 'application/pdf' or name contains '.pdf')");

  const [foldersRes, pdfsRes] = await Promise.all([
    fetch(`https://www.googleapis.com/drive/v3/files?q=${foldersQuery}&fields=files(id,name,parents)&pageSize=1000`, { headers }),
    fetch(`https://www.googleapis.com/drive/v3/files?q=${pdfsQuery}&fields=files(id,name,mimeType,parents,webViewLink,webContentLink,modifiedTime)&pageSize=1000`, { headers })
  ]);

  if (!pdfsRes.ok) {
    const errData = await pdfsRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Erreur Google Drive (${pdfsRes.status})`);
  }

  const foldersData = foldersRes.ok ? await foldersRes.json() : { files: [] };
  const pdfsData = await pdfsRes.json();

  const allFolders: { id: string; name: string; parents?: string[] }[] = foldersData.files || [];
  const allPdfs: DriveFileItem[] = pdfsData.files || [];

  // Build folder map and parent lookup
  const folderMap = new Map<string, { id: string; name: string; parents?: string[] }>();
  allFolders.forEach((f) => folderMap.set(f.id, f));

  // Find S3 root folder (prioritize targetFolderId if provided)
  const s3Folder = allFolders.find((f) => f.id === targetFolderId) || allFolders.find((f) => {
    const n = f.name.trim().toLowerCase();
    return n === 's3' || n === 'dossier s3' || n.startsWith('s3 -') || n.startsWith('s3_');
  }) || allFolders.find((f) => f.name.toLowerCase().includes('s3'));

  const s3FolderId = targetFolderId || s3Folder?.id;

  // Build helper to find path and check if a folder is descendant of S3
  const getFolderPathAndIsUnderS3 = (parentIds?: string[]): { path: string; isUnderS3: boolean } => {
    if (!parentIds || parentIds.length === 0) return { path: '', isUnderS3: false };

    let currentId = parentIds[0];
    const pathParts: string[] = [];
    let isUnder = false;
    let depth = 0;

    while (currentId && depth < 10) {
      if (s3FolderId && currentId === s3FolderId) {
        isUnder = true;
      }
      const folder = folderMap.get(currentId);
      if (!folder) break;
      pathParts.unshift(folder.name);
      currentId = folder.parents && folder.parents.length > 0 ? folder.parents[0] : '';
      depth++;
    }

    return {
      path: pathParts.join(' / '),
      isUnderS3: isUnder || (!s3FolderId && pathParts.some((p) => p.toLowerCase().includes('s3'))),
    };
  };

  const discovered: DiscoveredDriveResource[] = [];

  // Filter and parse PDFs
  for (const item of allPdfs) {
    const { path, isUnderS3 } = getFolderPathAndIsUnderS3(item.parents);

    // If S3 folder was identified, prioritize files inside S3
    // Also include files matching CP2 module keywords if S3 folder structure is loose
    const textToCheck = `${path} ${item.name}`;
    const detectedModule = matchModuleFromText(textToCheck);
    const hasModuleKeyword = normalize(textToCheck).match(/(analyse|physique|chimie|mecanique|fluide|info|electricite|ingenierie|anglais|expression)/i);

    if (isUnderS3 || hasModuleKeyword) {
      const cleanTitle = item.name.replace(/\.pdf$/i, '').trim();
      const detectedType = matchTypeFromText(item.name, path);
      const detectedNumber = extractChapterOrSeriesNumber(item.name);

      discovered.push({
        id: `drive_${item.id}`,
        fileId: item.id,
        moduleId: detectedModule,
        type: detectedType,
        title: cleanTitle, // Exact title from the student's PDF!
        url: `https://drive.google.com/file/d/${item.id}/preview`,
        folderPath: path || 'Google Drive',
        chapterOrSeries: detectedNumber,
        fileName: item.name,
      });
    }
  }

  // Sort resources in natural educational order:
  // 1. By module
  // 2. By type (cours, td, tp)
  // 3. By sequence number (chapitre/série)
  // 4. By title alphabetically
  discovered.sort((a, b) => {
    if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if ((a.chapterOrSeries || 0) !== (b.chapterOrSeries || 0)) {
      return (a.chapterOrSeries || 0) - (b.chapterOrSeries || 0);
    }
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Save to localStorage cache so they load instantly on next refresh
  if (discovered.length > 0) {
    try {
      localStorage.setItem('cp2_cached_drive_resources', JSON.stringify(discovered));
      localStorage.setItem('cp2_drive_sync_timestamp', new Date().toISOString());
    } catch (e) {
      console.warn('LocalStorage error caching resources:', e);
    }
  }

  return discovered;
}

/**
 * Synchronizes discovered Google Drive S3 resources to Firestore and local state
 */
export async function syncDiscoveredResourcesToFirestore(
  resources: DiscoveredDriveResource[],
  adminEmail: string
): Promise<number> {
  let count = 0;
  for (const res of resources) {
    try {
      const docRef = doc(db, 'resources', res.id);
      await setDoc(docRef, {
        id: res.id,
        moduleId: res.moduleId,
        type: res.type,
        title: res.title, // Exact name from PDF preserved
        url: res.url,
        folderPath: res.folderPath,
        chapterOrSeries: res.chapterOrSeries || 0,
        fileName: res.fileName,
        authorEmail: adminEmail,
        source: 'google_drive_s3',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      count++;
    } catch (err) {
      console.error('Failed to sync resource to Firestore:', res.id, err);
    }
  }
  return count;
}

/**
 * Fetch PDF files from the user's Google Drive matching a search query
 */
export async function listDrivePdfFiles(
  accessToken: string,
  searchQuery: string = ''
): Promise<DriveFileItem[]> {
  let q = "trashed = false and (mimeType = 'application/pdf' or name contains '.pdf')";
  if (searchQuery.trim()) {
    const sanitized = searchQuery.replace(/'/g, "\\'");
    q += ` and name contains '${sanitized}'`;
  }

  const params = new URLSearchParams({
    q,
    fields: 'files(id, name, mimeType, webViewLink, webContentLink, size, modifiedTime)',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Erreur Google Drive: ${res.status}`);
  }

  const data = await res.json();
  return data.files || [];
}

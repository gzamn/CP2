export type TabType = 'modules' | 'cours' | 'td' | 'tp' | 'video' | 'admin';

export interface CourseDoc {
  id: string;
  chapter: number;
  title: string;
  pdfUrl?: string;
  moduleId?: string;
}

export interface TDDoc {
  id: string;
  series: number;
  title: string;
  pdfUrl?: string;
  solutionsUrl?: string;
  moduleId?: string;
}

export interface TPDoc {
  id: string;
  number: number;
  title: string;
  pdfUrl?: string;
  moduleId?: string;
}

export interface VideoDoc {
  id: string;
  youtubeId: string;
  title: string;
  channel?: string;
  channelUrl?: string;
  moduleId?: string;
  isPlaylist?: boolean;
}

export interface CP2Module {
  id: string;
  title: string;
  semester: 'S3' | 'S4';
  gradient: string;
  courses: CourseDoc[];
  td: TDDoc[];
  tp: TPDoc[];
  videos: VideoDoc[];
}

export interface CustomResource {
  id: string;
  moduleId: string;
  type: 'cours' | 'td' | 'tp' | 'video';
  title: string;
  url: string;
  secondaryUrl?: string;
  chapterOrSeries?: number;
  channel?: string;
  createdAt?: string;
  authorEmail?: string;
}

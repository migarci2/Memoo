import type { Playbook, PlaybookFolder } from '@/lib/types';

export type FolderColorToken = {
  value: string;
  label: string;
  solid: string;
  soft: string;
  border: string;
  text: string;
  tone: string;
};

export const PLAYBOOK_FOLDER_COLORS: FolderColorToken[] = [
  {
    value: 'sage',
    label: 'Sage',
    solid: '#7b9b86',
    soft: 'rgba(123,155,134,0.16)',
    border: 'rgba(123,155,134,0.34)',
    text: '#335443',
    tone: 'from-[#f3f8f4] via-white to-[#eef6f1]',
  },
  {
    value: 'ocean',
    label: 'Ocean',
    solid: '#4e8ca7',
    soft: 'rgba(78,140,167,0.16)',
    border: 'rgba(78,140,167,0.34)',
    text: '#24566a',
    tone: 'from-[#f1f8fb] via-white to-[#edf5f8]',
  },
  {
    value: 'sand',
    label: 'Sand',
    solid: '#c29558',
    soft: 'rgba(194,149,88,0.16)',
    border: 'rgba(194,149,88,0.34)',
    text: '#7b5526',
    tone: 'from-[#fbf5ed] via-white to-[#f6efe5]',
  },
  {
    value: 'rose',
    label: 'Rose',
    solid: '#bf7b84',
    soft: 'rgba(191,123,132,0.16)',
    border: 'rgba(191,123,132,0.34)',
    text: '#7a3941',
    tone: 'from-[#fcf4f5] via-white to-[#f7edf0]',
  },
  {
    value: 'slate',
    label: 'Slate',
    solid: '#6c8191',
    soft: 'rgba(108,129,145,0.16)',
    border: 'rgba(108,129,145,0.34)',
    text: '#3c5566',
    tone: 'from-[#f2f6f8] via-white to-[#edf2f5]',
  },
];

const FALLBACK_FOLDER_COLOR = PLAYBOOK_FOLDER_COLORS[0];

export function getFolderColorToken(color?: string | null): FolderColorToken {
  if (!color) return FALLBACK_FOLDER_COLOR;
  return PLAYBOOK_FOLDER_COLORS.find(option => option.value === color) ?? FALLBACK_FOLDER_COLOR;
}

export function sortPlaybookFolders(folders: PlaybookFolder[], playbooks?: Playbook[]) {
  const counts = new Map<string, number>();
  for (const playbook of playbooks ?? []) {
    if (!playbook.folder_id) continue;
    counts.set(playbook.folder_id, (counts.get(playbook.folder_id) ?? 0) + 1);
  }

  return [...folders].sort((a, b) => {
    const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

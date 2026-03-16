'use client';

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowsClockwise,
  ArrowsIn,
  ArrowsOut,
  ArrowUp,
  Browser,
  CircleNotch,
  CornersOut,
  Cursor as CursorIcon,
  CursorClick,
  Diamond,
  Eye,
  FloppyDisk,
  Hand,
  Keyboard,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  PaperPlaneTilt,
  Pencil,
  Plus,
  Timer,
  Trash,
  TreeStructure,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { apiPost } from '@/lib/api';
import type { PlaybookStep, PlaybookStepCreate } from '@/lib/types';

/* ══ Constants ══════════════════════════════════════════════════════════════ */

const NODE_W = 244;
const NODE_H = 58;
const COND_H = 66;
const TERM_R = 18;
const GAP_Y = 52;
const GAP_X = 44;

/* ══ Step type metadata ═════════════════════════════════════════════════════ */

const STEP_TYPES = [
  'navigate', 'click', 'input', 'submit', 'verify', 'wait', 'condition', 'loop',
] as const;
type StepType = (typeof STEP_TYPES)[number];

const ACTION_TYPES: StepType[] = ['navigate', 'click', 'input', 'submit', 'verify', 'wait'];
const FLOW_TYPES: StepType[] = ['condition', 'loop'];

type IconProps = { size?: number; weight?: 'bold' | 'regular' | 'fill'; className?: string };
type StepMeta = {
  icon: React.FC<IconProps>;
  color: string;
  bg: string;
  hex: string;
  label: string;
};

const META: Record<StepType, StepMeta> = {
  navigate: { icon: Browser,        color: 'text-slate-600', bg: 'bg-slate-50',    hex: '#64748b', label: 'Navigate'  },
  click:    { icon: CursorClick,     color: 'text-emerald-600', bg: 'bg-emerald-50', hex: '#10b981', label: 'Click'     },
  input:    { icon: Keyboard,        color: 'text-amber-600', bg: 'bg-amber-50',    hex: '#f59e0b', label: 'Input'     },
  submit:   { icon: PaperPlaneTilt,  color: 'text-blue-600', bg: 'bg-blue-50',     hex: '#3b82f6', label: 'Submit'    },
  verify:   { icon: Eye,            color: 'text-violet-600', bg: 'bg-violet-50',   hex: '#8b5cf6', label: 'Verify'    },
  wait:     { icon: Timer,          color: 'text-slate-500', bg: 'bg-gray-50',     hex: '#6b7280', label: 'Wait'      },
  condition:{ icon: Diamond,        color: 'text-orange-600', bg: 'bg-orange-50',   hex: '#f97316', label: 'Condition' },
  loop:     { icon: ArrowsClockwise,color: 'text-cyan-600', bg: 'bg-cyan-50',     hex: '#06b6d4', label: 'Loop'      },
};

/* ══ Editable step model ════════════════════════════════════════════════════ */

type EditableStep = {
  _key: string;
  title: string;
  step_type: StepType;
  target_url: string;
  selector: string;
  variables: Record<string, string>;
  guardrails: Record<string, string>;
  condition_expr: string;
  then_branch: EditableStep[];
  else_branch: EditableStep[];
  loop_expr: string;
  loop_max: string;
  loop_body: EditableStep[];
};

function uid(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankStep(type: StepType = 'click'): EditableStep {
  return {
    _key: uid(), title: '', step_type: type, target_url: '', selector: '',
    variables: {}, guardrails: {},
    condition_expr: '', then_branch: [], else_branch: [],
    loop_expr: '', loop_max: '3', loop_body: [],
  };
}

function fromApi(step: PlaybookStep): EditableStep {
  const v = (step.variables ?? {}) as Record<string, unknown>;
  const g = (step.guardrails ?? {}) as Record<string, unknown>;
  const base = blankStep((step.step_type as StepType) || 'click');
  base._key = step.id || uid();
  base.title = step.title;
  base.step_type = (step.step_type as StepType) || 'click';
  base.target_url = step.target_url ?? '';
  base.selector = step.selector ?? '';
  for (const [k, val] of Object.entries(v)) {
    if (['__then', '__else', '__body', '__condition', '__loop', '__loop_max'].includes(k)) continue;
    base.variables[k] = String(val ?? '');
  }
  for (const [k, val] of Object.entries(g)) { base.guardrails[k] = String(val ?? ''); }
  if (step.step_type === 'condition') {
    base.condition_expr = String(v.__condition ?? '');
    base.then_branch = Array.isArray(v.__then) ? (v.__then as PlaybookStep[]).map(fromApi) : [];
    base.else_branch = Array.isArray(v.__else) ? (v.__else as PlaybookStep[]).map(fromApi) : [];
  }
  if (step.step_type === 'loop') {
    base.loop_expr = String(v.__loop ?? '');
    base.loop_max = String(v.__loop_max ?? '3');
    base.loop_body = Array.isArray(v.__body) ? (v.__body as PlaybookStep[]).map(fromApi) : [];
  }
  return base;
}

function toApi(step: EditableStep): PlaybookStepCreate {
  const vars: Record<string, unknown> = { ...step.variables };
  const guards: Record<string, unknown> = { ...step.guardrails };
  if (step.step_type === 'condition') {
    vars.__condition = step.condition_expr;
    vars.__then = step.then_branch.map(toApi);
    vars.__else = step.else_branch.map(toApi);
  }
  if (step.step_type === 'loop') {
    vars.__loop = step.loop_expr;
    vars.__loop_max = step.loop_max;
    vars.__body = step.loop_body.map(toApi);
  }
  return {
    title: step.title.trim(), step_type: step.step_type,
    target_url: step.target_url || undefined, selector: step.selector || undefined,
    variables: vars,
    guardrails: Object.keys(guards).length ? guards : {},
  };
}

/* ══ Auto-layout ════════════════════════════════════════════════════════════ */

type Pos = { x: number; y: number };
type Edge = { from: string; to: string; type: 'default' | 'yes' | 'no' };

function measureWidth(steps: EditableStep[]): number {
  let maxW = NODE_W;
  for (const s of steps) {
    if (s.step_type === 'condition') {
      const yesW = s.then_branch.length > 0 ? measureWidth(s.then_branch) : NODE_W;
      const noW = s.else_branch.length > 0 ? measureWidth(s.else_branch) : NODE_W;
      maxW = Math.max(maxW, yesW + GAP_X + noW);
    }
  }
  return maxW;
}

function layoutColumn(
  steps: EditableStep[], centerX: number, startY: number,
  pos: Record<string, Pos>, edges: Edge[],
): { bottomY: number; lastKeys: string[] } {
  let y = startY;
  let prevKeys: string[] = [];
  let lastBottom = startY;

  for (const step of steps) {
    const h = step.step_type === 'condition' ? COND_H : NODE_H;
    for (const pk of prevKeys) edges.push({ from: pk, to: step._key, type: 'default' });
    pos[step._key] = { x: centerX - NODE_W / 2, y };
    lastBottom = y + h;

    if (step.step_type === 'condition') {
      const branchY = lastBottom + GAP_Y * 0.6;
      const yesW = step.then_branch.length > 0 ? measureWidth(step.then_branch) : NODE_W;
      const noW = step.else_branch.length > 0 ? measureWidth(step.else_branch) : NODE_W;
      const totalW = yesW + GAP_X + noW;
      const yesCX = centerX - totalW / 2 + yesW / 2;
      const noCX = centerX + totalW / 2 - noW / 2;

      let yesRes = { bottomY: branchY, lastKeys: [] as string[] };
      let noRes  = { bottomY: branchY, lastKeys: [] as string[] };

      if (step.then_branch.length > 0) {
        edges.push({ from: step._key, to: step.then_branch[0]._key, type: 'yes' });
        yesRes = layoutColumn(step.then_branch, yesCX, branchY, pos, edges);
      }
      if (step.else_branch.length > 0) {
        edges.push({ from: step._key, to: step.else_branch[0]._key, type: 'no' });
        noRes = layoutColumn(step.else_branch, noCX, branchY, pos, edges);
      }
      const yesLast = step.then_branch.length > 0 ? yesRes.lastKeys : [step._key];
      const noLast  = step.else_branch.length > 0 ? noRes.lastKeys  : [step._key];
      prevKeys = [...new Set([...yesLast, ...noLast])];
      lastBottom = Math.max(yesRes.bottomY, noRes.bottomY);
      y = lastBottom + GAP_Y;

    } else if (step.step_type === 'loop') {
      if (step.loop_body.length > 0) {
        const bodyY = lastBottom + GAP_Y * 0.5;
        edges.push({ from: step._key, to: step.loop_body[0]._key, type: 'default' });
        const bodyRes = layoutColumn(step.loop_body, centerX, bodyY, pos, edges);
        for (const lk of bodyRes.lastKeys) edges.push({ from: lk, to: step._key, type: 'default' });
        lastBottom = bodyRes.bottomY;
      }
      y = lastBottom + GAP_Y;
      prevKeys = [step._key];
    } else {
      y = lastBottom + GAP_Y;
      prevKeys = [step._key];
    }
  }
  return { bottomY: lastBottom, lastKeys: prevKeys };
}

function computeLayout(steps: EditableStep[]) {
  const pos: Record<string, Pos> = {};
  const edges: Edge[] = [];
  const centerX = 0;
  pos.__start__ = { x: centerX - TERM_R, y: 0 };
  const topY = TERM_R * 2 + GAP_Y;
  const res = layoutColumn(steps, centerX, topY, pos, edges);
  if (steps.length > 0) edges.push({ from: '__start__', to: steps[0]._key, type: 'default' });
  const endY = res.bottomY + GAP_Y;
  pos.__end__ = { x: centerX - TERM_R, y: endY };
  for (const k of res.lastKeys) edges.push({ from: k, to: '__end__', type: 'default' });
  if (steps.length === 0) edges.push({ from: '__start__', to: '__end__', type: 'default' });
  return { positions: pos, edges };
}

function flattenTree(steps: EditableStep[]): EditableStep[] {
  const out: EditableStep[] = [];
  for (const s of steps) {
    out.push(s);
    if (s.step_type === 'condition') { out.push(...flattenTree(s.then_branch), ...flattenTree(s.else_branch)); }
    if (s.step_type === 'loop') { out.push(...flattenTree(s.loop_body)); }
  }
  return out;
}

/* ══ Tree mutation helpers ══════════════════════════════════════════════════ */

function findAndReplace(list: EditableStep[], key: string, fn: (s: EditableStep) => EditableStep | null): EditableStep[] {
  return list.flatMap(s => {
    if (s._key === key) { const r = fn(s); return r ? [r] : []; }
    return [{ ...s,
      then_branch: findAndReplace(s.then_branch, key, fn),
      else_branch: findAndReplace(s.else_branch, key, fn),
      loop_body:   findAndReplace(s.loop_body, key, fn),
    }];
  });
}

function insertAfterKey(list: EditableStep[], key: string, item: EditableStep): EditableStep[] {
  const result: EditableStep[] = [];
  for (const s of list) {
    if (s._key === key) { result.push(s, item); }
    else { result.push({ ...s, then_branch: insertAfterKey(s.then_branch, key, item), else_branch: insertAfterKey(s.else_branch, key, item), loop_body: insertAfterKey(s.loop_body, key, item) }); }
  }
  return result;
}

function moveInList(list: EditableStep[], key: string, dir: -1 | 1): EditableStep[] {
  const idx = list.findIndex(s => s._key === key);
  if (idx >= 0) {
    const t = idx + dir;
    if (t < 0 || t >= list.length) return list;
    const next = [...list]; [next[idx], next[t]] = [next[t], next[idx]]; return next;
  }
  return list.map(s => ({ ...s, then_branch: moveInList(s.then_branch, key, dir), else_branch: moveInList(s.else_branch, key, dir), loop_body: moveInList(s.loop_body, key, dir) }));
}

/* ══ Main component ═════════════════════════════════════════════════════════ */

type StepFlowEditorProps = {
  playbookId: string;
  teamId: string;
  initialSteps: PlaybookStep[];
  versionNumber: number;
};

const STORAGE_KEY_PREFIX = 'memoo-canvas-pos-';

function loadDragPos(playbookId: string): Record<string, Pos> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${playbookId}`);
    return raw ? (JSON.parse(raw) as Record<string, Pos>) : {};
  } catch { return {}; }
}

function saveDragPos(playbookId: string, pos: Record<string, Pos>) {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(pos).length === 0) localStorage.removeItem(`${STORAGE_KEY_PREFIX}${playbookId}`);
    else localStorage.setItem(`${STORAGE_KEY_PREFIX}${playbookId}`, JSON.stringify(pos));
  } catch { }
}

export function StepFlowEditor({ playbookId, teamId, initialSteps, versionNumber }: StepFlowEditorProps) {
  const [steps, setSteps] = useState<EditableStep[]>(initialSteps.map(fromApi));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'cursor' | 'hand'>('cursor');
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // History state
  const MAX_HISTORY = 50;
  const historyRef = useRef<EditableStep[][]>([]);
  const futureRef  = useRef<EditableStep[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function pushHistory(prev: EditableStep[]) {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), prev];
    futureRef.current = [];
    setCanUndo(true); setCanRedo(false);
  }
  const undo = () => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, steps];
    setSteps(prev); setCanUndo(historyRef.current.length > 0); setCanRedo(true); setDirty(true);
  };
  const redo = () => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, steps];
    setSteps(next); setCanUndo(true); setCanRedo(futureRef.current.length > 0); setDirty(true);
  };
  const mutateSteps = (fn: (prev: EditableStep[]) => EditableStep[]) => {
    setSteps(prev => { pushHistory(prev); return fn(prev); });
  };

  const markDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape' && fullscreen) setFullscreen(false);
        return;
      }
      if (editing && (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (editing && (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (editing && (e.key === 'Delete' || e.key === 'Backspace') && selectedKey) { e.preventDefault(); removeStep(selectedKey); return; }
      if (e.key === 'v' || e.key === 'V') { if (!e.ctrlKey && !e.metaKey) setCanvasMode('cursor'); return; }
      if (e.key === 'h' || e.key === 'H') { setCanvasMode('hand'); return; }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fitToView(); return; }
      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) { if (!editing) setEditing(true); return; }
      if (e.key === 'Escape') {
        if (selectedKey) setSelectedKey(null);
        else if (editing) setEditing(false);
        else if (fullscreen) setFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen, selectedKey, steps, editing]);

  useEffect(() => {
    document.body.style.overflow = fullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  useEffect(() => { const t = setTimeout(fitToView, 60); return () => clearTimeout(t); }, [fullscreen]);

  const allNodes = useMemo(() => flattenTree(steps), [steps]);
  const { positions, edges } = useMemo(() => computeLayout(steps), [steps]);
  const selectedNode = useMemo(() => allNodes.find(n => n._key === selectedKey) ?? null, [allNodes, selectedKey]);

  useEffect(() => { fitToView(); }, []);

  function fitToView() {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vals = Object.values(positions);
    if (vals.length === 0) return;
    const minX = Math.min(...vals.map(p => p.x)) - 40;
    const minY = Math.min(...vals.map(p => p.y)) - 40;
    const maxX = Math.max(...vals.map(p => p.x + NODE_W)) + 40;
    const maxY = Math.max(...vals.map(p => p.y + NODE_H)) + 40;
    const cw = maxX - minX; const ch = maxY - minY;
    const z = Math.min(rect.width / cw, rect.height / ch, 1.4);
    setCamera({ zoom: z, x: rect.width / 2 - ((minX + maxX) / 2) * z, y: rect.height / 2 - ((minY + maxY) / 2) * z });
  }

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const nz = Math.min(Math.max(cam.zoom * factor, 0.18), 2.5);
      const ratio = nz / cam.zoom;
      setCamera({ zoom: nz, x: mx - (mx - cam.x) * ratio, y: my - (my - cam.y) * ratio });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const panRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).dataset.canvas !== 'bg') return;
    panRef.current = { sx: e.clientX, sy: e.clientY, cx: camera.x, cy: camera.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedKey(null);
  };
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    setCamera(c => ({ ...c, x: p.cx + (e.clientX - p.sx), y: p.cy + (e.clientY - p.sy) }));
  };
  const onCanvasPointerUp = () => { panRef.current = null; };

  const dragRef = useRef<{ key: string; ox: number; oy: number } | null>(null);
  const [dragPos, setDragPos] = useState<Record<string, Pos>>(() => loadDragPos(playbookId));
  const onNodePointerDown = (e: React.PointerEvent, key: string) => {
    e.stopPropagation();
    if (!editing) return;
    const el = canvasRef.current!;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left - camera.x) / camera.zoom;
    const cy = (e.clientY - rect.top  - camera.y) / camera.zoom;
    const np = (dragPos[key] ?? positions[key])!;
    dragRef.current = { key, ox: cx - np.x, oy: cy - np.y };
    setSelectedKey(key);
  };
  const onNodePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const el = canvasRef.current!;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left - camera.x) / camera.zoom;
    const cy = (e.clientY - rect.top  - camera.y) / camera.zoom;
    const d = dragRef.current;
    setDragPos(prev => {
      const next = { ...prev, [d.key]: { x: cx - d.ox, y: cy - d.oy } };
      saveDragPos(playbookId, next);
      return next;
    });
  };
  const onNodePointerUp = () => { dragRef.current = null; };
  const resetLayout = () => { setDragPos({}); saveDragPos(playbookId, {}); setTimeout(fitToView, 30); };
  const effectivePos = useMemo(() => ({ ...positions, ...dragPos }), [positions, dragPos]);

  const updateStep = (key: string, patch: Partial<EditableStep>) => { mutateSteps(prev => findAndReplace(prev, key, s => ({ ...s, ...patch }))); markDirty(); };
  const removeStep = (key: string) => { mutateSteps(prev => findAndReplace(prev, key, () => null)); if (selectedKey === key) setSelectedKey(null); markDirty(); };
  const addAfter = (key: string, type: StepType = 'click') => { const ns = blankStep(type); mutateSteps(prev => insertAfterKey(prev, key, ns)); setSelectedKey(ns._key); markDirty(); };
  const addAtEnd = (type: StepType = 'click') => { const ns = blankStep(type); mutateSteps(prev => [...prev, ns]); setSelectedKey(ns._key); markDirty(); };
  const moveStep = (key: string, dir: -1 | 1) => { mutateSteps(prev => moveInList(prev, key, dir)); markDirty(); };
  const addToBranch = (parentKey: string, branch: 'then' | 'else' | 'body') => {
    const ns = blankStep('click');
    mutateSteps(prev => findAndReplace(prev, parentKey, s => {
      if (branch === 'then') return { ...s, then_branch: [...s.then_branch, ns] };
      if (branch === 'else') return { ...s, else_branch: [...s.else_branch, ns] };
      return { ...s, loop_body: [...s.loop_body, ns] };
    }));
    setSelectedKey(ns._key); markDirty();
  };
  const addNewNode = (type: StepType) => {
    if (selectedKey) {
      const sel = allNodes.find(n => n._key === selectedKey);
      if (sel?.step_type === 'condition') addToBranch(selectedKey, 'then');
      else if (sel?.step_type === 'loop') addToBranch(selectedKey, 'body');
      else addAfter(selectedKey, type);
    } else addAtEnd(type);
  };

  const saveNewVersion = async () => {
    const bad = steps.find(s => !s.title.trim());
    if (bad) { setSelectedKey(bad._key); toast('Every step needs a title.', 'error'); return; }
    setSaving(true);
    try {
      await apiPost(`/playbooks/${playbookId}/versions`, { change_note: 'Edited in flow editor', steps: steps.map(toApi) });
      setDirty(false); toast('New version saved!', 'success'); router.refresh();
    } catch (err) { toast(err instanceof Error ? err.message : 'Save failed.', 'error'); }
    finally { setSaving(false); }
  };

  const wrapperCls = fullscreen ? 'fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]' : 'mt-5';

  return (
    <section className={wrapperCls}>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${fullscreen ? 'px-5 py-3 border-b border-[var(--app-line-soft)] bg-[var(--app-surface)]' : 'mb-3'}`}>
        <div>
          <p className="landing-kicker">{editing ? 'Flow editor' : 'Flow'}</p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight">v{versionNumber} · {countAll(steps)} step{countAll(steps) !== 1 ? 's' : ''}</h2>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              {dirty && <span className="text-xs font-bold text-[var(--app-brand-sand)]">Unsaved</span>}
              <button onClick={() => { setEditing(false); setSelectedKey(null); }} className="rounded-lg border border-[var(--app-line-soft)] px-4 py-1.5 text-sm font-semibold hover:bg-[rgba(27,42,74,0.03)]">Done</button>
              <button onClick={saveNewVersion} disabled={saving || !dirty} className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm disabled:opacity-40">
                {saving ? <span className="inline-flex animate-spin"><CircleNotch size={14} /></span> : <FloppyDisk size={14} weight="bold" />}
                {saving ? 'Saving…' : 'Save version'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm">
              <Pencil size={14} weight="bold" /> Edit flow
            </button>
          )}
          <button onClick={() => setFullscreen(f => !f)} className="p-2 rounded-lg hover:bg-[rgba(27,42,74,0.05)] transition-colors" title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
            {fullscreen ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}
          </button>
        </div>
      </div>

      <div className={`flex overflow-hidden bg-[var(--app-surface)] ${fullscreen ? 'flex-1' : 'rounded-2xl border border-[var(--app-line-soft)] shadow-sm'}`} style={fullscreen ? undefined : { height: 'clamp(460px, 68vh, 820px)' }}>
        <div ref={canvasRef} className="canvas-grid relative flex-1 overflow-hidden" 
             style={{ cursor: panRef.current ? 'grabbing' : canvasMode === 'hand' ? 'grab' : 'default', backgroundSize: `${20 * camera.zoom}px ${20 * camera.zoom}px`, backgroundPosition: `${camera.x}px ${camera.y}px` }}
             onPointerDown={onCanvasPointerDown} onPointerMove={e => { onCanvasPointerMove(e); onNodePointerMove(e); }} onPointerUp={() => { onCanvasPointerUp(); onNodePointerUp(); }}>
          
          <div data-canvas="bg" className="absolute inset-0 z-0" />
          <div className="pointer-events-none absolute origin-[0_0]" style={{ transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})` }}>
            <svg className="absolute" style={{ overflow: 'visible', width: 1, height: 1 }}>
              <defs>
                <marker id="ah-default" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 7 2.5, 0 5" fill="var(--app-line-strong)" /></marker>
                <marker id="ah-yes" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 7 2.5, 0 5" fill="#4a8c61" /></marker>
                <marker id="ah-no" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 7 2.5, 0 5" fill="#c04040" /></marker>
              </defs>
              {edges.map((edge, i) => <EdgeLine key={`${edge.from}-${edge.to}-${i}`} edge={edge} positions={effectivePos} />)}
            </svg>
            <div className="absolute pointer-events-auto" style={{ left: effectivePos.__start__?.x, top: effectivePos.__start__?.y }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--app-sage)] bg-[rgba(123,155,134,0.1)]"><div className="h-2 w-2 rounded-full bg-[var(--app-sage)]" /></div>
            </div>
            {allNodes.map(node => (
              <div key={node._key} className="absolute pointer-events-auto" style={{ left: effectivePos[node._key]?.x ?? 0, top: effectivePos[node._key]?.y ?? 0, width: NODE_W, cursor: editing ? 'pointer' : 'default' }} onPointerDown={e => onNodePointerDown(e, node._key)}>
                <NodeCard node={node} selected={editing && selectedKey === node._key} meta={META[node.step_type] ?? META.click} />
              </div>
            ))}
            <div className="absolute pointer-events-auto" style={{ left: effectivePos.__end__?.x, top: effectivePos.__end__?.y }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--app-brand-sand)] bg-[rgba(191,155,106,0.1)]"><div className="h-2 w-2 rounded-sm bg-[var(--app-brand-sand)]" /></div>
            </div>
          </div>

          {editing && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-[var(--app-line-soft)] bg-white/90 p-1 shadow-sm backdrop-blur-md">
              <button onClick={() => setCanvasMode('cursor')} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${canvasMode === 'cursor' ? 'bg-[var(--app-blue)] text-white shadow-sm' : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.05)]'}`} title="Select mode (V)"><CursorIcon size={15} weight={canvasMode === 'cursor' ? 'fill' : 'bold'} /></button>
              <button onClick={() => setCanvasMode('hand')} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${canvasMode === 'hand' ? 'bg-[var(--app-blue)] text-white shadow-sm' : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.05)]'}`} title="Hand mode (H)"><Hand size={15} weight={canvasMode === 'hand' ? 'fill' : 'bold'} /></button>
              <div className="mx-1 h-5 w-px bg-[var(--app-line-soft)]" />
              {ACTION_TYPES.map(t => (
                <button key={t} onClick={() => addNewNode(t)} title={META[t].label} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,42,74,0.05)] ${META[t].color}`}><span className="inline-flex">{((M) => <M.icon size={16} />)(META[t])}</span></button>
              ))}
              <div className="mx-1 h-5 w-px bg-[var(--app-line-soft)]" />
              {FLOW_TYPES.map(t => (
                <button key={t} onClick={() => addNewNode(t)} title={META[t].label} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,42,74,0.05)] ${META[t].color}`}><span className="inline-flex">{((M) => <M.icon size={16} />)(META[t])}</span></button>
              ))}
              <div className="mx-1 h-5 w-px bg-[var(--app-line-soft)]" />
              <button onClick={undo} disabled={!canUndo} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${canUndo ? 'text-[var(--app-text)] hover:bg-[rgba(27,42,74,0.05)]' : 'text-[var(--app-muted)] opacity-30'}`} title="Undo (Z)"><ArrowCounterClockwise size={15} weight="bold" /></button>
              <button onClick={redo} disabled={!canRedo} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${canRedo ? 'text-[var(--app-text)] hover:bg-[rgba(27,42,74,0.05)]' : 'text-[var(--app-muted)] opacity-30'}`} title="Redo (Y)"><ArrowClockwise size={15} weight="bold" /></button>
            </div>
          )}

          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-xl border border-[var(--app-line-soft)] bg-white/90 p-1 shadow-sm backdrop-blur-md">
            <button onClick={() => setCamera(c => ({ ...c, zoom: Math.max(c.zoom * 0.8, 0.18) }))} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.05)] transition-colors"><MagnifyingGlassMinus size={14} weight="bold" /></button>
            <span className="w-10 text-center text-[10px] font-bold tabular-nums text-[var(--app-muted)]">{Math.round(camera.zoom * 100)}%</span>
            <button onClick={() => setCamera(c => ({ ...c, zoom: Math.min(c.zoom * 1.2, 2.5) }))} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.05)] transition-colors"><MagnifyingGlassPlus size={14} weight="bold" /></button>
            <div className="mx-0.5 h-4 w-px bg-[var(--app-line-soft)]" />
            <button onClick={fitToView} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.05)] transition-colors"><CornersOut size={14} weight="bold" /></button>
          </div>
          <Minimap positions={effectivePos} camera={camera} canvasRef={canvasRef} allNodes={allNodes} />
        </div>

        <AnimatePresence>
          {editing && selectedNode && (
            <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 36 }} className="shrink-0 overflow-y-auto overflow-x-hidden border-l border-[var(--app-line-soft)] bg-[var(--app-surface)]">
              <EditSidebar node={selectedNode} updateStep={updateStep} removeStep={removeStep} moveStep={moveStep} addToBranch={addToBranch} close={() => setSelectedKey(null)} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function NodeCard({ node, selected, meta }: { node: EditableStep; selected: boolean; meta: StepMeta }) {
  const isCond = node.step_type === 'condition';
  const isLoop = node.step_type === 'loop';
  return (
    <div className={`group relative rounded-xl border bg-white shadow-sm transition-all duration-150 ${selected ? 'border-[var(--app-blue)] ring-2 ring-[var(--app-blue)]/20 shadow-md' : 'border-[var(--app-line-soft)] hover:shadow-md hover:border-[var(--app-line-strong)]'}`}>
      <div className="absolute left-0 top-3 bottom-3 w-[2.5px] rounded-full" style={{ backgroundColor: meta.hex }} />
      <div className="flex items-center gap-2.5 py-2.5 pl-4 pr-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}><meta.icon size={16} weight="regular" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-snug text-[var(--app-text)]">{node.title || <span className="italic opacity-30">Untitled</span>}</p>
          <p className={`text-[10px] font-bold uppercase tracking-wider leading-none mt-0.5 ${meta.color}`}>{meta.label}</p>
        </div>
      </div>
      <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border-2 border-[var(--app-line-strong)] bg-white" />
      <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border-2 border-[var(--app-line-strong)] bg-white" />
    </div>
  );
}

function EdgeLine({ edge, positions }: { edge: Edge; positions: Record<string, Pos> }) {
  const from = positions[edge.from]; const to = positions[edge.to];
  if (!from || !to) return null;
  const x1 = from.x + (edge.from.startsWith('__') ? TERM_R : NODE_W / 2);
  const y1 = from.y + (edge.from.startsWith('__') ? TERM_R * 2 : NODE_H);
  const x2 = to.x + (edge.to.startsWith('__') ? TERM_R : NODE_W / 2);
  const y2 = to.y;
  const dy = Math.abs(y2 - y1);
  const cp = Math.min(dy * 0.45, 70);
  const d = `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
  const color = edge.type === 'yes' ? '#4a8c61' : edge.type === 'no' ? '#c04040' : 'var(--app-line-strong)';
  return <path d={d} fill="none" stroke={color} strokeWidth={2} markerEnd="url(#ah-default)" />;
}

type EditSidebarProps = {
  node: EditableStep;
  updateStep: (k: string, p: Partial<EditableStep>) => void;
  removeStep: (k: string) => void;
  moveStep: (k: string, dir: -1 | 1) => void;
  addToBranch: (pk: string, b: 'then' | 'else' | 'body') => void;
  close: () => void;
};

function EditSidebar({ node, updateStep, removeStep, moveStep, addToBranch, close }: EditSidebarProps) {
  const meta = META[node.step_type as StepType] ?? META.click;
  const isCond = node.step_type === 'condition';
  const isLoop = node.step_type === 'loop';
  const isAction = !isCond && !isLoop;

  return (
    <div className="flex h-full w-80 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--app-line-soft)] px-4 py-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}><meta.icon size={14} /></div>
        <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
        <div className="flex-1" />
        <button onClick={close} className="p-1 rounded-lg hover:bg-[rgba(27,42,74,0.05)] transition-colors"><X size={14} weight="bold" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <SideField label="Title">
          <input className="input text-sm" value={node.title} onChange={e => updateStep(node._key, { title: e.target.value })} autoFocus />
        </SideField>
        {isAction && (
          <SideField label="Type">
            <div className="flex flex-wrap gap-1.5">
              {ACTION_TYPES.map(t => (
                <button key={t} onClick={() => updateStep(node._key, { step_type: t })} className={`rounded-lg px-2 py-1 text-[10px] font-bold border transition-all ${node.step_type === t ? `${META[t].bg} ${META[t].color} border-current` : 'border-[var(--app-line-soft)] text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.03)]'}`}>{META[t].label}</button>
              ))}
            </div>
          </SideField>
        )}
        {isCond && (
          <SideField label="Branches">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addToBranch(node._key, 'then')} className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-2 text-[10px] font-bold text-emerald-700">Add Yes ({node.then_branch.length})</button>
              <button onClick={() => addToBranch(node._key, 'else')} className="rounded-lg border border-dashed border-red-100 bg-red-50 p-2 text-[10px] font-bold text-red-600">Add No ({node.else_branch.length})</button>
            </div>
          </SideField>
        )}
        {isLoop && (
          <div className="space-y-4">
            <SideField label="Iterations"><input type="number" className="input" value={node.loop_max} onChange={e => updateStep(node._key, { loop_max: e.target.value })} /></SideField>
            <button onClick={() => addToBranch(node._key, 'body')} className="w-full rounded-lg border border-dashed border-cyan-200 bg-cyan-50 p-2 text-[10px] font-bold text-cyan-700">Add to body ({node.loop_body.length})</button>
          </div>
        )}
        {isAction && ['click', 'input', 'verify'].includes(node.step_type) && (
          <SideField label="CSS Selector"><input className="input font-mono text-xs" value={node.selector} onChange={e => updateStep(node._key, { selector: e.target.value })} /></SideField>
        )}
        {node.step_type === 'input' && (
          <SideField label="Value"><input className="input font-mono text-xs" value={node.variables.value || ''} onChange={e => updateStep(node._key, { variables: { ...node.variables, value: e.target.value } })} /></SideField>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--app-line-soft)] px-4 py-3">
        <button onClick={() => moveStep(node._key, -1)} className="p-2 rounded-lg hover:bg-[rgba(27,42,74,0.05)] transition-colors"><ArrowUp size={14} /></button>
        <button onClick={() => moveStep(node._key, 1)} className="p-2 rounded-lg hover:bg-[rgba(27,42,74,0.05)] transition-colors"><ArrowDown size={14} /></button>
        <div className="flex-1" />
        <button onClick={() => removeStep(node._key)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash size={14} /></button>
      </div>
    </div>
  );
}

function SideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">{label}</label>
      {children}
    </div>
  );
}

function Minimap({ positions, camera, canvasRef, allNodes }: { positions: Record<string, Pos>; camera: { x: number; y: number; zoom: number }; canvasRef: React.RefObject<HTMLDivElement | null>; allNodes: EditableStep[] }) {
  const MW = 140; const MH = 96;
  const vals = Object.values(positions); if (vals.length === 0) return null;
  const minX = Math.min(...vals.map(p => p.x)) - 40; const minY = Math.min(...vals.map(p => p.y)) - 40;
  const maxX = Math.max(...vals.map(p => p.x + NODE_W)) + 40; const maxY = Math.max(...vals.map(p => p.y + NODE_H)) + 40;
  const scale = Math.min(MW / (maxX - minX), MH / (maxY - minY));
  return (
    <div className="absolute bottom-3 left-3 z-10 overflow-hidden rounded-xl border border-[var(--app-line-soft)] bg-white/90 p-1 shadow-sm backdrop-blur-md" style={{ width: MW, height: MH }}>
      <div className="relative h-full w-full">
        {allNodes.map(n => {
          const p = positions[n._key]; if (!p) return null;
          return <div key={n._key} className="absolute rounded-sm opacity-40" style={{ left: (p.x - minX) * scale, top: (p.y - minY) * scale, width: NODE_W * scale, height: NODE_H * scale, backgroundColor: META[n.step_type]?.hex || '#000' }} />;
        })}
      </div>
    </div>
  );
}

function countAll(steps: EditableStep[]): number {
  return steps.reduce((n, s) => n + 1 + countAll(s.then_branch) + countAll(s.else_branch) + countAll(s.loop_body), 0);
}

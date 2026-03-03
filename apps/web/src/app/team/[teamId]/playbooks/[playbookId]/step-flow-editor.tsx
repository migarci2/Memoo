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

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const NODE_W = 244;
const NODE_H = 58;
const COND_H = 66;
const TERM_R = 18;
const GAP_Y = 52;
const GAP_X = 44;

/* ═══════════════════════════════════════════════════════════════════════════
   Step type metadata
   ═══════════════════════════════════════════════════════════════════════════ */

const STEP_TYPES = [
  'navigate', 'click', 'input', 'submit', 'verify', 'wait', 'condition', 'loop',
] as const;
type StepType = (typeof STEP_TYPES)[number];

const ACTION_TYPES: StepType[] = ['navigate', 'click', 'input', 'submit', 'verify', 'wait'];
const FLOW_TYPES: StepType[] = ['condition', 'loop'];

type IconProps = { size?: number; weight?: 'bold' | 'duotone' | 'fill'; className?: string };
type StepMeta = {
  icon: React.FC<IconProps>;
  color: string;
  bg: string;
  hex: string;
  label: string;
};

const META: Record<StepType, StepMeta> = {
  navigate: { icon: Browser,        color: 'text-[#5f7784]', bg: 'bg-[rgba(95,119,132,0.10)]',  hex: '#5f7784', label: 'Navigate'  },
  click:    { icon: CursorClick,     color: 'text-[#4a8c61]', bg: 'bg-[rgba(74,140,97,0.08)]',   hex: '#4a8c61', label: 'Click'     },
  input:    { icon: Keyboard,        color: 'text-[#bf9b6a]', bg: 'bg-[rgba(191,155,106,0.10)]',  hex: '#bf9b6a', label: 'Input'     },
  submit:   { icon: PaperPlaneTilt,  color: 'text-[#5f7784]', bg: 'bg-[rgba(95,119,132,0.08)]',   hex: '#5f7784', label: 'Submit'    },
  verify:   { icon: Eye,            color: 'text-[#7b5ea7]', bg: 'bg-[rgba(123,94,167,0.08)]',   hex: '#7b5ea7', label: 'Verify'    },
  wait:     { icon: Timer,          color: 'text-[#8b7355]', bg: 'bg-[rgba(139,115,85,0.08)]',    hex: '#8b7355', label: 'Wait'      },
  condition:{ icon: Diamond,        color: 'text-[#c06030]', bg: 'bg-[rgba(192,96,48,0.07)]',     hex: '#c06030', label: 'Condition' },
  loop:     { icon: ArrowsClockwise,color: 'text-[#2e7d8c]', bg: 'bg-[rgba(46,125,140,0.07)]',    hex: '#2e7d8c', label: 'Loop'      },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Editable step model (recursive for branches / loop body)
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ── Serialization ─────────────────────────────────────────────────────── */

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

/* ═══════════════════════════════════════════════════════════════════════════
   Auto-layout
   ═══════════════════════════════════════════════════════════════════════════ */

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

      // When a branch is empty, the conditional itself is the endpoint
      // for that path — ensure it connects to the next step / end.
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
        // Loop-back edge from body end to loop header
        for (const lk of bodyRes.lastKeys) {
          edges.push({ from: lk, to: step._key, type: 'default' });
        }
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

/* ── Flatten tree ─────────────────────────────────────────────────────── */

function flattenTree(steps: EditableStep[]): EditableStep[] {
  const out: EditableStep[] = [];
  for (const s of steps) {
    out.push(s);
    if (s.step_type === 'condition') { out.push(...flattenTree(s.then_branch), ...flattenTree(s.else_branch)); }
    if (s.step_type === 'loop') { out.push(...flattenTree(s.loop_body)); }
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tree mutation helpers
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════════════════ */

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
    if (Object.keys(pos).length === 0) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${playbookId}`);
    } else {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${playbookId}`, JSON.stringify(pos));
    }
  } catch { /* quota exceeded – ignore */ }
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

  // ── Undo / Redo history ────────────────────────────────────────────────
  const MAX_HISTORY = 50;
  const historyRef = useRef<EditableStep[][]>([]);
  const futureRef  = useRef<EditableStep[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function pushHistory(prev: EditableStep[]) {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), prev];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, steps];
    setSteps(prev);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    setDirty(true);
  }

  function redo() {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, steps];
    setSteps(next);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
    setDirty(true);
  }

  /** Wrap setSteps to record undo history */
  function mutateSteps(fn: (prev: EditableStep[]) => EditableStep[]) {
    setSteps(prev => {
      pushHistory(prev);
      return fn(prev);
    });
  }

  void teamId;
  const markDirty = useCallback(() => setDirty(true), []);

  // ── Escape exits fullscreen / keyboard shortcuts ────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape' && fullscreen) setFullscreen(false);
        return;
      }

      // Undo / Redo (edit mode only)
      if (editing && (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (editing && (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (editing && (e.ctrlKey || e.metaKey) && e.key === 'Z') { e.preventDefault(); redo(); return; }

      // Delete selected node (edit mode only)
      if (editing && (e.key === 'Delete' || e.key === 'Backspace') && selectedKey) { e.preventDefault(); removeStep(selectedKey); return; }

      // Canvas mode
      if (e.key === 'v' || e.key === 'V') { if (!e.ctrlKey && !e.metaKey) { setCanvasMode('cursor'); return; } }
      if (e.key === 'h' || e.key === 'H') { setCanvasMode('hand'); return; }

      // Fit to view
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fitToView(); return; }

      // Enter edit mode with E
      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) {
        if (!editing) setEditing(true);
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        if (selectedKey) { setSelectedKey(null); return; }
        if (editing) { setEditing(false); return; }
        if (fullscreen) setFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, selectedKey, steps, editing]);

  // ── Lock body scroll in fullscreen ─────────────────────────────────────
  useEffect(() => {
    if (fullscreen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  // Re-fit when toggling fullscreen
  useEffect(() => {
    const t = setTimeout(fitToView, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // ── Auto-layout ────────────────────────────────────────────────────────
  const allNodes = useMemo(() => flattenTree(steps), [steps]);
  const { positions, edges } = useMemo(() => computeLayout(steps), [steps]);

  const selectedNode = useMemo(
    () => allNodes.find(n => n._key === selectedKey) ?? null,
    [allNodes, selectedKey],
  );

  // ── Initial center ─────────────────────────────────────────────────────
  useEffect(() => {
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setCamera({
      zoom: z,
      x: rect.width / 2 - ((minX + maxX) / 2) * z,
      y: rect.height / 2 - ((minY + maxY) / 2) * z,
    });
  }

  // ── Zoom via wheel ─────────────────────────────────────────────────────
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

  // ── Pan via drag ───────────────────────────────────────────────────────
  const panRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    // only pan if clicking empty canvas (the backdrop div)
    if ((e.target as HTMLElement).dataset.canvas !== 'bg') return;
    // In hand mode or middle-button: always pan. In cursor mode: also pan (canvas bg click).
    panRef.current = { sx: e.clientX, sy: e.clientY, cx: camera.x, cy: camera.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedKey(null);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    const p = panRef.current;
    if (!p) return;
    setCamera(c => ({
      ...c,
      x: p.cx + (e.clientX - p.sx),
      y: p.cy + (e.clientY - p.sy),
    }));
  }

  function onCanvasPointerUp() { panRef.current = null; }

  // ── Node drag ──────────────────────────────────────────────────────────
  const dragRef = useRef<{ key: string; ox: number; oy: number } | null>(null);
  const [dragPos, setDragPos] = useState<Record<string, Pos>>(() => loadDragPos(playbookId));

  function onNodePointerDown(e: React.PointerEvent, key: string) {
    e.stopPropagation();
    if (!editing) return; // view mode: no drag or select
    const el = canvasRef.current!;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left - camera.x) / camera.zoom;
    const cy = (e.clientY - rect.top  - camera.y) / camera.zoom;
    const np = (dragPos[key] ?? positions[key])!;
    dragRef.current = { key, ox: cx - np.x, oy: cy - np.y };
    setSelectedKey(key);
  }

  function onNodePointerMove(e: React.PointerEvent) {
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
  }

  function onNodePointerUp() { dragRef.current = null; }

  // Reset layout button
  function resetLayout() {
    setDragPos({});
    saveDragPos(playbookId, {});
    setTimeout(fitToView, 30);
  }

  // Effective positions = auto-layout merged with any drag overrides
  const effectivePos = useMemo(() => ({ ...positions, ...dragPos }), [positions, dragPos]);

  // ── Tree mutations ─────────────────────────────────────────────────────
  function updateStep(key: string, patch: Partial<EditableStep>) {
    mutateSteps(prev => findAndReplace(prev, key, s => ({ ...s, ...patch })));
    markDirty();
  }
  function removeStep(key: string) {
    mutateSteps(prev => findAndReplace(prev, key, () => null));
    if (selectedKey === key) setSelectedKey(null);
    markDirty();
  }
  function addAfter(key: string, type: StepType = 'click') {
    const ns = blankStep(type);
    mutateSteps(prev => insertAfterKey(prev, key, ns));
    setSelectedKey(ns._key);
    markDirty();
  }
  function addAtEnd(type: StepType = 'click') {
    const ns = blankStep(type);
    mutateSteps(prev => [...prev, ns]);
    setSelectedKey(ns._key);
    markDirty();
  }
  function moveStep(key: string, dir: -1 | 1) {
    mutateSteps(prev => moveInList(prev, key, dir));
    markDirty();
  }
  function addToBranch(parentKey: string, branch: 'then' | 'else' | 'body') {
    const ns = blankStep('click');
    mutateSteps(prev =>
      findAndReplace(prev, parentKey, s => {
        if (branch === 'then') return { ...s, then_branch: [...s.then_branch, ns] };
        if (branch === 'else') return { ...s, else_branch: [...s.else_branch, ns] };
        return { ...s, loop_body: [...s.loop_body, ns] };
      }),
    );
    setSelectedKey(ns._key);
    markDirty();
  }

  function addNewNode(type: StepType) {
    if (selectedKey) {
      const sel = allNodes.find(n => n._key === selectedKey);
      if (sel?.step_type === 'condition') addToBranch(selectedKey, 'then');
      else if (sel?.step_type === 'loop') addToBranch(selectedKey, 'body');
      else addAfter(selectedKey, type);
    } else {
      addAtEnd(type);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────
  function validateTree(list: EditableStep[]): string | null {
    for (const s of list) {
      if (!s.title.trim()) return s._key;
      if (s.step_type === 'condition') { const e = validateTree(s.then_branch) ?? validateTree(s.else_branch); if (e) return e; }
      if (s.step_type === 'loop') { const e = validateTree(s.loop_body); if (e) return e; }
    }
    return null;
  }

  async function saveNewVersion() {
    const bad = validateTree(steps);
    if (bad) { setSelectedKey(bad); toast('Every step needs a title.', 'error'); return; }
    setSaving(true);
    try {
      await apiPost(`/playbooks/${playbookId}/versions`, { change_note: 'Edited in flow editor', steps: steps.map(toApi) });
      setDirty(false); toast('New version saved!', 'success'); router.refresh();
    } catch (err) { toast(err instanceof Error ? err.message : 'Save failed.', 'error'); }
    finally { setSaving(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const wrapperCls = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]'
    : 'mt-5';

  return (
    <section className={wrapperCls}>
      {/* Header bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${
        fullscreen ? 'px-5 py-3 border-b border-[var(--app-line)] bg-[var(--app-surface)]' : 'mb-3'
      }`}>
        <div>
          <p className="landing-kicker">{editing ? 'Flow editor' : 'Flow'}</p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight">
            v{versionNumber} · {countAll(steps)} step{countAll(steps) !== 1 ? 's' : ''}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              {dirty && <span className="text-xs font-semibold text-[var(--app-sand)]">Unsaved</span>}
              <button onClick={() => { setEditing(false); setSelectedKey(null); }}
                className="btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm">
                Done
              </button>
              <button onClick={saveNewVersion} disabled={saving || !dirty}
                className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-40">
                {saving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} weight="bold" />}
                {saving ? 'Saving…' : 'Save version'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
              <Pencil size={14} weight="bold" />
              Edit flow
            </button>
          )}
          <button onClick={() => setFullscreen(f => !f)}
            className="icon-btn" title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
            {fullscreen ? <ArrowsIn size={16} weight="bold" /> : <ArrowsOut size={16} weight="bold" />}
          </button>
        </div>
      </div>

      {/* Workspace: canvas + sidebar */}
      <div className={`flex overflow-hidden bg-[var(--app-surface)] ${
        fullscreen ? 'flex-1' : 'rounded-2xl border border-[var(--app-line)]'
      }`}
        style={fullscreen ? undefined : { height: 'clamp(460px, 68vh, 820px)' }}>

        {/* ── Canvas ─────────────────────────────────────────────────── */}
        <div
          ref={canvasRef}
          className="canvas-grid relative flex-1 overflow-hidden"
          style={{
            cursor: panRef.current ? 'grabbing' : canvasMode === 'hand' ? 'grab' : 'default',
            backgroundSize: `${20 * camera.zoom}px ${20 * camera.zoom}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
          }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={(e) => { onCanvasPointerMove(e); onNodePointerMove(e); }}
          onPointerUp={() => { onCanvasPointerUp(); onNodePointerUp(); }}
        >
          {/* Invisible click-target for pan (captures clicks on empty space) */}
          <div data-canvas="bg" className="absolute inset-0 z-0" />

          {/* Transformed world */}
          <div className="pointer-events-none absolute origin-[0_0]"
            style={{ transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})` }}>

            {/* SVG edges */}
            <svg className="absolute" style={{ overflow: 'visible', width: 1, height: 1 }}>
              <defs>
                <marker id="ah-default" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill="var(--app-line-strong)" />
                </marker>
                <marker id="ah-yes" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill="#4a8c61" />
                </marker>
                <marker id="ah-no" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill="#c04040" />
                </marker>
              </defs>
              {edges.map((edge, i) => (
                <EdgeLine key={`${edge.from}-${edge.to}-${i}`} edge={edge} positions={effectivePos} />
              ))}
            </svg>

            {/* Start terminal */}
            <div className="absolute pointer-events-auto" style={{ left: effectivePos.__start__?.x, top: effectivePos.__start__?.y }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--app-sage)] bg-[rgba(123,155,134,0.18)]">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
              </div>
            </div>

            {/* Nodes */}
            {allNodes.map(node => (
              <div
                key={node._key}
                className="absolute pointer-events-auto"
                style={{
                  left: effectivePos[node._key]?.x ?? 0,
                  top: effectivePos[node._key]?.y ?? 0,
                  width: NODE_W,
                  cursor: editing ? 'pointer' : 'default',
                }}
                onPointerDown={e => onNodePointerDown(e, node._key)}
              >
                <NodeCard node={node} selected={editing && selectedKey === node._key} meta={META[node.step_type] ?? META.click} />
              </div>
            ))}

            {/* End terminal */}
            <div className="absolute pointer-events-auto" style={{ left: effectivePos.__end__?.x, top: effectivePos.__end__?.y }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--app-sand)] bg-[rgba(191,155,106,0.18)]">
                <div className="h-2.5 w-2.5 rounded-sm bg-[var(--app-sand)]" />
              </div>
            </div>
          </div>

          {/* ── Floating toolbar (top-left, edit mode only) ─────────── */}
          {editing && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-xl border border-[var(--app-line)] bg-white/85 px-1 py-0.5 shadow-sm backdrop-blur-md">
            {/* Mode toggle */}
            <button
              onClick={() => setCanvasMode('cursor')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                canvasMode === 'cursor'
                  ? 'bg-[var(--app-blue)] text-white shadow-sm'
                  : 'text-[var(--app-muted)] hover:bg-[var(--app-chip)]'
              }`}
              title="Select mode (V)"
            >
              <CursorIcon size={15} weight={canvasMode === 'cursor' ? 'fill' : 'bold'} />
            </button>
            <button
              onClick={() => setCanvasMode('hand')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                canvasMode === 'hand'
                  ? 'bg-[var(--app-blue)] text-white shadow-sm'
                  : 'text-[var(--app-muted)] hover:bg-[var(--app-chip)]'
              }`}
              title="Hand mode (H)"
            >
              <Hand size={15} weight={canvasMode === 'hand' ? 'fill' : 'bold'} />
            </button>

            <div className="mx-1 h-5 w-px bg-[var(--app-line)]" />

            {/* Step type buttons */}
            {ACTION_TYPES.map(t => {
              const m = META[t];
              return (
                <button key={t} onClick={() => addNewNode(t)} title={m.label}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--app-chip)] ${m.color}`}>
                  <m.icon size={16} weight="duotone" />
                </button>
              );
            })}
            <div className="mx-1 h-5 w-px bg-[var(--app-line)]" />
            {FLOW_TYPES.map(t => {
              const m = META[t];
              return (
                <button key={t} onClick={() => addNewNode(t)} title={m.label}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--app-chip)] ${m.color}`}>
                  <m.icon size={16} weight="duotone" />
                </button>
              );
            })}

            <div className="mx-1 h-5 w-px bg-[var(--app-line)]" />

            {/* Undo / Redo */}
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                canUndo ? 'text-[var(--app-muted)] hover:bg-[var(--app-chip)] hover:text-[var(--app-text)]' : 'text-[var(--app-line-strong)] cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <ArrowCounterClockwise size={15} weight="bold" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                canRedo ? 'text-[var(--app-muted)] hover:bg-[var(--app-chip)] hover:text-[var(--app-text)]' : 'text-[var(--app-line-strong)] cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Shift+Z)"
            >
              <ArrowClockwise size={15} weight="bold" />
            </button>
          </div>
          )}

          {/* ── Zoom controls (bottom-right) ───────────────────────── */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-full border border-[var(--app-line)] bg-white/80 p-1 shadow-lg shadow-black/[0.04] backdrop-blur-xl">
            <button
              onClick={() => setCamera(c => ({ ...c, zoom: Math.max(c.zoom * 0.8, 0.18) }))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-muted)] transition-colors hover:bg-[var(--app-chip)] hover:text-[var(--app-text)]"
              title="Zoom out"
            >
              <MagnifyingGlassMinus size={14} weight="bold" />
            </button>
            <span className="w-10 text-center text-[10px] font-semibold tabular-nums text-[var(--app-muted)]">
              {Math.round(camera.zoom * 100)}%
            </span>
            <button
              onClick={() => setCamera(c => ({ ...c, zoom: Math.min(c.zoom * 1.2, 2.5) }))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-muted)] transition-colors hover:bg-[var(--app-chip)] hover:text-[var(--app-text)]"
              title="Zoom in"
            >
              <MagnifyingGlassPlus size={14} weight="bold" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-[var(--app-line)]" />
            <button
              onClick={fitToView}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-muted)] transition-colors hover:bg-[var(--app-chip)] hover:text-[var(--app-text)]"
              title="Fit to view (F)"
            >
              <CornersOut size={14} weight="bold" />
            </button>
            {Object.keys(dragPos).length > 0 && (
              <button
                onClick={resetLayout}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-muted)] transition-colors hover:bg-[var(--app-chip)] hover:text-[var(--app-text)]"
                title="Reset to auto-layout"
              >
                <ArrowCounterClockwise size={13} weight="bold" />
              </button>
            )}
          </div>

          {/* ── Minimap (bottom-left) ──────────────────────────────── */}
          <Minimap positions={effectivePos} camera={camera} canvasRef={canvasRef} allNodes={allNodes} />

          {/* ── Help hints (top-right, edit mode only) ────────────── */}
          {editing ? (
          <div className="absolute right-3 top-3 z-10 rounded-lg border border-[var(--app-line)] bg-white/80 px-3 py-1.5 text-[10px] text-[var(--app-muted)] shadow-sm backdrop-blur-xl">
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">V</kbd> select{' · '}
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">H</kbd> hand{' · '}
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">F</kbd> fit{' · '}
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">⌫</kbd> delete{' · '}
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">⌘Z</kbd> undo
          </div>
          ) : (
          <div className="absolute right-3 top-3 z-10 rounded-lg border border-[var(--app-line)] bg-white/80 px-3 py-1.5 text-[10px] text-[var(--app-muted)] shadow-sm backdrop-blur-xl">
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">F</kbd> fit{' · '}
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">H</kbd> hand{' · '}
            <kbd className="rounded bg-[var(--app-chip)] px-1 py-0.5 font-mono text-[9px]">E</kbd> edit
          </div>
          )}
        </div>

        {/* ── Edit sidebar (edit mode only) ──────────────────────── */}
        {editing && (
        <AnimatePresence>
          {selectedNode && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="shrink-0 overflow-y-auto overflow-x-hidden border-l border-[var(--app-line)] bg-[var(--app-surface)]"
            >
              <EditSidebar
                node={selectedNode}
                updateStep={updateStep}
                removeStep={removeStep}
                moveStep={moveStep}
                addToBranch={addToBranch}
                close={() => setSelectedKey(null)}
              />
            </motion.aside>
          )}
        </AnimatePresence>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Canvas Node Card
   ═══════════════════════════════════════════════════════════════════════════ */

function NodeCard({ node, selected, meta }: { node: EditableStep; selected: boolean; meta: StepMeta }) {
  const isCond = node.step_type === 'condition';
  const isLoop = node.step_type === 'loop';

  return (
    <div className={`
      group relative rounded-xl border bg-white shadow-sm transition-all duration-150
      ${selected ? 'border-[var(--app-blue)] ring-2 ring-[var(--app-blue)]/20 shadow-md' : 'border-[var(--app-line)] hover:shadow-md hover:border-[var(--app-line-strong)]'}
      cursor-pointer select-none
    `}>
      {/* Accent stripe */}
      <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full" style={{ backgroundColor: meta.hex }} />

      {/* Content */}
      <div className="flex items-center gap-2.5 py-2.5 pl-4 pr-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
          <meta.icon size={16} weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-snug text-[var(--app-text)]">
            {node.title || <span className="italic text-[var(--app-muted)]/60">Untitled</span>}
          </p>
          <p className={`text-[10px] font-bold uppercase tracking-wider leading-none mt-0.5 ${meta.color}`}>
            {meta.label}
            {isCond && node.condition_expr && (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--app-muted)]">
                · {truncate(node.condition_expr, 18)}
              </span>
            )}
            {isLoop && (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--app-muted)]">
                · {node.loop_max}× max
              </span>
            )}
            {!isCond && !isLoop && node.target_url && (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--app-muted)]">
                → {truncate(node.target_url, 18)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Ports */}
      <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 h-[10px] w-[10px] rounded-full border-2 border-[var(--app-line-strong)] bg-white" />
      {isCond ? (
        <>
          <div className="absolute -bottom-[5px] left-[30%] -translate-x-1/2 h-[10px] w-[10px] rounded-full border-2 border-[#4a8c61] bg-white" />
          <div className="absolute -bottom-[5px] left-[70%] -translate-x-1/2 h-[10px] w-[10px] rounded-full border-2 border-[#c04040] bg-white" />
        </>
      ) : (
        <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 h-[10px] w-[10px] rounded-full border-2 border-[var(--app-line-strong)] bg-white" />
      )}

      {/* Condition/loop badge */}
      {isCond && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-md bg-[#c06030] text-white">
          <TreeStructure size={10} weight="bold" />
        </div>
      )}
      {isLoop && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-md bg-[#2e7d8c] text-white">
          <ArrowsClockwise size={10} weight="bold" />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SVG Edge Line
   ═══════════════════════════════════════════════════════════════════════════ */

function EdgeLine({ edge, positions }: { edge: Edge; positions: Record<string, Pos> }) {
  const from = positions[edge.from];
  const to = positions[edge.to];
  if (!from || !to) return null;

  const fromTerm = edge.from === '__start__' || edge.from === '__end__';
  const toTerm   = edge.to   === '__start__' || edge.to   === '__end__';

  // Source port (bottom)
  let x1: number, y1: number;
  if (fromTerm) {
    x1 = from.x + TERM_R; y1 = from.y + TERM_R * 2;
  } else if (edge.type === 'yes') {
    x1 = from.x + NODE_W * 0.3; y1 = from.y + (from.x === positions[edge.from]?.x ? COND_H : NODE_H);
  } else if (edge.type === 'no') {
    x1 = from.x + NODE_W * 0.7; y1 = from.y + COND_H;
  } else {
    x1 = from.x + NODE_W / 2; y1 = from.y + NODE_H;
  }

  // Target port (top)
  let x2: number, y2: number;
  if (toTerm) {
    x2 = to.x + TERM_R; y2 = to.y;
  } else {
    x2 = to.x + NODE_W / 2; y2 = to.y;
  }

  const dy = Math.abs(y2 - y1);
  const cp = Math.min(dy * 0.45, 70);
  const d = `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;

  const colors = { default: 'var(--app-line-strong)', yes: '#4a8c61', no: '#c04040' };
  const stroke = colors[edge.type] || colors.default;

  return (
    <g>
      <path d={d} fill="none" stroke={stroke} strokeWidth={2}
        markerEnd={`url(#ah-${edge.type})`}
        strokeDasharray={edge.type === 'default' ? undefined : '6 3'}
      />
      {edge.type !== 'default' && (
        <text
          x={(x1 + x2) / 2 + (edge.type === 'yes' ? -14 : 14)}
          y={(y1 + y2) / 2 - 4}
          fill={stroke}
          fontSize={9}
          fontWeight={700}
          textAnchor="middle"
        >
          {edge.type === 'yes' ? 'YES' : 'NO'}
        </text>
      )}
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Edit Sidebar
   ═══════════════════════════════════════════════════════════════════════════ */

type EditSidebarProps = {
  node: EditableStep;
  updateStep: (k: string, p: Partial<EditableStep>) => void;
  removeStep: (k: string) => void;
  moveStep: (k: string, dir: -1 | 1) => void;
  addToBranch: (pk: string, b: 'then' | 'else' | 'body') => void;
  close: () => void;
};

function EditSidebar({ node, updateStep, removeStep, moveStep, addToBranch, close }: EditSidebarProps) {
  const meta = META[node.step_type] ?? META.click;
  const isAction = ACTION_TYPES.includes(node.step_type);
  const isCond = node.step_type === 'condition';
  const isLoop = node.step_type === 'loop';

  return (
    <div className="flex h-full w-80 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--app-line)] px-4 py-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
          <meta.icon size={14} weight="duotone" />
        </div>
        <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
        <div className="flex-1" />
        <button onClick={close} className="icon-btn !h-7 !w-7"><X size={14} weight="bold" /></button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <SideField label="Title">
          <input className="input text-sm" value={node.title}
            onChange={e => updateStep(node._key, { title: e.target.value })}
            placeholder={isCond ? 'e.g. Is user logged in?' : isLoop ? 'e.g. Process each row' : 'e.g. Open login page'}
            autoFocus />
        </SideField>

        {/* Type selector (actions only) */}
        {isAction && (
          <SideField label="Type">
            <div className="flex flex-wrap gap-1">
              {ACTION_TYPES.map(t => {
                const tm = META[t];
                const on = node.step_type === t;
                return (
                  <button key={t} type="button" onClick={() => updateStep(node._key, { step_type: t })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all
                      ${on ? `${tm.bg} ${tm.color} ring-2 ring-current/20` : 'bg-[var(--app-chip)]/40 text-[var(--app-muted)] hover:bg-[var(--app-chip)]'}`}>
                    <tm.icon size={12} weight={on ? 'duotone' : 'bold'} />
                    {tm.label}
                  </button>
                );
              })}
            </div>
          </SideField>
        )}

        {/* Condition expression */}
        {isCond && (
          <>
            <SideField label="Expression">
              <input className="input font-mono text-xs" value={node.condition_expr}
                onChange={e => updateStep(node._key, { condition_expr: e.target.value })}
                placeholder='element exists: #selector' />
              <span className="mt-1 block text-[10px] text-[var(--app-muted)]/70">
                <code className="rounded bg-[var(--app-chip)] px-1">element exists: #sel</code>{' · '}
                <code className="rounded bg-[var(--app-chip)] px-1">url contains: /path</code>{' · '}
                <code className="rounded bg-[var(--app-chip)] px-1">{'{{var}}'} == val</code>
              </span>
            </SideField>
            <SideField label="Branches">
              <div className="flex gap-2">
                <button onClick={() => addToBranch(node._key, 'then')}
                  className="flex-1 rounded-lg border border-dashed border-[rgba(74,140,97,0.3)] bg-[rgba(74,140,97,0.05)] px-3 py-2 text-center text-xs font-semibold text-[#4a8c61] transition-colors hover:bg-[rgba(74,140,97,0.12)]">
                  <Plus size={10} weight="bold" className="inline mr-1" />
                  Yes ({node.then_branch.length})
                </button>
                <button onClick={() => addToBranch(node._key, 'else')}
                  className="flex-1 rounded-lg border border-dashed border-[rgba(200,60,60,0.2)] bg-[rgba(200,60,60,0.04)] px-3 py-2 text-center text-xs font-semibold text-[#c04040] transition-colors hover:bg-[rgba(200,60,60,0.10)]">
                  <Plus size={10} weight="bold" className="inline mr-1" />
                  No ({node.else_branch.length})
                </button>
              </div>
            </SideField>
          </>
        )}

        {/* Loop settings */}
        {isLoop && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SideField label="Max iterations">
                <input type="number" min="1" className="input w-full text-sm" value={node.loop_max}
                  onChange={e => updateStep(node._key, { loop_max: e.target.value })} />
              </SideField>
              <SideField label="Until (optional)">
                <input className="input font-mono text-xs" value={node.loop_expr}
                  onChange={e => updateStep(node._key, { loop_expr: e.target.value })}
                  placeholder="no more rows" />
              </SideField>
            </div>
            <SideField label="Loop body">
              <button onClick={() => addToBranch(node._key, 'body')}
                className="w-full rounded-lg border border-dashed border-[rgba(46,125,140,0.3)] bg-[rgba(46,125,140,0.05)] px-3 py-2 text-center text-xs font-semibold text-[#2e7d8c] transition-colors hover:bg-[rgba(46,125,140,0.12)]">
                <Plus size={10} weight="bold" className="inline mr-1" />
                Add step ({node.loop_body.length} in body)
              </button>
            </SideField>
          </>
        )}

        {/* Target URL */}
        {isAction && (node.step_type === 'navigate' || node.target_url) && (
          <SideField label="Target URL">
            <input className="input font-mono text-xs" value={node.target_url}
              onChange={e => updateStep(node._key, { target_url: e.target.value })}
              placeholder="https://example.com/login" />
          </SideField>
        )}

        {/* Selector */}
        {isAction && ['click', 'input', 'submit', 'verify'].includes(node.step_type) && (
          <SideField label="CSS Selector">
            <input className="input font-mono text-xs" value={node.selector}
              onChange={e => updateStep(node._key, { selector: e.target.value })}
              placeholder='input[name="email"]' />
          </SideField>
        )}

        {/* Input value */}
        {node.step_type === 'input' && (
          <SideField label="Value">
            <input className="input font-mono text-xs" value={node.variables.value ?? ''}
              onChange={e => updateStep(node._key, { variables: { ...node.variables, value: e.target.value } })}
              placeholder="{{email}}" />
            <span className="mt-1 block text-[10px] text-[var(--app-muted)]/70">Use {'{{variable}}'} for dynamic data</span>
          </SideField>
        )}

        {/* Wait */}
        {node.step_type === 'wait' && (
          <SideField label="Wait (seconds)">
            <input type="number" min="0.5" step="0.5" className="input w-28 text-sm"
              value={node.variables.seconds ?? '2'}
              onChange={e => updateStep(node._key, { variables: { ...node.variables, seconds: e.target.value } })} />
          </SideField>
        )}

        {/* Guardrail */}
        {isAction && (
          <SideField label="Guardrail">
            <input className="input text-xs" value={node.guardrails.verify ?? ''}
              onChange={e => updateStep(node._key, { guardrails: { ...node.guardrails, verify: e.target.value } })}
              placeholder="Page should show dashboard" />
          </SideField>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-[var(--app-line)] px-4 py-3">
        <button onClick={() => moveStep(node._key, -1)} className="icon-btn" title="Move up"><ArrowUp size={13} weight="bold" /></button>
        <button onClick={() => moveStep(node._key, 1)} className="icon-btn" title="Move down"><ArrowDown size={13} weight="bold" /></button>
        <div className="flex-1" />
        <button onClick={() => removeStep(node._key)}
          className="icon-btn text-red-500 hover:bg-red-50 hover:text-red-600" title="Delete">
          <Trash size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function SideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
      {label}
      {children}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Minimap
   ═══════════════════════════════════════════════════════════════════════════ */

function Minimap({
  positions, camera, canvasRef, allNodes,
}: {
  positions: Record<string, Pos>;
  camera: { x: number; y: number; zoom: number };
  canvasRef: React.RefObject<HTMLDivElement | null>;
  allNodes: EditableStep[];
}) {
  const MINIMAP_W = 140;
  const MINIMAP_H = 96;
  const PADDING = 40;

  const vals = Object.values(positions);
  if (vals.length === 0) return null;

  const minX = Math.min(...vals.map(p => p.x)) - PADDING;
  const minY = Math.min(...vals.map(p => p.y)) - PADDING;
  const maxX = Math.max(...vals.map(p => p.x + NODE_W)) + PADDING;
  const maxY = Math.max(...vals.map(p => p.y + NODE_H)) + PADDING;
  const worldW = maxX - minX;
  const worldH = maxY - minY;

  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

  // Viewport rectangle
  const cEl = canvasRef.current;
  const vw = cEl ? cEl.clientWidth / camera.zoom : 800;
  const vh = cEl ? cEl.clientHeight / camera.zoom : 600;
  const vpX = (-camera.x / camera.zoom - minX) * scale;
  const vpY = (-camera.y / camera.zoom - minY) * scale;
  const vpW = vw * scale;
  const vpH = vh * scale;

  return (
    <div className="absolute bottom-3 left-3 z-10 overflow-hidden rounded-lg border border-[var(--app-line)] bg-white/80 shadow-lg shadow-black/[0.04] backdrop-blur-xl"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}>
      <div className="relative h-full w-full">
        {/* Node dots */}
        {allNodes.map(node => {
          const p = positions[node._key];
          if (!p) return null;
          const meta = META[node.step_type] ?? META.click;
          return (
            <div
              key={node._key}
              className="absolute rounded-sm"
              style={{
                left: (p.x - minX) * scale,
                top: (p.y - minY) * scale,
                width: Math.max(NODE_W * scale, 3),
                height: Math.max(NODE_H * scale, 2),
                backgroundColor: meta.hex,
                opacity: 0.6,
              }}
            />
          );
        })}
        {/* Start dot */}
        {positions.__start__ && (
          <div className="absolute h-1.5 w-1.5 rounded-full bg-[var(--app-sage)]"
            style={{ left: (positions.__start__.x - minX) * scale, top: (positions.__start__.y - minY) * scale }} />
        )}
        {/* End dot */}
        {positions.__end__ && (
          <div className="absolute h-1.5 w-1.5 rounded-full bg-[var(--app-sand)]"
            style={{ left: (positions.__end__.x - minX) * scale, top: (positions.__end__.y - minY) * scale }} />
        )}
        {/* Viewport */}
        <div className="absolute rounded-sm border border-[var(--app-blue)]/50 bg-[var(--app-blue)]/[0.06]"
          style={{ left: vpX, top: vpY, width: vpW, height: vpH }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Utility
   ═══════════════════════════════════════════════════════════════════════════ */

function countAll(steps: EditableStep[]): number {
  return steps.reduce((n, s) => n + 1 + countAll(s.then_branch) + countAll(s.else_branch) + countAll(s.loop_body), 0);
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

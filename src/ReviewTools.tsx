import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- Icons ---
const PenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
  </svg>
);
const PinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const TextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>
  </svg>
);
const ImageIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);
const EraserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>
  </svg>
);
const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);
const ChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
);
const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

// --- Types ---
type ReviewTool = 'select' | 'sketch' | 'pin' | 'text' | 'image' | 'eraser';

interface ReviewPin { id: string; x: number; y: number; comment: string; color: string; }
interface TextNote { id: string; x: number; y: number; text: string; color: string; anchorX?: number; anchorY?: number; }
interface ReviewImage { id: string; x: number; y: number; width: number; height: number; src: string; }
interface StrokePath { id: string; points: { x: number; y: number }[]; color: string; width: number; }

type UndoEntry =
  | { type: 'pin'; viewId: number; pin: ReviewPin }
  | { type: 'text'; viewId: number; note: TextNote }
  | { type: 'image'; viewId: number; image: ReviewImage }
  | { type: 'stroke'; viewId: number };

const COLORS = ['#ff3b30', '#ff9500', '#ffcc02', '#34c759', '#007aff', '#af52de', '#ffffff', '#000000'];
const STROKE_WIDTHS = [2, 4, 8];
const DRAG_THRESHOLD = 20; // px

const glassStyle = {
  background: 'rgba(255,255,255,0.25)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
};

interface ReviewToolsProps {
  expanded: boolean;
  onToggle: () => void;
  viewId: number;
  isTransitioning: boolean;
  navExpanded: boolean;
  onNavToggle: () => void;
}

const ReviewTools: React.FC<ReviewToolsProps> = ({ expanded, onToggle, viewId, isTransitioning, navExpanded, onNavToggle }) => {
  const [activeTool, setActiveTool] = useState<ReviewTool>('select');
  const [activeColor, setActiveColor] = useState('#ff3b30');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Per-view state — plain objects, not Maps
  type ViewData = { pins: ReviewPin[]; notes: TextNote[]; images: ReviewImage[]; strokes: StrokePath[] };
  const [views, setViews] = useState<Record<number, ViewData>>({});
  const getView = (id: number): ViewData => views[id] || { pins: [], notes: [], images: [], strokes: [] };
  const updateView = (id: number, fn: (v: ViewData) => Partial<ViewData>) => {
    setViews(prev => {
      const old = prev[id] || { pins: [], notes: [], images: [], strokes: [] };
      return { ...prev, [id]: { ...old, ...fn(old) } };
    });
  };

  // Undo stack
  const [, setUndoStack] = useState<UndoEntry[]>([]);

  // Interaction refs
  const isDrawing = useRef(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);
  const textDraft = useRef<{ anchorX: number; anchorY: number; startScreenX: number; startScreenY: number } | null>(null);
  const [textDraftPos, setTextDraftPos] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; type: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startW: number; startX: number } | null>(null);

  const v = getView(viewId);
  const currentPins = v.pins;
  const currentNotes = v.notes;
  const currentImages = v.images;
  const currentStrokes = v.strokes;

  // Live stroke rendering (in-progress only)
  const [livePoints, setLivePoints] = useState<{ x: number; y: number }[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const getPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }, []);

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack(prev => [...prev, entry]);
  }, []);

  // --- Undo ---
  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      const rest = prev.slice(0, -1);
      if (entry.type === 'stroke') {
        updateView(entry.viewId, v => ({ strokes: v.strokes.slice(0, -1) }));
      } else if (entry.type === 'pin') {
        updateView(entry.viewId, v => ({ pins: v.pins.filter(x => x.id !== entry.pin.id) }));
      } else if (entry.type === 'text') {
        updateView(entry.viewId, v => ({ notes: v.notes.filter(x => x.id !== entry.note.id) }));
      } else if (entry.type === 'image') {
        updateView(entry.viewId, v => ({ images: v.images.filter(x => x.id !== entry.image.id) }));
      }
      return rest;
    });
  }, []);

  // Ctrl+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  const handleClearAll = useCallback(() => {
    updateView(viewId, () => ({ pins: [], notes: [], images: [], strokes: [] }));
    setEditingPin(null); setEditingNote(null);
    setUndoStack([]);
  }, [viewId]);

  // --- Mouse handlers (single interaction layer) ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isTransitioning) return;
    const pos = getPos(e);
    if (activeTool === 'sketch') {
      isDrawing.current = true;
      currentStroke.current = [pos];
    } else if (activeTool === 'eraser') {
      const threshold = 0.02;
      updateView(viewId, v => ({
        strokes: v.strokes.filter(s => !s.points.some(p => Math.abs(p.x - pos.x) < threshold && Math.abs(p.y - pos.y) < threshold))
      }));
    } else if (activeTool === 'pin') {
      const pin: ReviewPin = { id: `pin-${Date.now()}`, x: pos.x, y: pos.y, comment: '', color: activeColor };
      updateView(viewId, v => ({ pins: [...v.pins, pin] }));
      pushUndo({ type: 'pin', viewId, pin });
    } else if (activeTool === 'text') {
      textDraft.current = { anchorX: pos.x, anchorY: pos.y, startScreenX: e.clientX, startScreenY: e.clientY };
      setTextDraftPos(null);
    } else if (activeTool === 'image') {
      fileInputRef.current?.click();
    }
  }, [activeTool, activeColor, viewId, getPos, isTransitioning, pushUndo]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Text/leader drag
    if (textDraft.current) {
      const dx = e.clientX - textDraft.current.startScreenX;
      const dy = e.clientY - textDraft.current.startScreenY;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        const pos = getPos(e);
        setTextDraftPos({ x: pos.x, y: pos.y });
      }
      return;
    }
    // Sketch
    if (!isDrawing.current || activeTool !== 'sketch') return;
    const pos = getPos(e);
    currentStroke.current.push(pos);
    setLivePoints([...currentStroke.current]);
  }, [activeTool, getPos]);

  const handleMouseUp = useCallback(() => {
    // Text/leader finalize
    if (textDraft.current) {
      const draft = textDraft.current;
      textDraft.current = null;
      const isLeader = textDraftPos !== null;
      setTextDraftPos(null);
      const note: TextNote = {
        id: `note-${Date.now()}`,
        x: isLeader ? textDraftPos!.x : draft.anchorX,
        y: isLeader ? textDraftPos!.y : draft.anchorY,
        text: '',
        color: activeColor,
        anchorX: isLeader ? draft.anchorX : undefined,
        anchorY: isLeader ? draft.anchorY : undefined,
      };
      updateView(viewId, vd => ({ notes: [...vd.notes, note] }));
      pushUndo({ type: 'text', viewId, note });
      setEditingNote(note.id);
      return;
    }
    // Sketch finalize
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentStroke.current.length > 1) {
      const newStroke: StrokePath = { id: `s-${Date.now()}`, points: [...currentStroke.current], color: activeColor, width: strokeWidth };
      updateView(viewId, vd => ({ strokes: [...vd.strokes, newStroke] }));
      pushUndo({ type: 'stroke', viewId });
    }
    currentStroke.current = [];
    setLivePoints([]);
  }, [activeColor, strokeWidth, viewId, textDraftPos, pushUndo]);

  // Image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        const w = 0.2;
        const newImg: ReviewImage = { id: `img-${Date.now()}`, x: 0.4, y: 0.4, width: w, height: w / aspect, src };
        updateView(viewId, vd => ({ images: [...vd.images, newImg] }));
        pushUndo({ type: 'image', viewId, image: newImg });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setActiveTool('select');
  }, [viewId, pushUndo]);

  // Annotation drag
  const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, id: string, type: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const pos = getPos(e);
    setDragging({ id, type, offsetX: pos.x, offsetY: pos.y });
  }, [activeTool, getPos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const pos = getPos(e);
      if (dragging.type === 'pin') updateView(viewId, vd => ({ pins: vd.pins.map(x => x.id === dragging.id ? { ...x, x: pos.x, y: pos.y } : x) }));
      else if (dragging.type === 'note') updateView(viewId, vd => ({ notes: vd.notes.map(x => x.id === dragging.id ? { ...x, x: pos.x, y: pos.y } : x) }));
      else if (dragging.type === 'anchor') { const realId = dragging.id.replace('-anchor', ''); updateView(viewId, vd => ({ notes: vd.notes.map(x => x.id === realId ? { ...x, anchorX: pos.x, anchorY: pos.y } : x) })); }
      else if (dragging.type === 'image') updateView(viewId, vd => ({ images: vd.images.map(x => x.id === dragging.id ? { ...x, x: pos.x, y: pos.y } : x) }));
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, viewId, getPos]);

  // Image resize
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const el = overlayRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const deltaX = (e.clientX - resizing.startX) / r.width;
      const newW = Math.max(0.05, resizing.startW + deltaX);
      updateView(viewId, vd => ({
        images: vd.images.map(img => {
          if (img.id !== resizing.id) return img;
          const aspect = img.width / img.height;
          return { ...img, width: newW, height: newW / aspect };
        })
      }));
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing, viewId]);

  const deletePin = useCallback((id: string) => { updateView(viewId, vd => ({ pins: vd.pins.filter(x => x.id !== id) })); setEditingPin(null); }, [viewId]);
  const deleteNote = useCallback((id: string) => { updateView(viewId, vd => ({ notes: vd.notes.filter(x => x.id !== id) })); setEditingNote(null); }, [viewId]);
  const deleteImage = useCallback((id: string) => { updateView(viewId, vd => ({ images: vd.images.filter(x => x.id !== id) })); }, [viewId]);

  const toolCursor = activeTool === 'sketch' ? 'crosshair' : activeTool === 'pin' ? 'crosshair' : activeTool === 'text' ? 'crosshair' : activeTool === 'eraser' ? 'crosshair' : activeTool === 'image' ? 'copy' : 'default';

  const tools: { id: ReviewTool; icon: React.ReactNode; label: string }[] = [
    { id: 'sketch', icon: <PenIcon />, label: 'Sketch' },
    { id: 'pin', icon: <PinIcon />, label: 'Pin' },
    { id: 'text', icon: <TextIcon />, label: 'Text / Leader' },
    { id: 'image', icon: <ImageIcon />, label: 'Image' },
    { id: 'eraser', icon: <EraserIcon />, label: 'Eraser' },
  ];

  return (
    <>
      {/* Header bar */}
      <div className="absolute top-3 left-3 right-3" style={{ zIndex: 10000 }}>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-full flex items-center rounded-2xl transition-all duration-300"
            style={{ ...glassStyle, height: expanded ? 52 : 0, opacity: expanded ? 1 : 0, overflow: 'hidden', padding: expanded ? '0 16px' : '0' }}
          >
            {/* Left — logo */}
            <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: 140 }}>
              <span className="text-base tracking-widest font-semibold select-none" style={{ color: 'rgba(25,25,25,0.75)', letterSpacing: '0.15em' }}>AURA</span>
              <span className="text-base tracking-wider font-light select-none" style={{ color: 'rgba(25,25,25,0.4)', letterSpacing: '0.1em' }}>HORIZON</span>
            </div>

            {/* Center — tools */}
            <div className="flex-1 flex items-center justify-center gap-0.5">
              {tools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(activeTool === tool.id ? 'select' : tool.id)}
                  title={tool.label}
                  className="relative flex items-center justify-center rounded-lg transition-all hover:bg-black/10"
                  style={{ width: 36, height: 36, color: activeTool === tool.id ? activeColor : 'rgba(25,25,25,0.75)', background: activeTool === tool.id ? activeColor + '18' : 'transparent', border: activeTool === tool.id ? `1.5px solid ${activeColor}55` : '1.5px solid transparent' }}
                >
                  {tool.icon}
                </button>
              ))}
              <div className="w-px h-5 mx-1.5" style={{ background: 'rgba(0,0,0,0.12)' }} />
              <button onClick={() => setShowColorPicker(!showColorPicker)} className="flex items-center justify-center rounded-lg hover:bg-black/10" style={{ width: 36, height: 36 }} title="Color">
                <div className="rounded-full" style={{ width: 18, height: 18, background: activeColor, border: '2px solid rgba(0,0,0,0.15)' }} />
              </button>
              {activeTool === 'sketch' && STROKE_WIDTHS.map(w => (
                <button key={w} onClick={() => setStrokeWidth(w)} className="flex items-center justify-center rounded-lg hover:bg-black/10" style={{ width: 36, height: 36, border: strokeWidth === w ? `1.5px solid ${activeColor}55` : '1.5px solid transparent' }} title={`${w}px`}>
                  <div className="rounded-full" style={{ width: w + 4, height: w + 4, background: 'rgba(25,25,25,0.75)' }} />
                </button>
              ))}
              <div className="w-px h-5 mx-1.5" style={{ background: 'rgba(0,0,0,0.12)' }} />
              <button onClick={handleUndo} title="Undo (Ctrl+Z)" className="flex items-center justify-center rounded-lg hover:bg-black/10" style={{ width: 36, height: 36, color: 'rgba(25,25,25,0.55)' }}><UndoIcon /></button>
              <button onClick={handleClearAll} title="Clear All" className="flex items-center justify-center rounded-lg hover:bg-black/10 hover:text-red-500" style={{ width: 36, height: 36, color: 'rgba(25,25,25,0.55)' }}><TrashIcon /></button>
              <div className="w-px h-5 mx-1.5" style={{ background: 'rgba(0,0,0,0.12)' }} />
              <button onClick={onNavToggle} title={navExpanded ? 'Hide views' : 'Show views'} className="flex items-center justify-center rounded-lg hover:bg-black/10" style={{ width: 36, height: 36, color: navExpanded ? 'rgba(25,25,25,0.75)' : 'rgba(25,25,25,0.35)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1.5"/><rect x="14" y="2" width="8" height="8" rx="1.5"/><rect x="2" y="14" width="8" height="8" rx="1.5"/><rect x="14" y="14" width="8" height="8" rx="1.5"/></svg>
              </button>
            </div>

            {/* Right — placeholders */}
            <div className="flex items-center gap-1 flex-shrink-0" style={{ minWidth: 140, justifyContent: 'flex-end' }}>
              <button title="Settings" className="flex items-center justify-center rounded-lg transition-all hover:bg-black/10" style={{ width: 34, height: 34, color: 'rgba(25,25,25,0.55)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button title="Account" className="flex items-center justify-center rounded-lg transition-all hover:bg-black/10" style={{ width: 34, height: 34, color: 'rgba(25,25,25,0.55)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
              </button>
            </div>
          </div>

          {/* Color picker */}
          {showColorPicker && expanded && (
            <div className="flex gap-1.5 px-3 py-2 rounded-xl" style={glassStyle}>
              {COLORS.map(c => (
                <button key={c} onClick={() => { setActiveColor(c); setShowColorPicker(false); }} className="rounded-full transition-transform hover:scale-110" style={{ width: 24, height: 24, background: c, border: activeColor === c ? '2.5px solid white' : '2px solid rgba(25,25,25,0.35)', boxShadow: activeColor === c ? '0 0 8px rgba(0,0,0,0.2)' : 'none' }} />
              ))}
            </div>
          )}

          {/* Toggle (hidden) */}
          <button onClick={onToggle} className="hidden" style={{ width: 28, height: 28, ...glassStyle, color: 'rgba(255,255,255,0.8)' }}>
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </div>

      {/* Annotation overlay */}
      <div ref={overlayRef} className="absolute inset-0 z-[8]" style={{ visibility: isTransitioning ? 'hidden' : 'visible' }}>
        {/* SVG for saved strokes + live stroke */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
          {currentStrokes.map((s) => s.points.length >= 2 && (
            <polyline
              key={s.id}
              points={s.points.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {livePoints.length >= 2 && (
            <polyline
              points={livePoints.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')}
              fill="none"
              stroke={activeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Interaction layer */}
        {activeTool !== 'select' && (
          <div className="absolute inset-0" style={{ cursor: toolCursor }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
        )}

        {/* Draft leader line preview */}
        {textDraft.current && textDraftPos && (
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none', overflow: 'visible' }}>
            <line x1={`${textDraft.current.anchorX * 100}%`} y1={`${textDraft.current.anchorY * 100}%`} x2={`${textDraftPos.x * 100}%`} y2={`${textDraftPos.y * 100}%`} stroke={activeColor} strokeWidth="1.5" opacity="0.6" />
            <circle cx={`${textDraft.current.anchorX * 100}%`} cy={`${textDraft.current.anchorY * 100}%`} r="5" fill={activeColor} stroke="rgba(25,25,25,0.4)" strokeWidth="2" />
          </svg>
        )}

        {/* Images */}
        {currentImages.map(img => (
          <div
            key={img.id}
            className="absolute group"
            style={{ left: `${img.x * 100}%`, top: `${img.y * 100}%`, width: `${img.width * 100}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'auto', cursor: activeTool === 'select' ? 'move' : undefined }}
            onMouseDown={(e) => handleAnnotationMouseDown(e, img.id, 'image')}
          >
            <img src={img.src} alt="" className="w-full rounded-lg shadow-xl" style={{ border: '2px solid rgba(255,255,255,0.3)' }} draggable={false} />
            <button onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><XIcon /></button>
            {/* Resize handle */}
            <div
              className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-8 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(25,25,25,0.4)', border: '1px solid rgba(0,0,0,0.2)' }}
              onMouseDown={(e) => { e.stopPropagation(); setResizing({ id: img.id, startW: img.width, startX: e.clientX }); }}
            />
          </div>
        ))}

        {/* Pins */}
        {currentPins.map(pin => (
          <div key={pin.id} className="absolute group" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, transform: 'translate(-50%, -100%)', pointerEvents: 'auto', cursor: activeTool === 'select' ? 'move' : undefined }} onMouseDown={(e) => handleAnnotationMouseDown(e, pin.id, 'pin')}>
            {/* Pin label above */}
            {editingPin !== pin.id && pin.comment && (
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 rounded-lg px-2.5 py-1 text-xs whitespace-nowrap"
                style={{ ...glassStyle, color: 'rgba(25,25,25,0.75)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {pin.comment}
              </div>
            )}
            <div style={{ cursor: 'pointer', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} onClick={(e) => { e.stopPropagation(); setEditingPin(editingPin === pin.id ? null : pin.id); }}>
              <svg width="24" height="32" viewBox="-1 -1 26 33" overflow="visible">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 18 12 18s12-10.8 12-18C24 5.4 18.6 0 12 0z" fill="rgba(255,255,255,0.25)" stroke={pin.color} strokeWidth="1.5" />
                <circle cx="12" cy="11" r="4" fill={pin.color} />
              </svg>
            </div>
            {editingPin === pin.id && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 rounded-xl p-3 space-y-2" style={{ ...glassStyle, border: `1px solid ${pin.color}44`, minWidth: 220, zIndex: 100 }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <textarea placeholder="Note..." value={pin.comment} onChange={(e) => updateView(viewId, vd => ({ pins: vd.pins.map(x => x.id === pin.id ? { ...x, comment: e.target.value } : x) }))} className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-white/40 resize-none" rows={3} autoFocus />
                <div className="flex justify-between items-center">
                  <div className="flex gap-1">
                    {COLORS.slice(0, 5).map(c => (
                      <button key={c} onClick={() => updateView(viewId, vd => ({ pins: vd.pins.map(x => x.id === pin.id ? { ...x, color: c } : x) }))} className="rounded-full transition-transform hover:scale-110" style={{ width: 16, height: 16, background: c, border: pin.color === c ? '2px solid white' : '1px solid rgba(255,255,255,0.3)' }} />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => deletePin(pin.id)} className="rounded-full w-5 h-5 flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white"><XIcon /></button>
                    <button onClick={() => setEditingPin(null)} className="rounded-full w-5 h-5 flex items-center justify-center bg-green-500/80 hover:bg-green-500 text-white"><CheckIcon /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Text notes / Leaders */}
        {currentNotes.map(note => {
          const isLeader = note.anchorX !== undefined && note.anchorY !== undefined;
          return (
            <div key={note.id} style={{ pointerEvents: 'auto' }}>
              {/* Leader line + anchor */}
              {isLeader && (
                <>
                  <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none', overflow: 'visible' }}>
                    <line x1={`${note.anchorX! * 100}%`} y1={`${note.anchorY! * 100}%`} x2={`${note.x * 100}%`} y2={`${note.y * 100}%`} stroke={note.color} strokeWidth="1.5" opacity="0.7" />
                  </svg>
                  <div className="absolute" style={{ left: `${note.anchorX! * 100}%`, top: `${note.anchorY! * 100}%`, transform: 'translate(-50%,-50%)', cursor: 'move' }} onMouseDown={(e) => { if (activeTool !== 'select') return; e.stopPropagation(); const pos = getPos(e); setDragging({ id: note.id + '-anchor', type: 'anchor', offsetX: pos.x, offsetY: pos.y }); }}>
                    <div className="rounded-full" style={{ width: 10, height: 10, background: note.color, border: '2px solid rgba(25,25,25,0.4)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </div>
                </>
              )}
              {/* Note box */}
              <div className="absolute" style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%`, transform: 'translate(-50%,-50%)', cursor: activeTool === 'select' ? 'move' : undefined }} onMouseDown={(e) => handleAnnotationMouseDown(e, note.id, 'note')}>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ ...glassStyle, minWidth: 180 }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {editingNote === note.id && (
                    <div className="flex justify-end gap-1 px-2 pt-1.5">
                      <button onClick={() => deleteNote(note.id)} className="rounded-full w-5 h-5 flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white"><XIcon /></button>
                      <button onClick={() => setEditingNote(null)} className="rounded-full w-5 h-5 flex items-center justify-center bg-green-500/80 hover:bg-green-500 text-white"><CheckIcon /></button>
                    </div>
                  )}
                  <div className="px-2.5 pb-2 pt-1">
                    {editingNote === note.id ? (
                      <>
                        <textarea
                          value={note.text}
                          onChange={(e) => updateView(viewId, vd => ({ notes: vd.notes.map(n => n.id === note.id ? { ...n, text: e.target.value } : n) }))}
                          placeholder="Type a note..."
                          className="w-full bg-transparent text-xs outline-none resize-none"
                          style={{ color: 'rgba(25,25,25,0.85)' }}
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-1 mt-1">
                          {COLORS.slice(0, 6).map(c => (
                            <button
                              key={c}
                              onClick={() => updateView(viewId, vd => ({ notes: vd.notes.map(n => n.id === note.id ? { ...n, color: c } : n) }))}
                              className="rounded-full transition-transform hover:scale-110"
                              style={{ width: 14, height: 14, background: c, border: note.color === c ? '2px solid white' : '1px solid rgba(0,0,0,0.15)' }}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div
                        className="text-xs cursor-pointer min-h-[20px]"
                        style={{ color: 'rgba(25,25,25,0.75)' }}
                        onClick={() => setEditingNote(note.id)}
                      >
                        {note.text || 'Click to edit'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </>
  );
};

export default ReviewTools;

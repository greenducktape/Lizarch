import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { ColorPalette } from '../constants';

interface Book {
  id: number;
  name: string;
  testament: string;
  chapter_count: number;
  ordinal: number;
  start_ordinal: number;
  verse_count: number;
}

interface CrossReference {
  source: number;
  target: number;
  strength: number;
  description?: string;
}

interface Chapter {
  book_id: number;
  chapter: number;
  start_ordinal: number;
  verse_count: number;
}

interface ArcDiagramProps {
  books: Book[];
  chapters: Chapter[];
  references: CrossReference[];
  onSelectReference: (source: number, target: number) => void;
  selectedBook?: string;
  className?: string;
  palette: ColorPalette;
  theme: 'dark' | 'light';
}

export default function ArcDiagram({ books, chapters, references, onSelectReference, selectedBook, className, palette, theme }: ArcDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // We use a ref to store the current transform to avoid re-renders
  const transformRef = useRef(d3.zoomIdentity);
  const isZooming = useRef(false);
  const frameRef = useRef<number | null>(null);
  
  const [hoveredArc, setHoveredArc] = useState<CrossReference | null>(null);
  const hoveredArcRef = useRef<CrossReference | null>(null);
  
  // Update ref when state changes
  useEffect(() => {
    hoveredArcRef.current = hoveredArc;
  }, [hoveredArc]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const CATEGORIES = useMemo(() => [
    { id: 'pentateuch', name: 'Pentateuch/History', color: palette.colors.pentateuch, start: 1, end: 17 },
    { id: 'poetry', name: 'Poetry/Wisdom', color: palette.colors.poetry, start: 18, end: 22 },
    { id: 'prophets', name: 'Prophets', color: palette.colors.prophets, start: 23, end: 39 },
    { id: 'gospels', name: 'Gospels/Acts', color: palette.colors.gospels, start: 40, end: 44 },
    { id: 'epistles', name: 'Epistles/Revelation', color: palette.colors.epistles, start: 45, end: 66 }
  ], [palette]);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const getRefFromOrdinal = (ordinal: number) => {
    if (!books.length || !chapters.length) return `Ordinal ${ordinal}`;
    const book = books.find(b => ordinal >= b.start_ordinal && ordinal < b.start_ordinal + b.verse_count);
    if (!book) return `Ordinal ${ordinal}`;
    
    const chapter = chapters.find(c => c.book_id === book.id && ordinal >= c.start_ordinal && ordinal < c.start_ordinal + c.verse_count);
    if (!chapter) return `${book.name} (Ord: ${ordinal})`;
    
    const verse = ordinal - chapter.start_ordinal + 1;
    return `${book.name} ${chapter.chapter}:${verse}`;
  };

  // Data Preparation
  const { validRefs, totalUnits, bookNodes, chapterNodes, maxStrength, minStrength } = useMemo(() => {
    if (!books.length) return { validRefs: [], totalUnits: 0, bookNodes: [], chapterNodes: [], maxStrength: 1, minStrength: 0 };

    const totalUnits = books.reduce((acc, b) => acc + b.verse_count, 0);

    // Pre-calculate colors for fast lookup
    const ordinalColors = new Array(totalUnits);
    books.forEach(b => {
      const cat = CATEGORIES.find(c => b.id >= c.start && b.id <= c.end) || CATEGORIES[0];
      for(let i = 0; i < b.verse_count; i++) {
        ordinalColors[b.start_ordinal + i] = cat.color;
      }
    });
    
    // Limit to top 5000 strongest references
    let rawRefs = references
      .filter(r => r.source < totalUnits && r.target < totalUnits)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5000)
      .map(r => ({
        ...r,
        color1: ordinalColors[Math.min(r.source, r.target)] || CATEGORIES[0].color,
        color2: ordinalColors[Math.max(r.source, r.target)] || CATEGORIES[0].color
      }));

    const maxStrength = d3.max(rawRefs, d => d.strength) || 1;
    const minStrength = d3.min(rawRefs, d => d.strength) || 0;

    const validRefs = rawRefs.map(r => {
      const normalizedStrength = (r.strength - minStrength) / (maxStrength - minStrength || 1);
      const strengthBucket = Math.round(normalizedStrength * 4); 
      const baseWidth = 0.2 + normalizedStrength * 1.3;
      const alpha = 0.15 + normalizedStrength * 0.65;
      const minOrdinal = Math.min(r.source, r.target);
      const maxOrdinal = Math.max(r.source, r.target);
      return {
        ...r,
        minOrdinal,
        maxOrdinal,
        normalizedStrength,
        baseWidth,
        alpha,
        renderKey: `${r.color1}_${strengthBucket}`
      };
    }).sort((a, b) => a.renderKey.localeCompare(b.renderKey));

    const bookNodes = books.map(book => ({
      ...book,
      start: book.start_ordinal,
      end: book.start_ordinal + book.verse_count,
      center: book.start_ordinal + book.verse_count / 2
    }));

    const chapterNodes = chapters.map(c => ({
      ...c,
      start: c.start_ordinal,
      end: c.start_ordinal + c.verse_count,
      center: c.start_ordinal + c.verse_count / 2
    }));

    return { validRefs, totalUnits, bookNodes, chapterNodes, maxStrength, minStrength };
  }, [books, chapters, references, CATEGORIES]);

  // Helper to get category color
  const getCategoryForBook = useCallback((bookId: number) => {
    return CATEGORIES.find(c => bookId >= c.start && bookId <= c.end) || CATEGORIES[0];
  }, [CATEGORIES]);

  const getCategoryForOrdinal = useCallback((ordinal: number) => {
    const book = books.find(b => ordinal >= b.start_ordinal && ordinal < b.start_ordinal + b.verse_count);
    return book ? getCategoryForBook(book.id) : CATEGORIES[0];
  }, [books, getCategoryForBook, CATEGORIES]);


  // Main Draw Function
  const draw = useCallback((transform: d3.ZoomTransform) => {
    const canvas = canvasRef.current;
    const hiddenCanvas = hiddenCanvasRef.current;
    const svg = svgRef.current;
    
    if (!canvas || !hiddenCanvas || !svg || dimensions.width === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 50, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const ctx = canvas.getContext('2d', { alpha: true });
    const hiddenCtx = hiddenCanvas.getContext('2d', { alpha: false });
    
    if (!ctx || !hiddenCtx) return;

    // Fast math instead of d3 scales
    const k = transform.k;
    const tx = transform.x;
    const scaleFactor = totalUnits > 0 ? innerWidth / totalUnits : 0;
    
    // Pre-calculate common values
    const scaledFactor = scaleFactor * k;
    const getX = (val: number) => val * scaledFactor + tx;

    // --- CANVAS DRAWING (Arcs) ---
    const dpr = window.devicePixelRatio || 1;
    
    // Reset transform to identity before clearing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply scaling for DPR and then the zoom transform
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(margin.left, margin.top);

    // Only update hidden canvas when NOT zooming
    if (!isZooming.current) {
      hiddenCtx.setTransform(1, 0, 0, 1, 0, 0);
      hiddenCtx.fillStyle = '#000000';
      hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
      hiddenCtx.translate(margin.left, margin.top);
    }

    ctx.lineCap = 'round';
    
    // Pre-calculate line widths and alpha based on zoom level
    // When zooming in, we make the lines slightly thinner so they don't clump,
    // but we keep the alpha high enough so they remain clearly visible.
    const zoomWidthMultiplier = Math.max(0.4, 1 / Math.pow(k, 0.3));
    const zoomAlphaMultiplier = 1.0; // Maintain original opacity
    const y = innerHeight - 20;

    let currentKey = '';

    for (let i = 0; i < validRefs.length; i++) {
      const d = validRefs[i];
      const startX = getX(d.minOrdinal);
      const endX = getX(d.maxOrdinal);
      
      // Strict culling
      if (endX < -100 || startX > width + 100) continue;
      
      const widthX = endX - startX;
      if (widthX < 0.5) continue;

      if (d.renderKey !== currentKey) {
        if (currentKey !== '') {
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.strokeStyle = d.color1;
        ctx.lineWidth = d.baseWidth * zoomWidthMultiplier;
        ctx.globalAlpha = d.alpha * zoomAlphaMultiplier;
        currentKey = d.renderKey;
      }

      const radiusX = widthX / 2;
      const radiusY = Math.min(radiusX, innerHeight - 40);
      const centerX = startX + radiusX;

      if (radiusX > 0 && radiusY > 0) {
        ctx.moveTo(startX, y);
        ctx.ellipse(centerX, y, radiusX, radiusY, 0, Math.PI, 0, false);
      } else {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
    }

    if (currentKey !== '') {
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Draw hidden arcs only when not zooming
    if (!isZooming.current) {
      hiddenCtx.lineCap = 'round';
      for (let i = 0; i < validRefs.length; i++) {
        const d = validRefs[i];
        const startX = getX(d.minOrdinal);
        const endX = getX(d.maxOrdinal);
        
        if (endX < -100 || startX > width + 100) continue;
        
        const widthX = endX - startX;
        if (widthX < 0.5) continue;

        const radiusX = widthX / 2;
        const radiusY = Math.min(radiusX, innerHeight - 40);
        const centerX = startX + radiusX;

        const id = i + 1;
        const r = (id & 0xff0000) >> 16;
        const g = (id & 0x00ff00) >> 8;
        const b = (id & 0x0000ff);
        
        hiddenCtx.beginPath();
        if (radiusX > 0 && radiusY > 0) {
          hiddenCtx.moveTo(startX, y);
          hiddenCtx.ellipse(centerX, y, radiusX, radiusY, 0, Math.PI, 0, false);
        } else {
          hiddenCtx.moveTo(startX, y);
          hiddenCtx.lineTo(endX, y);
        }
        
        hiddenCtx.strokeStyle = `rgb(${r},${g},${b})`;
        hiddenCtx.lineWidth = Math.max(20, d.baseWidth * zoomWidthMultiplier * 6);
        hiddenCtx.stroke();
      }
    }

    // --- CANVAS DRAWING (Books & Chapters) ---
    const isLight = theme === 'light';
    const bgColor = isLight ? "#FDFBF7" : "#0A0A0A";
    const textColor = isLight ? "#475569" : "#64748b";
    const highlightColor = isLight ? "#000000" : "#ffffff";

    const maxVerseCount = Math.max(...chapterNodes.map((d: any) => d.verse_count), 1);
    const chapterHeightScale = d3.scaleLinear()
      .domain([0, maxVerseCount])
      .range([0, 15]);

    // Draw Chapters
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Batch chapter lines
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    chapterNodes.forEach((d: any) => {
      const startX = getX(d.start);
      const endX = getX(d.end);
      const width = endX - startX;
      
      // Culling
      if (endX < 0 || startX > innerWidth) return;

      if (width > 2) {
        ctx.moveTo(startX, innerHeight - 8);
        ctx.lineTo(startX, innerHeight - 8 + chapterHeightScale(d.verse_count));
      }
    });
    ctx.stroke();

    // Draw chapter texts
    ctx.globalAlpha = 1;
    ctx.fillStyle = textColor;
    ctx.font = '8px sans-serif';
    chapterNodes.forEach((d: any) => {
      const startX = getX(d.start);
      const endX = getX(d.end);
      const width = endX - startX;
      
      if (endX < 0 || startX > innerWidth) return;

      if (width > 20) {
        ctx.fillText(d.chapter.toString(), getX(d.center), innerHeight + 5);
      }
    });

    // Draw Books
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = bgColor;
    
    bookNodes.forEach((d: any) => {
      const startX = getX(d.start);
      const endX = getX(d.end);
      const width = Math.max(1, endX - startX);
      
      // Culling
      if (endX < 0 || startX > innerWidth) return;

      const isSelected = selectedBook && selectedBook !== 'ALL' && d.name === selectedBook;
      ctx.fillStyle = isSelected ? highlightColor : getCategoryForBook(d.id).color;
      
      ctx.fillRect(startX, innerHeight - 20, width, 10);
      ctx.strokeRect(startX, innerHeight - 20, width, 10);

      if (isSelected || width > Math.max(40, d.name.length * 7)) {
        ctx.fillStyle = isSelected ? highlightColor : getCategoryForBook(d.id).color;
        ctx.font = isSelected ? 'bold 10px sans-serif' : '10px sans-serif';
        ctx.fillText(d.name, getX(d.center), innerHeight - 8);
      }
    });

  }, [dimensions, totalUnits, validRefs, maxStrength, minStrength, theme, selectedBook, bookNodes, chapterNodes, getCategoryForBook]);


  // Initialize SVG Elements (One-time setup per dimension change)
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 50, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const zoomGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add a transparent rect to catch zoom events
    zoomGroup.append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "transparent");

    // Initial Draw
    draw(transformRef.current);

    // Setup Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [width, height]])
      .on("start", () => {
        isZooming.current = true;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
        }
        
        frameRef.current = requestAnimationFrame(() => {
          draw(transformRef.current);
          drawHover(transformRef.current);
          frameRef.current = null;
        });
      })
      .on("end", () => {
        isZooming.current = false;
        
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
        }
        
        frameRef.current = requestAnimationFrame(() => {
          draw(transformRef.current);
          drawHover(transformRef.current);
          frameRef.current = null;
        });
      });

    svg.call(zoom);
    // Restore transform state if it exists (e.g. after resize)
    svg.call(zoom.transform as any, transformRef.current);

  }, [dimensions, bookNodes, chapterNodes, theme, selectedBook, getCategoryForBook, draw]);

  const drawHover = useCallback((transform: d3.ZoomTransform) => {
    const hoverCanvas = hoverCanvasRef.current;
    if (!hoverCanvas || dimensions.width === 0) return;

    const ctx = hoverCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);

    const d = hoveredArcRef.current;
    if (!d) return;

    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 50, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(margin.left, margin.top);

    const k = transform.k;
    const tx = transform.x;
    const scaleFactor = totalUnits > 0 ? innerWidth / totalUnits : 0;
    const getX = (val: number) => val * scaleFactor * k + tx;

    const widthScale = d3.scaleLinear()
      .domain([minStrength, maxStrength])
      .range([0.2, 1.5]);

    const startX = getX((d as any).minOrdinal);
    const endX = getX((d as any).maxOrdinal);
    
    // Culling
    if (endX < -100 || startX > width + 100) return;

    const widthX = endX - startX;
    const radiusX = widthX / 2;
    const radiusY = Math.min(radiusX, innerHeight - 40);
    const centerX = startX + radiusX;
    const y = innerHeight - 20;

    ctx.lineCap = 'round';
    ctx.beginPath();
    if (radiusX > 0 && radiusY > 0) {
      ctx.moveTo(startX, y);
      ctx.ellipse(centerX, y, radiusX, radiusY, 0, Math.PI, 0, false);
    } else {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }

    if ((d as any).color1 === (d as any).color2) {
      ctx.strokeStyle = (d as any).color1;
    } else {
      const grad = ctx.createLinearGradient(startX, 0, endX, 0);
      grad.addColorStop(0, (d as any).color1);
      grad.addColorStop(1, (d as any).color2);
      ctx.strokeStyle = grad;
    }

    ctx.lineWidth = widthScale(d.strength) * 2 * Math.min(2, 1 + (transform.k - 1) * 0.1);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';

    ctx.stroke();
  }, [dimensions, totalUnits, minStrength, maxStrength, theme, getCategoryForOrdinal]);

  // Re-draw when hover changes (for highlighting)
  useEffect(() => {
    drawHover(transformRef.current);
  }, [drawHover, hoveredArc]);

  // Canvas Setup (Resize)
  useEffect(() => {
    const canvas = canvasRef.current;
    const hiddenCanvas = hiddenCanvasRef.current;
    const hoverCanvas = hoverCanvasRef.current;
    if (!canvas || !hiddenCanvas || !hoverCanvas || dimensions.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    
    hoverCanvas.width = dimensions.width * dpr;
    hoverCanvas.height = dimensions.height * dpr;
    hoverCanvas.style.width = `${dimensions.width}px`;
    hoverCanvas.style.height = `${dimensions.height}px`;
    
    hiddenCanvas.width = dimensions.width;
    hiddenCanvas.height = dimensions.height;
    
    // Redraw after resize
    draw(transformRef.current);
  }, [dimensions, draw]);

  // Interaction Handlers
  const lastMoveTime = useRef(0);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isZooming.current) return; // Skip expensive hit detection while panning/zooming
    
    const now = performance.now();
    if (now - lastMoveTime.current < 16) return; // ~60fps throttle
    lastMoveTime.current = now;

    const hiddenCanvas = hiddenCanvasRef.current;
    if (!hiddenCanvas) return;

    const rect = hiddenCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = hiddenCanvas.getContext('2d');
    if (!ctx) return;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    
    // Check if not black (0,0,0) - assuming black is background
    if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) {
      if (hoveredArc) setHoveredArc(null);
      return;
    }

    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    const index = id - 1;
    
    if (index >= 0 && index < validRefs.length) {
      if (hoveredArc !== validRefs[index]) {
        setHoveredArc(validRefs[index]);
      }
    } else {
      if (hoveredArc) setHoveredArc(null);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hoveredArc) {
      onSelectReference(hoveredArc.source, hoveredArc.target);
      return;
    }

    // Fallback for touch or if hover didn't trigger
    const hiddenCanvas = hiddenCanvasRef.current;
    if (!hiddenCanvas) return;

    const rect = hiddenCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = hiddenCanvas.getContext('2d');
    if (!ctx) return;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    
    // Check if not black (0,0,0)
    if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) return;

    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    const index = id - 1;
    
    if (index >= 0 && index < validRefs.length) {
      const ref = validRefs[index];
      onSelectReference(ref.source, ref.target);
    }
  };

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .translateExtent([[0, 0], [dimensions.width, dimensions.height]])
      .extent([[0, 0], [dimensions.width, dimensions.height]]);

    svg.transition().duration(750).call(zoom.transform as any, d3.zoomIdentity);
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      {/* Canvas Layer */}
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      
      {/* Hover Canvas Layer */}
      <canvas 
        ref={hoverCanvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      
      {/* Hidden Canvas for Hit Detection */}
      <canvas 
        ref={hiddenCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-0 invisible"
      />

      {/* SVG Layer (Interactive) */}
      <svg 
        ref={svgRef} 
        width={dimensions.width} 
        height={dimensions.height} 
        className="absolute top-0 left-0 w-full h-full cursor-move touch-none"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => setHoveredArc(null)}
      />
      
      {hoveredArc && (
        <div className={`absolute top-4 left-4 max-w-[200px] md:max-w-xs backdrop-blur border p-3 rounded-lg text-xs pointer-events-none shadow-xl z-10 ${theme === 'light' ? 'bg-white/90 border-slate-200 text-slate-800' : 'bg-slate-900/90 border-slate-700 text-slate-200'}`}>
          <div className={`font-mono mb-1 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>
            {hoveredArc.description ? 'Prophecy Fulfillment' : 'Connection Found'}
          </div>
          {hoveredArc.description && (
            <div className="mb-2 font-medium italic border-l-2 border-emerald-500 pl-2 py-1 bg-emerald-500/10 rounded-r">
              {hoveredArc.description}
            </div>
          )}
          <div>Source: {getRefFromOrdinal(hoveredArc.source)}</div>
          <div>Target: {getRefFromOrdinal(hoveredArc.target)}</div>
          <div className={`mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Click to compare passages</div>
        </div>
      )}
      
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
      </div>
    </div>
  );
}

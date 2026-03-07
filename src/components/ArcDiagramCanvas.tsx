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
    
    // Limit to top 5000 strongest references
    const validRefs = references
      .filter(r => r.source < totalUnits && r.target < totalUnits)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5000);

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

    const maxStrength = d3.max(validRefs, d => d.strength) || 1;
    const minStrength = d3.min(validRefs, d => d.strength) || 0;

    return { validRefs, totalUnits, bookNodes, chapterNodes, maxStrength, minStrength };
  }, [books, chapters, references]);

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

    // --- CANVAS DRAWING (Arcs) ---
    const dpr = window.devicePixelRatio || 1;
    // Reset transform to identity before clearing to ensure full clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    hiddenCtx.setTransform(1, 0, 0, 1, 0, 0);
    hiddenCtx.fillStyle = '#000000';
    hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // Apply scaling for DPR and then the zoom transform
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(margin.left, margin.top);
    // hiddenCtx doesn't use DPR scaling as it's 1:1 with CSS pixels
    hiddenCtx.translate(margin.left, margin.top);

    // Scales
    const x = d3.scaleLinear()
      .domain([0, totalUnits])
      .range([0, innerWidth]);

    const newX = transform.rescaleX(x);

    const opacityScale = d3.scaleLinear()
      .domain([minStrength, maxStrength])
      .range([0.15, 0.8]);
      
    const widthScale = d3.scaleLinear()
      .domain([minStrength, maxStrength])
      .range([0.2, 1.5]);

    ctx.lineCap = 'round';

    validRefs.forEach((d, i) => {
      const start = newX(d.source);
      const end = newX(d.target);
      
      // Culling
      if (Math.max(start, end) < -100 || Math.min(start, end) > width + 100) return;

      const h = Math.abs(end - start) / 2;
      const constrainedHeight = Math.min(h, innerHeight - 40);
      const y = innerHeight - 20;
      const centerX = (start + end) / 2;
      const radiusX = Math.abs(end - start) / 2;
      const radiusY = constrainedHeight;

      // Draw visible arc
      ctx.beginPath();
      try {
        ctx.ellipse(centerX, y, radiusX, radiusY, 0, Math.PI, 0, false);
      } catch (e) {
        ctx.moveTo(start, y);
        ctx.quadraticCurveTo(centerX, y - radiusY * 2, end, y);
      }

      const cat1 = getCategoryForOrdinal(Math.min(d.source, d.target));
      const cat2 = getCategoryForOrdinal(Math.max(d.source, d.target));
      
      if (cat1.id === cat2.id) {
        ctx.strokeStyle = cat1.color;
      } else {
        const grad = ctx.createLinearGradient(start, 0, end, 0);
        grad.addColorStop(0, cat1.color);
        grad.addColorStop(1, cat2.color);
        ctx.strokeStyle = grad;
      }

      ctx.lineWidth = widthScale(d.strength) * Math.min(2, 1 + (transform.k - 1) * 0.1);
      ctx.globalAlpha = opacityScale(d.strength);
      ctx.shadowBlur = 0;

      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw hidden arc
      // Skip if zooming for performance
      if (isZooming.current) return;

      // Color encoding: index + 1
      const id = i + 1;
      const r = (id & 0xff0000) >> 16;
      const g = (id & 0x00ff00) >> 8;
      const b = (id & 0x0000ff);
      const colorKey = `rgb(${r},${g},${b})`;
      
      hiddenCtx.beginPath();
      try {
        hiddenCtx.ellipse(centerX, y, radiusX, radiusY, 0, Math.PI, 0, false);
      } catch (e) {
        hiddenCtx.moveTo(start, y);
        hiddenCtx.quadraticCurveTo(centerX, y - radiusY * 2, end, y);
      }
      
      hiddenCtx.strokeStyle = colorKey;
      hiddenCtx.lineWidth = Math.max(10, widthScale(d.strength) * 4);
      hiddenCtx.stroke();
    });

    // --- SVG UPDATES (Books/Chapters) ---
    const d3Svg = d3.select(svg);
    
    // Update Books
    d3Svg.selectAll(".book-rect")
        .attr("x", (d: any) => newX(d.start))
        .attr("width", (d: any) => Math.max(1, newX(d.end) - newX(d.start)));

    // Update Book Labels
    d3Svg.selectAll(".book-label")
        .attr("x", (d: any) => newX(d.center))
        .style("opacity", (d: any) => {
            if (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) return 1;
            return (newX(d.end) - newX(d.start)) > 30 ? 1 : 0;
        });

    // Update Chapters
    d3Svg.selectAll(".chapter-line")
        .attr("x1", (d: any) => newX(d.start))
        .attr("x2", (d: any) => newX(d.start))
        .style("opacity", (d: any) => (newX(d.end) - newX(d.start)) > 2 ? 0.3 : 0);

    d3Svg.selectAll(".chapter-label")
        .attr("x", (d: any) => newX(d.center))
        .style("opacity", (d: any) => (newX(d.end) - newX(d.start)) > 20 ? 1 : 0);

  }, [dimensions, totalUnits, validRefs, maxStrength, minStrength, theme, selectedBook, getCategoryForOrdinal]);


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

    const x = d3.scaleLinear()
      .domain([0, totalUnits])
      .range([0, innerWidth]);

    // Draw Books
    const isLight = theme === 'light';
    const bgColor = isLight ? "#f8fafc" : "#0f172a";
    const textColor = isLight ? "#475569" : "#64748b";
    const highlightColor = isLight ? "#000000" : "#ffffff";

    const bookGroup = zoomGroup.append("g").attr("class", "books")
        .attr("transform", `translate(0, ${innerHeight - 20})`);

    bookGroup.selectAll("rect")
      .data(bookNodes)
      .enter()
      .append("rect")
      .attr("class", "book-rect")
      .attr("y", 0)
      .attr("height", 10)
      .attr("fill", (d: any) => {
        if (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) return highlightColor;
        return getCategoryForBook(d.id).color;
      })
      .attr("stroke", bgColor)
      .attr("stroke-width", 0.5);

    // Labels
    const labelGroup = zoomGroup.append("g").attr("class", "labels")
        .attr("transform", `translate(0, ${innerHeight + 10})`);

    labelGroup.selectAll("text")
      .data(bookNodes)
      .enter()
      .append("text")
      .attr("class", "book-label")
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .text((d: any) => d.name)
      .attr("font-size", "10px")
      .attr("fill", (d: any) => (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) ? highlightColor : getCategoryForBook(d.id).color)
      .attr("font-weight", (d: any) => (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) ? "bold" : "normal")
      .style("pointer-events", "none");

    // Chapters
    const chapterGroup = zoomGroup.append("g").attr("class", "chapters")
        .attr("transform", `translate(0, ${innerHeight - 20})`);

    const maxVerseCount = Math.max(...chapterNodes.map((d: any) => d.verse_count), 1);
    const chapterHeightScale = d3.scaleLinear()
      .domain([0, maxVerseCount])
      .range([0, 30]);

    chapterGroup.selectAll("line")
      .data(chapterNodes)
      .enter()
      .append("line")
      .attr("class", "chapter-line")
      .attr("y1", 10)
      .attr("y2", (d: any) => 10 + chapterHeightScale(d.verse_count))
      .attr("stroke", textColor)
      .attr("stroke-width", 0.5)
      .style("opacity", 0.3);

    chapterGroup.selectAll("text")
      .data(chapterNodes)
      .enter()
      .append("text")
      .attr("class", "chapter-label")
      .attr("y", 45)
      .attr("text-anchor", "middle")
      .text((d: any) => d.chapter)
      .attr("font-size", "8px")
      .attr("fill", textColor)
      .style("pointer-events", "none");

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
        draw(event.transform);
        drawHover(event.transform);
      })
      .on("end", () => {
        isZooming.current = false;
        draw(transformRef.current);
        drawHover(transformRef.current);
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

    const x = d3.scaleLinear()
      .domain([0, totalUnits])
      .range([0, innerWidth]);
    const newX = transform.rescaleX(x);

    const widthScale = d3.scaleLinear()
      .domain([minStrength, maxStrength])
      .range([0.2, 1.5]);

    const start = newX(d.source);
    const end = newX(d.target);
    
    // Culling
    if (Math.max(start, end) < -100 || Math.min(start, end) > width + 100) return;

    const h = Math.abs(end - start) / 2;
    const constrainedHeight = Math.min(h, innerHeight - 40);
    const y = innerHeight - 20;
    const centerX = (start + end) / 2;
    const radiusX = Math.abs(end - start) / 2;
    const radiusY = constrainedHeight;

    ctx.lineCap = 'round';
    ctx.beginPath();
    try {
      ctx.ellipse(centerX, y, radiusX, radiusY, 0, Math.PI, 0, false);
    } catch (e) {
      ctx.moveTo(start, y);
      ctx.quadraticCurveTo(centerX, y - radiusY * 2, end, y);
    }

    const cat1 = getCategoryForOrdinal(Math.min(d.source, d.target));
    const cat2 = getCategoryForOrdinal(Math.max(d.source, d.target));
    
    if (cat1.id === cat2.id) {
      ctx.strokeStyle = cat1.color;
    } else {
      const grad = ctx.createLinearGradient(start, 0, end, 0);
      grad.addColorStop(0, cat1.color);
      grad.addColorStop(1, cat2.color);
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
    <div ref={containerRef} className={`relative w-full h-full rounded-xl overflow-hidden shadow-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'} ${className}`}>
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
        <span className={`text-[10px] md:text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-600'}`}>Scroll/Pinch to Zoom • Drag to Pan</span>
        <button 
            onClick={handleResetZoom}
            className={`pointer-events-auto px-4 py-2 md:px-3 md:py-1 text-xs rounded border transition-colors shadow-lg ${theme === 'light' ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}
        >
            Reset View
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ColorPalette, PALETTES } from '../constants';

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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredArc, setHoveredArc] = useState<CrossReference | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const CATEGORIES = [
    { id: 'pentateuch', name: 'Pentateuch/History', color: palette.colors.pentateuch, start: 1, end: 17 },
    { id: 'poetry', name: 'Poetry/Wisdom', color: palette.colors.poetry, start: 18, end: 22 },
    { id: 'prophets', name: 'Prophets', color: palette.colors.prophets, start: 23, end: 39 },
    { id: 'gospels', name: 'Gospels/Acts', color: palette.colors.gospels, start: 40, end: 44 },
    { id: 'epistles', name: 'Epistles/Revelation', color: palette.colors.epistles, start: 45, end: 66 }
  ];

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

  // Draw Chart
  useEffect(() => {
    if (!svgRef.current || books.length === 0 || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 50, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create a group for the zoomable content
    const zoomGroup = svg.append("g")
        .attr("class", "zoom-layer")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define gradients for cross-category arcs
    const defs = svg.append("defs");
    
    // Glow filter for strong connections
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
      
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "2")
      .attr("result", "blur");
      
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    CATEGORIES.forEach(c1 => {
      CATEGORIES.forEach(c2 => {
        if (c1.id !== c2.id) {
          const gradient = defs.append("linearGradient")
            .attr("id", `grad-${c1.id}-${c2.id}`)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
          
          gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", c1.color);
            
          gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", c2.color);
        }
      });
    });

    const getCategoryForBook = (bookId: number) => {
      return CATEGORIES.find(c => bookId >= c.start && bookId <= c.end) || CATEGORIES[0];
    };

    const getCategoryForOrdinal = (ordinal: number) => {
      // Binary search could be faster, but linear is fine for 66 items
      const book = books.find(b => ordinal >= b.start_ordinal && ordinal < b.start_ordinal + b.verse_count);
      return book ? getCategoryForBook(book.id) : CATEGORIES[0];
    };

    // Calculate total "units" (approx verses)
    const totalUnits = books.reduce((acc, b) => acc + b.verse_count, 0);

    // X Scale
    const x = d3.scaleLinear()
      .domain([0, totalUnits])
      .range([0, innerWidth]);

    // Draw Book Nodes/Labels
    const bookNodes = books.map(book => {
      const start = book.start_ordinal;
      const size = book.verse_count;
      return { ...book, start, end: start + size, center: start + size / 2 };
    });

    // Draw Book Blocks (Timeline)
    const isLight = theme === 'light';
    const bgColor = isLight ? "#f8fafc" : "#0f172a";
    const textColor = isLight ? "#475569" : "#64748b";
    const highlightColor = isLight ? "#000000" : "#ffffff";
    const strokeColor = isLight ? "#e2e8f0" : "#1e293b";

    const bookGroup = zoomGroup.append("g").attr("class", "books")
        .attr("transform", `translate(0, ${innerHeight - 20})`);

    bookGroup.selectAll("rect")
      .data(bookNodes)
      .enter()
      .append("rect")
      .attr("x", d => x(d.start))
      .attr("y", 0)
      .attr("width", d => Math.max(1, x(d.end) - x(d.start))) // Ensure at least 1px
      .attr("height", 10)
      .attr("fill", d => {
        if (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) return highlightColor; // Highlight for selected
        return getCategoryForBook(d.id).color;
      })
      .attr("stroke", bgColor)
      .attr("stroke-width", 0.5)
      .on("mouseover", function(event, d) {
          d3.select(this).attr("fill", highlightColor);
      })
      .on("mouseout", function(event, d) {
          d3.select(this).attr("fill", () => {
            if (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) return highlightColor;
            return getCategoryForBook(d.id).color;
          });
      });

    // Draw Book Labels
    // We use a separate group for labels to control their visibility based on zoom
    const labelGroup = zoomGroup.append("g").attr("class", "labels")
        .attr("transform", `translate(0, ${innerHeight + 10})`);

    const labels = labelGroup.selectAll("text")
      .data(bookNodes)
      .enter()
      .append("text")
      .attr("x", d => x(d.center))
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .text(d => d.name)
      .attr("font-size", "10px")
      .attr("fill", d => (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) ? highlightColor : getCategoryForBook(d.id).color)
      .attr("font-weight", d => (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) ? "bold" : "normal")
      .style("pointer-events", "none")
      .style("opacity", d => {
        if (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) return 1; // Always show selected book label
        return (x(d.end) - x(d.start)) > 30 ? 1 : 0;
      });

    // Draw Chapters
    const chapterNodes = chapters.map(c => {
      const start = c.start_ordinal;
      const size = c.verse_count;
      return { ...c, start, end: start + size, center: start + size / 2 };
    });

    const chapterGroup = zoomGroup.append("g").attr("class", "chapters")
        .attr("transform", `translate(0, ${innerHeight - 20})`);

    const chapterLines = chapterGroup.selectAll("line")
      .data(chapterNodes)
      .enter()
      .append("line")
      .attr("x1", d => x(d.start))
      .attr("x2", d => x(d.start))
      .attr("y1", 10)
      .attr("y2", 15)
      .attr("stroke", bgColor)
      .attr("stroke-width", 0.5)
      .style("opacity", d => (x(d.end) - x(d.start)) > 10 ? 0.5 : 0);

    const chapterLabels = chapterGroup.selectAll("text")
      .data(chapterNodes)
      .enter()
      .append("text")
      .attr("x", d => x(d.center))
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .text(d => d.chapter)
      .attr("font-size", "8px")
      .attr("fill", textColor)
      .style("pointer-events", "none")
      .style("opacity", d => (x(d.end) - x(d.start)) > 15 ? 1 : 0);

    // Draw Arcs
    // Limit to top 5000 strongest references to prevent DOM overload and improve performance
    const validRefs = references
      .filter(r => r.source < totalUnits && r.target < totalUnits)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5000);
      
    const arcsGroup = zoomGroup.append("g").attr("class", "arcs");

    const maxStrength = d3.max(validRefs, d => d.strength) || 1;
    const minStrength = d3.min(validRefs, d => d.strength) || 0;
    
    const opacityScale = d3.scaleLinear()
      .domain([minStrength, maxStrength])
      .range([0.15, 0.8]); // Thin, semi-transparent to glowing
      
    const widthScale = d3.scaleLinear()
      .domain([minStrength, maxStrength])
      .range([0.5, 2.5]); // Thin to thicker neon lines

    arcsGroup.selectAll("path")
      .data(validRefs)
      .enter()
      .append("path")
      .attr("d", d => {
        const start = x(d.source);
        const end = x(d.target);
        
        if (Math.max(start, end) < 0 || Math.min(start, end) > width) {
            return "";
        }
        
        const h = Math.abs(end - start) / 2;
        const constrainedHeight = Math.min(h, innerHeight - 40); 
        
        return `M ${start}, ${innerHeight - 20} 
                A ${Math.abs(end - start)/2}, ${constrainedHeight} 0 0 ${start < end ? 1 : 0} ${end}, ${innerHeight - 20}`;
      })
      .style("fill", "none")
      .style("stroke", d => {
         const cat1 = getCategoryForOrdinal(Math.min(d.source, d.target));
         const cat2 = getCategoryForOrdinal(Math.max(d.source, d.target));
         return cat1.id === cat2.id ? cat1.color : `url(#grad-${cat1.id}-${cat2.id})`;
      })
      .style("stroke-width", d => widthScale(d.strength))
      .style("opacity", d => opacityScale(d.strength))
      .style("filter", d => d.strength > (maxStrength + minStrength) / 2 ? "url(#glow)" : "none")
      .on("mouseover", function(event, d) {
        d3.select(this)
            .style("stroke", highlightColor)
            .style("stroke-width", widthScale(d.strength) * 2)
            .style("opacity", 1)
            .style("filter", "url(#glow)")
            .raise(); // Bring to front
        setHoveredArc(d);
      })
      .on("mouseout", function(event, d) {
        const currentTransform = d3.zoomTransform(svg.node() as Element);
        const cat1 = getCategoryForOrdinal(Math.min(d.source, d.target));
        const cat2 = getCategoryForOrdinal(Math.max(d.source, d.target));
        const strokeColor = cat1.id === cat2.id ? cat1.color : `url(#grad-${cat1.id}-${cat2.id})`;
        
        d3.select(this)
            .style("stroke", strokeColor)
            .style("stroke-width", widthScale(d.strength) * Math.min(2, 1 + (currentTransform.k - 1) * 0.1))
            .style("opacity", opacityScale(d.strength))
            .style("filter", d.strength > (maxStrength + minStrength) / 2 ? "url(#glow)" : "none");
        setHoveredArc(null);
      })
      .on("click", (event, d) => {
          onSelectReference(d.source, d.target);
      });

    // Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20]) // Zoom up to 20x
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [width, height]])
      .on("zoom", (event) => {
        const transform = event.transform;
        
        // Rescale X axis
        const newX = transform.rescaleX(x);
        
        // Update Books
        bookGroup.selectAll("rect")
            .attr("x", (d: any) => newX(d.start))
            .attr("width", (d: any) => Math.max(1, newX(d.end) - newX(d.start)));

        // Update Labels (show more as we zoom in)
        labels
            .attr("x", (d: any) => newX(d.center))
            .style("opacity", (d: any) => {
              if (selectedBook && selectedBook !== 'ALL' && d.name === selectedBook) return 1;
              return (newX(d.end) - newX(d.start)) > 40 ? 1 : 0;
            });

        // Update Chapters
        chapterLines
            .attr("x1", (d: any) => newX(d.start))
            .attr("x2", (d: any) => newX(d.start))
            .style("opacity", (d: any) => (newX(d.end) - newX(d.start)) > 10 ? 0.5 : 0);

        chapterLabels
            .attr("x", (d: any) => newX(d.center))
            .style("opacity", (d: any) => (newX(d.end) - newX(d.start)) > 15 ? 1 : 0);

        // Update Arcs
        // Culling off-screen arcs drastically improves performance
        arcsGroup.selectAll("path")
            .attr("d", (d: any) => {
                const start = newX(d.source);
                const end = newX(d.target);
                
                // Culling: if both ends are off-screen to the left, or both to the right
                if (Math.max(start, end) < 0 || Math.min(start, end) > width) {
                    return ""; // Don't draw off-screen arcs
                }

                const h = Math.abs(end - start) / 2;
                const constrainedHeight = Math.min(h, innerHeight - 40);
                return `M ${start}, ${innerHeight - 20} 
                        A ${Math.abs(end - start)/2}, ${constrainedHeight} 0 0 ${start < end ? 1 : 0} ${end}, ${innerHeight - 20}`;
            })
            .style("stroke-width", (d: any) => widthScale(d.strength) * Math.min(2, 1 + (transform.k - 1) * 0.1)); // Make lines thicker when zoomed in
      });

    svg.call(zoom);

    // Expose reset function via a custom event or ref if needed, 
    // but for now we'll just add a button inside the component.
    
    // Cleanup
    return () => {
      svg.on(".zoom", null);
    };

  }, [books, references, dimensions]);

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // We need to re-create the zoom behavior to call transform on it
    // Ideally we'd store the zoom instance in a ref, but re-creating it with same config works for reset
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .translateExtent([[0, 0], [dimensions.width, dimensions.height]])
      .extent([[0, 0], [dimensions.width, dimensions.height]]);

    svg.transition().duration(750).call(zoom.transform as any, d3.zoomIdentity);
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full rounded-xl overflow-hidden shadow-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'} ${className}`}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full cursor-move" />
      
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

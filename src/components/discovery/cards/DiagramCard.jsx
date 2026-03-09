import React, { useEffect, useRef, useState, useId } from 'react';
import { Maximize2, ZoomIn, ZoomOut, X } from 'lucide-react';
import CardShell from './CardShell';

export default function DiagramCard({ title, icon, content, onRefine, onReset, isReadOnly, isEdited, span }) {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const uniqueId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!content) return;
    let cancelled = false;

    const raw = content.replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '').trim();
    if (!raw) return;

    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        themeVariables: {
          primaryColor: '#16A34A',
          primaryTextColor: '#fff',
          lineColor: '#6B8F7A',
        },
      });
      return mermaid.render(`mermaid-${uniqueId}`, raw);
    }).then(({ svg: renderedSvg }) => {
      if (!cancelled) {
        setSvg(renderedSvg);
        setError(null);
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Failed to render diagram');
        setSvg('');
      }
    });

    return () => { cancelled = true; };
  }, [content, uniqueId]);

  const diagramContent = (
    <div
      ref={containerRef}
      className="flex items-center justify-center overflow-auto"
      style={{ transform: `scale(${zoom})`, transformOrigin: 'center top' }}
    >
      {error ? (
        <div className="text-xs text-red-500 p-4 bg-red-500/10 rounded-lg">
          <p className="font-medium mb-1">Diagram render error</p>
          <pre className="whitespace-pre-wrap text-[11px]">{content}</pre>
        </div>
      ) : svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} className="[&_svg]:max-w-full" />
      ) : (
        <div className="text-sm text-muted-foreground p-8">Loading diagram...</div>
      )}
    </div>
  );

  return (
    <>
      <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
        <div className="flex items-center gap-1 mb-2 justify-end">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground min-w-[2.5rem] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.25))} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setFullscreen(true)} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {diagramContent}
      </CardShell>

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-8">
          <button onClick={() => setFullscreen(false)} className="absolute top-4 end-4 p-2 rounded-lg bg-card border border-border hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
          <div className="w-full h-full overflow-auto flex items-center justify-center">
            {svg ? (
              <div dangerouslySetInnerHTML={{ __html: svg }} className="[&_svg]:max-w-full [&_svg]:max-h-full" />
            ) : (
              <pre className="text-sm text-muted-foreground">{content}</pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}

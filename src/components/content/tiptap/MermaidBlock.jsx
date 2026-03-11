import { useState, useEffect, useRef, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { Pencil, Eye } from 'lucide-react';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

export default function MermaidBlock({ node, updateAttributes }) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(node.attrs.code || '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const renderRef = useRef(null);
  const debounceRef = useRef(null);

  const renderDiagram = useCallback(async (mermaidCode) => {
    if (!mermaidCode?.trim()) {
      setSvg('');
      return;
    }
    try {
      const id = `mermaid-${Date.now()}`;
      const { svg: renderedSvg } = await mermaid.render(id, mermaidCode);
      setSvg(renderedSvg);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    renderDiagram(code);
  }, []);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    updateAttributes({ code: newCode });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => renderDiagram(newCode), 500);
  };

  return (
    <NodeViewWrapper className="my-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between bg-muted px-3 py-1.5">
          <span className="text-caption font-medium text-muted-foreground">Mermaid Diagram</span>
          <button
            onClick={() => setEditing(!editing)}
            className="text-caption flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {editing ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editing ? 'Preview' : 'Edit'}
          </button>
        </div>

        {editing && (
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="w-full bg-card text-foreground font-mono text-sm p-3 border-b border-border resize-y min-h-[80px] focus:outline-none"
            placeholder="graph LR\n  A[Start] --> B[End]"
          />
        )}

        <div className="p-4 bg-card flex justify-center" ref={renderRef}>
          {error ? (
            <p className="text-caption text-danger">{error}</p>
          ) : svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} className="max-w-full overflow-auto" />
          ) : (
            <p className="text-caption text-muted-foreground">Empty diagram</p>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import CardShell from './CardShell';

export default function TextCard({ title, icon, content, onChange, onRefine, onReset, isReadOnly, isEdited, span, prominent }) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editing]);

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
      {editing && !isReadOnly ? (
        <textarea
          ref={textareaRef}
          value={content || ''}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onBlur={() => setEditing(false)}
          className="w-full bg-transparent text-sm text-foreground leading-relaxed resize-none focus:outline-none"
        />
      ) : (
        <div
          onClick={() => !isReadOnly && setEditing(true)}
          className={`text-sm leading-relaxed whitespace-pre-wrap ${isReadOnly ? 'cursor-default' : 'cursor-text hover:bg-muted/30 rounded-lg -m-2 p-2 transition-colors'} ${prominent ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          {content || (isReadOnly ? '—' : 'Click to edit...')}
        </div>
      )}
    </CardShell>
  );
}

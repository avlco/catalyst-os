import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import CardShell from './CardShell';

function parseMarkdownTable(content, columns) {
  if (!content) return { headers: columns || [], rows: [] };
  const lines = content.split('\n').filter(l => l.trim() && !l.match(/^\|?\s*[-:]+/));
  if (lines.length === 0) return { headers: columns || [], rows: [] };

  const parseLine = (line) => line.split('|').map(c => c.trim()).filter(Boolean);
  const headers = columns || parseLine(lines[0]);
  const dataLines = columns ? lines : lines.slice(1);
  const rows = dataLines.map(line => {
    const cells = parseLine(line);
    return headers.map((_, i) => cells[i] || '');
  });

  return { headers, rows };
}

function serializeTable(headers, rows) {
  const h = '| ' + headers.join(' | ') + ' |';
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const r = rows.map(row => '| ' + row.join(' | ') + ' |').join('\n');
  return [h, sep, r].filter(Boolean).join('\n');
}

export default function TableCard({ title, icon, content, columns, onChange, onRefine, onReset, isReadOnly, isEdited, span }) {
  const [editingCell, setEditingCell] = useState(null);
  const { headers, rows } = parseMarkdownTable(content, columns);

  const updateCell = (rowIdx, colIdx, value) => {
    const next = rows.map((r, ri) => ri === rowIdx ? r.map((c, ci) => ci === colIdx ? value : c) : [...r]);
    onChange(serializeTable(headers, next));
  };

  const addRow = () => {
    const newRow = headers.map(() => '');
    onChange(serializeTable(headers, [...rows, newRow]));
    setEditingCell({ row: rows.length, col: 0 });
  };

  const deleteRow = (idx) => {
    onChange(serializeTable(headers, rows.filter((_, i) => i !== idx)));
  };

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h, i) => (
                <th key={i} className="text-start py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
              {!isReadOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/50 group hover:bg-muted/20">
                {row.map((cell, ci) => (
                  <td key={ci} className="py-1.5 px-2">
                    {editingCell?.row === ri && editingCell?.col === ci && !isReadOnly ? (
                      <input
                        autoFocus
                        value={cell}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingCell(null);
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const nextCol = ci + 1 < headers.length ? ci + 1 : 0;
                            const nextRow = nextCol === 0 ? ri + 1 : ri;
                            if (nextRow < rows.length) setEditingCell({ row: nextRow, col: nextCol });
                            else setEditingCell(null);
                          }
                        }}
                        className="w-full bg-transparent text-sm focus:outline-none border-b border-primary/30"
                      />
                    ) : (
                      <span
                        onClick={() => !isReadOnly && setEditingCell({ row: ri, col: ci })}
                        className={`text-sm text-muted-foreground ${!isReadOnly ? 'cursor-text hover:text-foreground' : ''}`}
                      >
                        {cell || '—'}
                      </span>
                    )}
                  </td>
                ))}
                {!isReadOnly && (
                  <td className="py-1.5">
                    <button onClick={() => deleteRow(ri)} className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isReadOnly && (
        <button onClick={addRow} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus className="w-3 h-3" /> Add row
        </button>
      )}
    </CardShell>
  );
}

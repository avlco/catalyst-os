import React, { useState } from 'react';
import { Plus, X, Code2, Database, Cloud, Shield, Globe, Server, Smartphone, Cpu } from 'lucide-react';
import CardShell from './CardShell';

const TECH_ICONS = {
  react: Globe, vue: Globe, angular: Globe, svelte: Globe, next: Globe, nuxt: Globe,
  node: Server, deno: Server, python: Server, java: Server, go: Server, rust: Server,
  postgres: Database, mysql: Database, mongodb: Database, redis: Database, supabase: Database,
  aws: Cloud, gcp: Cloud, azure: Cloud, vercel: Cloud, netlify: Cloud, cloudflare: Cloud,
  docker: Cpu, kubernetes: Cpu,
  oauth: Shield, jwt: Shield, auth0: Shield,
  mobile: Smartphone, ios: Smartphone, android: Smartphone,
};

function parseTechStack(content) {
  if (!content) return [];
  return content.split('\n').filter(l => l.trim()).map(line => {
    const cleaned = line.replace(/^[-•*]\s*/, '').trim();
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx > 0) return { name: cleaned.slice(0, colonIdx).trim(), description: cleaned.slice(colonIdx + 1).trim() };
    return { name: cleaned, description: '' };
  });
}

function serializeTechStack(items) {
  return items.map(i => `- ${i.name}${i.description ? `: ${i.description}` : ''}`).join('\n');
}

function getIcon(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [k, Icon] of Object.entries(TECH_ICONS)) {
    if (key.includes(k)) return Icon;
  }
  return Code2;
}

export default function TechStackCard({ title, icon, content, onChange, onRefine, onReset, isReadOnly, isEdited, span }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const items = parseTechStack(content);

  const remove = (idx) => onChange(serializeTechStack(items.filter((_, i) => i !== idx)));

  const add = () => {
    if (!newName.trim()) return;
    onChange(serializeTechStack([...items, { name: newName.trim(), description: '' }]));
    setNewName('');
    setAdding(false);
  };

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => {
          const TechIcon = getIcon(item.name);
          return (
            <div key={idx} className="group relative flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors" title={item.description}>
              <TechIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-foreground">{item.name}</span>
              {!isReadOnly && (
                <button onClick={() => remove(idx)} className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
        {!isReadOnly && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add</span>
          </button>
        )}
        {adding && (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Technology name"
              className="px-2 py-1.5 text-sm bg-transparent border border-primary/30 rounded-lg focus:outline-none"
            />
            <button onClick={add} className="p-1.5 rounded-lg bg-primary text-primary-foreground">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </CardShell>
  );
}

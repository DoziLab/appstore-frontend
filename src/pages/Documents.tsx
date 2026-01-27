// src/components/Documents.tsx
import { FileText, FileImage, FileArchive, Download, Eye, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import React, { useEffect, useMemo, useState } from 'react';

// gleiche Typisierung & Datenstil wie im Dashboard (nur Fachinhalt anders)
type DocItem = {
  id: string;
  title: string;
  file: string;
  type: 'pdf' | 'image' | 'markdown' | 'other';
  updated?: string;
  tags?: string[];
};

const typeToBadge = (t: DocItem['type']) =>
  t === 'pdf' ? 'bg-red-100 text-red-700' :
  t === 'image' ? 'bg-blue-100 text-blue-700' :
  t === 'markdown' ? 'bg-green-100 text-green-700' :
  'bg-slate-100 text-slate-700';

const typeToIcon = (t: DocItem['type']) =>
  t === 'pdf' ? FileText :
  t === 'image' ? FileImage :
  t === 'markdown' ? FileText :
  FileArchive;

export function Documents() {
  // wie im Dashboard: statische Demo-Daten; später durch fetch('/docs/manifest.json') ersetzen
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    // Falls du sofort echte Inhalte willst, lege public/docs/manifest.json an (siehe unten)
    fetch('/docs/manifest.json')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setDocs)
      .catch(() => {
        // Fallback: Mock-Inhalte, damit die Seite sofort "wie Dashboard" aussieht
        setDocs([
          { id: 'techstack', title: 'Technologiestack', file: '/docs/Technologiestack.pdf', type: 'pdf', updated: '2026-01-03', tags: ['Architektur', 'UML'] },
          { id: 'install', title: 'Installationsanleitung', file: '/docs/Installationsanleitung.pdf', type: 'pdf', updated: '2026-01-02', tags: ['Setup', 'Admin'] },
          { id: 'arch', title: 'Architekturübersicht', file: '/docs/Architektur.png', type: 'image', updated: '2026-01-01', tags: ['Diagramm'] },
        ]);
      });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter(d =>
      d.title.toLowerCase().includes(s) ||
      d.type.toLowerCase().includes(s) ||
      (d.tags ?? []).some(t => t.toLowerCase().includes(s))
    );
  }, [docs, q]);

  // KPIs im selben Karten-Stil wie [Dashboard.tsx](https://bitolagertechnik-my.sharepoint.com/personal/lmo_bito_com/Documents/Microsoft%20Copilot-Chatdateien/Dashboard.tsx?EntityRepresentationId=c451fc17-2023-4ad7-87ab-00a58471cd8f)
  const kpis = [
    { label: 'Dokumente gesamt', value: String(docs.length) },
    { label: 'PDFs', value: String(docs.filter(d => d.type === 'pdf').length) },
    { label: 'Letzte Aktualisierung', value: docs.map(d => d.updated ?? '').sort().slice(-1)[0] || '—' },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header – gleiche Typo & Abstände wie Dashboard */}
      <div className="">
        <h1 className="text-slate-900 mb-2">Dokumentation</h1>
        <p className="text-slate-600">Technische Unterlagen, Architektur & Installationshinweise</p>
      </div>

      {/* Suchfeld + KPIs (optisch an Stats-Grid angelehnt) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="border-slate-200 shadow-sm lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="Suchen (Titel, Typ, Tag)…"
                value={q}
                onChange={e => setQ(e.target.value)}
                aria-label="Dokumente durchsuchen"
              />
            </div>
          </CardContent>
        </Card>

        {kpis.map(k => (
          <Card key={k.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">{k.label}</p>
                  <p className="text-slate-900">{k.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dokument-Karten im selben Card-Stil wie Deployments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Dokumente</CardTitle>
            <CardDescription>Downloads und Anzeige im gleichen Stil wie das Dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filtered.map((d) => {
                const Icon = typeToIcon(d.type);
                return (
                  <div key={d.id} className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="p-3 rounded-lg bg-slate-100 text-slate-700">
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-slate-900 truncate">{d.title}</p>
                        <Badge className={`${typeToBadge(d.type)} hover:${typeToBadge(d.type)}`}>
                          {d.type.toUpperCase()}
                        </Badge>
                        {d.updated && <span className="text-xs text-slate-500">Stand: {d.updated}</span>}
                      </div>
                      {!!(d.tags?.length) && (
                        <p className="text-xs text-slate-500">Tags: {(d.tags ?? []).join(', ')}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={d.file}
                        download
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-slate-900 text-white text-sm"
                        aria-label={`Download ${d.title}`}
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                      {/* Falls Router aktiv ist: interne Anzeige-Seite */}
                      <a
                        href={`/docs/${d.id}`}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-slate-200 text-slate-900 text-sm"
                        title="Anzeigen"
                      >
                        <Eye className="w-4 h-4" />
                        Anzeigen
                      </a>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-slate-500">Keine Treffer.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Seitenleiste (ersetzt „Ressourcenkontingente/Systemnachrichten“) */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Schnellzugriff</CardTitle>
              <CardDescription>Häufig genutzte Unterlagen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {docs.slice(0, 5).map(d => (
                <div key={`quick-${d.id}`} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d.title}</span>
                  <a className="text-slate-700 underline" href={d.file} download>Download</a>
                </div>
              ))}
              {docs.length === 0 && <p className="text-sm text-slate-500">Noch keine Dokumente geladen.</p>}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Hinweis</CardTitle>
              <CardDescription>Quelle der Dokumente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>Standardmäßig lädt die Seite <code>/docs/manifest.json</code> aus <code>public/docs/</code>.</p>
              <p>Für gesicherte Inhalte kannst du später auf eine Backend‑API umstellen.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { Server, Cpu, HardDrive, Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type DocItem = {
  id: string;
  title: string;
  file: string;
  type: 'pdf' | 'image' | 'markdown' | 'other';
  updated?: string;
};

export function Documents() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/docs/manifest.json')
      .then(r => r.json())
      .then(setDocs)
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter(d =>
      d.title.toLowerCase().includes(s) ||
      d.type.toLowerCase().includes(s)
    );
  }, [docs, q]);

  return (
    
      <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2">Dokumente</h1>
        <p className="text-slate-600">Wissensicherung des Backends per Dokumente</p>
      </div>

      {/* Stats Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployments */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Dateien</CardTitle>
            <CardDescription>Bereitgestellte Dateien</CardDescription>
          </CardHeader>
          <CardContent>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Dokumente gesamt" value={docs.length} />
        <KpiCard title="Letzte Aktualisierung" value={latestUpdated(docs)} />
        <KpiCard title="PDFs" value={docs.filter(d => d.type === 'pdf').length} />
      </section>

      {/* Karten-Grid */}
      <section className="card-grid">
        {filtered.map(d => (
          <DocCard key={d.id} doc={d} />
        ))}
        {filtered.length === 0 && <p>Keine Treffer.</p>}
      </section>
          </CardContent>
        </Card>
      {/* KPIs wie im Dashboard */}
      
    </div>
    </div>
  );
}

function latestUpdated(docs: DocItem[]) {
  const dates = docs.map(d => d.updated).filter(Boolean) as string[];
  if (!dates.length) return '—';
  return dates.sort().slice(-1)[0];
}

function KpiCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="card kpi">
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

function DocCard({ doc }: { doc: DocItem }) {
  const badgeColor =
    doc.type === 'pdf' ? 'badge-red' :
    doc.type === 'image' ? 'badge-blue' :
    doc.type === 'markdown' ? 'badge-green' : 'badge-gray';

  return (
    <div className="card doc">
      <div className="card-header">
        <span className={`badge ${badgeColor}`}>{doc.type.toUpperCase()}</span>
        {doc.updated && <span className="muted">Stand: {doc.updated}</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{doc.title}</h3>
      </div>
      <div className="card-footer">
        <a className="btn" href={doc.file} download>
          ⬇️ Download
        </a>
        <Link className="btn btn-secondary" to={`/docs/${doc.id}`}>
          Anzeigen
        </Link>
      </div>
    </div>
  );
}
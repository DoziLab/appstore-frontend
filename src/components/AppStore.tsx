import { Server, Database, GitBranch, Container, Shield, Code, Laptop, Boxes, Search, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';
import { AddTemplateDialog } from './AddTemplateDialog';

interface AppStoreProps {
  onDeploy: () => void;
}

export function AppStore({ onDeploy }: AppStoreProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);

  const templates = [
    {
      name: 'Jupyter Notebook',
      description: 'Interaktive Python-Notebooks für Data Science und Machine Learning',
      icon: Code,
      category: 'Development',
      versions: ['3.6', '3.7', '3.8'],
      popular: true,
      color: 'from-orange-400 to-red-500',
    },
    {
      name: 'GitLab Server',
      description: 'Komplette DevOps-Plattform mit Git-Repository-Management',
      icon: GitBranch,
      category: 'DevOps',
      versions: ['15.10', '16.0', '16.1'],
      popular: true,
      color: 'from-orange-500 to-red-600',
    },
    {
      name: 'Kubernetes Cluster',
      description: 'Container-Orchestrierungsplattform für skalierbare Deployments',
      icon: Container,
      category: 'Infrastructure',
      versions: ['1.26', '1.27', '1.28'],
      popular: true,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      name: 'Jenkins CI/CD',
      description: 'Automatisierungsserver für Continuous Integration und Delivery',
      icon: Boxes,
      category: 'DevOps',
      versions: ['2.387', '2.401'],
      popular: false,
      color: 'from-red-500 to-pink-600',
    },
    {
      name: 'PostgreSQL Database',
      description: 'Leistungsstarkes Open-Source-Datenbanksystem',
      icon: Database,
      category: 'Database',
      versions: ['14.8', '15.3', '16.0'],
      popular: true,
      color: 'from-blue-600 to-cyan-600',
    },
    {
      name: 'MongoDB Instance',
      description: 'NoSQL-Dokumentendatenbank für moderne Anwendungen',
      icon: Database,
      category: 'Database',
      versions: ['6.0', '7.0'],
      popular: false,
      color: 'from-green-600 to-lime-600',
    },
    {
      name: 'Pentest Lab',
      description: 'Vorkonfigurierte Umgebung mit Security-Testing-Tools',
      icon: Shield,
      category: 'Security',
      versions: ['2023.1', '2023.2'],
      popular: false,
      color: 'from-purple-500 to-pink-600',
    },
    {
      name: 'Development VM',
      description: 'Allgemeine Ubuntu-Entwicklungsumgebung',
      icon: Laptop,
      category: 'Development',
      versions: ['20.04', '22.04', '23.04'],
      popular: true,
      color: 'from-teal-500 to-green-600',
    },
    {
      name: 'Node.js Environment',
      description: 'Runtime-Umgebung für JavaScript-Serveranwendungen',
      icon: Server,
      category: 'Development',
      versions: ['16 LTS', '18 LTS', '20 LTS'],
      popular: true,
      color: 'from-green-500 to-emerald-600',
    },
    {
      name: 'Docker Registry',
      description: 'Private Container-Image-Registry für Projekte',
      icon: Container,
      category: 'Infrastructure',
      versions: ['2.8', '2.9'],
      popular: false,
      color: 'from-cyan-500 to-blue-600',
    },
    {
      name: 'Redis Cache',
      description: 'In-Memory-Datenspeicher für Caching und Message-Queuing',
      icon: Database,
      category: 'Database',
      versions: ['7.0', '7.2'],
      popular: false,
      color: 'from-red-500 to-orange-600',
    },
    {
      name: 'ML Training Server',
      description: 'GPU-fähiger Server für Machine-Learning-Training',
      icon: Code,
      category: 'Development',
      versions: ['CUDA 11.8', 'CUDA 12.0'],
      popular: false,
      color: 'from-violet-500 to-purple-600',
    },
  ];

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['Alle', 'Development', 'DevOps', 'Database', 'Infrastructure', 'Security'];
  const [selectedCategory, setSelectedCategory] = useState('Alle');

  const displayTemplates = selectedCategory === 'Alle' 
    ? filteredTemplates 
    : filteredTemplates.filter(t => t.category === selectedCategory);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-slate-900 mb-2">App Store</h1>
          <p className="text-slate-600">Durchsuche und deploye Application-Templates</p>
        </div>
        <Button
          variant="outline"
          className="bg-teal-500 hover:bg-teal-600 text-white"
          onClick={() => setAddTemplateOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Template hinzufügen
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Templates durchsuchen..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className={selectedCategory === category ? "bg-teal-500 hover:bg-teal-600" : ""}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Card key={template.name} className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-teal-200">
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center text-white shadow-lg`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex gap-2">
                    {template.popular && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                        Beliebt
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-slate-900">{template.name}</CardTitle>
                <CardDescription className="text-slate-600">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Kategorie:</span>
                  <Badge variant="outline" className="text-xs border-slate-300">
                    {template.category}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <span className="text-xs text-slate-500">Verfügbare Versionen:</span>
                  <div className="flex flex-wrap gap-2">
                    {template.versions.map((version) => (
                      <Badge key={version} variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                        {version}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={onDeploy}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white mt-4"
                >
                  Deploy
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {displayTemplates.length === 0 && (
        <div className="text-center py-12">
          <Server className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">Keine Templates gefunden, die deiner Suche entsprechen</p>
        </div>
      )}

      {/* Add Template Dialog */}
      <AddTemplateDialog
        open={addTemplateOpen}
        onOpenChange={setAddTemplateOpen}
      />
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Server, Database, GitBranch, Container, Shield, Code, Laptop, Boxes, Search, Plus, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { AddTemplateDialog } from '../components/AddTemplateDialog';
import { getTemplates, type TemplateDto } from '../api/templates';
import type { LucideIcon } from 'lucide-react';

interface AppStoreProps {
  onDeploy: (templateId: string) => void;
}

// Helper function to get icon and color based on template name
function getTemplateStyle(name: string): { icon: LucideIcon; color: string } {
  const nameLower = name.toLowerCase();
  
  // Match by keywords in name
  if (nameLower.includes('jupyter') || nameLower.includes('notebook')) {
    return { icon: Code, color: 'from-orange-400 to-red-500' };
  }
  if (nameLower.includes('gitlab') || nameLower.includes('git')) {
    return { icon: GitBranch, color: 'from-orange-500 to-red-600' };
  }
  if (nameLower.includes('kubernetes') || nameLower.includes('k8s')) {
    return { icon: Container, color: 'from-blue-500 to-indigo-600' };
  }
  if (nameLower.includes('jenkins')) {
    return { icon: Boxes, color: 'from-red-500 to-pink-600' };
  }
  if (nameLower.includes('postgres')) {
    return { icon: Database, color: 'from-blue-600 to-cyan-600' };
  }
  if (nameLower.includes('mongo')) {
    return { icon: Database, color: 'from-green-600 to-lime-600' };
  }
  if (nameLower.includes('pentest') || nameLower.includes('security')) {
    return { icon: Shield, color: 'from-purple-500 to-pink-600' };
  }
  if (nameLower.includes('multi-user') || nameLower.includes('multi user')) {
    return { icon: Laptop, color: 'from-teal-500 to-green-600' };
  }
  if (nameLower.includes('vm') || nameLower.includes('virtual') || nameLower.includes('student')) {
    return { icon: Laptop, color: 'from-teal-500 to-green-600' };
  }
  if (nameLower.includes('node') || nameLower.includes('nodejs')) {
    return { icon: Server, color: 'from-green-500 to-emerald-600' };
  }
  if (nameLower.includes('docker') || nameLower.includes('registry')) {
    return { icon: Container, color: 'from-cyan-500 to-blue-600' };
  }
  if (nameLower.includes('redis') || nameLower.includes('cache')) {
    return { icon: Database, color: 'from-red-500 to-orange-600' };
  }
  if (nameLower.includes('ml') || nameLower.includes('machine learning') || nameLower.includes('gpu')) {
    return { icon: Code, color: 'from-violet-500 to-purple-600' };
  }
  if (nameLower.includes('database') || nameLower.includes('db')) {
    return { icon: Database, color: 'from-blue-500 to-cyan-500' };
  }

  if (nameLower.includes("ubuntu")) {
    return { icon: Server, color: 'from-orange-500 to-red-600' };
  }
  if (nameLower.includes("debian")) {
    return { icon: Server, color: 'from-red-500 to-pink-600' };
  }
  if (nameLower.includes("centos")) {
    return { icon: Server, color: 'from-purple-500 to-indigo-600' };
  }
  if (nameLower.includes("fedora")) {
    return { icon: Server, color: 'from-blue-500 to-cyan-600' };
  }
  
  // Default
  return { icon: Server, color: 'from-slate-500 to-slate-600' };
}

export function AppStore({ onDeploy }: AppStoreProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Fetch templates from backend
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getTemplates({
          status: 'approved', // Only show approved templates
          page_size: 100, // Get all templates
        });
        setTemplates(response.data);
      } catch (err) {
        console.error('Failed to fetch templates:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Templates');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Filter templates by search query
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get unique categories from templates
  const categories = ['Alle'];
  
  const displayTemplates = selectedCategory === 'Alle' 
    ? filteredTemplates 
    : filteredTemplates;

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

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
          <p className="text-slate-600 mt-4">Templates werden geladen...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-900 font-medium mb-2">Fehler beim Laden</p>
          <p className="text-slate-600">{error}</p>
          <Button 
            className="mt-4 bg-teal-500 hover:bg-teal-600"
            onClick={() => window.location.reload()}
          >
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* Templates Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayTemplates.map((template) => {
            const style = getTemplateStyle(template.name);
            const Icon = style.icon;
            const activeVersions = template.versions?.filter(v => v.is_active) || [];

            function TemplateCard({ template }: { template: TemplateDto }) {
              return (
                <Card key={template.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-teal-200 flex flex-col h-full">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center text-white shadow-lg`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex gap-2">
                        {template.approval_status === 'approved' && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            Genehmigt
                          </Badge>
                        )}
                        {template.visibility === 'public' && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            Öffentlich
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-slate-900 line-clamp-2 min-h-[3.5rem]">{template.name}</CardTitle>
                    <CardDescription className="text-slate-600 min-h-[4.5rem]">
                      <p className="line-clamp-3 text-sm leading-relaxed">
                        {template.description || 'Keine Beschreibung verfügbar'}
                      </p>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end space-y-4">
                    <div className="min-h-[4rem]">
                      {activeVersions.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs text-slate-500">Verfügbare Versionen:</span>
                          <div className="flex flex-wrap gap-2">
                            {activeVersions.map((version) => (
                              <Badge key={version.id} variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                                {version.version}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeVersions.length === 0 && (
                        <div className="text-xs text-slate-500 italic">
                          Keine aktiven Versionen verfügbar
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setDetailsModalOpen(true);
                        }}
                        className="w-full"
                      >
                        Details
                      </Button>
                      <Button
                        onClick={() => onDeploy(template.id)}
                        className="w-full bg-teal-500 hover:bg-teal-600 text-white"
                        disabled={activeVersions.length === 0}
                      >
                        Deploy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return <TemplateCard key={template.id} template={template} />;
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && displayTemplates.length === 0 && (
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

      {/* Template Details Modal */}
      {selectedTemplate && (
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getTemplateStyle(selectedTemplate.name).color} flex items-center justify-center text-white`}>
                  {React.createElement(getTemplateStyle(selectedTemplate.name).icon, { className: "w-5 h-5" })}
                </div>
                <span>{selectedTemplate.name}</span>
              </DialogTitle>
              <DialogDescription>
                Template-Details und Informationen
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                {selectedTemplate.approval_status === 'approved' && (
                  <Badge className="bg-green-100 text-green-700">Genehmigt</Badge>
                )}
                {selectedTemplate.visibility === 'public' && (
                  <Badge className="bg-blue-100 text-blue-700">Öffentlich</Badge>
                )}
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Beschreibung</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {selectedTemplate.description || 'Keine Beschreibung verfügbar'}
                </p>
              </div>

              {/* Versions */}
              {selectedTemplate.versions && selectedTemplate.versions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Verfügbare Versionen</h3>
                  <div className="space-y-2">
                    {selectedTemplate.versions.map((version) => (
                      <div key={version.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={version.is_active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200'}>
                            {version.version}
                          </Badge>
                          {version.is_active && (
                            <span className="text-xs text-green-600 font-medium">Aktiv</span>
                          )}
                        </div>
                        {version.created_at && (
                          <span className="text-xs text-slate-500">
                            {new Date(version.created_at).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta Information */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Informationen</h3>
                {selectedTemplate.repo_url && (
                  <div className="text-sm">
                    <span className="text-slate-600">Repository: </span>
                    <a 
                      href={selectedTemplate.repo_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-700 underline"
                    >
                      {selectedTemplate.repo_url}
                    </a>
                  </div>
                )}
                {selectedTemplate.icon_url && (
                  <div className="text-sm">
                    <span className="text-slate-600">Icon: </span>
                    <span className="text-slate-700">{selectedTemplate.icon_url}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    onDeploy(selectedTemplate.id);
                    setDetailsModalOpen(false);
                  }}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                  disabled={(selectedTemplate.versions?.filter(v => v.is_active) || []).length === 0}
                >
                  Jetzt deployen
                </Button>
                <Button
                  onClick={() => setDetailsModalOpen(false)}
                  variant="outline"
                >
                  Schließen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
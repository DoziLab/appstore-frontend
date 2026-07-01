import React, { useState, useEffect, useMemo } from 'react';
import { Server, Database, GitBranch, Container, Shield, Code, Laptop, Boxes, Search, Plus, AlertCircle, Eye, Lock, User, Users, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '../components/ui/alert-dialog';
import { AddTemplateDialog } from '../components/AddTemplateDialog';
import { TemplateOwnerDetailDialog } from '../components/TemplateOwnerDetailDialog';
import { ApprovalBadge } from '../components/ApprovalBadge';
import { getTemplates, deleteTemplate, fetchTemplateIcon, type TemplateDto } from '../api/templates';
import { deriveTemplateOverallStatus } from '../lib/template-status';
import { useCurrentUser } from '../auth/useCurrentUser';
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
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [ownerDetailsOpen, setOwnerDetailsOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(false);
  // Cache für geladene Template-Icons (templateId -> blob URL)
  const [iconBlobUrls, setIconBlobUrls] = useState<Record<string, string>>({});

  // Filter-Flags: visibility = öffentlich/privat, ownership = eigene/fremde.
  // 'all' bedeutet jeweils „kein Filter". Wir filtern client-seitig, weil das
  // Listing-Endpoint sowieso nur die für den User sichtbaren Templates liefert
  // und ein zweiter Roundtrip pro Filterklick unnötig wäre.
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'mine' | 'others'>('all');

  const { username, isAdmin } = useCurrentUser();

  // Backend liefert `template.owner_id` als interne `users.id` (DB-PK),
  // unser Keycloak-Token hat aber nur `sub` (= `users.external_id`).
  // Wir leiten die interne ID aus der Liste ab: sobald ≥1 Template
  // existiert, dessen `owner_username` zu unserem `preferred_username`
  // passt, kennen wir unsere `users.id` und können sauber per ID
  // vergleichen. Direkter Vergleich per Username scheidet aus, weil
  // `owner_username` für Service-Accounts / Pre-Migration-User `null`
  // sein kann (siehe Kommentar in src/api/templates.ts).
  const myInternalUserId = useMemo(() => {
    if (!username) return null;
    return templates.find((t) => t.owner_username === username)?.owner_id ?? null;
  }, [templates, username]);

  // Lädt Icons für alle Templates mit icon_path
  const loadTemplateIcons = async (templates: TemplateDto[]) => {
    // Alte Blob-URLs freigeben
    Object.values(iconBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    setIconBlobUrls({});

    const newIconUrls: Record<string, string> = {};
    
    await Promise.all(
      templates.map(async (template) => {
        if (template.icon_path) {
          try {
            // Cache-Buster mit Date.now() für sofortiges Neu-Laden nach Upload
            const blob = await fetchTemplateIcon(`${template.icon_path}?v=${Date.now()}`);
            const blobUrl = URL.createObjectURL(blob);
            newIconUrls[template.id] = blobUrl;
          } catch (err) {
            console.error(`Failed to load icon for template ${template.id}:`, err);
          }
        }
      })
    );
    
    setIconBlobUrls(newIconUrls);
  };

  // Fetch templates from backend
  const fetchTemplates = async (): Promise<TemplateDto[]> => {
    try {
      setIsLoading(true);
      setError(null);
      // Wir geben hier bewusst keinen Status-/Visibility-Filter mit — das
      // Backend wendet die richtige Sichtbarkeitslogik bereits an:
      //   • Admins   → alle Templates
      //   • Owner    → alle eigenen (auch private, auch pending/rejected)
      //   • andere   → public + mind. eine approved Version
      // Würden wir hier z. B. `status: 'approved'` schicken, würden frisch
      // importierte eigene Templates (Version pending oder private = null)
      // aus der Liste fallen, sobald das Backend den Filter respektiert.
      const response = await getTemplates({
        page_size: 100,
      });
      setTemplates(response.data);
      
      // Lade Icons für Templates die eins haben
      await loadTemplateIcons(response.data);
      
      return response.data;
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Templates');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    
    // Cleanup: Blob-URLs freigeben
    return () => {
      Object.values(iconBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      setDeletingTemplate(true);
      await deleteTemplate(selectedTemplate.id);
      setConfirmDeleteTemplate(false);
      setDetailsModalOpen(false);
      setSelectedTemplate(null);
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setDeletingTemplate(false);
    }
  };

  // Filter templates by search query + flags
  const filteredTemplates = templates.filter((template) => {
    if (!template.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (visibilityFilter !== 'all') {
      // „Öffentlich" filtert auch eigene Templates ein, deren Marktplatz-
      // Veröffentlichung noch auf Erst-Genehmigung wartet (publish_requested):
      // sie tragen aktuell visibility=private, gehören aber konzeptuell in den
      // „Öffentlich"-Tab — sonst verschwinden sie für den Owner aus dem Blick.
      // „Privat" zeigt nur „echt-private" (kein laufender Marktplatz-Wunsch).
      if (visibilityFilter === 'public') {
        const isPublicLike =
          template.visibility === 'public' || template.publish_requested === true;
        if (!isPublicLike) return false;
      } else if (visibilityFilter === 'private') {
        if (template.visibility !== 'private' || template.publish_requested === true) {
          return false;
        }
      }
    }
    if (ownershipFilter === 'mine' && template.owner_id !== myInternalUserId) {
      return false;
    }
    if (ownershipFilter === 'others' && template.owner_id === myInternalUserId) {
      return false;
    }
    return true;
  });

  const displayTemplates = filteredTemplates;

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
      <div className="flex flex-col gap-4">
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
        </div>

        {/* Filter-Flags: visibility + ownership. Wir nutzen Toggle-Chips
            statt Selects, damit man auf einen Blick sieht, was aktiv ist. */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 mr-1">Sichtbarkeit:</span>
          <Button
            size="sm"
            variant={visibilityFilter === 'all' ? 'default' : 'outline'}
            className={visibilityFilter === 'all' ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}
            onClick={() => setVisibilityFilter('all')}
          >
            Alle
          </Button>
          <Button
            size="sm"
            variant={visibilityFilter === 'public' ? 'default' : 'outline'}
            className={visibilityFilter === 'public' ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}
            onClick={() => setVisibilityFilter('public')}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Öffentlich
          </Button>
          <Button
            size="sm"
            variant={visibilityFilter === 'private' ? 'default' : 'outline'}
            className={visibilityFilter === 'private' ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}
            onClick={() => setVisibilityFilter('private')}
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            Privat
          </Button>

          <span className="text-slate-500 ml-4 mr-1">Besitz:</span>
          <Button
            size="sm"
            variant={ownershipFilter === 'all' ? 'default' : 'outline'}
            className={ownershipFilter === 'all' ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}
            onClick={() => setOwnershipFilter('all')}
          >
            Alle
          </Button>
          <Button
            size="sm"
            variant={ownershipFilter === 'mine' ? 'default' : 'outline'}
            className={ownershipFilter === 'mine' ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}
            onClick={() => setOwnershipFilter('mine')}
          >
            <User className="w-3.5 h-3.5 mr-1.5" />
            Eigene
          </Button>
          <Button
            size="sm"
            variant={ownershipFilter === 'others' ? 'default' : 'outline'}
            className={ownershipFilter === 'others' ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}
            onClick={() => setOwnershipFilter('others')}
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Fremde
          </Button>
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
                    <div className="flex items-start justify-between gap-3 mb-3">
                      {/* Template-Icon: hochgeladenes Bild oder Fallback auf Lucide-Icon */}
                      {iconBlobUrls[template.id] ? (
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl border-2 border-slate-200 flex items-center justify-center bg-white shadow-sm overflow-hidden">
                          <img
                            src={iconBlobUrls[template.id]}
                            alt={`${template.name} Icon`}
                            className="max-w-full max-h-full object-contain p-1.5"
                          />
                        </div>
                      ) : (
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center text-white shadow-lg`}>
                          <Icon className="w-6 h-6" />
                        </div>
                      )}
                      {/* flex-wrap: in der schmalen Karten-Spalte (3-col-Grid)
                          passen „einsatzbereit" + „Öffentlich (offen)" oft
                          nicht nebeneinander — ohne wrap überlaufen die
                          shrink-0/whitespace-nowrap-Badges die Karte. */}
                      <div className="flex flex-wrap justify-end gap-2 min-w-0">
                        <ApprovalBadge
                          status={deriveTemplateOverallStatus(template)}
                          variant="overall"
                          showIcon={false}
                        />
                        {template.visibility === 'public' && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            Öffentlich
                          </Badge>
                        )}
                        {/* Erst-Veröffentlichung-Hinweis: das Template ist
                            noch PRIVATE in der DB, aber der Owner hat es
                            für die Marketplace beantragt. Wir zeigen es
                            visuell wie ein angefragtes „öffentlich" —
                            blau-amber-Mix wäre verwirrend, deshalb
                            durchgängig amber wie der overall-badge. */}
                        {template.visibility === 'private'
                          && template.publish_requested === true && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                              Öffentlich (offen)
                            </Badge>
                        )}
                      </div>
                    </div>
                    {/* break-words: ohne diese Regel sprengt ein langer
                        leerzeichenfreier Name/Beschreibung (z. B. "lorem"-
                        Wiederholung) die Karte über die Grid-Spalte hinaus —
                        line-clamp greift nur auf umgebrochene Zeilen. */}
                    <CardTitle className="text-slate-900 line-clamp-2 min-h-[3.5rem] break-words">{template.name}</CardTitle>
                    <CardDescription className="text-slate-600 min-h-[4.5rem]">
                      <p className="line-clamp-3 text-sm leading-relaxed break-words">
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
                          // Owner oder Admin → erweiterte Detailseite mit Versionsverwaltung;
                          // alle anderen → bestehender generischer Modal.
                          if ((myInternalUserId && template.owner_id === myInternalUserId) || isAdmin) {
                            setOwnerDetailsOpen(true);
                          } else {
                            setDetailsModalOpen(true);
                          }
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
        onImported={fetchTemplates}
      />

      {/* Owner-Detailansicht — wird nur für eigene Templates geöffnet.
          Bringt Versions-Aktualisierung und Approval-Buttons mit. */}
      {selectedTemplate && (
        <TemplateOwnerDetailDialog
          template={selectedTemplate}
          open={ownerDetailsOpen}
          onOpenChange={setOwnerDetailsOpen}
          isAdmin={isAdmin}
          onChanged={() => {
            // Liste neu laden, damit das aktualisierte Active-Flag / der
            // neue Approval-Status auch in den Cards sichtbar wird. Den
            // Dialog lassen wir offen, falls der Admin gleich noch eine
            // weitere Version approven möchte — dann muss selectedTemplate
            // aber das frische Objekt aus dem Re-Fetch zeigen.
            fetchTemplates().then((fresh) => {
              const updated = fresh.find((t) => t.id === selectedTemplate.id);
              if (updated) setSelectedTemplate(updated);
            });
          }}
        />
      )}

      {/* Template Details Modal */}
      {selectedTemplate && (
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {/* Template-Icon: hochgeladenes Bild oder Fallback */}
                {iconBlobUrls[selectedTemplate.id] ? (
                  <div className="w-10 h-10 rounded-lg border-2 border-slate-200 flex items-center justify-center bg-white overflow-hidden">
                    <img
                      src={iconBlobUrls[selectedTemplate.id]}
                      alt={`${selectedTemplate.name} Icon`}
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  </div>
                ) : (
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getTemplateStyle(selectedTemplate.name).color} flex items-center justify-center text-white`}>
                    {React.createElement(getTemplateStyle(selectedTemplate.name).icon, { className: "w-5 h-5" })}
                  </div>
                )}
                <span className="break-words">{selectedTemplate.name}</span>
              </DialogTitle>
              <DialogDescription>
                Template-Details und Informationen
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <ApprovalBadge
                  status={deriveTemplateOverallStatus(selectedTemplate)}
                  variant="overall"
                />
                {selectedTemplate.visibility === 'public' && (
                  <Badge className="bg-blue-100 text-blue-700">Öffentlich</Badge>
                )}
                {selectedTemplate.visibility === 'private'
                  && selectedTemplate.publish_requested === true && (
                    <Badge className="bg-amber-100 text-amber-700">
                      Öffentlich (offen)
                    </Badge>
                )}
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Beschreibung</h3>
                <p className="text-sm text-slate-600 leading-relaxed break-words">
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
                <div className="text-sm">
                  <span className="text-slate-600">Hochgeladen von: </span>
                  <span className="text-slate-700">
                    {selectedTemplate.owner_name || selectedTemplate.owner_username || selectedTemplate.owner_id}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-600">Erstellt am: </span>
                  <span className="text-slate-700">
                    {new Date(selectedTemplate.created_at).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
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
              </div>

              {/* Action Buttons */}
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
                {isAdmin && (
                  <Button
                    onClick={() => setConfirmDeleteTemplate(true)}
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </Button>
                )}
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

      {/* Delete Confirmation Dialog */}
      {selectedTemplate && (
        <AlertDialog open={confirmDeleteTemplate} onOpenChange={(o: boolean) => !deletingTemplate && setConfirmDeleteTemplate(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Template löschen?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie das Template <strong>{selectedTemplate.name}</strong> wirklich löschen?
                Diese Aktion kann nicht rückgängig gemacht werden. Alle Versionen und zugehörigen Dateien werden ebenfalls gelöscht.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingTemplate}>Abbrechen</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteTemplate}
                disabled={deletingTemplate}
              >
                {deletingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird gelöscht...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
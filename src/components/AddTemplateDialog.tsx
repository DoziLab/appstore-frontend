import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle2, Github, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface AddTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationError {
  field: string;
  message: string;
}

export function AddTemplateDialog({ open, onOpenChange }: AddTemplateDialogProps) {
  // Option 1: GitHub URL
  const [githubUrl, setGithubUrl] = useState('');

  // Option 2: Copy & Paste
  const [heatTemplate, setHeatTemplate] = useState('');
  const [cloudInit, setCloudInit] = useState('');
  const [appYaml, setAppYaml] = useState('');

  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [activeTab, setActiveTab] = useState('github');

  const resetForm = () => {
    setGithubUrl('');
    setHeatTemplate('');
    setCloudInit('');
    setAppYaml('');
    setValidationErrors([]);
    setValidationSuccess(false);
    setActiveTab('github');
  };

  const validateYAML = (content: string, fieldName: string): boolean => {
    if (!content.trim()) {
      return false;
    }

    try {
      // Einfache YAML-Validierung (Überprüfung auf grundlegende Struktur)
      const lines = content.split('\n');
      let hasValidStructure = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Prüfe auf YAML-Schlüssel-Wert-Paare
          if (trimmed.includes(':') || trimmed.startsWith('-')) {
            hasValidStructure = true;
            break;
          }
        }
      }

      if (!hasValidStructure) {
        setValidationErrors(prev => [...prev, {
          field: fieldName,
          message: `${fieldName} hat keine gültige YAML-Struktur`
        }]);
        return false;
      }

      return true;
    } catch (error) {
      setValidationErrors(prev => [...prev, {
        field: fieldName,
        message: `Fehler beim Parsen von ${fieldName}`
      }]);
      return false;
    }
  };

  const validateHeatTemplate = (content: string): boolean => {
    if (!validateYAML(content, 'Heat-Template')) {
      return false;
    }

    // Prüfe auf Heat-spezifische Struktur
    const requiredSections = ['heat_template_version', 'description', 'resources'];
    const contentLower = content.toLowerCase();
    
    for (const section of requiredSections) {
      if (!contentLower.includes(section)) {
        setValidationErrors(prev => [...prev, {
          field: 'Heat-Template',
          message: `Pflichtsektion fehlt: ${section}`
        }]);
        return false;
      }
    }

    return true;
  };

  const validateAppYaml = (content: string): boolean => {
    if (!content.trim()) {
      return true; // Optional field
    }

    if (!validateYAML(content, 'app.yaml')) {
      return false;
    }

    // Prüfe auf app.yaml spezifische Struktur
    const contentLower = content.toLowerCase();
    if (!contentLower.includes('metadata') && !contentLower.includes('parameters')) {
      setValidationErrors(prev => [...prev, {
        field: 'app.yaml',
        message: 'app.yaml sollte mindestens "metadata" oder "parameters" Sektion enthalten'
      }]);
      return false;
    }

    return true;
  };

  const validateGithubUrl = (url: string): boolean => {
    if (!url.trim()) {
      setValidationErrors([{
        field: 'GitHub URL',
        message: 'Bitte geben Sie eine GitHub-URL ein'
      }]);
      return false;
    }

    // Prüfe ob es eine gültige GitHub URL ist
    const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/tree\/.+$/;
    if (!githubPattern.test(url)) {
      setValidationErrors([{
        field: 'GitHub URL',
        message: 'Ungültige GitHub-URL. Erwartetes Format: https://github.com/orga/repo/tree/branch/path'
      }]);
      return false;
    }

    return true;
  };

  const handleValidate = () => {
    setIsValidating(true);
    setValidationErrors([]);
    setValidationSuccess(false);

    setTimeout(() => {
      let isValid = false;

      if (activeTab === 'github') {
        isValid = validateGithubUrl(githubUrl);
      } else {
        // Validiere Heat-Template (Pflichtfeld)
        if (!heatTemplate.trim()) {
          setValidationErrors([{
            field: 'Heat-Template',
            message: 'Heat-Template ist ein Pflichtfeld'
          }]);
          isValid = false;
        } else {
          const heatValid = validateHeatTemplate(heatTemplate);
          const appYamlValid = validateAppYaml(appYaml);
          const cloudInitValid = cloudInit.trim() ? validateYAML(cloudInit, 'cloud-init') : true;
          
          isValid = heatValid && appYamlValid && cloudInitValid;
        }
      }

      if (isValid) {
        setValidationSuccess(true);
        toast.success('Validierung erfolgreich!', {
          description: 'Das Template ist syntaktisch korrekt und kann gespeichert werden.'
        });
      } else {
        toast.error('Validierung fehlgeschlagen', {
          description: 'Bitte beheben Sie die Fehler und versuchen Sie es erneut.'
        });
      }

      setIsValidating(false);
    }, 1000);
  };

  const handleSave = () => {
    if (!validationSuccess) {
      toast.error('Bitte validieren Sie das Template zuerst');
      return;
    }

    // Speichere Template (noch nicht öffentlich)
    const templateData = activeTab === 'github' 
      ? { source: 'github', url: githubUrl }
      : { source: 'manual', heatTemplate, cloudInit, appYaml };

    console.log('Speichere Template:', templateData);
    
    toast.success('Template gespeichert!', {
      description: 'Das Template wurde erfolgreich gespeichert und ist privat.'
    });

    resetForm();
    onOpenChange(false);
  };

  const handleSubmitForApproval = () => {
    if (!validationSuccess) {
      toast.error('Bitte validieren Sie das Template zuerst');
      return;
    }

    // Sende Template zur Genehmigung
    const templateData = activeTab === 'github' 
      ? { source: 'github', url: githubUrl }
      : { source: 'manual', heatTemplate, cloudInit, appYaml };

    console.log('Sende Template zur Genehmigung:', templateData);
    
    toast.success('Zur Genehmigung freigegeben!', {
      description: 'Das Template wurde zur Prüfung an den Administrator gesendet.'
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open: boolean) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Template hinzufügen</DialogTitle>
          <DialogDescription className="text-slate-600">
            Fügen Sie ein neues Template über GitHub oder per Copy & Paste hinzu
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="github" className="gap-2">
              <Github className="w-4 h-4" />
              GitHub-Repository
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="w-4 h-4" />
              Copy & Paste
            </TabsTrigger>
          </TabsList>

          {/* Option 1: GitHub URL */}
          <TabsContent value="github" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="github-url" className="text-slate-700">
                GitHub-URL mit Pfad zum Template-Ordner
              </Label>
              <Input
                id="github-url"
                type="url"
                placeholder="https://github.com/orga/repo/tree/main/heat-template"
                value={githubUrl}
                onChange={(e) => {
                  setGithubUrl(e.target.value);
                  setValidationSuccess(false);
                  setValidationErrors([]);
                }}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Das System erwartet mindestens eine Heat-Template-Datei (.yaml/.yml) im angegebenen Ordner
              </p>
            </div>
          </TabsContent>

          {/* Option 2: Copy & Paste */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            {/* Heat Template - Pflichtfeld */}
            <div className="space-y-2">
              <Label htmlFor="heat-template" className="text-slate-700">
                Heat-Template (YAML) <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="heat-template"
                placeholder="heat_template_version: 2021-04-16&#10;description: Mein Template&#10;resources:&#10;  ..."
                value={heatTemplate}
                onChange={(e) => {
                  setHeatTemplate(e.target.value);
                  setValidationSuccess(false);
                  setValidationErrors([]);
                }}
                className="font-mono text-sm min-h-[200px] resize-y"
              />
            </div>

            {/* cloud-init - Optional */}
            <div className="space-y-2">
              <Label htmlFor="cloud-init" className="text-slate-700">
                cloud-init Datei (optional)
              </Label>
              <Textarea
                id="cloud-init"
                placeholder="#cloud-config&#10;packages:&#10;  - docker&#10;  - git"
                value={cloudInit}
                onChange={(e) => {
                  setCloudInit(e.target.value);
                  setValidationSuccess(false);
                  setValidationErrors([]);
                }}
                className="font-mono text-sm min-h-[120px] resize-y"
              />
            </div>

            {/* app.yaml - Optional */}
            <div className="space-y-2">
              <Label htmlFor="app-yaml" className="text-slate-700">
                app.yaml (optional)
              </Label>
              <Textarea
                id="app-yaml"
                placeholder="metadata:&#10;  name: Meine App&#10;  version: 1.0&#10;parameters:&#10;  ..."
                value={appYaml}
                onChange={(e) => {
                  setAppYaml(e.target.value);
                  setValidationSuccess(false);
                  setValidationErrors([]);
                }}
                className="font-mono text-sm min-h-[120px] resize-y"
              />
              <p className="text-xs text-slate-500">
                Die app.yaml wird für UI-Parameter und Metadaten verwendet
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Validation Messages */}
        <div className="space-y-2 min-h-[60px]">
          {validationSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Validierung erfolgreich! Das Template ist syntaktisch korrekt.
              </AlertDescription>
            </Alert>
          )}

          {validationErrors.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="font-medium mb-2">Folgende Fehler wurden gefunden:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm">
                      <strong>{error.field}:</strong> {error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={isValidating}
            className="flex-1"
          >
            {isValidating ? 'Validiere...' : 'Validieren'}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!validationSuccess}
            className="flex-1"
          >
            Speichern
          </Button>
          
          <Button
            onClick={handleSubmitForApproval}
            disabled={!validationSuccess}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
          >
            Zur Genehmigung freigeben
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

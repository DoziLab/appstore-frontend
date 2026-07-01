import { useEffect, useRef, useState } from 'react';
import { Image, Loader2, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { uploadTemplateIcon, deleteTemplateIcon, fetchTemplateIcon } from '../api/templates';

interface TemplateIconUploadProps {
  templateId: string;
  iconPath: string | null;
  /** Wird nach Upload oder Delete aufgerufen, damit der Parent das Template neu laden kann */
  onChanged: () => void;
  /** Timestamp oder Counter der sich bei jedem Upload ändert - triggert Icon-Reload */
  uploadTrigger?: number;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 1 * 1024 * 1024; // 1 MB (nginx-Limit ist niedriger als Backend-Limit)
const MAX_DIMENSION = 512; // Maximale Breite/Höhe in Pixeln

/**
 * Verkleinert ein Bild client-seitig auf maximal MAX_DIMENSION x MAX_DIMENSION
 * und konvertiert es zu einem optimierten Format.
 */
async function resizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Nur verkleinern, wenn das Bild größer als MAX_DIMENSION ist
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Bildkonvertierung fehlgeschlagen'));
            return;
          }
          // Erstelle neue File mit gleichem Namen
          const resizedFile = new File([blob], file.name, {
            type: 'image/webp', // WebP für beste Kompression
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        'image/webp',
        0.85 // Qualität 85%
      );
    };

    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Icon-Upload-Komponente für Templates. Zeigt das aktuelle Icon an (falls
 * vorhanden) oder einen Placeholder, und bietet Upload + Delete-Buttons.
 * 
 * Client-seitige Optimierung:
 *  - Erlaubte Formate: PNG, JPEG, WebP
 *  - Max. Dateigröße: 1 MB (nginx-Limit)
 *  - Automatische Verkleinerung auf 512×512px
 *  - Konvertierung zu WebP für optimale Kompression
 * 
 * Auth: Backend prüft Owner-or-Admin beim Upload/Delete.
 */
export function TemplateIconUpload({
  templateId,
  iconPath,
  onChanged,
  uploadTrigger = 0,
}: TemplateIconUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [iconBlobUrl, setIconBlobUrl] = useState<string | null>(null);
  const [loadingIcon, setLoadingIcon] = useState(false);

  // Icon vom Server laden, wenn iconPath vorhanden ist
  useEffect(() => {
    if (!iconPath) {
      setIconBlobUrl(null);
      return;
    }

    let cancelled = false;
    setLoadingIcon(true);
    
    // Cache-Buster mit Timestamp, damit ein Re-Upload sofort das neue Bild zeigt
    const url = `${iconPath}?v=${Date.now()}`;
    
    fetchTemplateIcon(url)
      .then((blob) => {
        if (!cancelled) {
          const blobUrl = URL.createObjectURL(blob);
          setIconBlobUrl(blobUrl);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Icon konnte nicht geladen werden:', err);
          setIconBlobUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingIcon(false);
      });

    // Cleanup: Blob-URL freigeben beim Unmount oder wenn iconPath wechselt
    return () => {
      cancelled = true;
      if (iconBlobUrl) URL.revokeObjectURL(iconBlobUrl);
    };
  }, [iconPath, uploadTrigger]); // uploadTrigger triggert Neu-Laden nach Upload

  const validateFile = (file: File): string | null => {
    if (file.size === 0) return 'Datei ist leer';
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Nur PNG, JPEG oder WebP erlaubt';
    }
    // Wir prüfen hier nicht mehr die Größe, da wir das Bild automatisch
    // verkleinern werden
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-seitige Validierung (Format)
    const validationError = validateFile(file);
    if (validationError) {
      toast.error('Upload fehlgeschlagen', { description: validationError });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      // Bild automatisch optimieren (verkleinern + komprimieren)
      let fileToUpload = file;
      if (file.size > MAX_SIZE) {
        toast.info('Bild wird optimiert…');
        try {
          fileToUpload = await resizeImage(file);
        } catch (resizeErr) {
          console.error('Bildoptimierung fehlgeschlagen:', resizeErr);
          toast.error('Bildoptimierung fehlgeschlagen', {
            description: resizeErr instanceof Error ? resizeErr.message : 'Bitte kleineres Bild wählen',
          });
          if (fileInputRef.current) fileInputRef.current.value = '';
          setUploading(false);
          return;
        }
      }

      await uploadTemplateIcon(templateId, fileToUpload);
      toast.success('Icon hochgeladen');
      
      // Sofort neue Preview laden (vor onChanged, damit kein Flackern entsteht)
      try {
        const blob = await fetchTemplateIcon(`${iconPath}?v=${Date.now()}`);
        // Alte Blob-URL freigeben
        if (iconBlobUrl) URL.revokeObjectURL(iconBlobUrl);
        const newBlobUrl = URL.createObjectURL(blob);
        setIconBlobUrl(newBlobUrl);
      } catch (previewErr) {
        console.error('Preview-Reload fehlgeschlagen:', previewErr);
      }
      
      onChanged();
    } catch (err) {
      // Spezielle Behandlung für 413 Request Entity Too Large
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('413') || errorMessage.includes('Too Large')) {
        toast.error('Datei zu groß für Server', {
          description: 'Bitte ein kleineres Bild wählen (empfohlen: unter 500 KB)',
        });
      } else {
        toast.error('Upload fehlgeschlagen', {
          description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTemplateIcon(templateId);
      toast.success('Icon entfernt');
      
      // Sofort Preview entfernen
      if (iconBlobUrl) {
        URL.revokeObjectURL(iconBlobUrl);
        setIconBlobUrl(null);
      }
      
      onChanged();
    } catch (err) {
      toast.error(
        'Löschen fehlgeschlagen',
        { description: err instanceof Error ? err.message : 'Unbekannter Fehler' }
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold text-slate-900">Template-Icon</Label>
      
      {/* Icon-Preview oder Placeholder */}
      <div className="flex items-start gap-3">
        <div className="relative w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
          {loadingIcon && (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          )}
          {!loadingIcon && iconBlobUrl && (
            <img
              src={iconBlobUrl}
              alt="Template Icon"
              style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
              className="object-contain"
            />
          )}
          {!loadingIcon && !iconBlobUrl && (
            <Image className="w-5 h-5 text-slate-300" />
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <p className="text-xs text-slate-500">
            {iconPath
              ? 'Aktuelles Icon — du kannst es ersetzen oder entfernen.'
              : 'Kein Icon hochgeladen. Erlaubt: PNG, JPEG, WebP. Große Bilder werden automatisch optimiert.'}
          </p>
          
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading || deleting}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || deleting}
              className="text-xs"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Lädt hoch…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {iconPath ? 'Ersetzen' : 'Hochladen'}
                </>
              )}
            </Button>

            {iconPath && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={uploading || deleting}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Löscht…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Entfernen
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

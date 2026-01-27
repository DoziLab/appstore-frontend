import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, CheckCircle2, GraduationCap } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { createCourse } from "../api/courses";

interface AddCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void; // let parent refresh
}

type ValidationError = { field: string; message: string };

const courseCodePattern = /^[A-Z]{2}(?:20(?:2[1-9]|[3-9]\d)|2[1-9]\d{2}|[3-9]\d{3})$/i;

export function AddCourseDialog({ open, onOpenChange, onCreated }: AddCourseDialogProps) {
  const [name, setName] = useState("");
  const [courseCode, setCourseCode] = useState("WS2024");

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setCourseCode("WS2024");
    setValidationErrors([]);
    setValidationSuccess(false);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const validate = () => {
    const errs: ValidationError[] = [];

    if (!name.trim()) {
      errs.push({ field: "Name", message: "Bitte geben Sie einen Kursnamen ein." });
    } else if (name.trim().length < 3) {
      errs.push({ field: "Name", message: "Der Kursname ist zu kurz (min. 3 Zeichen)." });
    }

    if (!courseCode.trim()) {
      errs.push({ field: "Kurscode", message: "Bitte geben Sie einen Kurscode ein." });
    } else if (!courseCodePattern.test(courseCode.trim())) {
      errs.push({
        field: "Kurscode",
        message: 'Ungültiges Format. Erwartet 2-4 Buchstaben + Jahr ab 2020.',
      });
    }

    setValidationErrors(errs);
    setValidationSuccess(errs.length === 0);
    return errs.length === 0;
  };

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && courseCode.trim().length > 0 && !isSubmitting;
  }, [name, courseCode, isSubmitting]);

  const handleCreate = async () => {
    const ok = validate();
    if (!ok) {
      toast.error("Bitte korrigieren Sie die Eingaben.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createCourse({ name: name.trim(), courseCode: courseCode.trim().toUpperCase() });

      toast.success("Kurs erstellt", {
        description: `"${name.trim()}" wurde erfolgreich angelegt.`,
      });

      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error("Erstellen fehlgeschlagen", { description: msg });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Kurs hinzufügen
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Legen Sie einen neuen Kurs an (Name + Kurscode).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="course-name" className="text-slate-700">
              Kursname <span className="text-red-500">*</span>
            </Label>
            <Input
              id="course-name"
              placeholder="IT Infrastructure II"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationSuccess(false);
                setValidationErrors([]);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-semester" className="text-slate-700">
              Kurscode <span className="text-red-500">*</span>
            </Label>
            <Input
              id="course-semester"
              placeholder="WS2024"
              value={courseCode}
              onChange={(e) => {
                setCourseCode(e.target.value);
                setValidationSuccess(false);
                setValidationErrors([]);
              }}
            />
            <p className="text-xs text-slate-500">Format: WS2024 oder SS2025</p>
          </div>

          {/* Validation Messages */}
          <div className="space-y-2 min-h-[60px]">
            {validationSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Eingaben sind gültig. Sie können den Kurs erstellen.
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

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={validate}
              disabled={isSubmitting}
              className="flex-1"
            >
              Validieren
            </Button>

            <Button
              onClick={handleCreate}
              disabled={!canSubmit}
              className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isSubmitting ? "Erstelle..." : "Kurs erstellen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

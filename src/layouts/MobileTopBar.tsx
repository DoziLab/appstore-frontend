import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../components/ui/sheet";

interface MobileTopBarProps {
  logo: string;
}

/**
 * Mobile-only Top-Bar mit Hamburger-Menu. Sichtbar unter `md:` (< 768px);
 * ab `md:` per `md:hidden` ausgeblendet, weil dort die klassische Sidebar
 * links direkt an ihrer Stelle steht. Der Hamburger öffnet einen linken
 * <Sheet>-Drawer, der die Sidebar im "mobile"-Variant enthält.
 *
 * Der Drawer schließt automatisch bei Route-Wechsel — sonst müsste der User
 * nach jedem Nav-Klick separat auf X tippen.
 */
export function MobileTopBar({ logo }: MobileTopBarProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Drawer bei jedem Route-Wechsel zu — sowohl Nav-Klick in der Sidebar als
  // auch Programmnavigation (z. B. aus dem User-Menu heraus /config öffnen).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-slate-200 bg-white sticky top-0 z-40">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Menü öffnen"
            className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        {/* SheetContent bringt eigenes Padding + Close-X mit; wir überschreiben
            padding: 0 und lassen die Sidebar-Komponente den Innenraum füllen. */}
        <SheetContent side="left" className="p-0 w-72 sm:max-w-xs">
          {/* Für a11y (Radix warnt sonst) — visuell versteckt. */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            logo={logo}
            variant="mobile"
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <img src={logo} alt="DoziLab" className="h-8 w-auto" />
    </div>
  );
}

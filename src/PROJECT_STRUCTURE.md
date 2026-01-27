# Projektstruktur

Diese Anwendung folgt einer organisierten Ordnerstruktur für bessere Wartbarkeit und Skalierbarkeit.

## 📁 Ordnerstruktur

```
src/
├── api/                    # API-Calls und Backend-Integration
│   ├── courses.ts          # Kurs-bezogene API-Calls
│   ├── deployments.ts      # Deployment-bezogene API-Calls
│   ├── http.ts             # HTTP-Client-Konfiguration
│   └── templates.ts        # Template-bezogene API-Calls
│
├── assets/                 # Statische Assets (Bilder, Icons, Styles)
│   └── styles/             # Globale CSS-Dateien
│       └── globals.css
│
├── auth/                   # Authentifizierungs-Konfiguration
│   └── keycloak.ts         # Keycloak-Setup
│
├── components/             # Wiederverwendbare UI-Komponenten
│   ├── AddTemplateDialog.tsx
│   ├── figma/              # Figma-spezifische Komponenten
│   │   └── ImageWithFallback.tsx
│   └── ui/                 # Basis-UI-Komponenten (Shadcn/UI)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
│
├── hooks/                  # Custom React Hooks
│   # Für zukünftige Hooks wie useAuth, useFetch, useDeployment
│
├── layouts/                # Layout-Templates und Wrapper
│   └── Sidebar.tsx         # Hauptnavigation
│
├── pages/                  # Hauptseiten der Anwendung (entsprechen Routen)
│   ├── AdminMonitoring.tsx      # /admin
│   ├── AppStore.tsx              # /appstore
│   ├── Courses.tsx               # /courses
│   ├── Dashboard.tsx             # /dashboard
│   ├── DeploymentDetails.tsx    # /deployment/:id
│   ├── DeploymentWizard.tsx     # /deploy/:templateId
│   ├── Documents.tsx
│   ├── Login.tsx                 # Login-Seite
│   ├── OpenStackConfig.tsx      # /config
│   └── mockDeployments.ts       # Mock-Daten für Entwicklung
│
├── store/                  # State Management
│   # Für zukünftiges State Management (Redux, Zustand oder Context)
│
├── utils/                  # Hilfsfunktionen und Utilities
│   # Für zukünftige Helper-Funktionen (Formatter, Validatoren, etc.)
│
├── App.tsx                 # Hauptkomponente mit Routing-Logik
├── main.tsx                # Entry Point der Anwendung
└── index.css               # Basis-Styles (Tailwind)
```

## 🧩 Verwendung

### Neue Seite hinzufügen

1. Erstelle eine neue Datei in `pages/`, z.B. `pages/NewPage.tsx`
2. Füge die Route in `App.tsx` hinzu:
   ```tsx
   <Route path="/new-page" element={<NewPage />} />
   ```
3. Füge den Link in `layouts/Sidebar.tsx` hinzu

### Neue wiederverwendbare Komponente hinzufügen

1. Erstelle die Komponente in `components/`, z.B. `components/MyComponent.tsx`
2. Importiere sie in den gewünschten Seiten

### Custom Hook hinzufügen

1. Erstelle den Hook in `hooks/`, z.B. `hooks/useMyHook.ts`
2. Exportiere die Hook-Funktion
3. Importiere und verwende sie in Komponenten

### API-Call hinzufügen

1. Füge die Funktion in der entsprechenden Datei in `api/` hinzu
2. Nutze den bereits konfigurierten HTTP-Client aus `api/http.ts`

## 🎯 Best Practices

- **Pages**: Enthalten die Hauptlogik für eine Route
- **Components**: Sind wiederverwendbar und zustandslos wenn möglich
- **Hooks**: Kapseln wiederverwendbare Logik
- **Layouts**: Definieren übergreifende Strukturen (Navigation, Footer, etc.)
- **Utils**: Reine Funktionen ohne Side Effects
- **Store**: Globaler State, der von mehreren Komponenten genutzt wird

## 🚀 Routing

Die Anwendung verwendet **React Router v6**:

- `/` → Weiterleitung zu `/dashboard`
- `/dashboard` → Dashboard mit Deployment-Übersicht
- `/courses` → Kursverwaltung
- `/appstore` → Template-Store
- `/deploy/:templateId` → Deployment-Wizard
- `/deployment/:deploymentId` → Deployment-Details
- `/config` → OpenStack-Konfiguration
- `/admin` → Admin-Monitoring

Navigation erfolgt über:
- `useNavigate()` für programmatische Navigation
- `<NavLink>` in der Sidebar für deklarative Navigation

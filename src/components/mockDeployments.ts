import { Server, Settings, Network, HardDrive, Shield } from 'lucide-react';

// Mock-Daten für verschiedene Deployment-Zustände
export const mockDeployments = {
  'CS101 - Jupyter Notebook': {
    id: 'deploy-1',
    name: 'CS101 - Jupyter Notebook',
    status: 'running' as const,
    course: 'Informatik 101',
    startedAt: '30.12.2025, 10:15 Uhr',
    completedAt: '30.12.2025, 10:23 Uhr',
    progress: 100,
    resources: {
      cpu: 4,
      ram: 8,
      storage: 50
    },
    steps: [
      {
        id: 'step-1',
        name: 'OpenStack-Ressourcen prüfen',
        status: 'completed' as const,
        startTime: '10:15:02',
        endTime: '10:15:08',
        duration: '6s',
        description: 'Verfügbarkeit von CPU, RAM und Speicher überprüfen',
        icon: Server
      },
      {
        id: 'step-2',
        name: 'VM-Instanz erstellen',
        status: 'completed' as const,
        startTime: '10:15:08',
        endTime: '10:16:45',
        duration: '97s',
        description: 'Virtuelle Maschine mit ausgewähltem Template erstellen',
        icon: Server
      },
      {
        id: 'step-3',
        name: 'Netzwerk konfigurieren',
        status: 'completed' as const,
        startTime: '10:16:45',
        endTime: '10:17:12',
        duration: '27s',
        description: 'Netzwerkschnittstellen und Floating-IP zuweisen',
        icon: Network
      },
      {
        id: 'step-4',
        name: 'Storage anbinden',
        status: 'completed' as const,
        startTime: '10:17:12',
        endTime: '10:18:34',
        duration: '82s',
        description: 'Persistenten Speicher konfigurieren und mounten',
        icon: HardDrive
      },
      {
        id: 'step-5',
        name: 'Software installieren',
        status: 'completed' as const,
        startTime: '10:18:34',
        endTime: '10:21:15',
        duration: '161s',
        description: 'Jupyter, Python-Pakete und Abhängigkeiten installieren',
        icon: Settings
      },
      {
        id: 'step-6',
        name: 'Sicherheitseinstellungen anwenden',
        status: 'completed' as const,
        startTime: '10:21:15',
        endTime: '10:22:48',
        duration: '93s',
        description: 'Firewall-Regeln und Security Groups konfigurieren',
        icon: Shield
      }
    ]
  },
  'CS202 - GitLab Server': {
    id: 'deploy-2',
    name: 'CS202 - GitLab Server',
    status: 'running' as const,
    course: 'Software Engineering',
    startedAt: '30.12.2025, 08:30 Uhr',
    completedAt: '30.12.2025, 08:41 Uhr',
    progress: 100,
    resources: {
      cpu: 8,
      ram: 16,
      storage: 100
    },
    steps: [
      {
        id: 'step-1',
        name: 'OpenStack-Ressourcen prüfen',
        status: 'completed' as const,
        startTime: '08:30:05',
        endTime: '08:30:11',
        duration: '6s',
        description: 'Verfügbarkeit von CPU, RAM und Speicher überprüfen',
        icon: Server
      },
      {
        id: 'step-2',
        name: 'VM-Instanz erstellen',
        status: 'completed' as const,
        startTime: '08:30:11',
        endTime: '08:32:23',
        duration: '132s',
        description: 'Virtuelle Maschine mit GitLab-Template erstellen',
        icon: Server
      },
      {
        id: 'step-3',
        name: 'Netzwerk konfigurieren',
        status: 'completed' as const,
        startTime: '08:32:23',
        endTime: '08:33:01',
        duration: '38s',
        description: 'Netzwerkschnittstellen und Floating-IP zuweisen',
        icon: Network
      },
      {
        id: 'step-4',
        name: 'Storage anbinden',
        status: 'completed' as const,
        startTime: '08:33:01',
        endTime: '08:34:45',
        duration: '104s',
        description: 'Persistenten Speicher für Git-Repositories konfigurieren',
        icon: HardDrive
      },
      {
        id: 'step-5',
        name: 'GitLab installieren',
        status: 'completed' as const,
        startTime: '08:34:45',
        endTime: '08:39:12',
        duration: '267s',
        description: 'GitLab CE und PostgreSQL-Datenbank installieren',
        icon: Settings
      },
      {
        id: 'step-6',
        name: 'Sicherheitseinstellungen anwenden',
        status: 'completed' as const,
        startTime: '08:39:12',
        endTime: '08:41:05',
        duration: '113s',
        description: 'SSL-Zertifikate und Authentifizierung konfigurieren',
        icon: Shield
      }
    ]
  },
  'CS305 - Kubernetes Cluster': {
    id: 'deploy-3',
    name: 'CS305 - Kubernetes Cluster',
    status: 'deploying' as const,
    course: 'Cloud Computing',
    startedAt: '30.12.2025, 13:25 Uhr',
    progress: 65,
    currentStep: 'Software installieren - Kubernetes Control Plane wird eingerichtet...',
    estimatedTimeRemaining: '3-4 Minuten',
    resources: {
      cpu: 12,
      ram: 32,
      storage: 150
    },
    steps: [
      {
        id: 'step-1',
        name: 'OpenStack-Ressourcen prüfen',
        status: 'completed' as const,
        startTime: '13:25:03',
        endTime: '13:25:09',
        duration: '6s',
        description: 'Verfügbarkeit von CPU, RAM und Speicher überprüfen',
        icon: Server
      },
      {
        id: 'step-2',
        name: 'VM-Instanz erstellen',
        status: 'completed' as const,
        startTime: '13:25:09',
        endTime: '13:27:45',
        duration: '156s',
        description: 'Multiple VMs für K8s-Cluster erstellen (1 Master, 3 Worker)',
        icon: Server
      },
      {
        id: 'step-3',
        name: 'Netzwerk konfigurieren',
        status: 'completed' as const,
        startTime: '13:27:45',
        endTime: '13:28:42',
        duration: '57s',
        description: 'Pod-Netzwerk und Service-Mesh konfigurieren',
        icon: Network
      },
      {
        id: 'step-4',
        name: 'Storage anbinden',
        status: 'completed' as const,
        startTime: '13:28:42',
        endTime: '13:30:15',
        duration: '93s',
        description: 'Cinder-Volumes für PersistentVolumeClaims bereitstellen',
        icon: HardDrive
      },
      {
        id: 'step-5',
        name: 'Software installieren',
        status: 'in-progress' as const,
        startTime: '13:30:15',
        description: 'Kubernetes (kubeadm, kubelet, kubectl) und Container Runtime installieren',
        icon: Settings
      },
      {
        id: 'step-6',
        name: 'Sicherheitseinstellungen anwenden',
        status: 'pending' as const,
        description: 'RBAC, Network Policies und Pod Security Policies konfigurieren',
        icon: Shield
      }
    ]
  },
  'CS410 - Pentest Lab': {
    id: 'deploy-4',
    name: 'CS410 - Pentest Lab',
    status: 'running' as const,
    course: 'Cybersicherheit',
    startedAt: '29.12.2025, 14:20 Uhr',
    completedAt: '29.12.2025, 14:29 Uhr',
    progress: 100,
    resources: {
      cpu: 6,
      ram: 12,
      storage: 80
    },
    steps: [
      {
        id: 'step-1',
        name: 'OpenStack-Ressourcen prüfen',
        status: 'completed' as const,
        startTime: '14:20:01',
        endTime: '14:20:07',
        duration: '6s',
        description: 'Verfügbarkeit von CPU, RAM und Speicher überprüfen',
        icon: Server
      },
      {
        id: 'step-2',
        name: 'VM-Instanz erstellen',
        status: 'completed' as const,
        startTime: '14:20:07',
        endTime: '14:22:15',
        duration: '128s',
        description: 'Virtuelle Maschine mit Kali Linux Template erstellen',
        icon: Server
      },
      {
        id: 'step-3',
        name: 'Netzwerk konfigurieren',
        status: 'completed' as const,
        startTime: '14:22:15',
        endTime: '14:23:05',
        duration: '50s',
        description: 'Isoliertes Testnetzwerk für Penetrationstests einrichten',
        icon: Network
      },
      {
        id: 'step-4',
        name: 'Storage anbinden',
        status: 'completed' as const,
        startTime: '14:23:05',
        endTime: '14:24:28',
        duration: '83s',
        description: 'Speicher für Capture-Dateien und Logs bereitstellen',
        icon: HardDrive
      },
      {
        id: 'step-5',
        name: 'Software installieren',
        status: 'completed' as const,
        startTime: '14:24:28',
        endTime: '14:27:45',
        duration: '197s',
        description: 'Pentest-Tools: Metasploit, Burp Suite, Nmap, Wireshark installieren',
        icon: Settings
      },
      {
        id: 'step-6',
        name: 'Sicherheitseinstellungen anwenden',
        status: 'completed' as const,
        startTime: '14:27:45',
        endTime: '14:29:12',
        duration: '87s',
        description: 'Netzwerk-Isolation und Zugriffsbeschränkungen konfigurieren',
        icon: Shield
      }
    ]
  },
  'CS150 - Entwicklungs-VM': {
    id: 'deploy-5',
    name: 'CS150 - Entwicklungs-VM',
    status: 'failed' as const,
    course: 'Einführung in die Programmierung',
    startedAt: '27.12.2025, 09:15 Uhr',
    progress: 42,
    error: 'Nicht genügend Speicherplatz verfügbar. Quota überschritten (3.2TB / 3.0TB benötigt).',
    resources: {
      cpu: 4,
      ram: 8,
      storage: 200
    },
    steps: [
      {
        id: 'step-1',
        name: 'OpenStack-Ressourcen prüfen',
        status: 'completed' as const,
        startTime: '09:15:02',
        endTime: '09:15:08',
        duration: '6s',
        description: 'Verfügbarkeit von CPU, RAM und Speicher überprüfen',
        icon: Server
      },
      {
        id: 'step-2',
        name: 'VM-Instanz erstellen',
        status: 'completed' as const,
        startTime: '09:15:08',
        endTime: '09:17:02',
        duration: '114s',
        description: 'Virtuelle Maschine mit Ubuntu Development Template erstellen',
        icon: Server
      },
      {
        id: 'step-3',
        name: 'Netzwerk konfigurieren',
        status: 'completed' as const,
        startTime: '09:17:02',
        endTime: '09:17:35',
        duration: '33s',
        description: 'Netzwerkschnittstellen und Floating-IP zuweisen',
        icon: Network
      },
      {
        id: 'step-4',
        name: 'Storage anbinden',
        status: 'failed' as const,
        startTime: '09:17:35',
        endTime: '09:17:52',
        duration: '17s',
        description: 'Persistenten Speicher konfigurieren und mounten',
        icon: HardDrive
      },
      {
        id: 'step-5',
        name: 'Software installieren',
        status: 'pending' as const,
        description: 'VS Code, Node.js, Python, Git und Build-Tools installieren',
        icon: Settings
      },
      {
        id: 'step-6',
        name: 'Sicherheitseinstellungen anwenden',
        status: 'pending' as const,
        description: 'SSH-Keys und Firewall-Regeln konfigurieren',
        icon: Shield
      }
    ]
  }
};

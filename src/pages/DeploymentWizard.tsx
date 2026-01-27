import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Server,
  Settings,
  Users,
  Network,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import {
  getTemplate,
  getTemplateVersion,
  getTemplateVersions,
  type TemplateDto,
  type TemplateVersionDto,
  type TemplateParameter,
} from "../api/templates";
import {
  getMyCourses,
  getCourseGroups,
  createCourseGroup,
  getCourseMembers,
  getGroupMembers,
  addGroupMembers,
  type CourseDto,
  type CourseGroupDto,
  type CourseMemberDto,
  type GroupMemberDto,
} from "../api/courses";
import {
  createDeployment,
  type DeploymentCreateRequest,
} from "../api/deployments";

interface DeploymentWizardProps {
  templateId: string;
  onCancel: () => void;
  onComplete: (deploymentId: string) => void;
}

// Step mapping for icons
const stepIcons: Record<string, any> = {
  template: Server,
  konfiguration: Settings,
  zugriff: Users,
  netzwerk: Network,
};

export function DeploymentWizard({
  templateId,
  onCancel,
  onComplete,
}: DeploymentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);

  // Data loading states
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(
    null,
  );
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [courseGroups, setCourseGroups] = useState<CourseGroupDto[]>([]);
  const [courseMembers, setCourseMembers] = useState<CourseMemberDto[]>([]);
  const [groupMembersMap, setGroupMembersMap] = useState<
    Record<string, GroupMemberDto[]>
  >({});
  const [templateVersions, setTemplateVersions] = useState<
    TemplateVersionDto[]
  >([]);
  const [templateVersionData, setTemplateVersionData] =
    useState<TemplateVersionDto | null>(null);
  const [loading, setLoading] = useState({
    template: true,
    courses: true,
    version: false,
    groups: false,
    members: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [deploymentName, setDeploymentName] = useState<string>("");
  const [deploymentMode, setDeploymentMode] = useState<string>("per_student");
  const [runtime, setRuntime] = useState<string>("3");

  // Group creation state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Form values - stores all parameter values
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Load template and courses on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading({
          template: true,
          courses: true,
          version: false,
          groups: false,
          members: false,
        });
        setError(null);

        const [templateRes, coursesRes] = await Promise.all([
          getTemplate(templateId),
          getMyCourses({ page_size: 100 }),
        ]);

        setSelectedTemplate(templateRes.data);
        setCourses(coursesRes.data);
        setLoading({
          template: false,
          courses: false,
          version: false,
          groups: false,
          members: false,
        });
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(
          err instanceof Error ? err.message : "Fehler beim Laden der Daten",
        );
        setLoading({
          template: false,
          courses: false,
          version: false,
          groups: false,
          members: false,
        });
      }
    };

    loadData();
  }, [templateId]);

  // Load template versions and auto-select active version
  useEffect(() => {
    if (!templateId) return;

    const loadVersions = async () => {
      try {
        setLoading((prev) => ({ ...prev, version: true }));
        const res = await getTemplateVersions(templateId, false);
        setTemplateVersions(res.data);

        // Auto-select the active version (or latest if no active)
        const activeVersion = res.data.find((v) => v.is_active);
        const latestVersion = res.data.length > 0 ? res.data[0] : null; // Assuming sorted by newest first
        const versionToSelect = activeVersion || latestVersion;

        if (versionToSelect) {
          setSelectedVersionId(versionToSelect.id);
        }

        setLoading((prev) => ({ ...prev, version: false }));
      } catch (err) {
        console.error("Failed to load template versions:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Fehler beim Laden der Versionen",
        );
        setLoading((prev) => ({ ...prev, version: false }));
      }
    };

    loadVersions();
  }, [templateId]);

  // Function to load course groups
  const loadCourseGroups = useCallback(async () => {
    if (!selectedCourseId) return;

    try {
      setLoading((prev) => ({ ...prev, groups: true }));
      const res = await getCourseGroups(selectedCourseId);
      setCourseGroups(res.data);
      setLoading((prev) => ({ ...prev, groups: false }));
    } catch (err) {
      console.error("Failed to load course groups:", err);
      // Don't set error for 404 - endpoint might not be implemented yet
      if (err instanceof Error && err.message.includes("404")) {
        // Endpoint not implemented yet
        setCourseGroups([]);
      } else {
        setError(
          err instanceof Error ? err.message : "Fehler beim Laden der Gruppen",
        );
      }
      setLoading((prev) => ({ ...prev, groups: false }));
    }
  }, [selectedCourseId]);

  // Load course members when course is selected
  const loadCourseMembers = useCallback(async () => {
    if (!selectedCourseId) return;

    try {
      setLoading((prev) => ({ ...prev, members: true }));
      const res = await getCourseMembers(selectedCourseId);
      setCourseMembers(res.data);
      setLoading((prev) => ({ ...prev, members: false }));
    } catch (err) {
      console.error("Failed to load course members:", err);
      setError(
        err instanceof Error ? err.message : "Fehler beim Laden der Studenten",
      );
      setLoading((prev) => ({ ...prev, members: false }));
    }
  }, [selectedCourseId]);

  // Load course members when course is selected
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseMembers([]);
      return;
    }
    loadCourseMembers();
  }, [selectedCourseId, loadCourseMembers]);

  // Load group members for each group
  const loadGroupMembers = useCallback(
    async (groupId: string) => {
      if (!selectedCourseId) return;

      try {
        const res = await getGroupMembers(selectedCourseId, groupId);
        setGroupMembersMap((prev) => ({
          ...prev,
          [groupId]: res.data,
        }));
      } catch (err) {
        console.error(`Failed to load members for group ${groupId}:`, err);
      }
    },
    [selectedCourseId],
  );

  // Load course groups when course is selected and mode is per_group
  useEffect(() => {
    if (!selectedCourseId || deploymentMode !== "per_group") {
      setCourseGroups([]);
      setSelectedGroupIds([]);
      setGroupMembersMap({});
      return;
    }

    loadCourseGroups().then(() => {
      // After groups are loaded, load members for each group
      courseGroups.forEach((group) => {
        loadGroupMembers(group.id);
      });
    });
  }, [selectedCourseId, deploymentMode, loadCourseGroups]);

  // Reset selected groups when deployment mode changes
  useEffect(() => {
    if (deploymentMode !== "per_group") {
      setSelectedGroupIds([]);
    }
  }, [deploymentMode]);

  // Load template version data when version is selected
  useEffect(() => {
    if (!selectedVersionId) {
      setTemplateVersionData(null);
      setFormValues({});
      return;
    }

    const loadVersionData = async () => {
      try {
        setLoading((prev) => ({ ...prev, version: true }));
        const res = await getTemplateVersion(selectedVersionId, true);
        setTemplateVersionData(res.data);

        // Initialize form values with defaults
        const defaults: Record<string, any> = {};
        if (res.data.parameters) {
          res.data.parameters.forEach((param) => {
            if (param.default !== undefined && param.default !== null) {
              defaults[param.name] = param.default;
            }
          });
        }
        setFormValues(defaults);

        setLoading((prev) => ({ ...prev, version: false }));
      } catch (err) {
        console.error("Failed to load template version:", err);
        setError(
          err instanceof Error ? err.message : "Fehler beim Laden der Version",
        );
        setLoading((prev) => ({ ...prev, version: false }));
      }
    };

    loadVersionData();
  }, [selectedVersionId]);

  // Group parameters by step (excluding template step as it has fixed fields)
  const parametersByStep = useMemo(() => {
    if (!templateVersionData?.parameters) return {};

    const grouped: Record<string, TemplateParameter[]> = {};
    templateVersionData.parameters.forEach((param) => {
      if (param.hidden) return; // Skip hidden parameters
      if (param.step === "template") return; // Skip template step parameters (we have fixed fields)

      const step = param.step || "konfiguration"; // Default to konfiguration if no step specified
      if (!grouped[step]) {
        grouped[step] = [];
      }
      grouped[step].push(param);
    });

    return grouped;
  }, [templateVersionData]);

  // Generate steps dynamically from parameters
  const steps = useMemo(() => {
    const stepOrder = ["konfiguration", "zugriff", "netzwerk"];
    const stepNames: Record<string, string> = {
      template: "Template",
      konfiguration: "Konfiguration",
      zugriff: "Zugriff",
      netzwerk: "Netzwerk",
    };

    // Always start with template step
    const templateStep = {
      id: 0,
      name: "Template",
      stepKey: "template",
      icon: Server,
      description: "Application-Template auswählen",
    };

    // Add config steps that have parameters
    const configSteps = stepOrder
      .filter(
        (step) => parametersByStep[step] && parametersByStep[step].length > 0,
      )
      .map((step, index) => ({
        id: index + 1,
        name: stepNames[step] || step,
        stepKey: step,
        icon: stepIcons[step] || Settings,
        description: `Parameter für ${stepNames[step] || step} konfigurieren`,
      }));

    // Always add overview step at the end
    const overviewStep = {
      id: configSteps.length + 1,
      name: "Übersicht",
      stepKey: "overview",
      icon: CheckCircle2,
      description: "Überprüfen und deployen",
    };

    return [templateStep, ...configSteps, overviewStep];
  }, [parametersByStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleParameterChange = (paramName: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleCreateGroup = async () => {
    if (!selectedCourseId || !newGroupName.trim()) return;

    try {
      setIsCreatingGroup(true);
      setError(null);
      const groupRes = await createCourseGroup(
        selectedCourseId,
        newGroupName.trim(),
      );
      const newGroup = groupRes.data;

      // If members were selected, add them to the group
      if (selectedMemberIds.length > 0) {
        try {
          await addGroupMembers(
            selectedCourseId,
            newGroup.id,
            selectedMemberIds,
          );
        } catch (err) {
          console.error("Failed to add members to group:", err);
          // Continue even if adding members fails
        }
      }

      setNewGroupName("");
      setSelectedMemberIds([]);
      setShowCreateGroup(false);
      // Reload groups and members
      await loadCourseGroups();
      if (selectedMemberIds.length > 0) {
        await loadGroupMembers(newGroup.id);
      }
    } catch (err) {
      console.error("Failed to create group:", err);
      setError(
        err instanceof Error ? err.message : "Fehler beim Erstellen der Gruppe",
      );
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedVersionId || !selectedCourseId || !deploymentName.trim()) {
      setError("Bitte füllen Sie alle erforderlichen Felder aus");
      return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      if (!templateVersionData?.parameters) {
        setError("Template-Parameter konnten nicht geladen werden");
        setIsDeploying(false);
        return;
      }

      // Build heat_parameters: Start with all default values from template parameters
      const heatParameters: Record<string, any> = {};

      // First, set all default values from template parameters
      templateVersionData.parameters.forEach((param: TemplateParameter) => {
        // Use default value from parameter if available
        if (param.default !== undefined && param.default !== null) {
          heatParameters[param.name] = param.default;
        }
      });

      // Override with user-entered values from formValues (these are the values the user changed)
      // formValues contains all parameters (defaults + user changes), so we use them directly
      Object.keys(formValues).forEach((key) => {
        const userValue = formValues[key];
        // Skip 'students' parameter for per_course mode - it will be auto-generated by backend
        if (deploymentMode === "per_course" && key === "students") {
          return;
        }
        // Use user value if it's not empty/null/undefined
        // This will override the default we just set
        if (userValue !== null && userValue !== undefined && userValue !== "") {
          heatParameters[key] = userValue;
        }
      });

      // Special handling for stack_label: use deployment name if provided, otherwise keep default
      if (deploymentName.trim()) {
        const stackLabelSlug = deploymentName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        if (stackLabelSlug) {
          heatParameters.stack_label = stackLabelSlug;
        }
      }

      // Build deployment request
      const deploymentData: DeploymentCreateRequest = {
        name: deploymentName.trim() || undefined,
        template_version_id: selectedVersionId,
        course_id: selectedCourseId,
        deployment_mode: deploymentMode,
        config_json: JSON.stringify(formValues),
        heat_parameters: heatParameters,
        access_types: ["ssh", "web"],
      };

      // Add group_ids or course_member_ids based on deployment mode
      if (deploymentMode === "per_group") {
        if (selectedGroupIds.length === 0) {
          setError("Bitte wählen Sie mindestens eine Gruppe aus");
          setIsDeploying(false);
          return;
        }
        deploymentData.group_ids = selectedGroupIds;
      } else if (deploymentMode === "per_student") {
        // TODO: Implement student selection UI
        // For now, we'll let the backend handle it (all students)
        deploymentData.course_member_ids = undefined;
      }

      const deployment = await createDeployment(deploymentData);

      console.log("Deployment created successfully:", deployment.data);
      // Navigate to deployment details page with the new deployment ID
      onComplete(deployment.data.id);
    } catch (err) {
      console.error("Deployment failed:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Deployment");
    } finally {
      setIsDeploying(false);
    }
  };

  const renderParameterField = (param: TemplateParameter) => {
    // Get value from formValues, fallback to default, then to empty value based on type
    let value = formValues[param.name];
    if (value === undefined || value === null) {
      value = param.default;
    }
    if (value === undefined || value === null) {
      if (param.type === "boolean") {
        value = false;
      } else if (param.type === "number") {
        value = "";
      } else {
        value = "";
      }
    }

    const fieldId = `param-${param.name}`;

    // Handle enum (dropdown)
    if (param.enum && param.enum.length > 0) {
      return (
        <div key={param.name} className="space-y-2">
          <Label htmlFor={fieldId}>
            {param.label || param.name}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Select
            value={String(value || "")}
            onValueChange={(val) => handleParameterChange(param.name, val)}
          >
            <SelectTrigger id={fieldId}>
              <SelectValue
                placeholder={`Wählen Sie ${param.label || param.name}`}
              />
            </SelectTrigger>
            <SelectContent>
              {param.enum.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {param.description && (
            <p className="text-xs text-slate-500">{param.description}</p>
          )}
        </div>
      );
    }

    // Handle boolean (switch)
    if (param.type === "boolean") {
      return (
        <div
          key={param.name}
          className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
        >
          <div className="flex-1">
            <Label htmlFor={fieldId}>
              {param.label || param.name}
              {param.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {param.description && (
              <p className="text-xs text-slate-500 mt-1">{param.description}</p>
            )}
          </div>
          <Switch
            id={fieldId}
            checked={
              value === true || value === "true" || value === 1 || value === "1"
            }
            onCheckedChange={(checked) =>
              handleParameterChange(param.name, checked)
            }
          />
        </div>
      );
    }

    // Handle number
    if (param.type === "number") {
      return (
        <div key={param.name} className="space-y-2">
          <Label htmlFor={fieldId}>
            {param.label || param.name}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={fieldId}
            type="number"
            value={value !== null && value !== undefined ? String(value) : ""}
            onChange={(e) =>
              handleParameterChange(
                param.name,
                e.target.value ? Number(e.target.value) : "",
              )
            }
            required={param.required}
          />
          {param.description && (
            <p className="text-xs text-slate-500">{param.description}</p>
          )}
        </div>
      );
    }

    // Handle string (default)
    return (
      <div key={param.name} className="space-y-2">
        <Label htmlFor={fieldId}>
          {param.label || param.name}
          {param.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Input
          id={fieldId}
          type={param.secret ? "password" : "text"}
          value={value !== null && value !== undefined ? String(value) : ""}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
          required={param.required}
          placeholder={param.description}
        />
        {param.description && (
          <p className="text-xs text-slate-500">{param.description}</p>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    const currentStepData = steps[currentStep];
    if (!currentStepData) return null;

    // Template selection step
    if (currentStepData.stepKey === "template") {
      return (
        <div className="space-y-6">
          {/* Template Info (read-only) */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-slate-500">Template</Label>
                <p className="text-sm font-medium text-slate-900 mt-1">
                  {selectedTemplate?.name || "Lädt..."}
                </p>
              </div>
            </div>
            {selectedTemplate?.description && (
              <p className="text-xs text-slate-600 mt-2">
                {selectedTemplate.description}
              </p>
            )}
          </div>

          <div>
            <Label>Version</Label>
            <Select
              value={selectedVersionId}
              onValueChange={setSelectedVersionId}
              disabled={loading.version || templateVersions.length === 0}
            >
              <SelectTrigger className="mt-2">
                <SelectValue
                  placeholder={
                    loading.version
                      ? "Lädt..."
                      : templateVersions.length === 0
                        ? "Keine Versionen verfügbar"
                        : "Version auswählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templateVersions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {version.version}{" "}
                    {version.is_active && (
                      <Badge variant="secondary" className="ml-2">
                        Aktiv
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading.version && (
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <span>Lade Versionen...</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="deployment-name">Deployment-Name</Label>
            <Input
              id="deployment-name"
              placeholder="z.B. CS101-Jupyter-Herbst2024"
              className="mt-2"
              value={deploymentName}
              onChange={(e) => setDeploymentName(e.target.value)}
            />
          </div>

          <div>
            <Label>Kurszuweisung</Label>
            <Select
              value={selectedCourseId}
              onValueChange={setSelectedCourseId}
              disabled={loading.courses}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Kurs auswählen" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name} ({course.semester})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Gruppieren</Label>
            <Select value={deploymentMode} onValueChange={setDeploymentMode}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* <SelectItem value="per_student">Pro Student (jeder Student bekommt eine eigene VM)</SelectItem>
                <SelectItem value="per_group">Pro Gruppe (Studenten werden in Gruppen aufgeteilt)</SelectItem> */}
                <SelectItem value="per_course">
                  Pro Kurs (eine VM für den gesamten Kurs)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-2">
              Wählen Sie, wie die Studenten aus dem Kurs aufgeteilt werden
              sollen
            </p>
          </div>

          {/* Group selection - only shown when per_group mode is selected */}
          {deploymentMode === "per_group" && (
            <div>
              <Label>Gruppen auswählen</Label>
              {!selectedCourseId ? (
                <span className="text-xs text-slate-500 mt-2 text-amber-600 block">
                  Bitte wählen Sie zuerst einen Kurs aus
                </span>
              ) : loading.groups ? (
                <div className="flex items-center gap-2 text-slate-500 mt-2">
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Lade Gruppen...</span>
                </div>
              ) : error && error.includes("404") ? (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs text-amber-800 block">
                    Der API-Endpoint für Gruppen ist noch nicht implementiert.
                    Bitte verwenden Sie vorerst einen anderen Deployment-Modus.
                  </span>
                </div>
              ) : courseGroups.length === 0 ? (
                <div className="mt-2 space-y-3">
                  <span className="text-xs text-slate-500 text-amber-600 block">
                    Keine Gruppen für diesen Kurs verfügbar.
                  </span>
                  {!showCreateGroup ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateGroup(true)}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Erste Gruppe erstellen
                    </Button>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div>
                        <Label htmlFor="new-group-name" className="text-xs">
                          Gruppenname
                        </Label>
                        <Input
                          id="new-group-name"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="z.B. Gruppe A"
                          className="mt-1"
                          disabled={isCreatingGroup}
                        />
                      </div>

                      {/* Student selection */}
                      {loading.members ? (
                        <div className="flex items-center gap-2 text-slate-500">
                          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs">Lade Studenten...</span>
                        </div>
                      ) : courseMembers.length > 0 ? (
                        <div>
                          <Label className="text-xs mb-2 block">
                            Studenten auswählen (optional)
                          </Label>
                          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white">
                            {courseMembers.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center space-x-2 py-1"
                              >
                                <input
                                  type="checkbox"
                                  id={`member-${member.id}`}
                                  checked={selectedMemberIds.includes(
                                    member.id,
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMemberIds([
                                        ...selectedMemberIds,
                                        member.id,
                                      ]);
                                    } else {
                                      setSelectedMemberIds(
                                        selectedMemberIds.filter(
                                          (id) => id !== member.id,
                                        ),
                                      );
                                    }
                                  }}
                                  className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                                  disabled={isCreatingGroup}
                                />
                                <Label
                                  htmlFor={`member-${member.id}`}
                                  className="text-xs font-normal cursor-pointer flex-1"
                                >
                                  Student {member.user_id.slice(0, 8)}...
                                </Label>
                              </div>
                            ))}
                          </div>
                          {selectedMemberIds.length > 0 && (
                            <span className="text-xs text-slate-500 mt-1 block">
                              {selectedMemberIds.length} Student(en) ausgewählt
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Keine Studenten im Kurs verfügbar
                        </span>
                      )}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateGroup}
                          disabled={!newGroupName.trim() || isCreatingGroup}
                          className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                        >
                          {isCreatingGroup ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Erstelle...
                            </>
                          ) : (
                            "Erstellen"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCreateGroup(false);
                            setNewGroupName("");
                            setSelectedMemberIds([]);
                          }}
                          disabled={isCreatingGroup}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-4 space-y-3">
                    {courseGroups.map((group) => {
                      const groupMembers = groupMembersMap[group.id] || [];
                      return (
                        <div
                          key={group.id}
                          className="space-y-2 pb-2 border-b border-slate-100 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`group-${group.id}`}
                              checked={selectedGroupIds.includes(group.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGroupIds([
                                    ...selectedGroupIds,
                                    group.id,
                                  ]);
                                  // Load members if not already loaded
                                  if (!groupMembersMap[group.id]) {
                                    loadGroupMembers(group.id);
                                  }
                                } else {
                                  setSelectedGroupIds(
                                    selectedGroupIds.filter(
                                      (id) => id !== group.id,
                                    ),
                                  );
                                }
                              }}
                              className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                            />
                            <Label
                              htmlFor={`group-${group.id}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {group.name}
                              {groupMembers.length > 0 && (
                                <span className="text-xs text-slate-500 ml-2">
                                  ({groupMembers.length} Student
                                  {groupMembers.length !== 1 ? "en" : ""})
                                </span>
                              )}
                            </Label>
                          </div>
                          {groupMembers.length > 0 && (
                            <div className="ml-6 space-y-1">
                              <span className="text-xs text-slate-500">
                                Studenten:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {groupMembers.map((member) => (
                                  <Badge
                                    key={member.id}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {member.user_id.slice(0, 8)}...
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Create new group button */}
                  {!showCreateGroup ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateGroup(true)}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Neue Gruppe erstellen
                    </Button>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div>
                        <Label htmlFor="new-group-name" className="text-xs">
                          Gruppenname
                        </Label>
                        <Input
                          id="new-group-name"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="z.B. Gruppe A"
                          className="mt-1"
                          disabled={isCreatingGroup}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              newGroupName.trim() &&
                              !isCreatingGroup
                            ) {
                              handleCreateGroup();
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateGroup}
                          disabled={!newGroupName.trim() || isCreatingGroup}
                          className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                        >
                          {isCreatingGroup ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Erstelle...
                            </>
                          ) : (
                            "Erstellen"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCreateGroup(false);
                            setNewGroupName("");
                          }}
                          disabled={isCreatingGroup}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedGroupIds.length > 0 && (
                <span className="text-xs text-slate-500 mt-2 block">
                  {selectedGroupIds.length} Gruppe(n) ausgewählt
                </span>
              )}
            </div>
          )}

          <div>
            <Label>Laufzeit</Label>
            <Select value={runtime} onValueChange={setRuntime}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Monat</SelectItem>
                <SelectItem value="3">3 Monate</SelectItem>
                <SelectItem value="6">6 Monate</SelectItem>
                <SelectItem value="12">1 Jahr</SelectItem>
                <SelectItem value="24">2 Jahre</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Nach Ablauf werden die Ressourcen automatisch freigegeben
            </p>
          </div>

          {loading.version && (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Lade Template-Version...</span>
            </div>
          )}
        </div>
      );
    }

    // Overview step
    if (currentStepData.stepKey === "overview") {
      const selectedCourse = courses.find((c) => c.id === selectedCourseId);
      const deploymentModeLabels: Record<string, string> = {
        // per_student: 'Pro Student',
        // per_group: 'Pro Gruppe',
        per_course: "Pro Kurs",
      };
      const runtimeLabels: Record<string, string> = {
        "1": "1 Monat",
        "3": "3 Monate",
        "6": "6 Monate",
        "12": "1 Jahr",
        "24": "2 Jahre",
      };

      return (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-lg">
            <h3 className="text-slate-900 mb-4">Deployment-Zusammenfassung</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Template:</span>
                <span className="text-sm text-slate-900">
                  {selectedTemplate?.name || "-"}{" "}
                  {templateVersionData?.version
                    ? `(${templateVersionData.version})`
                    : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Deployment-Name:</span>
                <span className="text-sm text-slate-900">
                  {deploymentName || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Kurs:</span>
                <span className="text-sm text-slate-900">
                  {selectedCourse
                    ? `${selectedCourse.name} (${selectedCourse.semester})`
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Gruppieren:</span>
                <span className="text-sm text-slate-900">
                  {deploymentModeLabels[deploymentMode] || deploymentMode}
                </span>
              </div>
              {deploymentMode === "per_group" &&
                selectedGroupIds.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">
                      Ausgewählte Gruppen:
                    </span>
                    <span className="text-sm text-slate-900">
                      {selectedGroupIds.length} Gruppe(n):{" "}
                      {courseGroups
                        .filter((g) => selectedGroupIds.includes(g.id))
                        .map((g) => g.name)
                        .join(", ")}
                    </span>
                  </div>
                )}
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Laufzeit:</span>
                <span className="text-sm text-slate-900">
                  {runtimeLabels[runtime] || runtime}
                </span>
              </div>
            </div>
          </div>

          {templateVersionData?.parameters &&
            templateVersionData.parameters.filter((p) => !p.hidden).length >
              0 && (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Template-Parameter
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {templateVersionData.parameters
                    .filter((p) => !p.hidden)
                    .map((param) => {
                      const value =
                        formValues[param.name] !== undefined
                          ? formValues[param.name]
                          : param.default !== undefined
                            ? param.default
                            : null;

                      return (
                        <div
                          key={param.name}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-slate-600">
                            {param.label || param.name}:
                          </span>
                          <span className="text-slate-900">
                            {value !== null && value !== undefined
                              ? typeof value === "boolean"
                                ? value
                                  ? "Ja"
                                  : "Nein"
                                : String(value)
                              : "-"}
                          </span>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900">Bereit zum Deployen</p>
                <p className="text-xs text-amber-700 mt-1">
                  Das Deployment dauert etwa 5-10 Minuten. Sie werden
                  benachrichtigt, wenn es bereit ist.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Parameter configuration steps
    const stepParams = parametersByStep[currentStepData.stepKey] || [];

    if (stepParams.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          Keine Parameter für diesen Schritt verfügbar.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {stepParams.map((param) => renderParameterField(param))}
      </div>
    );
  };

  if (error && !loading.template && !loading.courses) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-900 font-medium mb-2">Fehler beim Laden</p>
          <p className="text-slate-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2">Application deployen</h1>
        <p className="text-slate-600">
          Konfigurieren und deployen Sie Ihre Application
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === index;
          const isCompleted = currentStep > index;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${
                    isCompleted
                      ? "bg-teal-500 text-white"
                      : isActive
                        ? "bg-teal-500 text-white ring-4 ring-teal-100"
                        : "bg-slate-100 text-slate-400"
                  }
                `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <p
                  className={`text-sm mt-2 ${isActive ? "text-slate-900" : "text-slate-500"}`}
                >
                  {step.name}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 -mt-6 ${isCompleted ? "bg-teal-500" : "bg-slate-200"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{steps[currentStep]?.name}</CardTitle>
          <CardDescription>{steps[currentStep]?.description}</CardDescription>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handlePrevious}
          disabled={isDeploying}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? "Abbrechen" : "Zurück"}
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            className="bg-teal-500 hover:bg-teal-600 text-white"
            disabled={
              (currentStep === 0 &&
                (!selectedVersionId ||
                  !selectedCourseId ||
                  !deploymentName ||
                  (deploymentMode === "per_group" &&
                    selectedGroupIds.length === 0))) ||
              isDeploying
            }
          >
            Weiter
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {isDeploying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Wird deployed...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Application deployen
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

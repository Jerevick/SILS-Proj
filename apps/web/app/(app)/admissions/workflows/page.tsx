"use client";

/**
 * Admissions Workflows — Configurable multi-step admissions workflows for this institution.
 * Drag-and-drop steps, assign roles (Admissions, Academic Affairs, HoD, Dean, Registry).
 * Pre-loaded default templates for Certificate, Diploma, Undergraduate, Postgraduate.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  Tabs,
  Tab,
} from "@mui/material";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  FileText,
  GraduationCap,
} from "lucide-react";
import type { ProgrammeType, AiAssistLevel } from "@prisma/client";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    secondary: { main: "#a855f7" },
    background: { default: "#030014", paper: "rgba(15, 15, 35, 0.8)" },
  },
  typography: { fontFamily: "var(--font-display), system-ui, sans-serif" },
});

const PROGRAMME_TYPES: ProgrammeType[] = [
  "CERTIFICATE",
  "DIPLOMA",
  "UNDERGRADUATE",
  "POSTGRADUATE",
];

const PROGRAMME_LABELS: Record<ProgrammeType, string> = {
  CERTIFICATE: "Certificate",
  DIPLOMA: "Diploma",
  UNDERGRADUATE: "Undergraduate",
  POSTGRADUATE: "Postgraduate",
};

const AI_ASSIST_LEVELS: { value: AiAssistLevel; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "SUMMARY", label: "AI summary" },
  { value: "FULL", label: "Full AI assist" },
];

const ROLE_OPTIONS = [
  "Admissions",
  "Academic Affairs",
  "HoD",
  "Dean",
  "Registry",
];

const DEFAULT_TEMPLATES: Record<
  ProgrammeType,
  { name: string; steps: { roleName: string; department?: string; requiredApproval: boolean; aiAssistLevel: AiAssistLevel }[] }
> = {
  CERTIFICATE: {
    name: "Certificate admissions",
    steps: [
      { roleName: "Admissions", requiredApproval: true, aiAssistLevel: "SUMMARY" },
      { roleName: "Academic Affairs", requiredApproval: true, aiAssistLevel: "NONE" },
      { roleName: "Registry", requiredApproval: true, aiAssistLevel: "NONE" },
    ],
  },
  DIPLOMA: {
    name: "Diploma admissions",
    steps: [
      { roleName: "Admissions", requiredApproval: true, aiAssistLevel: "SUMMARY" },
      { roleName: "Academic Affairs", requiredApproval: true, aiAssistLevel: "NONE" },
      { roleName: "HoD", requiredApproval: true, aiAssistLevel: "NONE" },
      { roleName: "Registry", requiredApproval: true, aiAssistLevel: "NONE" },
    ],
  },
  UNDERGRADUATE: {
    name: "Undergraduate admissions",
    steps: [
      { roleName: "Admissions", requiredApproval: true, aiAssistLevel: "FULL" },
      { roleName: "Academic Affairs", requiredApproval: true, aiAssistLevel: "SUMMARY" },
      { roleName: "HoD", requiredApproval: true, aiAssistLevel: "NONE" },
      { roleName: "Dean", requiredApproval: true, aiAssistLevel: "NONE" },
      { roleName: "Registry", requiredApproval: true, aiAssistLevel: "NONE" },
    ],
  },
  POSTGRADUATE: {
    name: "Postgraduate admissions",
    steps: [
      { roleName: "Admissions", requiredApproval: true, aiAssistLevel: "FULL" },
      { roleName: "Academic Affairs", requiredApproval: true, aiAssistLevel: "SUMMARY" },
      { roleName: "HoD", requiredApproval: true, aiAssistLevel: "NONE" },
      { roleName: "Dean", requiredApproval: true, aiAssistLevel: "NONE" },
      { roleName: "Registry", requiredApproval: true, aiAssistLevel: "NONE" },
    ],
  },
};

type StepEdit = {
  stepOrder: number;
  roleName: string;
  department: string;
  requiredApproval: boolean;
  aiAssistLevel: AiAssistLevel;
};

async function fetchWorkflows() {
  const res = await fetch("/api/workflows");
  if (!res.ok) throw new Error("Failed to fetch workflows");
  return res.json();
}

async function saveWorkflow(
  programmeType: ProgrammeType,
  name: string,
  steps: StepEdit[]
) {
  const res = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      programmeType,
      name,
      steps: steps.map((s, i) => ({
        stepOrder: i,
        roleName: s.roleName,
        department: s.department || null,
        requiredApproval: s.requiredApproval,
        aiAssistLevel: s.aiAssistLevel,
      })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Save failed");
  return data;
}

function stepsFromWorkflow(w: { workflowSteps: { stepOrder: number; roleName: string; department: string | null; requiredApproval: boolean; aiAssistLevel: AiAssistLevel }[] }): StepEdit[] {
  return [...w.workflowSteps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((s) => ({
      stepOrder: s.stepOrder,
      roleName: s.roleName,
      department: s.department ?? "",
      requiredApproval: s.requiredApproval,
      aiAssistLevel: s.aiAssistLevel,
    }));
}

export default function AdmissionsWorkflowsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProgrammeType>("UNDERGRADUATE");

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: fetchWorkflows,
  });

  const [edits, setEdits] = useState<Record<ProgrammeType, { name: string; steps: StepEdit[] }>>(() => ({
    CERTIFICATE: { name: DEFAULT_TEMPLATES.CERTIFICATE.name, steps: DEFAULT_TEMPLATES.CERTIFICATE.steps.map((s, i) => ({ stepOrder: i, roleName: s.roleName, department: "", requiredApproval: s.requiredApproval, aiAssistLevel: s.aiAssistLevel })) },
    DIPLOMA: { name: DEFAULT_TEMPLATES.DIPLOMA.name, steps: DEFAULT_TEMPLATES.DIPLOMA.steps.map((s, i) => ({ stepOrder: i, roleName: s.roleName, department: "", requiredApproval: s.requiredApproval, aiAssistLevel: s.aiAssistLevel })) },
    UNDERGRADUATE: { name: DEFAULT_TEMPLATES.UNDERGRADUATE.name, steps: DEFAULT_TEMPLATES.UNDERGRADUATE.steps.map((s, i) => ({ stepOrder: i, roleName: s.roleName, department: "", requiredApproval: s.requiredApproval, aiAssistLevel: s.aiAssistLevel })) },
    POSTGRADUATE: { name: DEFAULT_TEMPLATES.POSTGRADUATE.name, steps: DEFAULT_TEMPLATES.POSTGRADUATE.steps.map((s, i) => ({ stepOrder: i, roleName: s.roleName, department: "", requiredApproval: s.requiredApproval, aiAssistLevel: s.aiAssistLevel })) },
  }));

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (workflows.length === 0 || workflowsLoading) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setEdits((prev) => {
      const next = { ...prev };
      for (const w of workflows as { programmeType: ProgrammeType; name: string; workflowSteps: { stepOrder: number; roleName: string; department: string | null; requiredApproval: boolean; aiAssistLevel: AiAssistLevel }[] }[]) {
        next[w.programmeType] = {
          name: w.name,
          steps: stepsFromWorkflow(w),
        };
      }
      return next;
    });
  }, [workflows, workflowsLoading]);

  const saveMutation = useMutation({
    mutationFn: ({
      programmeType,
      name,
      steps,
    }: {
      programmeType: ProgrammeType;
      name: string;
      steps: StepEdit[];
    }) => saveWorkflow(programmeType, name, steps),
    onSuccess: (_, { programmeType }) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(`${PROGRAMME_LABELS[programmeType]} workflow saved`);
    },
    onError: (err) => toast.error("Save failed", { description: (err as Error).message }),
  });

  const current = edits[tab];

  const moveStep = (from: number, dir: 1 | -1) => {
    const to = from + dir;
    if (to < 0 || to >= current.steps.length) return;
    setEdits((prev) => {
      const next = { ...prev, [tab]: { ...prev[tab], steps: [...prev[tab].steps] } };
      const s = next[tab].steps;
      [s[from], s[to]] = [s[to], s[from]];
      s.forEach((st, i) => (st.stepOrder = i));
      return next;
    });
  };

  const addStep = () => {
    setEdits((prev) => {
      const steps = [...prev[tab].steps, { stepOrder: prev[tab].steps.length, roleName: "Admissions", department: "", requiredApproval: true, aiAssistLevel: "NONE" as AiAssistLevel }];
      return { ...prev, [tab]: { ...prev[tab], steps } };
    });
  };

  const removeStep = (index: number) => {
    if (current.steps.length <= 1) return;
    setEdits((prev) => {
      const steps = prev[tab].steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i }));
      return { ...prev, [tab]: { ...prev[tab], steps } };
    });
  };

  const updateStep = (index: number, field: keyof StepEdit, value: string | boolean) => {
    setEdits((prev) => {
      const steps = [...prev[tab].steps];
      (steps[index] as Record<string, unknown>)[field] = value;
      return { ...prev, [tab]: { ...prev[tab], steps } };
    });
  };

  const loadTemplate = (programmeType: ProgrammeType) => {
    const t = DEFAULT_TEMPLATES[programmeType];
    setEdits((prev) => ({
      ...prev,
      [programmeType]: {
        name: t.name,
        steps: t.steps.map((s, i) => ({ stepOrder: i, roleName: s.roleName, department: "", requiredApproval: s.requiredApproval, aiAssistLevel: s.aiAssistLevel })),
      },
    }));
    toast.success(`Loaded default ${PROGRAMME_LABELS[programmeType]} template`);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            component={Link}
            href="/admissions/dashboard"
            startIcon={<ArrowLeft className="h-4 w-4" />}
            sx={{ color: "rgba(226,232,240,0.8)", textTransform: "none" }}
          >
            Admissions
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-neon-cyan" />
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">
              Admissions Workflows
            </h1>
          </div>
        </div>

        <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <CardContent>
            <Typography color="text.secondary">
              Configure admission workflows per programme type for your institution. Reorder steps and assign roles.
            </Typography>
          </CardContent>
        </Card>

        {workflowsLoading ? (
          <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <CardContent>
              <Typography color="text.secondary">Loading workflows…</Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            <Tabs
              value={tab}
              onChange={(_, v: ProgrammeType) => setTab(v)}
              sx={{
                "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
                "& .Mui-selected": { color: "#00f5ff" },
              }}
            >
              {PROGRAMME_TYPES.map((t) => (
                <Tab key={t} label={PROGRAMME_LABELS[t]} value={t} />
              ))}
            </Tabs>

            <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <CardHeader
                title={`${PROGRAMME_LABELS[tab]} workflow`}
                subheader="Reorder with up/down. Assign roles: Admissions → Academic Affairs → HoD → Dean → Registry."
                action={
                  <>
                    <Button
                      size="small"
                      startIcon={<GraduationCap className="h-4 w-4" />}
                      onClick={() => loadTemplate(tab)}
                      sx={{ mr: 1, color: "rgba(148,163,184,0.9)", textTransform: "none" }}
                    >
                      Load default template
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Save className="h-4 w-4" />}
                      onClick={() =>
                        saveMutation.mutate({
                          programmeType: tab,
                          name: current.name,
                          steps: current.steps,
                        })
                      }
                      disabled={saveMutation.isPending}
                      sx={{ textTransform: "none", bgcolor: "#00f5ff", color: "#030014" }}
                    >
                      Save
                    </Button>
                  </>
                }
              />
              <CardContent>
                <TextField
                  fullWidth
                  label="Workflow name"
                  value={current.name}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [tab]: { ...prev[tab], name: e.target.value } }))
                  }
                  size="small"
                  sx={{ mb: 2, "& .MuiOutlinedInput-root": { color: "#e2e8f0" } }}
                />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Steps (order defines pipeline)
                </Typography>
                {current.steps.map((step, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <IconButton size="small" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                        <ChevronUp className="h-4 w-4" />
                      </IconButton>
                      <GripVertical className="h-4 w-4 text-slate-500" style={{ margin: "2px 0" }} />
                      <IconButton size="small" onClick={() => moveStep(index, 1)} disabled={index === current.steps.length - 1}>
                        <ChevronDown className="h-4 w-4" />
                      </IconButton>
                    </Box>
                    <Box sx={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Role</InputLabel>
                        <Select
                          value={step.roleName}
                          label="Role"
                          onChange={(e) => updateStep(index, "roleName", e.target.value)}
                          sx={{ color: "#e2e8f0" }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <MenuItem key={r} value={r}>{r}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        label="Department (optional)"
                        value={step.department}
                        onChange={(e) => updateStep(index, "department", e.target.value)}
                        sx={{ width: 140, "& .MuiOutlinedInput-root": { color: "#e2e8f0" } }}
                      />
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>AI assist</InputLabel>
                        <Select
                          value={step.aiAssistLevel}
                          label="AI assist"
                          onChange={(e) => updateStep(index, "aiAssistLevel", e.target.value as AiAssistLevel)}
                          sx={{ color: "#e2e8f0" }}
                        >
                          {AI_ASSIST_LEVELS.map((a) => (
                            <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={step.requiredApproval}
                            onChange={(_, v) => updateStep(index, "requiredApproval", v)}
                            size="small"
                          />
                        }
                        label="Required approval"
                        sx={{ color: "rgba(226,232,240,0.8)" }}
                      />
                      {step.requiredApproval && (
                        <Chip size="small" label="Required" color="primary" variant="outlined" />
                      )}
                    </Box>
                    <IconButton size="small" color="error" onClick={() => removeStep(index)} disabled={current.steps.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  startIcon={<Plus className="h-4 w-4" />}
                  onClick={addStep}
                  sx={{ mt: 1, color: "#00f5ff", textTransform: "none" }}
                >
                  Add step
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ThemeProvider>
  );
}

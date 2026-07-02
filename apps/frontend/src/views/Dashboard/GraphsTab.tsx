"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChart";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CategoryScale,
  Chart as ChartJS,
  Tooltip as ChartTooltip,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
} from "chart.js";
import ZoomPlugin from "chartjs-plugin-zoom";
import { useCallback, useEffect, useState } from "react";
import ReactGridLayout, { WidthProvider } from "react-grid-layout";
import {
  type AlertEvent,
  type DashboardGraph,
  type Problem,
  type WidgetConfig,
  api,
} from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { DashboardPageManager } from "../../components/DashboardPageManager";
import { AddGraphDialog } from "./AddGraphDialog";
import { WidgetCard } from "./WidgetCard";

const GridLayout = WidthProvider(ReactGridLayout);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  ZoomPlugin,
);
// ── Tab panels ────────────────────────────────────────────────────────

export const GraphsTab = () => {
  const tick = useRefreshTick();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saveScope, setSaveScope] = useState<"user" | "team">("user");
  const [page, setPage] = useState("dashboard");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [allAlertEvents, setAllAlertEvents] = useState<AlertEvent[]>([]);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);

  const fetchEvents = useCallback(() => {
    api
      .getAlertEvents(500)
      .then((r) => setAllAlertEvents(r.events))
      .catch(() => {});
  }, []);

  const fetchProblems = useCallback(() => {
    api
      .getProblems()
      .then((r) => setAllProblems(r.problems))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      fetchEvents();
      fetchProblems();
    }
  }, [tick]);

  useEffect(() => {
    api
      .getDashboardLayout("user")
      .then((res) => {
        const userWidgets = res.widgets ?? [];
        if (userWidgets.length > 0) {
          setWidgets(userWidgets);
          setSaveScope("user");
          return;
        }
        // No personal layout — fall back to team layout
        return api.getDashboardLayout("team").then((teamRes) => {
          const teamWidgets = teamRes.widgets ?? [];
          setWidgets(teamWidgets);
          setSaveScope(teamWidgets.length > 0 ? "team" : "user");
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleLayoutChange = useCallback(
    (layout: { i: string; x: number; y: number; w: number; h: number }[]) => {
      setWidgets((prev) => {
        const next = prev.map((w) => {
          const l = layout.find((item) => item.i === w.i);
          return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
        });
        const moved = next.some((w, i) => {
          const o = prev[i];
          return o && (w.x !== o.x || w.y !== o.y || w.w !== o.w || w.h !== o.h);
        });
        if (moved) setIsDirty(true);
        return next;
      });
    },
    [],
  );

  const addWidget = useCallback((graph: DashboardGraph) => {
    setWidgets((prev) => {
      const col = prev.length % 2 === 0 ? 0 : 6;
      const row = Math.floor(prev.length / 2) * 4;
      const widget: WidgetConfig = {
        i: `${graph.graphid}-${Date.now()}`,
        graphid: graph.graphid,
        graphName: graph.name,
        hostId: graph.hosts[0]?.hostid,
        hostName: graph.hosts[0]?.host,
        mode: "chartjs",
        periodIdx: 5,
        x: col,
        y: row,
        w: 6,
        h: 4,
      };
      return [...prev, widget];
    });
    setIsDirty(true);
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.i !== id));
    setIsDirty(true);
  }, []);

  const updateWidget = useCallback((id: string, updates: Partial<WidgetConfig>) => {
    setWidgets((prev) => prev.map((w) => (w.i === id ? { ...w, ...updates } : w)));
    setIsDirty(true);
  }, []);

  const saveLayout = useCallback(async () => {
    setSaving(true);
    try {
      await api.saveDashboardLayout(saveScope, widgets, page);
      setIsDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save layout");
    } finally {
      setSaving(false);
    }
  }, [saveScope, widgets, page]);

  const handlePageChange = useCallback(
    (newPage: string) => {
      setPage(newPage);
      api
        .getDashboardLayout(saveScope, newPage)
        .then((res) => {
          setWidgets(res.widgets ?? []);
          setIsDirty(false);
        })
        .catch(() => {});
    },
    [saveScope],
  );

  const layout = widgets.map((w) => ({
    i: w.i,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: 2,
    minH: 3,
  }));

  const existingIds = widgets.map((w) => w.graphid);

  if (!loaded) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <Skeleton key={i} variant="rectangular" height={320} sx={{ borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      <TabHeader
        title="Graphs"
        description="Zabbix native graphs arranged in a customisable drag-and-drop layout."
      />
      {/* Toolbar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Graphs
        </Typography>
        {widgets.length > 0 && (
          <Chip
            label={widgets.length}
            size="small"
            sx={{ height: 18, fontSize: "0.68rem", minWidth: 24 }}
          />
        )}
        <Box sx={{ flex: 1 }} />

        {/* Add graph */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={() => setAddOpen(true)}
          sx={{ fontSize: "0.75rem", height: 28, px: 1.5 }}
        >
          Add Graph
        </Button>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Dashboard pages */}
        <DashboardPageManager
          kind="dashboard"
          scope={saveScope}
          page={page}
          onPageChange={handlePageChange}
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Layout scope + save */}
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          Layout:
        </Typography>
        <Select
          size="small"
          value={saveScope}
          onChange={(e) => {
            const newScope = e.target.value as "user" | "team";
            setSaveScope(newScope);
            api
              .getDashboardLayout(newScope, page)
              .then((res) => {
                setWidgets(res.widgets ?? []);
                setIsDirty(false);
              })
              .catch(() => {});
          }}
          sx={{
            fontSize: "0.72rem",
            height: 28,
            "& .MuiSelect-select": { py: 0, px: 1, lineHeight: "28px" },
          }}
        >
          <MenuItem value="user" sx={{ fontSize: "0.78rem" }}>
            Mine
          </MenuItem>
          <MenuItem value="team" sx={{ fontSize: "0.78rem" }}>
            Team
          </MenuItem>
        </Select>
        <Tooltip title={saving ? "Saving…" : isDirty ? "Save layout" : "Layout saved"}>
          <span>
            <IconButton
              size="small"
              color={isDirty ? "warning" : "default"}
              onClick={saveLayout}
              disabled={!isDirty || saving}
            >
              <SaveIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Empty state */}
      {widgets.length === 0 ? (
        <Box
          sx={{
            py: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <ShowChartOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography color="text.secondary" variant="body2">
            No graphs added yet
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            Add your first graph
          </Button>
        </Box>
      ) : (
        <GridLayout
          layout={layout}
          cols={12}
          rowHeight={80}
          draggableHandle=".drag-handle"
          onLayoutChange={handleLayoutChange}
          style={{ minHeight: 200 }}
        >
          {widgets.map((w) => (
            <div key={w.i}>
              <WidgetCard
                widget={w}
                onRemove={() => removeWidget(w.i)}
                onUpdate={(updates) => updateWidget(w.i, updates)}
                alertEvents={allAlertEvents}
                problems={allProblems.filter((p) => p.hostname === w.hostName)}
              />
            </div>
          ))}
        </GridLayout>
      )}

      <AddGraphDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addWidget}
        existingIds={existingIds}
      />
      <Snackbar
        open={!!saveError}
        autoHideDuration={4000}
        onClose={() => setSaveError("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity="error"
          onClose={() => setSaveError("")}
          variant="filled"
          sx={{ fontSize: "0.82rem" }}
        >
          {saveError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

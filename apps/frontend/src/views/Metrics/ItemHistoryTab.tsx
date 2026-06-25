"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import ReactGridLayout, { WidthProvider } from "react-grid-layout";
import { type MetricWidgetConfig, api } from "../../app/api";
import { DashboardPageManager } from "../../components/DashboardPageManager";
import { AddMetricDialog, type ItemDef, MetricWidgetCard } from "./shared";

const GridLayout = WidthProvider(ReactGridLayout);

// ── Item Graphs tab (widget grid) ────────────────────────────────────

export const ItemHistoryTab = () => {
  const [widgets, setWidgets] = useState<MetricWidgetConfig[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saveScope, setSaveScope] = useState<"user" | "team">("user");
  const [page, setPage] = useState("metrics");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const confirmIf = (dirty: boolean, msg: string, action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    setConfirmMsg(msg);
    setConfirmAction(() => action);
  };
  // Alert events fetched once — used to draw breach markers on each chart
  const [allAlertEvents, setAllAlertEvents] = useState<import("../../app/api").AlertEvent[]>([]);

  useEffect(() => {
    const fetchEvents = () => {
      api
        .getAlertEvents(500)
        .then((r) => setAllAlertEvents(r.events))
        .catch(() => {});
    };
    fetchEvents();
    const timer = setInterval(fetchEvents, 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api
      .getMetricLayout("user")
      .then((res) => {
        const userWidgets = res.widgets ?? [];
        if (userWidgets.length > 0) {
          setWidgets(userWidgets);
          setSaveScope("user");
          return;
        }
        // No personal layout — fall back to team layout
        return api.getMetricLayout("team").then((teamRes) => {
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

  const addWidget = useCallback((hostname: string, item: ItemDef) => {
    setWidgets((prev) => {
      const col = prev.length % 2 === 0 ? 0 : 6;
      const row = Math.floor(prev.length / 2) * 4;
      const widget: MetricWidgetConfig = {
        i: `${item.itemid}-${Date.now()}`,
        hostname,
        itemid: item.itemid,
        itemName: item.name,
        units: "",
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

  const updateWidget = useCallback((id: string, updates: Partial<MetricWidgetConfig>) => {
    setWidgets((prev) => prev.map((w) => (w.i === id ? { ...w, ...updates } : w)));
    setIsDirty(true);
  }, []);

  const saveLayout = useCallback(async () => {
    setSaving(true);
    try {
      await api.saveMetricLayout(saveScope, widgets, page);
      setIsDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save layout");
    } finally {
      setSaving(false);
    }
  }, [saveScope, widgets, page]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: confirmIf is a stable inline helper, not a dep
  const handlePageChange = useCallback(
    (newPage: string) => {
      confirmIf(isDirty, "You have unsaved changes. Switch page and discard them?", () => {
        setPage(newPage);
        api
          .getMetricLayout(saveScope, newPage)
          .then((res) => {
            setWidgets(res.widgets ?? []);
            setIsDirty(false);
          })
          .catch(() => {});
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveScope, isDirty],
  );

  const layout = widgets.map((w) => ({
    i: w.i,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: 4,
    minH: 3,
  }));

  const existingIds = widgets.map((w) => w.itemid);

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
      {/* Toolbar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Item Graphs
        </Typography>
        {widgets.length > 0 && (
          <Chip
            label={widgets.length}
            size="small"
            sx={{ height: 18, fontSize: "0.68rem", minWidth: 24 }}
          />
        )}
        <Box sx={{ flex: 1 }} />

        {/* Add metric */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={() => setAddOpen(true)}
          sx={{ fontSize: "0.75rem", height: 28, px: 1.5 }}
        >
          Add Metric
        </Button>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Dashboard pages */}
        <DashboardPageManager
          kind="metrics"
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
            confirmIf(isDirty, "You have unsaved changes. Switch layout and discard them?", () => {
              setSaveScope(newScope);
              api
                .getMetricLayout(newScope, page)
                .then((res) => {
                  setWidgets(res.widgets ?? []);
                  setIsDirty(false);
                })
                .catch(() => {});
            });
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
            No metric widgets added yet
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            Add your first metric
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
              <MetricWidgetCard
                widget={w}
                onRemove={() => removeWidget(w.i)}
                onUpdate={(updates) => updateWidget(w.i, updates)}
                alertEvents={allAlertEvents.filter((e) => e.item_id === w.itemid)}
              />
            </div>
          ))}
        </GridLayout>
      )}

      <AddMetricDialog
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
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Unsaved changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirmMsg}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              confirmAction?.();
              setConfirmAction(null);
            }}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

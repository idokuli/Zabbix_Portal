"use client";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type DashboardGraph, type Host, type WidgetConfig, api } from "../../app/api";
import { SearchableSelect } from "../../components/SearchableSelect";

const PRESET_COLORS = [
  "#1BA7F5",
  "#00BFB3",
  "#F77B00",
  "#9170B8",
  "#E7664C",
  "#22C55E",
  "#F44336",
  "#FFC107",
  "#8B5CF6",
  "#D36086",
  "#54B399",
  "#D6BF57",
];

export const GraphConfigDialog = ({
  open,
  widget,
  onClose,
  onSave,
}: {
  open: boolean;
  widget: WidgetConfig;
  onClose: () => void;
  onSave: (updates: Partial<WidgetConfig>) => void;
}) => {
  const [title, setTitle] = useState(widget.customTitle ?? "");
  const [lineColor, setLineColor] = useState(widget.lineColor ?? "");

  // Host / graph swap
  const [hosts, setHosts] = useState<Host[]>([]);
  const [newHostId, setNewHostId] = useState("");
  const [newGraphs, setNewGraphs] = useState<DashboardGraph[]>([]);
  const [graphsLoading, setGraphsLoading] = useState(false);
  const [newGraphId, setNewGraphId] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(widget.customTitle ?? "");
      setLineColor(widget.lineColor ?? "");
      setNewHostId(widget.hostId ?? "");
      setNewGraphs([]);
      setNewGraphId("");
      api
        .listHosts()
        .then((r) => setHosts(r.hosts))
        .catch(() => {});
    }
  }, [open, widget.customTitle, widget.lineColor, widget.hostId]);

  useEffect(() => {
    if (!newHostId) {
      setNewGraphs([]);
      setNewGraphId("");
      return;
    }
    setGraphsLoading(true);
    setNewGraphId("");
    api
      .getDashboardGraphs(newHostId)
      .then((r) => setNewGraphs(r.graphs))
      .catch(() => setNewGraphs([]))
      .finally(() => setGraphsLoading(false));
  }, [newHostId]);

  const handleSave = () => {
    const updates: Partial<WidgetConfig> = {
      customTitle: title.trim() || undefined,
      lineColor: lineColor || undefined,
    };
    if (newGraphId) {
      const g = newGraphs.find((g) => g.graphid === newGraphId);
      if (g) {
        updates.graphid = g.graphid;
        updates.graphName = g.name;
        const host = g.hosts[0];
        if (host) {
          updates.hostId = host.hostid;
          updates.hostName = host.host;
        }
        // Reset custom title when swapping to a new graph
        if (!title.trim()) updates.customTitle = undefined;
      }
    }
    onSave(updates);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={700}>Configure Graph</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.5 }}>
              Current graph
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {widget.customTitle ?? widget.graphName}
            </Typography>
            {widget.hostName && (
              <Typography variant="caption" color="text.secondary">
                Host: {widget.hostName}
              </Typography>
            )}
          </Box>
          <TextField
            size="small"
            label="Custom title"
            placeholder={widget.graphName}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            helperText="Leave blank to use the graph name"
          />
          <Box>
            <Typography
              variant="body2"
              sx={{ mb: 1, color: "text.secondary", fontSize: "0.78rem" }}
            >
              Accent color (first series)
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              {PRESET_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setLineColor(lineColor === c ? "" : c)}
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    bgcolor: c,
                    cursor: "pointer",
                    border: lineColor === c ? "2px solid white" : "2px solid transparent",
                    outline: lineColor === c ? `2px solid ${c}` : "none",
                    transition: "transform 0.12s",
                    "&:hover": { transform: "scale(1.25)" },
                  }}
                />
              ))}
              {lineColor && (
                <Typography
                  variant="caption"
                  onClick={() => setLineColor("")}
                  sx={{
                    color: "text.disabled",
                    cursor: "pointer",
                    "&:hover": { color: "text.primary" },
                  }}
                >
                  Reset
                </Typography>
              )}
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600, fontSize: "0.8rem" }}>
              Change host / graph
            </Typography>
            <Stack spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Host</InputLabel>
                <SearchableSelect
                  label="Host"
                  value={newHostId}
                  onChange={(e) => setNewHostId(e.target.value)}
                >
                  <MenuItem value="">
                    <Typography sx={{ color: "text.disabled", fontSize: "0.82rem" }}>
                      Select a host…
                    </Typography>
                  </MenuItem>
                  {hosts.map((h) => (
                    <MenuItem key={h.hostid} value={h.hostid}>
                      {h.host}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
              {newHostId && (
                <FormControl size="small" fullWidth>
                  <InputLabel>Graph</InputLabel>
                  <Select
                    label="Graph"
                    value={newGraphId}
                    onChange={(e) => setNewGraphId(e.target.value)}
                    disabled={graphsLoading}
                  >
                    {graphsLoading ? (
                      <MenuItem value="" disabled>
                        Loading…
                      </MenuItem>
                    ) : newGraphs.length === 0 ? (
                      <MenuItem value="" disabled>
                        No graphs found for this host
                      </MenuItem>
                    ) : (
                      newGraphs.map((g) => (
                        <MenuItem key={g.graphid} value={g.graphid}>
                          {g.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

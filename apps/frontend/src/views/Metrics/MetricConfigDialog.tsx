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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type Host, type MetricWidgetConfig, api } from "../../app/api";
import { SearchableSelect } from "../../components/SearchableSelect";
import { PRESET_COLORS } from "./shared";

export const MetricConfigDialog = ({
  open,
  widget,
  onClose,
  onSave,
}: {
  open: boolean;
  widget: MetricWidgetConfig;
  onClose: () => void;
  onSave: (updates: Partial<MetricWidgetConfig>) => void;
}) => {
  const [title, setTitle] = useState(widget.customTitle ?? "");
  const [lineColor, setLineColor] = useState(widget.lineColor ?? "");

  const [hosts, setHosts] = useState<Host[]>([]);
  const [newHostname, setNewHostname] = useState("");
  const [newItems, setNewItems] = useState<{ itemid: string; name: string; key_: string }[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newItemId, setNewItemId] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(widget.customTitle ?? "");
      setLineColor(widget.lineColor ?? "");
      setNewHostname("");
      setNewItems([]);
      setNewItemId("");
      api
        .listHosts()
        .then((r) => setHosts(r.hosts))
        .catch(() => {});
    }
  }, [open, widget.customTitle, widget.lineColor]);

  useEffect(() => {
    if (!newHostname) {
      setNewItems([]);
      setNewItemId("");
      return;
    }
    setItemsLoading(true);
    setNewItemId("");
    api
      .listItems(newHostname)
      .then((r) => setNewItems(r.items.filter((i) => i.value_type === "0" || i.value_type === "3")))
      .catch(() => setNewItems([]))
      .finally(() => setItemsLoading(false));
  }, [newHostname]);

  const handleSave = () => {
    const updates: Partial<MetricWidgetConfig> = {
      customTitle: title.trim() || undefined,
      lineColor: lineColor || undefined,
    };
    if (newItemId && newHostname) {
      const item = newItems.find((i) => i.itemid === newItemId);
      if (item) {
        updates.itemid = item.itemid;
        updates.itemName = item.name;
        updates.hostname = newHostname;
        if (!title.trim()) {
          updates.customTitle = undefined;
        }
      }
    }
    onSave(updates);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={700}>Configure Metric</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ display: "block", mb: 0.25 }}
              >
                Host
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {widget.hostname}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ display: "block", mb: 0.25 }}
              >
                Item
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {widget.customTitle ?? widget.itemName}
              </Typography>
            </Box>
          </Box>
          <TextField
            size="small"
            label="Custom title"
            placeholder={widget.itemName}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            helperText="Leave blank to use the item name"
          />
          <Box>
            <Typography
              variant="body2"
              sx={{ mb: 1, color: "text.secondary", fontSize: "0.78rem" }}
            >
              Line color
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
              Change host / item
            </Typography>
            <Stack spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Host</InputLabel>
                <SearchableSelect
                  label="Host"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                >
                  <MenuItem value="">
                    <Typography sx={{ color: "text.disabled", fontSize: "0.82rem" }}>
                      Select a host…
                    </Typography>
                  </MenuItem>
                  {hosts.map((h) => (
                    <MenuItem key={h.hostid} value={h.host}>
                      {h.host}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
              {newHostname && (
                <FormControl size="small" fullWidth>
                  <InputLabel>Item</InputLabel>
                  <SearchableSelect
                    label="Item"
                    value={newItemId}
                    onChange={(e) => setNewItemId(e.target.value)}
                    disabled={itemsLoading}
                  >
                    {itemsLoading ? (
                      <MenuItem value="" disabled>
                        Loading…
                      </MenuItem>
                    ) : newItems.length === 0 ? (
                      <MenuItem value="" disabled>
                        No numeric items on this host
                      </MenuItem>
                    ) : (
                      newItems.map((i) => (
                        <MenuItem key={i.itemid} value={i.itemid}>
                          <Box>
                            <Typography sx={{ fontSize: "0.82rem", fontWeight: 500 }}>
                              {i.name}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: "0.7rem",
                                fontFamily: "monospace",
                                color: "text.secondary",
                              }}
                            >
                              {i.key_}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </SearchableSelect>
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

"use client";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import type { Host } from "../../app/api";

type EditForm = {
  name: string;
  ip: string;
  proxyid: string;
  status: string;
  group_ids: string[];
};

export const EditHostDialog = ({
  editHost,
  onClose,
  editForm,
  setEditForm,
  proxies,
  hostGroups,
  editSaving,
  onSave,
}: {
  editHost: Host | null;
  onClose: () => void;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  proxies: Array<{ proxyid: string; name: string }>;
  hostGroups: Array<{ groupid: string; name: string }>;
  editSaving: boolean;
  onSave: () => void;
}) => (
  <Dialog open={!!editHost} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ fontWeight: 700 }}>Edit host — {editHost?.host}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField
          size="small"
          label="Display name"
          value={editForm.name}
          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          fullWidth
          helperText="Shown in Zabbix UI. Leave matching hostname to keep it simple."
        />
        <TextField
          size="small"
          label="IP address"
          value={editForm.ip}
          onChange={(e) => setEditForm((f) => ({ ...f, ip: e.target.value }))}
          fullWidth
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Proxy</InputLabel>
          <Select
            label="Proxy"
            value={editForm.proxyid}
            onChange={(e) => setEditForm((f) => ({ ...f, proxyid: e.target.value }))}
          >
            <MenuItem value="">No proxy — direct monitoring</MenuItem>
            {proxies.map((p) => (
              <MenuItem key={p.proxyid} value={p.proxyid}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={editForm.status}
            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
          >
            <MenuItem value="0">Enabled</MenuItem>
            <MenuItem value="1">Disabled</MenuItem>
          </Select>
        </FormControl>
        {hostGroups.length > 0 && (
          <FormControl size="small" fullWidth>
            <InputLabel>Host groups</InputLabel>
            <Select
              multiple
              label="Host groups"
              value={editForm.group_ids}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, group_ids: e.target.value as string[] }))
              }
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as string[]).map((id) => {
                    const g = hostGroups.find((g) => g.groupid === id);
                    return <Chip key={id} label={g?.name ?? id} size="small" sx={{ height: 20 }} />;
                  })}
                </Box>
              )}
            >
              {hostGroups.map((g) => (
                <MenuItem key={g.groupid} value={g.groupid}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={editSaving}>
        Cancel
      </Button>
      <Button variant="contained" onClick={onSave} disabled={editSaving}>
        {editSaving ? <CircularProgress size={14} /> : "Save"}
      </Button>
    </DialogActions>
  </Dialog>
);

"use client";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { SEVERITY_CONFIG } from "./shared";

export const EditTriggerDialog = ({
  open,
  onClose,
  editName,
  setEditName,
  editEventName,
  setEditEventName,
  editSeverity,
  setEditSeverity,
  editEnabled,
  setEditEnabled,
  editExpression,
  setEditExpression,
  editComments,
  setEditComments,
  editSaving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editName: string;
  setEditName: (v: string) => void;
  editEventName: string;
  setEditEventName: (v: string) => void;
  editSeverity: number;
  setEditSeverity: (v: number) => void;
  editEnabled: boolean;
  setEditEnabled: (v: boolean) => void;
  editExpression: string;
  setEditExpression: (v: string) => void;
  editComments: string;
  setEditComments: (v: string) => void;
  editSaving: boolean;
  onSave: () => void;
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Edit Trigger</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField
          size="small"
          fullWidth
          required
          label="Trigger name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
        />

        <TextField
          size="small"
          fullWidth
          label="Event name"
          value={editEventName}
          onChange={(e) => setEditEventName(e.target.value)}
          helperText="Optional — shown in the Problems view"
        />

        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
            Severity
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {SEVERITY_CONFIG.map((s) => (
              <Button
                key={s.severity}
                size="small"
                variant={editSeverity === s.severity ? "contained" : "outlined"}
                onClick={() => setEditSeverity(s.severity)}
                sx={{
                  fontSize: "0.72rem",
                  textTransform: "none",
                  borderColor: s.color,
                  color: editSeverity === s.severity ? "#fff" : s.color,
                  bgcolor: editSeverity === s.severity ? s.color : "transparent",
                  "&:hover": {
                    bgcolor: editSeverity === s.severity ? s.color : `${s.color}18`,
                    borderColor: s.color,
                  },
                }}
              >
                {s.label}
              </Button>
            ))}
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Switch checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />
          }
          label={editEnabled ? "Enabled" : "Disabled"}
        />

        <TextField
          size="small"
          fullWidth
          label="Expression"
          value={editExpression}
          onChange={(e) => setEditExpression(e.target.value)}
          multiline
          minRows={2}
          InputProps={{ sx: { fontFamily: "monospace", fontSize: "0.8rem" } }}
          helperText="Edit with care — must be a valid Zabbix trigger expression."
        />

        <TextField
          size="small"
          fullWidth
          label="Description"
          value={editComments}
          onChange={(e) => setEditComments(e.target.value)}
          multiline
          minRows={2}
          placeholder="Optional notes about this trigger"
        />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        disabled={editSaving || !editName.trim() || !editExpression.trim()}
        onClick={onSave}
      >
        {editSaving ? <CircularProgress size={18} /> : "Save"}
      </Button>
    </DialogActions>
  </Dialog>
);

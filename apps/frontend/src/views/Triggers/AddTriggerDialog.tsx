"use client";
import {
  Alert,
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
  Typography,
} from "@mui/material";
import type { Host } from "../../app/api";
import { SEVERITY_CONFIG, operators } from "./shared";

type FormHostItem = {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  delay: string;
};

export const AddTriggerDialog = ({
  open,
  onClose,
  hosts,
  formHost,
  setFormHost,
  formItemKey,
  setFormItemKey,
  formHostItems,
  formHostItemsLoading,
  formName,
  setFormName,
  formEventName,
  setFormEventName,
  formSeverity,
  setFormSeverity,
  isStringItem,
  formMatchType,
  setFormMatchType,
  formPattern,
  setFormPattern,
  formOperator,
  setFormOperator,
  formThreshold,
  setFormThreshold,
  formComments,
  setFormComments,
  saving,
  onItemSelected,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  hosts: Host[];
  formHost: string;
  setFormHost: (v: string) => void;
  formItemKey: string;
  setFormItemKey: (v: string) => void;
  formHostItems: FormHostItem[];
  formHostItemsLoading: boolean;
  formName: string;
  setFormName: (v: string) => void;
  formEventName: string;
  setFormEventName: (v: string) => void;
  formSeverity: number;
  setFormSeverity: (v: number) => void;
  isStringItem: boolean;
  formMatchType: string;
  setFormMatchType: (v: string) => void;
  formPattern: string;
  setFormPattern: (v: string) => void;
  formOperator: string;
  setFormOperator: (v: string) => void;
  formThreshold: string;
  setFormThreshold: (v: string) => void;
  formComments: string;
  setFormComments: (v: string) => void;
  saving: boolean;
  onItemSelected: (item: FormHostItem) => void;
  onAdd: () => void;
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Add Trigger</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <FormControl size="small" fullWidth required>
          <InputLabel>Host</InputLabel>
          <Select value={formHost} label="Host" onChange={(e) => setFormHost(e.target.value)}>
            {hosts.map((h) => (
              <MenuItem key={h.hostid} value={h.host}>
                {h.host}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth required disabled={!formHost || formHostItemsLoading}>
          <InputLabel>Item</InputLabel>
          <Select
            value={formItemKey}
            label="Item"
            onChange={(e) => {
              setFormItemKey(e.target.value);
              const item = formHostItems.find((i) => i.key_ === e.target.value);
              if (item) onItemSelected(item);
            }}
          >
            {formHostItemsLoading ? (
              <MenuItem disabled>
                <CircularProgress size={14} sx={{ mr: 1 }} />
                Loading…
              </MenuItem>
            ) : formHostItems.length === 0 ? (
              <MenuItem disabled>No items found</MenuItem>
            ) : (
              formHostItems.map((i) => (
                <MenuItem key={i.key_} value={i.key_}>
                  {i.name} ({i.key_})
                  {(i.value_type === "1" || i.value_type === "4") && (
                    <Chip
                      label="text"
                      size="small"
                      sx={{ ml: 1, height: 16, fontSize: "0.6rem" }}
                    />
                  )}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        <TextField
          size="small"
          fullWidth
          required
          label="Name"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
        />

        <TextField
          size="small"
          fullWidth
          label="Event name"
          value={formEventName}
          onChange={(e) => setFormEventName(e.target.value)}
          helperText="Optional — shown in the Problems view when this trigger fires"
        />

        {/* Severity — segmented button row */}
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
            Severity
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {SEVERITY_CONFIG.map((s) => (
              <Button
                key={s.severity}
                size="small"
                variant={formSeverity === s.severity ? "contained" : "outlined"}
                onClick={() => setFormSeverity(s.severity)}
                sx={{
                  fontSize: "0.72rem",
                  textTransform: "none",
                  borderColor: s.color,
                  color: formSeverity === s.severity ? "#fff" : s.color,
                  bgcolor: formSeverity === s.severity ? s.color : "transparent",
                  "&:hover": {
                    bgcolor: formSeverity === s.severity ? s.color : `${s.color}18`,
                    borderColor: s.color,
                  },
                }}
              >
                {s.label}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Condition */}
        {isStringItem ? (
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Match type</InputLabel>
              <Select
                value={formMatchType}
                label="Match type"
                onChange={(e) => setFormMatchType(e.target.value)}
              >
                <MenuItem value="like">contains</MenuItem>
                <MenuItem value="notlike">does not contain</MenuItem>
                <MenuItem value="regexp">matches regex</MenuItem>
                <MenuItem value="notregexp">does not match regex</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              required
              label="Pattern"
              value={formPattern}
              onChange={(e) => setFormPattern(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>
        ) : (
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 90 }}>
              <InputLabel>Operator</InputLabel>
              <Select
                value={formOperator}
                label="Operator"
                onChange={(e) => setFormOperator(e.target.value)}
              >
                {operators.map((op) => (
                  <MenuItem key={op.value} value={op.value}>
                    {op.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              required
              label="Threshold"
              value={formThreshold}
              onChange={(e) => setFormThreshold(e.target.value)}
              type="number"
              sx={{ flex: 1 }}
            />
          </Stack>
        )}

        {formHost && formItemKey && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            {isStringItem ? (
              <span>
                Expression:{" "}
                <code>
                  {`find(/${formHost}/${formItemKey},,"${formMatchType.replace(/^not/, "") || "like"}","${formPattern || "?"}")`}
                  {formMatchType.startsWith("not") ? "=0" : "=1"}
                </code>
              </span>
            ) : (
              <span>
                Expression:{" "}
                <code>{`last(/${formHost}/${formItemKey}) ${formOperator} ${formThreshold || "?"}`}</code>
              </span>
            )}
          </Alert>
        )}

        <TextField
          size="small"
          fullWidth
          label="Description"
          value={formComments}
          onChange={(e) => setFormComments(e.target.value)}
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
        disabled={
          saving ||
          !formHost ||
          !formItemKey ||
          !formName ||
          (isStringItem ? formPattern === "" : formThreshold === "")
        }
        onClick={onAdd}
      >
        {saving ? <CircularProgress size={18} /> : "Add"}
      </Button>
    </DialogActions>
  </Dialog>
);

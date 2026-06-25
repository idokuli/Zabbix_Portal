"use client";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

export const ConfirmDelete = ({
  open,
  name,
  onConfirm,
  onClose,
}: { open: boolean; name: string; onConfirm: () => void; onClose: () => void }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle sx={{ fontWeight: 700 }}>Delete?</DialogTitle>
    <DialogContent>
      <Typography>
        Permanently delete <strong>{name}</strong>? This cannot be undone.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button color="error" variant="contained" onClick={onConfirm}>
        Delete
      </Button>
    </DialogActions>
  </Dialog>
);

export const StatusChip = ({ status }: { status: number }) => (
  <Chip
    label={status === 0 ? "Enabled" : "Disabled"}
    size="small"
    color={status === 0 ? "success" : "default"}
    variant="outlined"
    sx={{ height: 18, fontSize: "0.62rem" }}
  />
);

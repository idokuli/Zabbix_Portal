"use client";
import {
  Button,
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
        Permanently delete <strong>{name}</strong>?
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

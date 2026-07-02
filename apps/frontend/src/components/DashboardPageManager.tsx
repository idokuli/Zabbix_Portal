"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type DashboardPage, type DashboardPageKind, api } from "../app/api";
import { ConfirmDelete } from "../app/components/ConfirmDelete";

type DashboardPageManagerProps = {
  kind: DashboardPageKind;
  scope: "user" | "team";
  page: string;
  onPageChange: (page: string) => void;
};

export const DashboardPageManager = ({
  kind,
  scope,
  page,
  onPageChange,
}: DashboardPageManagerProps) => {
  const [pages, setPages] = useState<DashboardPage[]>([
    { page: kind, name: "Default", is_default: true },
  ]);
  const [dialog, setDialog] = useState<"new" | "rename" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    api
      .listDashboardPages(scope, kind)
      .then((res) => setPages(res.pages))
      .catch(() => {});
  }, [scope, kind]);

  const current = pages.find((p) => p.page === page);

  const closeDialog = () => setDialog(null);

  const submitDialog = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (dialog === "new") {
        const created = await api.createDashboardPage(scope, kind, name);
        setPages((prev) => [...prev, created]);
        onPageChange(created.page);
      } else if (dialog === "rename" && current && !current.is_default) {
        await api.renameDashboardPage(scope, kind, current.page, name);
        setPages((prev) => prev.map((p) => (p.page === current.page ? { ...p, name } : p)));
      }
      closeDialog();
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!current || current.is_default) return;
    try {
      await api.deleteDashboardPage(scope, kind, current.page);
      setPages((prev) => prev.filter((p) => p.page !== current.page));
      onPageChange(kind);
    } catch {
      // silently fail — user can retry
    } finally {
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <>
      <Select
        size="small"
        value={page}
        onChange={(e) => onPageChange(e.target.value)}
        sx={{
          fontSize: "0.72rem",
          height: 28,
          maxWidth: 170,
          "& .MuiSelect-select": { py: 0, px: 1, lineHeight: "28px" },
        }}
      >
        {pages.map((p) => (
          <MenuItem key={p.page} value={p.page} sx={{ fontSize: "0.78rem" }}>
            {p.name}
          </MenuItem>
        ))}
      </Select>
      <Tooltip title="New dashboard">
        <IconButton
          size="small"
          onClick={() => {
            setNameInput("");
            setDialog("new");
          }}
        >
          <AddIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Rename dashboard">
        <span>
          <IconButton
            size="small"
            disabled={!current || current.is_default}
            onClick={() => {
              setNameInput(current?.name ?? "");
              setDialog("rename");
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Delete dashboard">
        <span>
          <IconButton
            size="small"
            disabled={!current || current.is_default}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Dialog open={dialog !== null} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>
          {dialog === "new" ? "New dashboard" : "Rename dashboard"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitDialog();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={submitDialog} disabled={!nameInput.trim() || saving}>
            {dialog === "new" ? "Create" : "Rename"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDelete
        open={confirmDeleteOpen}
        name={current?.name ?? ""}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
};

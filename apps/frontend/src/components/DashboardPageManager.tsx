"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
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
import { api, type DashboardPage, type DashboardPageKind, type DashboardScope } from "../app/api";
import { ConfirmDelete } from "../app/components/ConfirmDelete";

type DashboardPageManagerProps = {
  kind: DashboardPageKind;
  scope: DashboardScope;
  page: string;
  teamId?: number;
  onPageChange: (page: string, teamId?: number) => void;
};

// Multiple teams all have a default page literally named "dashboard"/"metrics",
// so the page key alone isn't a unique Select value once scope="all" lists every
// team's pages together — key/value it by team+page, independent of what's sent
// to the API (that's just `page` and `teamId`, passed up via onPageChange).
const pageOptionValue = (p: Pick<DashboardPage, "page" | "team_id">) =>
  `${p.team_id ?? ""}::${p.page}`;

export const DashboardPageManager = ({
  kind,
  scope,
  page,
  teamId,
  onPageChange,
}: DashboardPageManagerProps) => {
  const [pages, setPages] = useState<DashboardPage[]>([
    { page: kind, name: "Default", is_default: true },
  ]);
  const [dialog, setDialog] = useState<"new" | "rename" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onPageChange re-selects a valid page when the fetched list no longer contains the current one (e.g. switching to/from "all" scope)
  useEffect(() => {
    api
      .listDashboardPages(scope, kind)
      .then((res) => {
        setPages(res.pages);
        const stillValid = res.pages.some(
          (p) => p.page === page && (p.team_id ?? undefined) === teamId,
        );
        if (res.pages.length > 0 && !stillValid) {
          onPageChange(res.pages[0].page, res.pages[0].team_id);
        }
      })
      .catch(() => {});
  }, [scope, kind]);

  const current = pages.find((p) => p.page === page && (p.team_id ?? undefined) === teamId);
  const readOnly = scope === "all";

  const closeDialog = () => setDialog(null);

  const submitDialog = async () => {
    if (scope === "all") {
      return;
    }
    const name = nameInput.trim();
    if (!name) {
      return;
    }
    setSaving(true);
    try {
      if (dialog === "new") {
        const created = await api.createDashboardPage(scope, kind, name);
        setPages((prev) => [...prev, created]);
        onPageChange(created.page, created.team_id);
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
    if (scope === "all" || !current || current.is_default) {
      return;
    }
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
        value={pageOptionValue({ page, team_id: teamId })}
        onChange={(e) => {
          const found = pages.find((p) => pageOptionValue(p) === e.target.value);
          if (found) {
            onPageChange(found.page, found.team_id);
          }
        }}
        sx={{
          fontSize: "0.72rem",
          height: 28,
          maxWidth: 170,
          "& .MuiSelect-select": { py: 0, px: 1, lineHeight: "28px" },
        }}
      >
        {pages.map((p) => (
          <MenuItem
            key={pageOptionValue(p)}
            value={pageOptionValue(p)}
            sx={{ fontSize: "0.78rem" }}
          >
            {p.name}
          </MenuItem>
        ))}
      </Select>
      <Tooltip title={readOnly ? "Read-only across teams" : "New dashboard"}>
        <span>
          <IconButton
            size="small"
            disabled={readOnly}
            onClick={() => {
              setNameInput("");
              setDialog("new");
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={readOnly ? "Read-only across teams" : "Rename dashboard"}>
        <span>
          <IconButton
            size="small"
            disabled={readOnly || !current || current.is_default}
            onClick={() => {
              setNameInput(current?.name ?? "");
              setDialog("rename");
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={readOnly ? "Read-only across teams" : "Delete dashboard"}>
        <span>
          <IconButton
            size="small"
            disabled={readOnly || !current || current.is_default}
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
              if (e.key === "Enter") {
                submitDialog();
              }
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

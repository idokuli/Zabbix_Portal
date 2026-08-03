"use client";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { ConfirmDelete, MembersDialog, SectionHeader, type TemplateGroup } from "./shared";

type TemplateOption = { templateid: string; name: string };

export const TemplateGroupsTab = ({
  showToast,
}: {
  showToast: (m: string, s: "success" | "error") => void;
}) => {
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateGroup | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TemplateGroup | null>(null);
  const [viewGroup, setViewGroup] = useState<TemplateGroup | null>(null);
  const [members, setMembers] = useState<
    Array<{ templateid: string; name: string; description: string }>
  >([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // For the add/edit dialog
  const [allTemplates, setAllTemplates] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateOption[]>([]);
  const tick = useRefreshTick();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const r = await api.listTemplateGroups();
        setGroups(r.groups);
        setLoadError(false);
      } catch (e) {
        setLoadError(true);
        showToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void load(true);
    }
  }, [tick]);

  const openDialog = async (target: TemplateGroup | null) => {
    setEditTarget(target);
    setNameInput(target?.name ?? "");
    setSelectedTemplates([]);
    setAddOpen(true);

    setTemplatesLoading(true);
    try {
      const [templatesRes, membersRes] = await Promise.all([
        api.listDcTemplates(),
        target ? api.getTemplateGroupMembers(target.groupid) : Promise.resolve({ templates: [] }),
      ]);
      const opts: TemplateOption[] = templatesRes.templates.map((t) => ({
        templateid: t.templateid,
        name: t.name,
      }));
      setAllTemplates(opts);
      const memberIds = new Set(membersRes.templates.map((t) => t.templateid));
      setSelectedTemplates(opts.filter((t) => memberIds.has(t.templateid)));
    } catch {
      setAllTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const openView = async (g: TemplateGroup) => {
    setViewGroup(g);
    setMembersLoading(true);
    try {
      const r = await api.getTemplateGroupMembers(g.groupid);
      setMembers(r.templates);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const onSave = async () => {
    const name = nameInput.trim();
    if (!name) {
      return;
    }
    setSaving(true);
    try {
      let groupid: string;
      if (editTarget) {
        await api.updateTemplateGroup(editTarget.groupid, name);
        groupid = editTarget.groupid;
        showToast("Template group updated.", "success");
      } else {
        const r = await api.createTemplateGroup(name);
        groupid = r.groupid;
        showToast("Template group created.", "success");
      }
      await api.setTemplateGroupMembers(
        groupid,
        selectedTemplates.map((t) => t.templateid),
      );
      setAddOpen(false);
      setEditTarget(null);
      setNameInput("");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await api.deleteTemplateGroup(deleteTarget.groupid);
      showToast("Template group deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <SectionHeader
        title="Template Groups"
        description="Organize monitoring templates into logical groups."
        count={groups.length}
        loading={loading}
        onRefresh={load}
        onAdd={() => openDialog(null)}
      />
      <TableContainer sx={{ border: "1px solid", borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Templates</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={3} sx={{ py: 1 }}>
                  {loadError ? (
                    <Typography variant="body2" color="error">
                      Failed to load template groups — click refresh to retry.
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      No template groups found.
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => (
                <TableRow
                  key={g.groupid}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => openView(g)}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {g.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={g.template_count}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.62rem", cursor: "pointer" }}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View templates">
                        <IconButton size="small" onClick={() => openView(g)}>
                          <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openDialog(g)}>
                          <EditOutlinedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(g)}>
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <MembersDialog
        open={!!viewGroup}
        title={`Templates in "${viewGroup?.name ?? ""}"`}
        items={members}
        loading={membersLoading}
        onClose={() => setViewGroup(null)}
        renderSecondary={(t) => (t as { description: string }).description || ""}
      />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editTarget ? "Edit template group" : "Add template group"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !templatesLoading && onSave()}
            />
            <Autocomplete
              multiple
              size="small"
              loading={templatesLoading}
              options={allTemplates}
              value={selectedTemplates}
              onChange={(_, v) => setSelectedTemplates(v)}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.templateid === b.templateid}
              renderInput={(params) => (
                <TextField
                  {...params}
                  slotProps={{
                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <>
                          {templatesLoading && <CircularProgress size={14} />}
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    },
                  }}
                  label="Assign templates"
                  placeholder={
                    templatesLoading ? "Loading templates…" : "Select templates for this group"
                  }
                />
              )}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getItemProps({ index })}
                    key={option.templateid}
                    label={option.name}
                    size="small"
                    sx={{ fontSize: "0.72rem" }}
                  />
                ))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving || templatesLoading || !nameInput.trim()}
          >
            {saving ? <CircularProgress size={14} /> : editTarget ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};

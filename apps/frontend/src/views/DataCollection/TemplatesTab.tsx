"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { ConfirmDelete, type DcTemplate, type TemplateGroup } from "./shared";

const makeEmptyTemplateForm = () => ({
  name: "",
  visible_name: "",
  group_ids: [] as string[],
  template_ids: [] as string[],
  description: "",
  tags: [] as Array<{ _key: string; tag: string; value: string }>,
  macros: [] as Array<{ _key: string; macro: string; value: string; description: string }>,
});

export const TemplatesTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const [templates, setTemplates] = useState<DcTemplate[]>([]);
  const [tplGroups, setTplGroups] = useState<TemplateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DcTemplate | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(makeEmptyTemplateForm());
  const [dialogTab, setDialogTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, gr] = await Promise.all([api.listDcTemplates(), api.listTemplateGroups()]);
      setTemplates(tr.templates);
      setTplGroups(gr.groups);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = templates.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const openAdd = () => {
    setForm(makeEmptyTemplateForm());
    setDialogTab(0);
    setAddOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await api.createDcTemplate({
        name: form.name,
        visible_name: form.visible_name || undefined,
        group_ids: form.group_ids,
        template_ids: form.template_ids.length ? form.template_ids : undefined,
        description: form.description || undefined,
        tags: form.tags.filter((t) => t.tag).length
          ? form.tags.filter((t) => t.tag).map(({ tag, value }) => ({ tag, value }))
          : undefined,
        macros: form.macros.filter((m) => m.macro).length
          ? form.macros
              .filter((m) => m.macro)
              .map(({ macro, value, description }) => ({ macro, value, description }))
          : undefined,
      });
      showToast("Template created.", "success");
      setAddOpen(false);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDcTemplate(deleteTarget.templateid);
      showToast("Template deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Templates
          </Typography>
          {loading ? (
            <CircularProgress size={14} />
          ) : (
            <Chip label={filtered.length} size="small" sx={{ height: 18, fontSize: "0.62rem" }} />
          )}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 180 }}
          />
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
            onClick={openAdd}
          >
            Add
          </Button>
        </Stack>
      </Box>
      <TableContainer
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          maxHeight: 480,
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Groups</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Linked templates</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No templates found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.templateid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {t.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                      {t.groups.map((g) => (
                        <Chip
                          key={g.groupid}
                          label={g.name}
                          size="small"
                          variant="outlined"
                          sx={{ height: 16, fontSize: "0.6rem" }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                      {t.linked_templates.map((lt) => (
                        <Chip
                          key={lt.templateid}
                          label={lt.name}
                          size="small"
                          sx={{ height: 16, fontSize: "0.6rem" }}
                        />
                      ))}
                      {t.linked_templates.length === 0 && (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}>
                        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create template — full tabbed dialog */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: "90vh" } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>Create template</DialogTitle>
        <Tabs
          value={dialogTab}
          onChange={(_, v) => setDialogTab(v)}
          sx={{ px: 3, borderBottom: "1px solid", borderColor: "divider", minHeight: 36 }}
          TabIndicatorProps={{ style: { height: 2 } }}
        >
          <Tab
            label="Template"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
          <Tab
            label="Tags"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
          <Tab
            label="Macros"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
          <Tab
            label="Value mapping"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
        </Tabs>
        <DialogContent sx={{ minHeight: 300 }}>
          {/* Tab 0 — Template */}
          {dialogTab === 0 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                size="small"
                label="Template name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                helperText="Technical name used in Zabbix API and expressions"
              />
              <TextField
                size="small"
                label="Visible name"
                value={form.visible_name}
                onChange={(e) => setForm((f) => ({ ...f, visible_name: e.target.value }))}
                helperText="Display name shown in the UI (defaults to template name if empty)"
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Template groups *</InputLabel>
                <Select
                  multiple
                  label="Template groups *"
                  value={form.group_ids}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, group_ids: e.target.value as string[] }))
                  }
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {(selected as string[]).map((id) => {
                        const g = tplGroups.find((g) => g.groupid === id);
                        return (
                          <Chip key={id} label={g?.name ?? id} size="small" sx={{ height: 20 }} />
                        );
                      })}
                    </Box>
                  )}
                >
                  {tplGroups.map((g) => (
                    <MenuItem key={g.groupid} value={g.groupid}>
                      {g.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Linked templates</InputLabel>
                <Select
                  multiple
                  label="Linked templates"
                  value={form.template_ids}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, template_ids: e.target.value as string[] }))
                  }
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {(selected as string[]).map((id) => {
                        const t = templates.find((t) => t.templateid === id);
                        return (
                          <Chip key={id} label={t?.name ?? id} size="small" sx={{ height: 20 }} />
                        );
                      })}
                    </Box>
                  )}
                >
                  {templates.map((t) => (
                    <MenuItem key={t.templateid} value={t.templateid}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                multiline
                rows={3}
              />
            </Stack>
          )}

          {/* Tab 1 — Tags */}
          {dialogTab === 1 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Template-level tags applied to all problems from this template:
              </Typography>
              {form.tags.map((tag, idx) => (
                <Stack
                  key={tag._key}
                  direction="row"
                  spacing={1}
                  sx={{ mb: 1 }}
                  alignItems="center"
                >
                  <TextField
                    size="small"
                    label="Name"
                    value={tag.tag}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tags: f.tags.map((t, i) => (i === idx ? { ...t, tag: e.target.value } : t)),
                      }))
                    }
                    sx={{ width: 200 }}
                  />
                  <TextField
                    size="small"
                    label="Value"
                    value={tag.value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tags: f.tags.map((t, i) =>
                          i === idx ? { ...t, value: e.target.value } : t,
                        ),
                      }))
                    }
                    sx={{ width: 200 }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() =>
                      setForm((f) => ({ ...f, tags: f.tags.filter((_, i) => i !== idx) }))
                    }
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              ))}
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    tags: [...f.tags, { _key: crypto.randomUUID(), tag: "", value: "" }],
                  }))
                }
              >
                Add tag
              </Button>
            </Box>
          )}

          {/* Tab 2 — Macros */}
          {dialogTab === 2 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                User macros defined at the template level:
              </Typography>
              {form.macros.map((macro, idx) => (
                <Stack
                  key={macro._key}
                  direction="row"
                  spacing={1}
                  sx={{ mb: 1 }}
                  alignItems="center"
                >
                  <TextField
                    size="small"
                    label="Macro"
                    placeholder="{$MACRO_NAME}"
                    value={macro.macro}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        macros: f.macros.map((m, i) =>
                          i === idx ? { ...m, macro: e.target.value } : m,
                        ),
                      }))
                    }
                    sx={{ width: 180 }}
                  />
                  <TextField
                    size="small"
                    label="Value"
                    value={macro.value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        macros: f.macros.map((m, i) =>
                          i === idx ? { ...m, value: e.target.value } : m,
                        ),
                      }))
                    }
                    sx={{ width: 180 }}
                  />
                  <TextField
                    size="small"
                    label="Description"
                    value={macro.description}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        macros: f.macros.map((m, i) =>
                          i === idx ? { ...m, description: e.target.value } : m,
                        ),
                      }))
                    }
                    sx={{ width: 180 }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() =>
                      setForm((f) => ({ ...f, macros: f.macros.filter((_, i) => i !== idx) }))
                    }
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              ))}
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    macros: [
                      ...f.macros,
                      { _key: crypto.randomUUID(), macro: "", value: "", description: "" },
                    ],
                  }))
                }
              >
                Add macro
              </Button>
            </Box>
          )}

          {/* Tab 3 — Value mapping (info only — set on items after template is created) */}
          {dialogTab === 3 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                Value mappings are configured per-item after the template is created. Use the Items
                view to add value maps to individual items within this template.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.group_ids.length}
          >
            {saving ? <CircularProgress size={14} /> : "Create"}
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

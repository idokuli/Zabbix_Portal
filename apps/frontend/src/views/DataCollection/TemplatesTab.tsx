"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
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
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
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
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import type { TemplateItem } from "../../app/api/types";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { generateId } from "../../app/utils";
import { FilterSearchField } from "../../components/FilterBar";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ConfirmDelete, type DcTemplate, type TemplateGroup } from "./shared";

type TemplateDetail = {
  templateid: string;
  name: string;
  visible_name: string;
  description: string;
  item_count: number;
  groups: Array<{ groupid: string; name: string }>;
  linked_templates: Array<{ templateid: string; name: string }>;
  tags: Array<{ tag: string; value: string }>;
  macros: Array<{ macro: string; value: string; description: string }>;
};

const makeEmptyTemplateForm = () => ({
  name: "",
  visible_name: "",
  group_ids: [] as string[],
  template_ids: [] as string[],
  description: "",
  tags: [] as Array<{ _key: string; tag: string; value: string }>,
  macros: [] as Array<{ _key: string; macro: string; value: string; description: string }>,
});

const TemplateRow = ({
  t,
  onOpenDetail,
  onDeleteRequest,
}: {
  t: DcTemplate;
  onOpenDetail: (t: DcTemplate) => void;
  onDeleteRequest: (t: DcTemplate) => void;
}) => (
  <TableRow hover>
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
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="View / Edit">
          <IconButton size="small" onClick={() => void onOpenDetail(t)}>
            <EditOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => onDeleteRequest(t)}>
            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </TableCell>
  </TableRow>
);

type TagEntry = { _key: string; tag: string; value: string };
type MacroEntry = { _key: string; macro: string; value: string; description: string };
type TemplateFormState = {
  name: string;
  visible_name: string;
  description: string;
  group_ids: string[];
  template_ids: string[];
  tags: TagEntry[];
  macros: MacroEntry[];
};

const TagsEditor = ({
  tags,
  onChange,
  fieldWidth = 200,
}: {
  tags: TagEntry[];
  onChange: (updater: (tags: TagEntry[]) => TagEntry[]) => void;
  fieldWidth?: number;
}) => (
  <Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      Template-level tags applied to all problems from this template:
    </Typography>
    {tags.map((tag, idx) => (
      <Stack key={tag._key} direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <TextField
          size="small"
          label="Name"
          value={tag.tag}
          onChange={(e) =>
            onChange((prev) => prev.map((t, i) => (i === idx ? { ...t, tag: e.target.value } : t)))
          }
          sx={{ width: fieldWidth }}
        />
        <TextField
          size="small"
          label="Value"
          value={tag.value}
          onChange={(e) =>
            onChange((prev) =>
              prev.map((t, i) => (i === idx ? { ...t, value: e.target.value } : t)),
            )
          }
          sx={{ width: fieldWidth }}
        />
        <IconButton
          size="small"
          color="error"
          onClick={() => onChange((prev) => prev.filter((_, i) => i !== idx))}
        >
          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>
    ))}
    <Button
      size="small"
      variant="outlined"
      startIcon={<AddOutlinedIcon />}
      onClick={() => onChange((prev) => [...prev, { _key: generateId(), tag: "", value: "" }])}
    >
      Add tag
    </Button>
  </Box>
);

const MacrosEditor = ({
  macros,
  onChange,
  macroWidth = 180,
  otherWidth = 180,
}: {
  macros: MacroEntry[];
  onChange: (updater: (macros: MacroEntry[]) => MacroEntry[]) => void;
  macroWidth?: number;
  otherWidth?: number;
}) => (
  <Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      User macros defined at the template level:
    </Typography>
    {macros.map((macro, idx) => (
      <Stack key={macro._key} direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <TextField
          size="small"
          label="Macro"
          placeholder="{$MACRO_NAME}"
          value={macro.macro}
          onChange={(e) =>
            onChange((prev) =>
              prev.map((m, i) => (i === idx ? { ...m, macro: e.target.value } : m)),
            )
          }
          sx={{ width: macroWidth }}
        />
        <TextField
          size="small"
          label="Value"
          value={macro.value}
          onChange={(e) =>
            onChange((prev) =>
              prev.map((m, i) => (i === idx ? { ...m, value: e.target.value } : m)),
            )
          }
          sx={{ width: otherWidth }}
        />
        <TextField
          size="small"
          label="Description"
          value={macro.description}
          onChange={(e) =>
            onChange((prev) =>
              prev.map((m, i) => (i === idx ? { ...m, description: e.target.value } : m)),
            )
          }
          sx={{ width: otherWidth }}
        />
        <IconButton
          size="small"
          color="error"
          onClick={() => onChange((prev) => prev.filter((_, i) => i !== idx))}
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
        onChange((prev) => [...prev, { _key: generateId(), macro: "", value: "", description: "" }])
      }
    >
      Add macro
    </Button>
  </Box>
);

const TemplateGroupsAndLinksFields = ({
  groupIds,
  onGroupIdsChange,
  templateIds,
  onTemplateIdsChange,
  tplGroups,
  templates,
  excludeTemplateId,
  groupsRequired = true,
}: {
  groupIds: string[];
  onGroupIdsChange: (ids: string[]) => void;
  templateIds: string[];
  onTemplateIdsChange: (ids: string[]) => void;
  tplGroups: TemplateGroup[];
  templates: DcTemplate[];
  excludeTemplateId?: string;
  groupsRequired?: boolean;
}) => (
  <>
    <FormControl size="small" fullWidth>
      <InputLabel>{groupsRequired ? "Template groups *" : "Template groups"}</InputLabel>
      <SearchableSelect
        multiple
        label={groupsRequired ? "Template groups *" : "Template groups"}
        value={groupIds}
        onChange={(e) => onGroupIdsChange(e.target.value as string[])}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {(selected as string[]).map((id) => {
              const g = tplGroups.find((g) => g.groupid === id);
              return <Chip key={id} label={g?.name ?? id} size="small" sx={{ height: 20 }} />;
            })}
          </Box>
        )}
      >
        {tplGroups.map((g) => (
          <MenuItem key={g.groupid} value={g.groupid}>
            {g.name}
          </MenuItem>
        ))}
      </SearchableSelect>
    </FormControl>
    <FormControl size="small" fullWidth>
      <InputLabel>Linked templates</InputLabel>
      <SearchableSelect
        multiple
        label="Linked templates"
        value={templateIds}
        onChange={(e) => onTemplateIdsChange(e.target.value as string[])}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {(selected as string[]).map((id) => {
              const t = templates.find((t) => t.templateid === id);
              return <Chip key={id} label={t?.name ?? id} size="small" sx={{ height: 20 }} />;
            })}
          </Box>
        )}
      >
        {templates
          .filter((t) => t.templateid !== excludeTemplateId)
          .map((t) => (
            <MenuItem key={t.templateid} value={t.templateid}>
              {t.name}
            </MenuItem>
          ))}
      </SearchableSelect>
    </FormControl>
  </>
);

const CreateTemplateDialog = ({
  open,
  onClose,
  form,
  setForm,
  tplGroups,
  templates,
  dialogTab,
  setDialogTab,
  saving,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  form: TemplateFormState;
  setForm: Dispatch<SetStateAction<TemplateFormState>>;
  tplGroups: TemplateGroup[];
  templates: DcTemplate[];
  dialogTab: number;
  setDialogTab: (v: number) => void;
  saving: boolean;
  onCreate: () => void;
}) => (
  <Dialog
    slotProps={{ paper: { sx: { maxHeight: "90vh" } } }}
    open={open}
    onClose={onClose}
    maxWidth="md"
    fullWidth
  >
    <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>Create template</DialogTitle>
    <Tabs
      slotProps={{ indicator: { style: { height: 2 } } }}
      value={dialogTab}
      onChange={(_, v) => setDialogTab(v)}
      sx={{ px: 3, borderBottom: "1px solid", borderColor: "divider", minHeight: 36 }}
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
          <TemplateGroupsAndLinksFields
            groupIds={form.group_ids}
            onGroupIdsChange={(ids) => setForm((f) => ({ ...f, group_ids: ids }))}
            templateIds={form.template_ids}
            onTemplateIdsChange={(ids) => setForm((f) => ({ ...f, template_ids: ids }))}
            tplGroups={tplGroups}
            templates={templates}
          />
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

      {dialogTab === 1 && (
        <Box sx={{ mt: 1 }}>
          <TagsEditor
            tags={form.tags}
            onChange={(updater) => setForm((f) => ({ ...f, tags: updater(f.tags) }))}
            fieldWidth={200}
          />
        </Box>
      )}

      {dialogTab === 2 && (
        <Box sx={{ mt: 1 }}>
          <MacrosEditor
            macros={form.macros}
            onChange={(updater) => setForm((f) => ({ ...f, macros: updater(f.macros) }))}
            macroWidth={180}
            otherWidth={180}
          />
        </Box>
      )}

      {dialogTab === 3 && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info">
            Value mappings are configured per-item after the template is created. Use the Items view
            to add value maps to individual items within this template.
          </Alert>
        </Box>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        onClick={onCreate}
        disabled={saving || !form.name.trim() || form.group_ids.length === 0}
      >
        {saving ? <CircularProgress size={14} /> : "Create"}
      </Button>
    </DialogActions>
  </Dialog>
);

const TemplateItemRow = ({
  item,
  onEdit,
  onDeleteRequest,
}: {
  item: TemplateItem;
  onEdit: (item: TemplateItem) => void;
  onDeleteRequest: (item: TemplateItem) => void;
}) => (
  <TableRow hover>
    <TableCell>
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        {item.name}
      </Typography>
    </TableCell>
    <TableCell>
      <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
        {item.key_}
      </Typography>
    </TableCell>
    <TableCell>
      <Typography variant="caption">{item.delay}</Typography>
    </TableCell>
    <TableCell>
      <Stack direction="row" spacing={0.3}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(item)}>
            <EditOutlinedIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => onDeleteRequest(item)}>
            <DeleteOutlineIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </TableCell>
  </TableRow>
);

const TemplateItemsTab = ({
  tplItems,
  itemsLoading,
  onAddItemRequest,
  onEditItemRequest,
  onDeleteItemRequest,
}: {
  tplItems: TemplateItem[];
  itemsLoading: boolean;
  onAddItemRequest: () => void;
  onEditItemRequest: (item: TemplateItem) => void;
  onDeleteItemRequest: (item: TemplateItem) => void;
}) => (
  <Box>
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Items defined directly on this template (not inherited):
      </Typography>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddOutlinedIcon />}
        onClick={onAddItemRequest}
      >
        Add item
      </Button>
    </Stack>
    {itemsLoading ? (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={20} />
      </Box>
    ) : (
      <TableContainer sx={{ border: "1px solid", borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Key</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Interval</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 70 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tplItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="caption" color="text.disabled">
                    No items found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tplItems.map((item) => (
                <TemplateItemRow
                  key={item.itemid}
                  item={item}
                  onEdit={onEditItemRequest}
                  onDeleteRequest={onDeleteItemRequest}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    )}
  </Box>
);

const TemplateDetailDialog = ({
  open,
  onClose,
  detail,
  detailLoading,
  detailSaving,
  detailTab,
  setDetailTab,
  editForm,
  setEditForm,
  tplGroups,
  templates,
  tplItems,
  itemsLoading,
  onSave,
  onAddItemRequest,
  onEditItemRequest,
  onDeleteItemRequest,
}: {
  open: boolean;
  onClose: () => void;
  detail: TemplateDetail | null;
  detailLoading: boolean;
  detailSaving: boolean;
  detailTab: number;
  setDetailTab: (v: number) => void;
  editForm: TemplateFormState;
  setEditForm: Dispatch<SetStateAction<TemplateFormState>>;
  tplGroups: TemplateGroup[];
  templates: DcTemplate[];
  tplItems: TemplateItem[];
  itemsLoading: boolean;
  onSave: () => void;
  onAddItemRequest: () => void;
  onEditItemRequest: (item: TemplateItem) => void;
  onDeleteItemRequest: (item: TemplateItem) => void;
}) => (
  <Dialog
    slotProps={{ paper: { sx: { height: "90vh" } } }}
    open={open}
    onClose={onClose}
    maxWidth="lg"
    fullWidth
  >
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {detail ? detail.name : "Template detail"}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {detailLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!detailLoading && detail && (
        <>
          <Tabs
            slotProps={{ indicator: { style: { height: 2 } } }}
            value={detailTab}
            onChange={(_, v) => setDetailTab(v)}
            sx={{
              px: 3,
              borderBottom: "1px solid",
              borderColor: "divider",
              minHeight: 40,
              mt: 0.5,
            }}
          >
            {["Template", "Tags", "Macros", `Items (${tplItems.length})`].map((label) => (
              <Tab
                key={label}
                label={label}
                sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
              />
            ))}
          </Tabs>

          <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2 }}>
            {detailTab === 0 && (
              <Stack spacing={2}>
                <TextField
                  size="small"
                  label="Template name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  helperText="Technical name used in Zabbix API and expressions"
                />
                <TextField
                  size="small"
                  label="Visible name"
                  value={editForm.visible_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, visible_name: e.target.value }))}
                  helperText="Display name (defaults to template name if empty)"
                />
                <TemplateGroupsAndLinksFields
                  groupIds={editForm.group_ids}
                  onGroupIdsChange={(ids) => setEditForm((f) => ({ ...f, group_ids: ids }))}
                  templateIds={editForm.template_ids}
                  onTemplateIdsChange={(ids) => setEditForm((f) => ({ ...f, template_ids: ids }))}
                  tplGroups={tplGroups}
                  templates={templates}
                  excludeTemplateId={detail.templateid}
                  groupsRequired={false}
                />
                <TextField
                  size="small"
                  label="Description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  multiline
                  rows={3}
                />
              </Stack>
            )}

            {detailTab === 1 && (
              <TagsEditor
                tags={editForm.tags}
                onChange={(updater) => setEditForm((f) => ({ ...f, tags: updater(f.tags) }))}
                fieldWidth={180}
              />
            )}

            {detailTab === 2 && (
              <MacrosEditor
                macros={editForm.macros}
                onChange={(updater) => setEditForm((f) => ({ ...f, macros: updater(f.macros) }))}
                macroWidth={160}
                otherWidth={140}
              />
            )}

            {detailTab === 3 && (
              <TemplateItemsTab
                tplItems={tplItems}
                itemsLoading={itemsLoading}
                onAddItemRequest={onAddItemRequest}
                onEditItemRequest={onEditItemRequest}
                onDeleteItemRequest={onDeleteItemRequest}
              />
            )}
          </Box>

          {detailTab !== 3 && (
            <>
              <Divider />
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, px: 3, py: 1.5 }}>
                <Button size="small" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  onClick={onSave}
                  disabled={
                    detailSaving || !editForm.name.trim() || editForm.group_ids.length === 0
                  }
                >
                  {detailSaving ? <CircularProgress size={13} /> : "Save"}
                </Button>
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  </Dialog>
);

export const TemplatesTab = ({
  showToast,
}: {
  showToast: (m: string, s: "success" | "error") => void;
}) => {
  const [templates, setTemplates] = useState<DcTemplate[]>([]);
  const [tplGroups, setTplGroups] = useState<TemplateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DcTemplate | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(makeEmptyTemplateForm());
  const [dialogTab, setDialogTab] = useState(0);
  const tick = useRefreshTick();

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    visible_name: "",
    description: "",
    group_ids: [] as string[],
    template_ids: [] as string[],
    tags: [] as Array<{ _key: string; tag: string; value: string }>,
    macros: [] as Array<{ _key: string; macro: string; value: string; description: string }>,
  });

  // Template items (Items tab)
  const [tplItems, setTplItems] = useState<TemplateItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemSaving, setAddItemSaving] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    name: "",
    key_: "",
    delay: "1m",
    history: "7d",
    trends: "365d",
    units: "",
    description: "",
  });
  const [itemDeleteTarget, setItemDeleteTarget] = useState<TemplateItem | null>(null);
  const [editItemTarget, setEditItemTarget] = useState<TemplateItem | null>(null);
  const [editItemForm, setEditItemForm] = useState({ name: "", delay: "", key_: "" });

  const loadTplItems = useCallback(
    async (templateid: string) => {
      setItemsLoading(true);
      try {
        const res = await api.getTemplateItems(templateid);
        setTplItems(res.items);
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setItemsLoading(false);
      }
    },
    [showToast],
  );

  const openDetail = async (t: DcTemplate) => {
    setDetailOpen(true);
    setDetailTab(0);
    setDetail(null);
    setTplItems([]);
    setDetailLoading(true);
    try {
      const [d, itemsRes] = await Promise.all([
        api.getDcTemplate(t.templateid),
        api.getTemplateItems(t.templateid),
      ]);
      setDetail(d);
      setTplItems(itemsRes.items);
      setEditForm({
        name: d.name,
        visible_name: d.visible_name,
        description: d.description,
        group_ids: d.groups.map((g) => g.groupid),
        template_ids: d.linked_templates.map((lt) => lt.templateid),
        tags: d.tags.map((tg) => ({ _key: generateId(), tag: tg.tag, value: tg.value })),
        macros: d.macros.map((m) => ({
          _key: generateId(),
          macro: m.macro,
          value: m.value,
          description: m.description,
        })),
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const onSaveDetail = async () => {
    if (!detail) {
      return;
    }
    setDetailSaving(true);
    try {
      await api.updateDcTemplate(detail.templateid, {
        name: editForm.name,
        visible_name: editForm.visible_name || editForm.name,
        description: editForm.description,
        group_ids: editForm.group_ids,
        template_ids: editForm.template_ids,
        tags: editForm.tags.filter((t) => t.tag).map(({ tag, value }) => ({ tag, value })),
        macros: editForm.macros
          .filter((m) => m.macro)
          .map(({ macro, value, description }) => ({ macro, value, description })),
      });
      showToast("Template updated.", "success");
      setDetailOpen(false);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setDetailSaving(false);
    }
  };

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const [tr, gr] = await Promise.all([api.listDcTemplates(), api.listTemplateGroups()]);
        setTemplates(tr.templates);
        setTplGroups(gr.groups);
      } catch (e) {
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
        template_ids: form.template_ids.length > 0 ? form.template_ids : undefined,
        description: form.description || undefined,
        tags:
          form.tags.filter((t) => t.tag).length > 0
            ? form.tags.filter((t) => t.tag).map(({ tag, value }) => ({ tag, value }))
            : undefined,
        macros:
          form.macros.filter((m) => m.macro).length > 0
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
    if (!deleteTarget) {
      return;
    }
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
      <TabHeader
        title="Templates"
        description="Manage reusable sets of items, triggers, and graphs applied to monitored hosts."
        count={filtered.length}
        loading={loading}
      />
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
        <FilterSearchField placeholder="Search…" value={search} onChange={setSearch} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void load()} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
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
      <TableContainer
        sx={{
          border: "1px solid",
          borderColor: "divider",
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
                <TemplateRow
                  key={t.templateid}
                  t={t}
                  onOpenDetail={openDetail}
                  onDeleteRequest={setDeleteTarget}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create template — full tabbed dialog */}
      <CreateTemplateDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        form={form}
        setForm={setForm}
        tplGroups={tplGroups}
        templates={templates}
        dialogTab={dialogTab}
        setDialogTab={setDialogTab}
        saving={saving}
        onCreate={() => void onSave()}
      />

      {/* Template detail / edit dialog */}
      <TemplateDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        detail={detail}
        detailLoading={detailLoading}
        detailSaving={detailSaving}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        editForm={editForm}
        setEditForm={setEditForm}
        tplGroups={tplGroups}
        templates={templates}
        tplItems={tplItems}
        itemsLoading={itemsLoading}
        onSave={() => void onSaveDetail()}
        onAddItemRequest={() => {
          setAddItemForm({
            name: "",
            key_: "",
            delay: "1m",
            history: "7d",
            trends: "365d",
            units: "",
            description: "",
          });
          setAddItemOpen(true);
        }}
        onEditItemRequest={(item) => {
          setEditItemTarget(item);
          setEditItemForm({ name: item.name, delay: item.delay, key_: item.key_ });
        }}
        onDeleteItemRequest={setItemDeleteTarget}
      />

      {/* Add item to template */}
      <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add item to template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={addItemForm.name}
              onChange={(e) => setAddItemForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              size="small"
              label="Key *"
              placeholder="system.cpu.load[percpu,avg1]"
              value={addItemForm.key_}
              onChange={(e) => setAddItemForm((f) => ({ ...f, key_: e.target.value }))}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Update interval"
                value={addItemForm.delay}
                onChange={(e) => setAddItemForm((f) => ({ ...f, delay: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="History"
                value={addItemForm.history}
                onChange={(e) => setAddItemForm((f) => ({ ...f, history: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="Trends"
                value={addItemForm.trends}
                onChange={(e) => setAddItemForm((f) => ({ ...f, trends: e.target.value }))}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              size="small"
              label="Units"
              placeholder="%, MB, rpm…"
              value={addItemForm.units}
              onChange={(e) => setAddItemForm((f) => ({ ...f, units: e.target.value }))}
            />
            <TextField
              size="small"
              label="Description"
              value={addItemForm.description}
              onChange={(e) => setAddItemForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={addItemSaving || !addItemForm.name.trim() || !addItemForm.key_.trim()}
            onClick={async () => {
              if (!detail) {
                return;
              }
              setAddItemSaving(true);
              try {
                await api.addTemplateItem(detail.templateid, {
                  name: addItemForm.name.trim(),
                  key_: addItemForm.key_.trim(),
                  delay: addItemForm.delay || "1m",
                  history: addItemForm.history || "7d",
                  trends: addItemForm.trends || "365d",
                  units: addItemForm.units || undefined,
                  description: addItemForm.description || undefined,
                });
                showToast("Item added.", "success");
                setAddItemOpen(false);
                void loadTplItems(detail.templateid);
              } catch (e) {
                showToast(e instanceof Error ? e.message : String(e), "error");
              } finally {
                setAddItemSaving(false);
              }
            }}
          >
            {addItemSaving ? <CircularProgress size={14} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit item */}
      <Dialog
        open={!!editItemTarget}
        onClose={() => setEditItemTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name"
              value={editItemForm.name}
              onChange={(e) => setEditItemForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              size="small"
              label="Key"
              value={editItemForm.key_}
              onChange={(e) => setEditItemForm((f) => ({ ...f, key_: e.target.value }))}
            />
            <TextField
              size="small"
              label="Update interval"
              value={editItemForm.delay}
              onChange={(e) => setEditItemForm((f) => ({ ...f, delay: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItemTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editItemForm.name.trim()}
            onClick={async () => {
              if (!(detail && editItemTarget)) {
                return;
              }
              try {
                await api.updateTemplateItem(detail.templateid, editItemTarget.itemid, {
                  name: editItemForm.name.trim(),
                  key_: editItemForm.key_.trim() || undefined,
                  delay: editItemForm.delay.trim() || undefined,
                });
                showToast("Item updated.", "success");
                setEditItemTarget(null);
                void loadTplItems(detail.templateid);
              } catch (e) {
                showToast(e instanceof Error ? e.message : String(e), "error");
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete item confirm */}
      <ConfirmDelete
        open={!!itemDeleteTarget}
        name={itemDeleteTarget?.name ?? ""}
        onConfirm={async () => {
          if (!(detail && itemDeleteTarget)) {
            return;
          }
          try {
            await api.deleteTemplateItem(detail.templateid, itemDeleteTarget.itemid);
            showToast("Item deleted.", "success");
            setItemDeleteTarget(null);
            void loadTplItems(detail.templateid);
          } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
          }
        }}
        onClose={() => setItemDeleteTarget(null)}
      />

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};

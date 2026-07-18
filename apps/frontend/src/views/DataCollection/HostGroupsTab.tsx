"use client";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { ConfirmDelete, type HostGroup, MembersDialog, SectionHeader } from "./shared";

type HostOption = { hostid: string; host: string; name: string };

export const HostGroupsTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const [groups, setGroups] = useState<HostGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HostGroup | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HostGroup | null>(null);
  const [viewGroup, setViewGroup] = useState<HostGroup | null>(null);
  const [members, setMembers] = useState<
    Array<{ hostid: string; host: string; name: string; status: number }>
  >([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // For the add/edit dialog
  const [allHosts, setAllHosts] = useState<HostOption[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [selectedHosts, setSelectedHosts] = useState<HostOption[]>([]);
  const tick = useRefreshTick();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const r = await api.listHostGroups();
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

  const openDialog = async (target: HostGroup | null) => {
    setEditTarget(target);
    setNameInput(target?.name ?? "");
    setSelectedHosts([]);
    setAddOpen(true);

    // Load hosts lazily
    setHostsLoading(true);
    try {
      const [hostsRes, membersRes] = await Promise.all([
        api.listHosts(),
        target ? api.getHostGroupMembers(target.groupid) : Promise.resolve({ hosts: [] }),
      ]);
      const opts: HostOption[] = hostsRes.hosts.map((h) => ({
        hostid: h.hostid,
        host: h.host,
        name: h.name ?? "",
      }));
      setAllHosts(opts);
      const memberIds = new Set(membersRes.hosts.map((h) => h.hostid));
      setSelectedHosts(opts.filter((h) => memberIds.has(h.hostid)));
    } catch {
      setAllHosts([]);
    } finally {
      setHostsLoading(false);
    }
  };

  const openView = async (g: HostGroup) => {
    setViewGroup(g);
    setMembersLoading(true);
    try {
      const r = await api.getHostGroupMembers(g.groupid);
      setMembers(r.hosts);
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
        await api.updateHostGroup(editTarget.groupid, name);
        groupid = editTarget.groupid;
        showToast("Host group updated.", "success");
      } else {
        const r = await api.createHostGroup(name);
        groupid = r.groupid;
        showToast("Host group created.", "success");
      }
      await api.setHostGroupMembers(
        groupid,
        selectedHosts.map((h) => h.hostid),
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
      await api.deleteHostGroup(deleteTarget.groupid);
      showToast("Host group deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <TabHeader
        title="Host Groups"
        description="Organize hosts into groups for easier management and permission assignment."
      />
      <SectionHeader
        title="Host Groups"
        count={groups.length}
        loading={loading}
        onRefresh={load}
        onAdd={() => openDialog(null)}
      />
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Hosts</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={3} sx={{ py: 1 }}>
                  {loadError ? (
                    <Typography variant="body2" color="error">
                      Failed to load host groups — click refresh to retry.
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      No host groups found.
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
                      label={g.host_count}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.62rem", cursor: "pointer" }}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View hosts">
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
        title={`Hosts in "${viewGroup?.name ?? ""}"`}
        items={members.map((h) => ({ ...h, name: h.host || h.name }))}
        loading={membersLoading}
        onClose={() => setViewGroup(null)}
        renderSecondary={(h) =>
          (h as { name: string; host: string; status: number }).status === 0
            ? "Monitored"
            : "Not monitored"
        }
      />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editTarget ? "Edit host group" : "Add host group"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Name"
              helperText="Use / to create sub-groups, e.g. Linux servers/Web"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !hostsLoading && onSave()}
            />
            <Autocomplete
              multiple
              size="small"
              loading={hostsLoading}
              options={allHosts}
              value={selectedHosts}
              onChange={(_, v) => setSelectedHosts(v)}
              getOptionLabel={(o) => o.host || o.name}
              isOptionEqualToValue={(a, b) => a.hostid === b.hostid}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Assign hosts"
                  placeholder={
                    hostsLoading ? "Loading hosts…" : "Select hosts to add to this group"
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {hostsLoading && <CircularProgress size={14} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.hostid}
                    label={option.host || option.name}
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
            disabled={saving || hostsLoading || !nameInput.trim()}
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

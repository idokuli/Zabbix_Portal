"use client";
import CloseIcon from "@mui/icons-material/Close";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChart";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type DashboardGraph, type Host, type Team, api } from "../../app/api";
import { SearchableSelect } from "../../components/SearchableSelect";

export const AddGraphDialog = ({
  open,
  onClose,
  onAdd,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (graph: DashboardGraph) => void;
  existingIds: string[];
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [filterTeamId, setFilterTeamId] = useState<number | "">("");
  const [selectedHostId, setSelectedHostId] = useState("");
  const [graphSearch, setGraphSearch] = useState("");
  const [graphs, setGraphs] = useState<DashboardGraph[]>([]);
  const [loadingGraphs, setLoadingGraphs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFilterTeamId("");
    setSelectedHostId("");
    setGraphSearch("");
    setGraphs([]);
    Promise.all([api.listHosts(), api.getTeamsOverview()]).then(([hostsRes, teamsRes]) => {
      setHosts(hostsRes.hosts);
      setTeams(teamsRes.teams);
    });
  }, [open]);

  // Filter host list by selected team
  const teamHostnames =
    filterTeamId !== "" ? (teams.find((t) => t.id === filterTeamId)?.hosts ?? []) : null;
  const visibleHosts = teamHostnames ? hosts.filter((h) => teamHostnames.includes(h.host)) : hosts;

  // Load graphs when host changes
  useEffect(() => {
    if (!selectedHostId) {
      setGraphs([]);
      return;
    }
    setLoadingGraphs(true);
    api
      .getDashboardGraphs(selectedHostId)
      .then((res) => setGraphs(res.graphs))
      .catch(() => setGraphs([]))
      .finally(() => setLoadingGraphs(false));
  }, [selectedHostId]);

  const filteredGraphs = graphs.filter((g) =>
    g.name.toLowerCase().includes(graphSearch.toLowerCase()),
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={700}>Add Graph</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {/* Step 1 — pick host */}
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Step 1 — Select a host
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Filter by team</InputLabel>
            <Select
              label="Filter by team"
              value={filterTeamId}
              onChange={(e) => {
                setFilterTeamId(e.target.value as number | "");
                setSelectedHostId("");
                setGraphs([]);
              }}
            >
              <MenuItem value="">All teams</MenuItem>
              {teams.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Host *</InputLabel>
            <SearchableSelect
              label="Host *"
              value={selectedHostId}
              onChange={(e) => {
                setSelectedHostId(e.target.value);
                setGraphSearch("");
              }}
            >
              <MenuItem value="" disabled>
                Select a host…
              </MenuItem>
              {visibleHosts.map((h) => (
                <MenuItem key={h.hostid} value={h.hostid}>
                  {h.host}
                </MenuItem>
              ))}
            </SearchableSelect>
          </FormControl>
        </Box>

        {/* Step 2 — pick graph */}
        {selectedHostId && (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                Step 2 — Select a graph
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="Search graphs…"
                value={graphSearch}
                onChange={(e) => setGraphSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ShowChartOutlinedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Divider />
            {loadingGraphs ? (
              <Box sx={{ p: 2 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                  <Skeleton key={i} variant="text" height={48} sx={{ mb: 0.5 }} />
                ))}
              </Box>
            ) : filteredGraphs.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <Typography color="text.secondary" variant="body2">
                  {graphSearch ? "No graphs match your search" : "No graphs found for this host"}
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ maxHeight: 320, overflowY: "auto" }}>
                {filteredGraphs.map((g) => {
                  const added = existingIds.includes(g.graphid);
                  return (
                    <ListItem key={g.graphid} sx={{ opacity: added ? 0.45 : 1 }}>
                      <ListItemText
                        primary={g.name}
                        primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 500 }}
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={added}
                          onClick={() => {
                            onAdd(g);
                            onClose();
                          }}
                          sx={{ fontSize: "0.72rem", minWidth: 60 }}
                        >
                          {added ? "Added" : "Add"}
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </>
        )}

        {!selectedHostId && (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography color="text.disabled" variant="body2">
              Select a host above to see its graphs
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

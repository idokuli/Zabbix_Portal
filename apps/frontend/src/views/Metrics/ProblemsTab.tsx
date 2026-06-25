"use client";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  type SelectChangeEvent,
  Skeleton,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { type Host, type HostGroup, type Problem, api } from "../../app/api";
import { useAuth } from "../../app/context/AuthContext";
import { SearchableSelect } from "../../components/SearchableSelect";
import { SEVERITY_CONFIG, SeverityChip, formatAge } from "./shared";

// ── Problems tab ──────────────────────────────────────────────────────

export const ProblemsTab = () => {
  const { user: authUser } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverities, setSelectedSeverities] = useState<number[]>([]);
  const [hostFilter, setHostFilter] = useState("");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostGroups, setHostGroups] = useState<HostGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Ack dialog state
  const [ackTarget, setAckTarget] = useState<Problem | null>(null);
  const [ackNote, setAckNote] = useState("");

  const loadProblems = useCallback(() => {
    if (!initialLoadDone.current) setLoading(true);
    setLoadError(null);
    Promise.all([api.getProblems(), api.listHosts(), api.listHostGroups()])
      .then(([pr, hr, gr]) => {
        setProblems(pr.problems);
        setHosts(hr.hosts);
        setHostGroups(gr.groups);
        initialLoadDone.current = true;
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load problems."))
      .finally(() => setLoading(false));
  }, []);

  const handleAcknowledge = useCallback(async (problem: Problem, note: string) => {
    const { eventid } = problem;
    setAcknowledging((prev) => new Set([...prev, eventid]));
    setAckTarget(null);
    setAckNote("");
    try {
      const res = await api.acknowledgeProblem(eventid, {
        problem_name: problem.name,
        hostname: problem.hostname,
        severity: problem.severity,
        note,
      });
      const now = new Date().toISOString();
      setProblems((prev) =>
        prev.map((p) =>
          p.eventid === eventid
            ? {
                ...p,
                acknowledged: true,
                ack_user: res.acknowledged_by,
                ack_time: now,
                ack_note: note,
              }
            : p,
        ),
      );
      window.dispatchEvent(new Event("problemAcknowledged"));
    } catch {
      // no-op — button re-enables so user can retry
    } finally {
      setAcknowledging((prev) => {
        const next = new Set(prev);
        next.delete(eventid);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    loadProblems();
    const timer = setInterval(loadProblems, 10_000);
    return () => clearInterval(timer);
  }, [loadProblems]);

  const toggleSeverity = (sev: number) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  // Hosts that belong to any selected group (all hosts when no group selected)
  const visibleHosts =
    selectedGroups.length === 0
      ? hosts
      : hosts.filter((h) => h.groups?.some((g) => selectedGroups.includes(g.name)));

  const filtered = problems.filter((p) => {
    if (selectedSeverities.length > 0 && !selectedSeverities.includes(p.severity)) return false;
    if (hostFilter && p.hostname !== hostFilter) return false;
    if (selectedGroups.length > 0 && !p.groups.some((g) => selectedGroups.includes(g)))
      return false;
    return true;
  });

  const severityCounts = SEVERITY_CONFIG.map((s) => ({
    ...s,
    count: problems.filter((p) => p.severity === s.severity).length,
  }));

  return (
    <Box>
      {loadError && (
        <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
          {loadError}
        </Typography>
      )}
      {/* Header row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Active Problems
        </Typography>
        {!loading && (
          <Chip
            label={
              filtered.length !== problems.length
                ? `${filtered.length} / ${problems.length}`
                : problems.length
            }
            size="small"
            sx={{ height: 18, fontSize: "0.68rem" }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel shrink sx={{ fontSize: "0.78rem" }}>
            Filter by group
          </InputLabel>
          <Select
            multiple
            value={selectedGroups}
            onChange={(e: SelectChangeEvent<string[]>) =>
              setSelectedGroups(
                typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value,
              )
            }
            input={<OutlinedInput label="Filter by group" sx={{ fontSize: "0.78rem" }} />}
            renderValue={(selected) =>
              selected.length === 0 ? "All groups" : `${selected.length} selected`
            }
            displayEmpty
            sx={{ fontSize: "0.78rem" }}
          >
            {hostGroups.map((g) => (
              <MenuItem key={g.groupid} value={g.name} sx={{ fontSize: "0.78rem", py: 0.25 }}>
                <Checkbox checked={selectedGroups.includes(g.name)} size="small" />
                <ListItemText primary={g.name} primaryTypographyProps={{ fontSize: "0.78rem" }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ fontSize: "0.78rem" }}>Filter by host</InputLabel>
          <SearchableSelect
            label="Filter by host"
            value={visibleHosts.some((h) => h.host === hostFilter) ? hostFilter : ""}
            onChange={(e) => setHostFilter(e.target.value)}
            sx={{ fontSize: "0.78rem" }}
          >
            <MenuItem value="" sx={{ fontSize: "0.78rem" }}>
              All hosts
            </MenuItem>
            {visibleHosts.map((h) => (
              <MenuItem key={h.hostid} value={h.host} sx={{ fontSize: "0.78rem" }}>
                {h.host}
              </MenuItem>
            ))}
          </SearchableSelect>
        </FormControl>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadProblems} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Severity filter chips */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
        {loading
          ? SEVERITY_CONFIG.map((s) => (
              <Skeleton key={s.severity} variant="rounded" width={90} height={26} />
            ))
          : severityCounts
              .filter((s) => s.count > 0)
              .map((s) => {
                const active = selectedSeverities.includes(s.severity);
                return (
                  <Chip
                    key={s.severity}
                    label={`${s.label} (${s.count})`}
                    size="small"
                    onClick={() => toggleSeverity(s.severity)}
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      color: active ? s.color : "text.secondary",
                      backgroundColor: active ? s.bg : "transparent",
                      border: `1px solid ${active ? `${s.color}80` : "rgba(255,255,255,0.1)"}`,
                      transition: "all 0.15s",
                    }}
                  />
                );
              })}
        {!loading && problems.length === 0 && (
          <Chip
            label="No active problems"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: "0.72rem" }}
          />
        )}
        {!loading && (selectedSeverities.length > 0 || hostFilter || selectedGroups.length > 0) && (
          <Chip
            label="Clear filters"
            size="small"
            variant="outlined"
            onDelete={() => {
              setSelectedSeverities([]);
              setHostFilter("");
              setSelectedGroups([]);
            }}
            sx={{ fontSize: "0.72rem" }}
          />
        )}
      </Box>

      {/* Problems table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 28, pr: 0 }} />
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 130 }}>
                Severity
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 160 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Problem</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 120 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 90 }}>
                Duration
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 90 }}>Ack</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells
                    <TableCell key={j}>
                      <Skeleton variant="text" height={20} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {problems.length === 0 ? "No active problems" : "No problems match filters"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const isExpanded = expandedProblemId === p.eventid;
                return (
                  <>
                    <TableRow
                      key={p.eventid}
                      onClick={() => setExpandedProblemId(isExpanded ? null : p.eventid)}
                      sx={{ cursor: "pointer", "&:hover": { backgroundColor: "action.hover" } }}
                    >
                      <TableCell sx={{ width: 28, pr: 0 }}>
                        <IconButton
                          size="small"
                          aria-label={isExpanded ? "Collapse row" : "Expand row"}
                          sx={{ p: 0.25 }}
                        >
                          {isExpanded ? (
                            <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <SeverityChip severity={p.severity} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                          {p.hostname}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                          {p.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={new Date(p.clock * 1000).toLocaleString()}>
                          <Typography
                            variant="body2"
                            sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                          >
                            {new Date(p.clock * 1000).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                        >
                          {formatAge(p.age_seconds)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {p.acknowledged ? (
                          <Tooltip
                            title={
                              p.ack_user ? (
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{ display: "block", fontWeight: 700 }}
                                  >
                                    Acknowledged by {p.ack_user}
                                  </Typography>
                                  {p.ack_time && (
                                    <Typography variant="caption" sx={{ display: "block" }}>
                                      {new Date(p.ack_time).toLocaleString()}
                                    </Typography>
                                  )}
                                  {p.ack_note && (
                                    <Typography
                                      variant="caption"
                                      sx={{ display: "block", fontStyle: "italic", mt: 0.25 }}
                                    >
                                      "{p.ack_note}"
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                "Acknowledged"
                              )
                            }
                          >
                            <Chip
                              label={p.ack_user ? `Ack'd by ${p.ack_user}` : "Ack'd"}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.68rem" }}
                            />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Acknowledge this problem">
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAckTarget(p);
                                  setAckNote("");
                                }}
                                disabled={acknowledging.has(p.eventid)}
                                sx={{ fontSize: "0.68rem", height: 20, minWidth: 50, px: 1 }}
                              >
                                {acknowledging.has(p.eventid) ? "…" : "Ack"}
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    <TableRow key={`${p.eventid}-detail`}>
                      <TableCell
                        colSpan={7}
                        sx={{ py: 0, border: isExpanded ? undefined : "none" }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box
                            sx={{
                              px: 3,
                              py: 1.5,
                              bgcolor: "action.hover",
                              borderRadius: 1,
                              my: 0.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color: "text.secondary",
                                textTransform: "uppercase",
                                letterSpacing: "0.07em",
                                fontSize: "0.6rem",
                              }}
                            >
                              Problem details
                            </Typography>
                            <Box sx={{ display: "flex", gap: 4, mt: 0.75, flexWrap: "wrap" }}>
                              <Box>
                                <Typography variant="caption" color="text.disabled">
                                  Host
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600, fontSize: "0.8rem" }}
                                >
                                  {p.hostname}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.disabled">
                                  Started
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                  {new Date(p.clock * 1000).toLocaleString()}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.disabled">
                                  Duration
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                  {formatAge(p.age_seconds)}
                                </Typography>
                              </Box>
                              {p.acknowledged && (
                                <Box>
                                  <Typography variant="caption" color="text.disabled">
                                    Acknowledged by
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: "0.8rem",
                                      fontWeight: 600,
                                      color: "success.main",
                                    }}
                                  >
                                    {p.ack_user || "Unknown"}
                                    {p.ack_time && (
                                      <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ ml: 0.75, fontWeight: 400 }}
                                      >
                                        · {new Date(p.ack_time).toLocaleString()}
                                      </Typography>
                                    )}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                            {p.ack_note && (
                              <Box
                                sx={{
                                  mt: 1,
                                  px: 1.5,
                                  py: 0.75,
                                  bgcolor: "background.paper",
                                  borderRadius: 1,
                                  borderLeft: "3px solid",
                                  borderColor: "success.main",
                                }}
                              >
                                <Typography variant="caption" color="text.disabled">
                                  Note
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ fontSize: "0.82rem", fontStyle: "italic", mt: 0.25 }}
                                >
                                  "{p.ack_note}"
                                </Typography>
                              </Box>
                            )}
                            {p.acknowledged && !p.ack_note && (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{ display: "block", mt: 0.75 }}
                              >
                                No note was added.
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Acknowledge dialog */}
      <Dialog open={ackTarget !== null} onClose={() => setAckTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Acknowledge problem</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {ackTarget && (
              <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {ackTarget.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ackTarget.hostname} · {ackTarget.severity_name}
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary">
              Acknowledging as <strong>{authUser?.username ?? "you"}</strong>. Add an optional note
              explaining what was done.
            </Typography>
            <TextField
              size="small"
              multiline
              minRows={2}
              fullWidth
              label="Note (optional)"
              placeholder="e.g. Restarted the service, investigating further…"
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAckTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={ackTarget ? acknowledging.has(ackTarget.eventid) : false}
            onClick={() => {
              if (ackTarget) handleAcknowledge(ackTarget, ackNote);
            }}
          >
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

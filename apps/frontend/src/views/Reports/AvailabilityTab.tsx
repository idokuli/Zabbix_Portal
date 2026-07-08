"use client";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { TimeBar } from "./shared";
import { useReportLoader } from "./useReportLoader";

export const AvailabilityTab = () => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<
    Array<{
      hostid: string;
      hostname: string;
      availability_pct: number;
      downtime_seconds: number;
      problem_count: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      api
        .getAvailability({ hours })
        .then((r) => setData(r.hosts))
        .catch((err: unknown) => {
          console.error("Failed to load availability data:", err);
        })
        .finally(() => setLoading(false));
    },
    [hours],
  );
  useReportLoader(load);

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Availability Report"
        description="Measure uptime and SLA compliance per host group over a selected time window."
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <TimeBar hours={hours} onChange={setHours} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
        {loading && <CircularProgress size={14} />}
      </Box>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Availability is calculated from Zabbix problems in the selected window. Hosts with no
        problems show 100%.
      </Alert>
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32, p: 0 }} />
              <TableCell sx={{ fontWeight: 700 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 200 }}>Availability</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Uptime %</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 120 }}>Downtime</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Problems</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No data — all hosts may be 100% available.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((h) => {
              const pct = h.availability_pct;
              const color = pct >= 99 ? "#22C55E" : pct >= 95 ? "#F59E0B" : "#EF4444";
              const downMins = Math.floor(h.downtime_seconds / 60);
              const downStr =
                downMins >= 60 ? `${Math.floor(downMins / 60)}h ${downMins % 60}m` : `${downMins}m`;
              return (
                <>
                  <TableRow
                    key={h.hostid}
                    hover
                    onClick={() => setExpandedId(expandedId === h.hostid ? null : h.hostid)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ width: 32, p: 0, pl: 0.5 }}>
                      <IconButton size="small" tabIndex={-1}>
                        {expandedId === h.hostid ? (
                          <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {h.hostname}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: "rgba(255,255,255,0.08)",
                            "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                        {pct.toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {h.downtime_seconds > 0 ? downStr : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {h.problem_count}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${h.hostid}-detail`}>
                    <TableCell
                      colSpan={6}
                      sx={{ p: 0, borderBottom: expandedId === h.hostid ? undefined : "none" }}
                    >
                      <Collapse in={expandedId === h.hostid} timeout="auto" unmountOnExit>
                        <Box
                          sx={{
                            px: 3,
                            py: 1.5,
                            bgcolor: "action.hover",
                            display: "grid",
                            gridTemplateColumns: "140px 1fr",
                            gap: "4px 12px",
                          }}
                        >
                          {[
                            ["Host ID", h.hostid],
                            ["Availability", `${h.availability_pct.toFixed(3)}%`],
                            ["Downtime", h.downtime_seconds > 0 ? downStr : "—"],
                            ["Problems", String(h.problem_count)],
                            ["Window", `${hours}h`],
                          ].map(([label, value]) => (
                            <>
                              <Typography
                                key={`${label}-label`}
                                variant="caption"
                                sx={{
                                  color: "text.disabled",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  fontSize: "0.6rem",
                                  alignSelf: "center",
                                }}
                              >
                                {label}
                              </Typography>
                              <Typography
                                key={`${label}-value`}
                                variant="body2"
                                sx={{ fontSize: "0.78rem" }}
                              >
                                {value}
                              </Typography>
                            </>
                          ))}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

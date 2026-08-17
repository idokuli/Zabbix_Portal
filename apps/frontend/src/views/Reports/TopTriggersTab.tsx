"use client";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
import { SEVERITIES } from "../../app/severity";
import { FILTER_BAR_SX, filterLabelSx } from "../../components/FilterBar";
import { fmtTs, TimeBar } from "./shared";
import { useReportLoader } from "./useReportLoader";

const SEV_COLORS: Record<number, string> = Object.fromEntries(
  SEVERITIES.map((s) => [s.value, s.color]),
);

export const TopTriggersTab = () => {
  const [hours, setHours] = useState(24);
  const [severityMin, setSeverityMin] = useState(0);
  const [data, setData] = useState<
    Array<{
      triggerid: string;
      description: string;
      priority: number;
      severity_label: string;
      lastchange: number;
      hosts: Array<{ host: string }>;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      api
        .getTopTriggers({ limit: 100, severity_min: severityMin, hours })
        .then((r) => setData(r.triggers))
        .catch((err: unknown) => {
          console.error("Failed to load top triggers:", err);
        })
        .finally(() => setLoading(false));
    },
    [hours, severityMin],
  );
  useReportLoader(load);

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Top Triggers"
        description="Most frequently firing triggers ranked by problem count in the selected time window."
      />
      <Box sx={FILTER_BAR_SX}>
        <TimeBar hours={hours} onChange={setHours} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={filterLabelSx}>Min severity</InputLabel>
          <Select
            label="Min severity"
            value={severityMin}
            onChange={(e) => setSeverityMin(Number(e.target.value))}
            sx={filterLabelSx}
          >
            <MenuItem value={0} sx={filterLabelSx}>
              All
            </MenuItem>
            <MenuItem value={2} sx={filterLabelSx}>
              Low+
            </MenuItem>
            <MenuItem value={3} sx={filterLabelSx}>
              Medium+
            </MenuItem>
            <MenuItem value={4} sx={filterLabelSx}>
              High+
            </MenuItem>
            <MenuItem value={5} sx={filterLabelSx}>
              Critical only
            </MenuItem>
          </Select>
        </FormControl>
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
      <TableContainer
        sx={{
          border: "1px solid",
          borderColor: "divider",
          maxHeight: 560,
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32, p: 0 }} />
              <TableCell sx={{ fontWeight: 700 }}>Trigger</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Severity</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Last fired</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No triggers fired in this window.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((t) => (
              <>
                <TableRow
                  key={t.triggerid}
                  hover
                  onClick={() => setExpandedId(expandedId === t.triggerid ? null : t.triggerid)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell sx={{ width: 32, p: 0, pl: 0.5 }}>
                    <IconButton size="small" tabIndex={-1}>
                      {expandedId === t.triggerid ? (
                        <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{t.description}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {t.hosts.map((h) => h.host).join(", ")}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t.severity_label}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: "0.62rem",
                        color: SEV_COLORS[t.priority],
                        bgcolor: `${SEV_COLORS[t.priority]}18`,
                        border: `1px solid ${SEV_COLORS[t.priority]}40`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {fmtTs(t.lastchange)}
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow key={`${t.triggerid}-detail`}>
                  <TableCell
                    colSpan={5}
                    sx={{ p: 0, borderBottom: expandedId === t.triggerid ? undefined : "none" }}
                  >
                    <Collapse in={expandedId === t.triggerid} timeout="auto" unmountOnExit>
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
                          ["Trigger ID", t.triggerid],
                          ["Severity", t.severity_label],
                          ["All hosts", t.hosts.map((h) => h.host).join(", ") || "—"],
                          ["Last fired", fmtTs(t.lastchange)],
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
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

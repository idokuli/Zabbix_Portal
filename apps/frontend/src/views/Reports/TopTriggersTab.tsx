"use client";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
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
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { TimeBar, fmtTs } from "./shared";

const SEV_COLORS: Record<number, string> = {
  5: "#B71C1C",
  4: "#F44336",
  3: "#FF5722",
  2: "#FFC107",
  1: "#2196F3",
  0: "#9E9E9E",
};

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

  const load = useCallback(() => {
    setLoading(true);
    api
      .getTopTriggers({ limit: 100, severity_min: severityMin, hours })
      .then((r) => setData(r.triggers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hours, severityMin]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <TimeBar hours={hours} onChange={setHours} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Min severity</InputLabel>
          <Select
            label="Min severity"
            value={severityMin}
            onChange={(e) => setSeverityMin(Number(e.target.value))}
          >
            <MenuItem value={0}>All</MenuItem>
            <MenuItem value={2}>Low+</MenuItem>
            <MenuItem value={3}>Medium+</MenuItem>
            <MenuItem value={4}>High+</MenuItem>
            <MenuItem value={5}>Critical only</MenuItem>
          </Select>
        </FormControl>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={load}
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
          borderRadius: 1.5,
          maxHeight: 560,
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Trigger</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Severity</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Last fired</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No triggers fired in this window.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((t) => (
              <TableRow key={t.triggerid} hover>
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
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {fmtTs(t.lastchange)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

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
  IconButton,
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
import { TimeBar, fmtTs } from "./shared";
import { useReportLoader } from "./useReportLoader";

const STATUS_COLORS: Record<number, string> = { 0: "#2EA043", 1: "#DBA243", 2: "#E45959" };
const STATUS_LABELS: Record<number, string> = { 0: "Sent", 1: "In progress", 2: "Failed" };

type ActionLogEntry = {
  alertid: string;
  clock: number;
  subject: string;
  sendto: string;
  status: number;
  error: string;
  alerttype: number;
};

const ActionLogRow = ({
  a,
  isExpanded,
  onToggle,
}: {
  a: ActionLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) => (
  <>
    <TableRow hover onClick={onToggle} sx={{ cursor: "pointer" }}>
      <TableCell sx={{ width: 32, p: 0, pl: 0.5 }}>
        <IconButton size="small" tabIndex={-1}>
          {isExpanded ? (
            <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
          ) : (
            <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </TableCell>
      <TableCell
        sx={{
          fontFamily: "monospace",
          fontSize: "0.72rem",
          color: "text.secondary",
          whiteSpace: "nowrap",
        }}
      >
        {fmtTs(a.clock)}
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
          {a.subject || "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 170 }}>
          {a.sendto || "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: STATUS_COLORS[a.status] ?? "#97AAB3",
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 500, whiteSpace: "nowrap" }}>
            {STATUS_LABELS[a.status] ?? String(a.status)}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="error.light" noWrap sx={{ maxWidth: 200 }}>
          {a.error || "—"}
        </Typography>
      </TableCell>
    </TableRow>
    <TableRow>
      <TableCell colSpan={6} sx={{ p: 0, borderBottom: isExpanded ? undefined : "none" }}>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
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
              ["Type", a.alerttype === 0 ? "Message" : "Script"],
              ["Status", STATUS_LABELS[a.status] ?? String(a.status)],
              ["Sent to", a.sendto || "—"],
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
                <Typography key={`${label}-value`} variant="body2" sx={{ fontSize: "0.78rem" }}>
                  {value}
                </Typography>
              </>
            ))}
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.6rem",
                alignSelf: "flex-start",
                pt: 0.25,
              }}
            >
              Subject
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.78rem", wordBreak: "break-all" }}>
              {a.subject || "—"}
            </Typography>
            {a.error && (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.disabled",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontSize: "0.6rem",
                    alignSelf: "flex-start",
                    pt: 0.25,
                  }}
                >
                  Error
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontSize: "0.78rem", wordBreak: "break-all", color: "error.light" }}
                >
                  {a.error}
                </Typography>
              </>
            )}
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  </>
);

export const ActionLogTab = () => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<
    Array<{
      alertid: string;
      clock: number;
      subject: string;
      sendto: string;
      status: number;
      error: string;
      alerttype: number;
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
        .getActionLog({ limit: 200, hours })
        .then((r) => setData(r.entries))
        .catch((err: unknown) => {
          console.error("Failed to load action log:", err);
        })
        .finally(() => setLoading(false));
    },
    [hours],
  );
  useReportLoader(load);

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Action Log"
        description="See a history of automated actions taken by Zabbix in response to triggers and events."
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
        <Chip
          label={`${data.length} entries`}
          size="small"
          sx={{ height: 20, fontSize: "0.65rem" }}
        />
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
              <TableCell sx={{ width: 32, p: 0 }} />
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 180 }}>Sent to</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No actions sent in this window.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((a) => (
              <ActionLogRow
                key={a.alertid}
                a={a}
                isExpanded={expandedId === a.alertid}
                onToggle={() => setExpandedId(expandedId === a.alertid ? null : a.alertid)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

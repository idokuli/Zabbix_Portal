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

export const AuditLogTab = () => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<
    Array<{
      auditid: string;
      username: string;
      clock: number;
      action: string;
      resourcetype: string;
      resourcename: string;
      ip: string;
      details: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      api
        .getAuditLog({ limit: 200, hours })
        .then((r) => setData(r.entries))
        .catch((err: unknown) => {
          console.error("Failed to load audit log:", err);
        })
        .finally(() => setLoading(false));
    },
    [hours],
  );
  useReportLoader(load);

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Audit Log"
        description="Track configuration changes and user activity across the Zabbix server."
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
              <TableCell sx={{ fontWeight: 700, width: 120 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 90 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 130 }}>Resource type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Resource</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 120 }}>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No audit entries in this window.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((e) => (
              <>
                <TableRow
                  key={e.auditid}
                  hover
                  onClick={() => setExpandedId(expandedId === e.auditid ? null : e.auditid)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell sx={{ width: 32, p: 0, pl: 0.5 }}>
                    <IconButton size="small" tabIndex={-1}>
                      {expandedId === e.auditid ? (
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
                    {fmtTs(e.clock)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {e.username || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={e.action}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.6rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {e.resourcetype}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
                      {e.resourcename || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: "monospace", color: "text.disabled" }}
                    >
                      {e.ip || "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow key={`${e.auditid}-detail`}>
                  <TableCell
                    colSpan={7}
                    sx={{ p: 0, borderBottom: expandedId === e.auditid ? undefined : "none" }}
                  >
                    <Collapse in={expandedId === e.auditid} timeout="auto" unmountOnExit>
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
                          ["User", e.username || "—"],
                          ["Action", e.action],
                          ["Resource", e.resourcename || "—"],
                          ["IP", e.ip || "—"],
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
                          Details
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: "0.72rem",
                            fontFamily: "monospace",
                            wordBreak: "break-all",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {e.details || "—"}
                        </Typography>
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

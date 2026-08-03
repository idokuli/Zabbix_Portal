"use client";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";

export const QueueTab = ({
  showToast,
}: {
  showToast: (m: string, s: "success" | "error") => void;
}) => {
  const [data, setData] = useState<{
    items: Record<string, string>[];
    total: number;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const tick = useRefreshTick();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        setData(await api.getQueue());
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

  const fmtNext = (ts: string | number) => {
    const t = typeof ts === "string" ? Number.parseInt(ts, 10) : ts;
    if (!t || t <= 0) {
      return "—";
    }
    const diff = t - Math.floor(Date.now() / 1000);
    if (diff < 0) {
      return (
        <Typography component="span" variant="caption" color="error.main">
          overdue {Math.abs(diff)}s
        </Typography>
      );
    }
    if (diff < 60) {
      return `in ${diff}s`;
    }
    return `in ${Math.floor(diff / 60)}m ${diff % 60}s`;
  };

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Item Queue"
        description="Current item processing queue showing delayed and stuck checks."
        count={data && !data.error ? data.total : undefined}
        loading={loading}
        actions={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => void load()} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        }
      />
      {data?.error && <Alert severity="info">{data.error}</Alert>}
      {data && !data.error && data.items.length === 0 && (
        <Alert severity="success">Queue is empty — all items are up to date.</Alert>
      )}
      {data && !data.error && data.items.length > 0 && (
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
                <TableCell sx={{ fontWeight: 700 }}>Host</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Delay</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Next check</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Item ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: queue rows have no stable id
                <TableRow key={i} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {(row as Record<string, string>).hostname || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {(row as Record<string, string>).item_name || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {(row as Record<string, string>).delay || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {fmtNext((row as Record<string, string>).nextcheck)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.disabled">
                      {(row as Record<string, string>).itemid}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};

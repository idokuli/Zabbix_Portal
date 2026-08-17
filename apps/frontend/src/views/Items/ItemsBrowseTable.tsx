"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Skeleton,
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
import type { Host } from "../../app/api";
import { formatDateTime } from "../../app/datetime";
import { FilterSearchField, filterLabelSx } from "../../components/FilterBar";
import { SearchableSelect } from "../../components/SearchableSelect";
import { type AllItem, isItemStale, timeAgo, valueTypes } from "./shared";

type ItemRowProps = {
  item: AllItem;
  isExpanded: boolean;
  onExpand: (id: string | null) => void;
  onEdit: (item: AllItem) => void;
  onDelete: (item: AllItem) => void;
  isFav: (id: string) => boolean;
  toggleFav: (id: string) => void;
};

const StatusChips = ({ item }: { item: AllItem }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
    <Chip
      label={item.status === "0" ? "Enabled" : "Disabled"}
      size="small"
      color={item.status === "0" ? "success" : "default"}
      variant="outlined"
      sx={{ height: 18, fontSize: "0.65rem" }}
    />
    {item.state === "1" && (
      <Chip
        label="Not Supported"
        size="small"
        color="error"
        variant="filled"
        sx={{ height: 16, fontSize: "0.6rem" }}
      />
    )}
    {item.state !== "1" && isItemStale(item) && (
      <Tooltip
        title={
          item.lastclock
            ? `Last data ${timeAgo(item.lastclock)} — host may be unreachable`
            : "Never collected — host may be unreachable"
        }
        placement="top"
      >
        <Chip
          label="No data"
          size="small"
          variant="filled"
          sx={{
            height: 16,
            fontSize: "0.6rem",
            bgcolor: "error.main",
            color: "#fff",
          }}
        />
      </Tooltip>
    )}
  </Box>
);

const LastValueCell = ({ item }: { item: AllItem }) => (
  <Tooltip
    title={
      isItemStale(item)
        ? "No recent data"
        : [item.lastvalue || "", item.lastclock ? `Last collected ${timeAgo(item.lastclock)}` : ""]
            .filter(Boolean)
            .join("\n\n")
    }
    placement="top"
  >
    <Typography
      variant="body2"
      sx={{
        fontFamily: "monospace",
        fontSize: "0.75rem",
        color: item.lastvalue && !isItemStale(item) ? "text.primary" : "text.disabled",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "block",
        maxWidth: 220,
      }}
    >
      {isItemStale(item) ? "—" : item.lastvalue || "—"}
    </Typography>
  </Tooltip>
);

const ItemDetailPanel = ({ item, isExpanded }: { item: AllItem; isExpanded: boolean }) => (
  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
    <Box
      sx={{
        px: 3,
        py: 1.5,
        bgcolor: "action.hover",
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
        Item details
      </Typography>
      <Box sx={{ display: "flex", gap: 4, mt: 0.75, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" color="text.disabled">
            Type
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
            {valueTypes.find((vt) => vt.value === Number(item.value_type))?.label ??
              `Type ${item.value_type}`}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.disabled">
            Interval
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
            {item.delay || "—"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.disabled">
            Source
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
            {item.templateid === "0" ? "Custom item" : "From template"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.disabled">
            Last collected
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
            {formatDateTime(item.lastclock, "Never")}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          mt: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.disabled">
          Key
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.78rem",
            wordBreak: "break-all",
            mt: 0.25,
          }}
        >
          {item.key_}
        </Typography>
      </Box>
    </Box>
  </Collapse>
);

const ItemRow = ({
  item,
  isExpanded,
  onExpand,
  onEdit,
  onDelete,
  isFav,
  toggleFav,
}: ItemRowProps) => {
  return (
    <>
      <TableRow
        hover
        onClick={() => onExpand(isExpanded ? null : item.itemid)}
        sx={{
          cursor: "pointer",
          ...(isItemStale(item) ? { bgcolor: "rgba(239,68,68,0.04)" } : {}),
        }}
      >
        <TableCell sx={{ width: 28, pr: 0 }}>
          <IconButton size="small" sx={{ p: 0.25 }}>
            {isExpanded ? (
              <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
            ) : (
              <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </TableCell>
        <TableCell padding="checkbox">
          <Tooltip title={isFav(item.itemid) ? "Remove from favourites" : "Add to favourites"}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                toggleFav(item.itemid);
              }}
              sx={{
                color: isFav(item.itemid) ? "warning.main" : "action.disabled",
              }}
            >
              {isFav(item.itemid) ? (
                <StarIcon sx={{ fontSize: 16 }} />
              ) : (
                <StarBorderIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="body2">{item.name}</Typography>
            {item.templateid === "0" && (
              <Chip
                label="custom"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 14, fontSize: "0.55rem", fontWeight: 700, px: 0.25 }}
              />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: "nowrap" }}>
            {item.hostname}
          </Typography>
        </TableCell>
        <TableCell>
          <StatusChips item={item} />
        </TableCell>
        <TableCell sx={{ maxWidth: 220, overflow: "hidden" }}>
          <LastValueCell item={item} />
        </TableCell>
        <TableCell sx={{ maxWidth: 220 }}>
          <Tooltip title={item.key_} placement="top">
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "text.secondary",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.key_}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
            {item.delay}
          </Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
            {(item.tags ?? []).map((t: { tag: string; value: string }) => (
              <Chip
                key={`${t.tag}:${t.value}`}
                label={t.value ? `${t.tag}: ${t.value}` : t.tag}
                size="small"
                variant="outlined"
                sx={{ height: 16, fontSize: "0.6rem" }}
              />
            ))}
          </Box>
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Edit item">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete item">
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={10} sx={{ py: 0, border: isExpanded ? undefined : "none" }}>
          <ItemDetailPanel item={item} isExpanded={isExpanded} />
        </TableCell>
      </TableRow>
    </>
  );
};

type TableBodyContentProps = {
  loading: boolean;
  items: AllItem[];
  browseHostFilter: string;
  browseSearch: string;
  expandedItemId: string | null;
  onExpand: (id: string | null) => void;
  onEdit: (item: AllItem) => void;
  onDelete: (item: AllItem) => void;
  isFav: (id: string) => boolean;
  toggleFav: (id: string) => void;
};

const TableBodyContent = ({
  loading,
  items,
  browseHostFilter,
  browseSearch,
  expandedItemId,
  onExpand,
  onEdit,
  onDelete,
  isFav,
  toggleFav,
}: TableBodyContentProps) => {
  if (loading) {
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
          <TableRow key={i}>
            {Array.from({ length: 9 }).map((__, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells
              <TableCell key={j}>
                <Skeleton variant="text" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </>
    );
  }
  if (items.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
          {browseHostFilter
            ? browseSearch
              ? "No items match the search."
              : "No items found on this host."
            : "Select a host above to view its items."}
        </TableCell>
      </TableRow>
    );
  }
  return (
    <>
      {items.map((item) => (
        <ItemRow
          key={item.itemid}
          item={item}
          isExpanded={expandedItemId === item.itemid}
          onExpand={onExpand}
          onEdit={onEdit}
          onDelete={onDelete}
          isFav={isFav}
          toggleFav={toggleFav}
        />
      ))}
    </>
  );
};

type ItemsBrowseTableProps = {
  items: AllItem[];
  allCount: number;
  loading: boolean;
  browseSearch: string;
  onSearchChange: (v: string) => void;
  browseHostFilter: string;
  onHostFilterChange: (v: string) => void;
  hosts: Host[];
  expandedItemId: string | null;
  onExpand: (id: string | null) => void;
  onEdit: (item: AllItem) => void;
  onDelete: (item: AllItem) => void;
  isFav: (id: string) => boolean;
  toggleFav: (id: string) => void;
  onRefresh: () => void;
};

export const ItemsBrowseTable = ({
  items,
  allCount,
  loading,
  browseSearch,
  onSearchChange,
  browseHostFilter,
  onHostFilterChange,
  hosts,
  expandedItemId,
  onExpand,
  onEdit,
  onDelete,
  isFav,
  toggleFav,
  onRefresh,
}: ItemsBrowseTableProps) => {
  const unreachableHost = browseHostFilter
    ? hosts.find((h) => h.host === browseHostFilter)
    : undefined;
  // biome-ignore lint/style/useExplicitLengthCheck: `> 0` breaks TS's narrowing of unreachableHost/interfaces below
  const primaryInterface = unreachableHost?.interfaces?.length
    ? (unreachableHost.interfaces.find((i) => i.type === "1") ?? unreachableHost.interfaces[0])
    : undefined;
  const showUnreachableAlert = primaryInterface?.available === "2";

  return (
    <Stack spacing={2}>
      {/* ── Toolbar ── */}
      <Stack sx={{ alignItems: "center" }} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <FilterSearchField
          placeholder="Search by name or key…"
          value={browseSearch}
          onChange={onSearchChange}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={filterLabelSx}>Filter by host</InputLabel>
          <SearchableSelect
            label="Filter by host"
            value={browseHostFilter}
            onChange={(e) => onHostFilterChange(e.target.value)}
            sx={filterLabelSx}
          >
            <MenuItem value="" sx={filterLabelSx}>
              <em>All hosts</em>
            </MenuItem>
            {hosts.map((h) => (
              <MenuItem key={h.hostid} value={h.host} sx={filterLabelSx}>
                {h.host}
              </MenuItem>
            ))}
          </SearchableSelect>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          {loading
            ? "Loading…"
            : `${items.length} of ${allCount} items${allCount === 2000 ? " (limit)" : ""}`}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={onRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {/* ── Host unreachable alert ── */}
      {showUnreachableAlert && (
        <Alert
          severity="warning"
          icon={<WifiOffIcon fontSize="inherit" />}
          sx={{ py: 0.5, fontSize: "0.82rem" }}
        >
          <strong>Host agent unreachable.</strong> Zabbix cannot collect data from this host. Items
          showing a <strong>No data</strong> chip have not reported within their expected polling
          interval — values below are stale.
        </Alert>
      )}

      {/* ── Table ── */}
      <TableContainer
        sx={{
          border: "1px solid",
          borderColor: "divider",
          maxHeight: 520,
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 28, pr: 0, bgcolor: "background.paper" }} />
              <TableCell sx={{ width: 36, bgcolor: "background.paper" }} />
              <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Name</TableCell>
              <TableCell
                sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
              >
                Host
              </TableCell>
              <TableCell
                sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
              >
                Status
              </TableCell>
              <TableCell
                sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
              >
                Last Value
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Key</TableCell>
              <TableCell
                sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
              >
                Interval
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Tags</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 50, bgcolor: "background.paper" }} />
            </TableRow>
          </TableHead>
          <TableBody>
            <TableBodyContent
              loading={loading}
              items={items}
              browseHostFilter={browseHostFilter}
              browseSearch={browseSearch}
              expandedItemId={expandedItemId}
              onExpand={onExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              isFav={isFav}
              toggleFav={toggleFav}
            />
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

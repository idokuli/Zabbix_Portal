"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { TabHeader } from "../../app/components/TabHeader";

export type TemplateGroup = { groupid: string; name: string; template_count: number };
export type HostGroup = { groupid: string; name: string; host_count: number };
export type DcTemplate = {
  templateid: string;
  name: string;
  description: string;
  groups: Array<{ groupid: string; name: string }>;
  linked_templates: Array<{ templateid: string; name: string }>;
};
export type Maintenance = {
  maintenanceid: string;
  name: string;
  maintenance_type: string;
  active_since: number;
  active_till: number;
  description: string;
  hosts: Array<{ hostid: string; name: string }>;
  groups: Array<{ groupid: string; name: string }>;
};
export type Correlation = {
  correlationid: string;
  name: string;
  description: string;
  status: string;
  condition_count: number;
  operation_count: number;
};
export type DiscoveryRule = {
  druleid: string;
  name: string;
  iprange: string;
  delay: string;
  status: string;
  nextcheck: number;
  check_count: number;
};

export { fmtTs } from "../../app/utils";

export const StatusChip = ({
  status,
  on = "0",
  labels = ["Enabled", "Disabled"],
}: {
  status: string;
  on?: string;
  labels?: string[];
}) => (
  <Chip
    label={status === on ? labels[0] : labels[1]}
    size="small"
    color={status === on ? "success" : "default"}
    variant="outlined"
    sx={{ height: 18, fontSize: "0.62rem" }}
  />
);

export { ConfirmDelete } from "../../app/components/ConfirmDelete";

export const MembersDialog = <T extends { name: string }>({
  open,
  title,
  items,
  loading,
  onClose,
  renderSecondary,
}: {
  open: boolean;
  title: string;
  items: T[];
  loading: boolean;
  onClose: () => void;
  renderSecondary?: (item: T) => string;
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
    {loading && <LinearProgress />}
    <DialogContent sx={{ pt: 0.5 }}>
      {!loading && items.length === 0 && (
        <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
          No items found.
        </Typography>
      )}
      <List dense disablePadding>
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: display-only list, no stable id
          <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
            <ListItemText
              primary={<Typography variant="body2">{item.name}</Typography>}
              secondary={
                renderSecondary ? (
                  <Typography variant="caption" color="text.disabled">
                    {renderSecondary(item)}
                  </Typography>
                ) : undefined
              }
            />
          </ListItem>
        ))}
      </List>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

export const SectionHeader = ({
  title,
  description,
  count,
  loading,
  onRefresh,
  onAdd,
  addLabel = "Add",
}: {
  title: string;
  description: string;
  count: number;
  loading: boolean;
  onRefresh: () => void;
  onAdd: () => void;
  addLabel?: string;
}) => (
  <TabHeader
    title={title}
    description={description}
    count={count}
    loading={loading}
    actions={
      <>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={onRefresh} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="contained"
          color="secondary"
          startIcon={<AddOutlinedIcon />}
          onClick={onAdd}
        >
          {addLabel}
        </Button>
      </>
    }
  />
);

"use client";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import StarIcon from "@mui/icons-material/Star";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  Stack,
  Typography,
} from "@mui/material";
import type { Host } from "../../app/api";
import { SEVERITIES } from "../../app/severity";
import { AvailabilityCell } from "./shared";

type DrawerItem = {
  itemid: string;
  name: string;
  key_: string;
  lastvalue: string;
  lastclock: number | null;
};
type DrawerTrigger = {
  triggerid: string;
  description: string;
  priority: number;
  value: number;
  lastchange: number;
  status: number;
};

const TRIGGER_PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  0: { label: SEVERITIES[0].label, color: SEVERITIES[0].color },
  1: { label: SEVERITIES[1].label, color: SEVERITIES[1].color },
  2: { label: SEVERITIES[2].label, color: SEVERITIES[2].color },
  3: { label: SEVERITIES[3].label, color: SEVERITIES[3].color },
  4: { label: SEVERITIES[4].label, color: SEVERITIES[4].color },
  5: { label: SEVERITIES[5].label, color: SEVERITIES[5].color },
};

const DrawerItemRow = ({
  item,
  isDark,
  isFav,
}: {
  item: DrawerItem;
  isDark: boolean;
  isFav: boolean;
}) => (
  <ListItem
    disablePadding
    sx={{
      py: 0.75,
      px: 1,
      mb: 0.25,
      borderRadius: 1.5,
      border: "1px solid",
      borderColor: "divider",
      bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flex: 1 }}>
      {isFav && <StarIcon sx={{ fontSize: 13, color: "warning.main", flexShrink: 0 }} />}
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
          {item.name}
        </Typography>
        <Typography
          noWrap
          sx={{ fontSize: "0.68rem", color: "text.disabled", fontFamily: "monospace" }}
        >
          {item.key_}
        </Typography>
      </Box>
    </Box>
    {item.lastvalue !== "" && (
      <Typography
        sx={{
          fontSize: "0.78rem",
          fontFamily: "monospace",
          color: "primary.main",
          fontWeight: 600,
          flexShrink: 0,
          ml: 1,
        }}
      >
        {item.lastvalue.length > 20 ? `${item.lastvalue.slice(0, 20)}…` : item.lastvalue}
      </Typography>
    )}
  </ListItem>
);

const DrawerTriggerRow = ({
  trigger,
  isDark,
  isFav,
}: {
  trigger: DrawerTrigger;
  isDark: boolean;
  isFav: boolean;
}) => {
  const prio = TRIGGER_PRIORITY_LABEL[trigger.priority] ?? TRIGGER_PRIORITY_LABEL[0];
  const isProblem = trigger.value === 1;
  return (
    <ListItem
      disablePadding
      sx={{
        py: 0.75,
        px: 1,
        mb: 0.25,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: isProblem ? "rgba(220,38,38,0.3)" : "divider",
        bgcolor: isProblem
          ? isDark
            ? "rgba(220,38,38,0.07)"
            : "rgba(220,38,38,0.04)"
          : isDark
            ? "rgba(255,255,255,0.02)"
            : "rgba(0,0,0,0.01)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flex: 1 }}>
        {isFav && <StarIcon sx={{ fontSize: 13, color: "warning.main", flexShrink: 0 }} />}
        {isProblem ? (
          <WarningAmberOutlinedIcon sx={{ fontSize: 15, color: "error.main", flexShrink: 0 }} />
        ) : (
          <CheckCircleOutlineIcon sx={{ fontSize: 15, color: "success.main", flexShrink: 0 }} />
        )}
        <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
          {trigger.description}
        </Typography>
      </Box>
      <Chip
        size="small"
        label={prio.label}
        sx={{
          height: 16,
          fontSize: "0.6rem",
          fontWeight: 700,
          bgcolor: `${prio.color}22`,
          color: prio.color,
          border: "none",
          flexShrink: 0,
        }}
      />
    </ListItem>
  );
};

const primaryHostInterface = (host: Host) =>
  host.interfaces?.find((i) => i.type === "1") ?? host.interfaces?.[0];

const HostDrawerHeader = ({
  host,
  isDark,
  onClose,
}: {
  host: Host;
  isDark: boolean;
  onClose: () => void;
}) => (
  <Box
    sx={{
      px: 2.5,
      pt: 2.5,
      pb: 2,
      borderBottom: "1px solid",
      borderColor: "divider",
      flexShrink: 0,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <RouterOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem" }}>
            {host.host}
          </Typography>
          <Chip
            size="small"
            label={host.status === "0" ? "Enabled" : "Disabled"}
            sx={{
              height: 18,
              fontSize: "0.62rem",
              fontWeight: 700,
              bgcolor:
                host.status === "0"
                  ? isDark
                    ? "rgba(22,163,74,0.18)"
                    : "rgba(22,163,74,0.12)"
                  : "action.hover",
              color: host.status === "0" ? "success.main" : "text.disabled",
              border: "none",
            }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <AvailabilityCell interfaces={host.interfaces} />
          {(() => {
            const iface = primaryHostInterface(host);
            return iface ? (
              <Typography
                sx={{ fontSize: "0.78rem", fontFamily: "monospace", color: "text.secondary" }}
              >
                {iface.ip}:{iface.port}
              </Typography>
            ) : null;
          })()}
          {(host.problem_count ?? 0) > 0 && (
            <Chip
              size="small"
              icon={<WarningAmberOutlinedIcon sx={{ fontSize: "0.75rem !important" }} />}
              label={`${host.problem_count} problem${host.problem_count !== 1 ? "s" : ""}`}
              sx={{
                height: 18,
                fontSize: "0.62rem",
                fontWeight: 700,
                bgcolor: "rgba(220,38,38,0.15)",
                color: "error.main",
                border: "none",
              }}
            />
          )}
        </Box>
      </Box>
      <IconButton size="small" onClick={onClose} sx={{ color: "text.disabled", mt: -0.5 }}>
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  </Box>
);

export const HostDetailDrawer = ({
  selectedHost,
  onClose,
  isDark,
  drawerLoading,
  drawerItems,
  drawerTriggers,
  isFavItem,
  isFavTrigger,
}: {
  selectedHost: Host | null;
  onClose: () => void;
  isDark: boolean;
  drawerLoading: boolean;
  drawerItems: DrawerItem[];
  drawerTriggers: DrawerTrigger[];
  isFavItem: (id: string) => boolean;
  isFavTrigger: (id: string) => boolean;
}) => (
  <Drawer
    anchor="right"
    open={!!selectedHost}
    onClose={onClose}
    PaperProps={{
      sx: {
        width: 520,
        bgcolor: "background.paper",
        backgroundImage: "none",
        borderLeft: "1px solid",
        borderColor: "divider",
      },
    }}
  >
    {selectedHost && (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Drawer header */}
        <HostDrawerHeader host={selectedHost} isDark={isDark} onClose={onClose} />

        {/* Drawer body */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
          {drawerLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {/* Items section */}
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "text.disabled",
                    mb: 1,
                  }}
                >
                  Items ({drawerItems.length})
                </Typography>
                {drawerItems.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">
                    No items found
                  </Typography>
                ) : (
                  <List disablePadding>
                    {[...drawerItems]
                      .sort((a, b) => (isFavItem(b.itemid) ? 1 : 0) - (isFavItem(a.itemid) ? 1 : 0))
                      .slice(0, 30)
                      .map((item) => (
                        <DrawerItemRow
                          key={item.itemid}
                          item={item}
                          isDark={isDark}
                          isFav={isFavItem(item.itemid)}
                        />
                      ))}
                    {drawerItems.length > 30 && (
                      <Typography variant="caption" color="text.disabled" sx={{ pl: 1 }}>
                        +{drawerItems.length - 30} more items — use the Items page to view all
                      </Typography>
                    )}
                  </List>
                )}
              </Box>

              <Divider />

              {/* Triggers section */}
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "text.disabled",
                    mb: 1,
                  }}
                >
                  Triggers ({drawerTriggers.length})
                </Typography>
                {drawerTriggers.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">
                    No triggers found
                  </Typography>
                ) : (
                  <List disablePadding>
                    {[...drawerTriggers]
                      .sort(
                        (a, b) =>
                          (isFavTrigger(b.triggerid) ? 1 : 0) - (isFavTrigger(a.triggerid) ? 1 : 0),
                      )
                      .map((trigger) => (
                        <DrawerTriggerRow
                          key={trigger.triggerid}
                          trigger={trigger}
                          isDark={isDark}
                          isFav={isFavTrigger(trigger.triggerid)}
                        />
                      ))}
                  </List>
                )}
              </Box>
            </Stack>
          )}
        </Box>
      </Box>
    )}
  </Drawer>
);

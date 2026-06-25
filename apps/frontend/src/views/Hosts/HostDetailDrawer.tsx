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
        bgcolor: isDark ? "#0F1E35" : "background.paper",
        backgroundImage: "none",
        borderLeft: "1px solid",
        borderColor: "divider",
      },
    }}
  >
    {selectedHost && (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Drawer header */}
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
                  {selectedHost.host}
                </Typography>
                <Chip
                  size="small"
                  label={selectedHost.status === "0" ? "Enabled" : "Disabled"}
                  sx={{
                    height: 18,
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    bgcolor:
                      selectedHost.status === "0"
                        ? isDark
                          ? "rgba(22,163,74,0.18)"
                          : "rgba(22,163,74,0.12)"
                        : "action.hover",
                    color: selectedHost.status === "0" ? "#16a34a" : "text.disabled",
                    border: "none",
                  }}
                />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <AvailabilityCell interfaces={selectedHost.interfaces} />
                {(() => {
                  const iface =
                    selectedHost.interfaces?.find((i) => i.type === "1") ??
                    selectedHost.interfaces?.[0];
                  return iface ? (
                    <Typography
                      sx={{
                        fontSize: "0.78rem",
                        fontFamily: "monospace",
                        color: "text.secondary",
                      }}
                    >
                      {iface.ip}:{iface.port}
                    </Typography>
                  ) : null;
                })()}
                {(selectedHost.problem_count ?? 0) > 0 && (
                  <Chip
                    size="small"
                    icon={<WarningAmberOutlinedIcon sx={{ fontSize: "0.75rem !important" }} />}
                    label={`${selectedHost.problem_count} problem${selectedHost.problem_count !== 1 ? "s" : ""}`}
                    sx={{
                      height: 18,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      bgcolor: "rgba(220,38,38,0.15)",
                      color: "#ef4444",
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
                        <ListItem
                          key={item.itemid}
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
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.75,
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            {isFavItem(item.itemid) && (
                              <StarIcon sx={{ fontSize: 13, color: "#F59E0B", flexShrink: 0 }} />
                            )}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                                {item.name}
                              </Typography>
                              <Typography
                                noWrap
                                sx={{
                                  fontSize: "0.68rem",
                                  color: "text.disabled",
                                  fontFamily: "monospace",
                                }}
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
                              {item.lastvalue.length > 20
                                ? `${item.lastvalue.slice(0, 20)}…`
                                : item.lastvalue}
                            </Typography>
                          )}
                        </ListItem>
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
                      .map((trigger) => {
                        const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
                          0: { label: "Not classified", color: "#6B7280" },
                          1: { label: "Info", color: "#3B82F6" },
                          2: { label: "Warning", color: "#F59E0B" },
                          3: { label: "Average", color: "#F97316" },
                          4: { label: "High", color: "#EF4444" },
                          5: { label: "Disaster", color: "#DC2626" },
                        };
                        const prio = PRIORITY_LABEL[trigger.priority] ?? PRIORITY_LABEL[0];
                        const isProblem = trigger.value === 1;
                        return (
                          <ListItem
                            key={trigger.triggerid}
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
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.75,
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              {isFavTrigger(trigger.triggerid) && (
                                <StarIcon sx={{ fontSize: 13, color: "#F59E0B", flexShrink: 0 }} />
                              )}
                              {isProblem ? (
                                <WarningAmberOutlinedIcon
                                  sx={{ fontSize: 15, color: "#EF4444", flexShrink: 0 }}
                                />
                              ) : (
                                <CheckCircleOutlineIcon
                                  sx={{ fontSize: 15, color: "#16a34a", flexShrink: 0 }}
                                />
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
                      })}
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

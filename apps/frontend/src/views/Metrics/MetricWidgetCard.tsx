"use client";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, IconButton, MenuItem, Paper, Select, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import type { AlertEvent, MetricWidgetConfig } from "../../app/api";
import { ItemChart } from "./ItemChart";
import { MetricConfigDialog } from "./MetricConfigDialog";
import { PERIOD_OPTIONS } from "./shared";

export const MetricWidgetCard = ({
  widget,
  onRemove,
  onUpdate,
  alertEvents = [],
}: {
  widget: MetricWidgetConfig;
  onRemove: () => void;
  onUpdate: (updates: Partial<MetricWidgetConfig>) => void;
  alertEvents?: AlertEvent[];
}) => {
  const periodOption = PERIOD_OPTIONS[widget.periodIdx] ?? PERIOD_OPTIONS[5];
  const [configOpen, setConfigOpen] = useState(false);
  const displayTitle = widget.customTitle ?? widget.itemName;

  return (
    <Paper
      elevation={2}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          bgcolor: "action.hover",
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          px: 0.5,
        }}
      >
        <Box
          component="button"
          type="button"
          className="drag-handle"
          aria-label="Drag to reposition widget"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flex: 1,
            minWidth: 0,
            px: 1,
            py: 0.6,
            cursor: "grab",
            border: "none",
            background: "none",
            font: "inherit",
            color: "inherit",
            textAlign: "left",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0, ml: 0.25 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: "0.76rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={displayTitle}
            >
              {displayTitle}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: "0.65rem", color: "text.secondary", display: "block", lineHeight: 1 }}
            >
              {widget.hostname}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0, pr: 0.5 }}>
          <Select
            variant="standard"
            value={widget.periodIdx}
            onChange={(e) => onUpdate({ periodIdx: Number(e.target.value) })}
            sx={{
              fontSize: "0.68rem",
              color: "text.secondary",
              "&:before, &:after": { display: "none" },
              "& .MuiSelect-select": { py: 0, pr: "18px !important", pl: 0.5 },
              "& .MuiSvgIcon-root": { fontSize: 14, right: 0 },
            }}
          >
            {PERIOD_OPTIONS.map((opt, i) => (
              <MenuItem key={opt.label} value={i} sx={{ fontSize: "0.72rem" }}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
          <Tooltip title="Configure metric">
            <IconButton
              size="small"
              onClick={() => setConfigOpen(true)}
              sx={{ color: "text.disabled", "&:hover": { color: "primary.light" }, p: 0.3 }}
            >
              <TuneIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            aria-label="Remove widget"
            onClick={onRemove}
            sx={{
              color: "text.disabled",
              "&:hover": { color: "error.light" },
              p: 0.3,
            }}
          >
            <CloseIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, p: 1, overflow: "hidden" }}>
        <ItemChart
          key={widget.itemid}
          itemid={widget.itemid}
          minutes={periodOption.minutes}
          alertEvents={alertEvents}
          lineColor={widget.lineColor}
          onPeriodChange={(delta) =>
            onUpdate({
              periodIdx: Math.max(0, Math.min(PERIOD_OPTIONS.length - 1, widget.periodIdx + delta)),
            })
          }
        />
      </Box>

      <MetricConfigDialog
        open={configOpen}
        widget={widget}
        onClose={() => setConfigOpen(false)}
        onSave={(updates) => onUpdate(updates)}
      />
    </Paper>
  );
};

"use client";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, IconButton, MenuItem, Paper, Select, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import type { AlertEvent, Problem, WidgetConfig } from "../../app/api";
import { ChartJsGraph } from "./ChartJsGraph";
import { GraphConfigDialog } from "./GraphConfigDialog";
import { PERIOD_OPTIONS } from "./shared";

export const WidgetCard = ({
  widget,
  onRemove,
  onUpdate,
  alertEvents = [],
  problems = [],
}: {
  widget: WidgetConfig;
  onRemove: () => void;
  onUpdate: (updates: Partial<WidgetConfig>) => void;
  alertEvents?: AlertEvent[];
  problems?: Problem[];
}) => {
  const periodOption = PERIOD_OPTIONS[widget.periodIdx] ?? PERIOD_OPTIONS[5];
  const [configOpen, setConfigOpen] = useState(false);
  const displayTitle = widget.customTitle ?? widget.graphName;

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 6 },
      }}
    >
      {/* Header row — drag zone is only the left side so controls remain clickable */}
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
        {/* Draggable area */}
        <Box
          className="drag-handle"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flex: 1,
            minWidth: 0,
            py: 0.75,
            px: 1,
            cursor: "grab",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 14, color: "text.disabled", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0, ml: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: "0.8rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
              title={displayTitle}
            >
              {displayTitle}
            </Typography>
            {widget.hostName && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.65rem",
                  color: "text.secondary",
                  display: "block",
                  lineHeight: 1,
                }}
              >
                {widget.hostName}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Controls — outside drag zone so clicks register */}
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
          <Tooltip title="Configure graph">
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

      <Box sx={{ flex: 1, minHeight: 0, p: 1.5, overflow: "hidden" }}>
        <ChartJsGraph
          key={widget.graphid}
          graphid={widget.graphid}
          minutes={periodOption.minutes}
          alertEvents={alertEvents}
          problems={problems}
          lineColor={widget.lineColor}
          onPeriodChange={(delta) =>
            onUpdate({
              periodIdx: Math.max(0, Math.min(PERIOD_OPTIONS.length - 1, widget.periodIdx + delta)),
            })
          }
        />
      </Box>

      <GraphConfigDialog
        open={configOpen}
        widget={widget}
        onClose={() => setConfigOpen(false)}
        onSave={(updates) => onUpdate(updates)}
      />
    </Paper>
  );
};

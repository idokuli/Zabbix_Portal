"use client";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
  IconButton,
  InputAdornment,
  type SxProps,
  TextField,
  type TextFieldProps,
  type Theme,
} from "@mui/material";

/**
 * Shared look for every filter toolbar in the app (search box, filter dropdowns,
 * summary chip, trailing icon buttons) — the reference design is the Problems tab
 * toolbar (views/Metrics/ProblemsTab.tsx). Apply filterLabelSx to each
 * InputLabel/Select/MenuItem in a toolbar's filter dropdowns so every toolbar's
 * text renders at the same size; use FilterSearchField for the search box; use
 * FILTER_BAR_SX on the toolbar's outer container.
 */
export const FILTER_LABEL_FONT_SIZE = "0.78rem";

export const filterLabelSx: SxProps<Theme> = { fontSize: FILTER_LABEL_FONT_SIZE };

export const FILTER_BAR_SX: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  mb: 2,
  flexWrap: "wrap",
};

type FilterSearchFieldProps = Omit<TextFieldProps, "size" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

/** The search box every filter toolbar starts with — flex:1, small icon, clear button. */
export const FilterSearchField = ({ value, onChange, sx, ...rest }: FilterSearchFieldProps) => (
  <TextField
    {...rest}
    size="small"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    slotProps={{
      input: {
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => onChange("")}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      },
    }}
    sx={{ flex: 1, minWidth: 180, ...sx }}
  />
);

"use client";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { InputAdornment, ListSubheader, Select, type SelectProps, TextField } from "@mui/material";
import React, { type ReactNode, useState } from "react";

const extractText = (node: ReactNode): string => {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (node == null) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
};

type Props<T> = Omit<SelectProps<T>, "children"> & {
  children: ReactNode;
  searchPlaceholder?: string;
};

export const SearchableSelect = <T,>({
  children,
  searchPlaceholder,
  onClose,
  MenuProps: menuPropsProp,
  ...rest
}: Props<T>) => {
  const [search, setSearch] = useState("");
  const selectedValue = rest.value;

  const filtered = React.Children.toArray(children).filter((child) => {
    if (!React.isValidElement(child)) {
      return true;
    }
    if (!search) {
      return true;
    }
    if ((child.props as { value?: unknown }).value === selectedValue) {
      return true;
    }
    const text = extractText((child.props as { children?: ReactNode }).children).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const handleClose: SelectProps<T>["onClose"] = (e) => {
    setSearch("");
    onClose?.(e);
  };

  return (
    <Select<T> {...rest} onClose={handleClose} MenuProps={{ autoFocus: false, ...menuPropsProp }}>
      <ListSubheader
        sx={{ px: 1, pt: 0.75, pb: 0.5, lineHeight: "normal", bgcolor: "background.paper" }}
      >
        <TextField
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ fontSize: 16 }} />
                </InputAdornment>
              ),
            },
          }}
          size="small"
          fullWidth
          autoFocus
          placeholder={searchPlaceholder ?? "Search…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </ListSubheader>
      {filtered}
    </Select>
  );
};

"use client";

import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Dialog,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { visibleNavGroups } from "./nav";

type Destination = {
  href: string;
  label: string;
  section: string;
  icon: React.ReactNode;
};

// ⌘K quick-jump: every nav destination, filtered as you type.
export const CommandPalette = ({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: string[];
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const destinations = useMemo<Destination[]>(() => {
    const out: Destination[] = [];
    for (const g of visibleNavGroups(roles)) {
      const section = t(g.labelKey);
      if (g.href) {
        out.push({ href: g.href, label: section, section: "", icon: g.icon });
      }
      for (const item of g.items) {
        out.push({ href: item.href, label: t(item.labelKey), section, icon: item.icon });
      }
    }
    return out;
  }, [roles, t]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? destinations.filter((d) => `${d.section} ${d.label}`.toLowerCase().includes(q))
    : destinations;

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, []);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && filtered[cursor]) {
      e.preventDefault();
      go(filtered[cursor].href);
    }
  };

  // Keep the highlighted row in view while arrowing through results.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <Dialog
      slotProps={{
        paper: {
          sx: { position: "fixed", top: "12%", m: 0, overflow: "hidden" },
        },
      }}
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder={t("nav.goTo", { defaultValue: "Go to…" })}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          sx={{ fontSize: "0.875rem" }}
          inputProps={{ "aria-label": "Search pages" }}
        />
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            border: "1px solid",
            borderColor: "divider",
            px: 0.75,
            lineHeight: 1.8,
            flexShrink: 0,
          }}
        >
          esc
        </Typography>
      </Box>
      <List ref={listRef} dense disablePadding sx={{ maxHeight: 360, overflowY: "auto", py: 0.5 }}>
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            No pages match “{query}”.
          </Typography>
        )}
        {filtered.map((d, idx) => (
          <ListItemButton
            key={d.href}
            data-idx={idx}
            selected={idx === cursor}
            onMouseEnter={() => setCursor(idx)}
            onClick={() => go(d.href)}
            sx={{ px: 2, py: 0.75 }}
          >
            <ListItemIcon sx={{ minWidth: 30, color: "text.secondary" }}>{d.icon}</ListItemIcon>
            <ListItemText
              slotProps={{ primary: { sx: { fontSize: "0.8125rem" } } }}
              primary={d.label}
            />
            {d.section && (
              <Typography variant="caption" color="text.disabled">
                {d.section}
              </Typography>
            )}
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
};

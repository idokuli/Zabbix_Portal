"use client";
import CloseIcon from "@mui/icons-material/Close";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Skeleton,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type Host, api } from "../../app/api";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { ItemDef } from "./shared";

export const AddMetricDialog = ({
  open,
  onClose,
  onAdd,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (hostname: string, item: ItemDef) => void;
  existingIds: string[];
}) => {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHost, setSelectedHost] = useState("");
  const [items, setItems] = useState<ItemDef[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    api.listHosts().then((res) => setHosts(res.hosts));
    setSelectedHost("");
    setItems([]);
    setItemSearch("");
  }, [open]);

  useEffect(() => {
    if (!selectedHost) {
      return;
    }
    setItemsLoading(true);
    setItems([]);
    setItemSearch("");
    api
      .listItems(selectedHost)
      .then((res) => {
        const numeric = res.items.filter((i) => i.value_type === "0" || i.value_type === "3");
        setItems(numeric);
      })
      .catch(() => setItems([]))
      .finally(() => setItemsLoading(false));
  }, [selectedHost]);

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      i.key_.toLowerCase().includes(itemSearch.toLowerCase()),
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={700}>Add Metric Widget</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Host</InputLabel>
            <SearchableSelect
              label="Host"
              value={selectedHost}
              onChange={(e) => setSelectedHost(e.target.value)}
            >
              {hosts.map((h) => (
                <MenuItem key={h.hostid} value={h.host}>
                  {h.host}
                </MenuItem>
              ))}
            </SearchableSelect>
          </FormControl>
        </Box>
        <Divider />
        {selectedHost ? (
          itemsLoading ? (
            <Box sx={{ p: 2 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <Skeleton key={i} variant="text" height={48} sx={{ mb: 0.5 }} />
              ))}
            </Box>
          ) : (
            <>
              <Box sx={{ p: 2, pb: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search items…"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ShowChartOutlinedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Divider />
              {filteredItems.length === 0 ? (
                <Box sx={{ py: 6, textAlign: "center" }}>
                  <Typography color="text.secondary" variant="body2">
                    {itemSearch ? "No items match your search" : "No numeric items on this host"}
                  </Typography>
                </Box>
              ) : (
                <List dense sx={{ maxHeight: 360, overflowY: "auto" }}>
                  {filteredItems.map((item) => {
                    const added = existingIds.includes(item.itemid);
                    return (
                      <ListItem key={item.itemid} sx={{ opacity: added ? 0.45 : 1 }}>
                        <ListItemText
                          primary={item.name}
                          secondary={item.key_}
                          primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 500 }}
                          secondaryTypographyProps={{
                            fontSize: "0.72rem",
                            fontFamily: "monospace",
                          }}
                        />
                        <ListItemSecondaryAction>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={added}
                            onClick={() => {
                              onAdd(selectedHost, item);
                              onClose();
                            }}
                            sx={{ fontSize: "0.72rem", minWidth: 60 }}
                          >
                            {added ? "Added" : "Add"}
                          </Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </>
          )
        ) : (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography color="text.secondary" variant="body2">
              Select a host to see its items
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

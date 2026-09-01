"use client";

import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlinedIcon from "@mui/icons-material/ArrowUpwardOutlined";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { type MyTeam, teamsApi } from "../../app/api/teams";

type GroupOrderDialogProps = {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string, sev: "success" | "error") => void;
};

export const GroupOrderDialog = ({ open, onClose, showToast }: GroupOrderDialogProps) => {
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    teamsApi
      .getMyTeams()
      .then((r) => setTeams(r.teams))
      .catch((e) => showToast(e instanceof Error ? e.message : String(e), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const persistOrder = async (next: MyTeam[]) => {
    setSaving(true);
    try {
      await Promise.all(
        next.map((t, i) =>
          i === t.display_order ? Promise.resolve() : teamsApi.setTeamDisplayOrder(t.id, i),
        ),
      );
      setTeams(next.map((t, i) => ({ ...t, display_order: i })));
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= teams.length || saving) {
      return;
    }
    const next = [...teams];
    [next[index], next[target]] = [next[target], next[index]];
    void persistOrder(next);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Group Order</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Controls the order your teams' host groups appear in the "Filter by group" pickers
          (Problems, Hosts). Only matters if you belong to more than one team.
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : teams.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            You're not a member of any team.
          </Typography>
        ) : (
          <List sx={{ border: "1px solid", borderColor: "divider" }} disablePadding>
            {teams.map((t, i) => (
              <ListItem
                key={t.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  "&:not(:last-child)": { borderBottom: "1px solid", borderColor: "divider" },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t.name}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.25 }}>
                  <IconButton
                    size="small"
                    aria-label={`Move ${t.name} up`}
                    disabled={i === 0 || saving}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUpwardOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Move ${t.name} down`}
                    disabled={i === teams.length - 1 || saving}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDownwardOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

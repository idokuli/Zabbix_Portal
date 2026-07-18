"use client";
import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { Host, HostTag } from "../../app/api";
import { generateId } from "../../app/utils";

type EditTag = { _key: string; tag: string; value: string };

export const TagEditorDialog = ({
  tagHost,
  onClose,
  onSave,
}: {
  tagHost: Host | null;
  onClose: () => void;
  onSave: (tags: HostTag[]) => Promise<void>;
}) => {
  const [editTags, setEditTags] = useState<EditTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagValue, setNewTagValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset internal state whenever a new host is opened
  useEffect(() => {
    if (tagHost) {
      setEditTags(
        (tagHost.tags ?? [])
          .filter((t) => t.tag !== "team")
          .map((t) => ({ _key: generateId(), ...t })),
      );
      setNewTagName("");
      setNewTagValue("");
    }
  }, [tagHost]);

  const addTag = () => {
    if (!newTagName.trim()) {
      return;
    }
    setEditTags((prev) => [
      ...prev,
      { _key: generateId(), tag: newTagName.trim(), value: newTagValue.trim() },
    ]);
    setNewTagName("");
    setNewTagValue("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const pending = newTagName.trim()
        ? [{ _key: "", tag: newTagName.trim(), value: newTagValue.trim() }]
        : [];
      const valid = [...editTags, ...pending]
        .filter((t) => t.tag.trim() !== "")
        .map(({ tag, value }) => ({ tag, value }));
      await onSave(valid);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!tagHost} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Edit tags —{" "}
        <Typography component="span" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
          {tagHost?.host}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {/* Chip area */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0.75,
              minHeight: 36,
              p: 1.5,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "action.hover",
            }}
          >
            {tagHost?.tags?.find((t) => t.tag === "team") && (
              <Chip
                size="small"
                label={`team: ${tagHost.tags.find((t) => t.tag === "team")?.value ?? ""}`}
                sx={{
                  fontSize: "0.72rem",
                  bgcolor: "action.selected",
                  color: "text.secondary",
                  cursor: "default",
                }}
              />
            )}
            {editTags.map((t, i) => (
              <Chip
                key={t._key}
                size="small"
                label={t.value ? `${t.tag}: ${t.value}` : t.tag}
                onDelete={() => setEditTags((prev) => prev.filter((_, j) => j !== i))}
                sx={{
                  fontSize: "0.72rem",
                  bgcolor: "action.selected",
                  color: "primary.main",
                  "& .MuiChip-deleteIcon": {
                    color: "primary.main",
                    opacity: 0.7,
                    "&:hover": { opacity: 1 },
                  },
                }}
              />
            ))}
            {editTags.length === 0 && !tagHost?.tags?.some((t) => t.tag === "team") && (
              <Typography variant="caption" color="text.disabled" sx={{ alignSelf: "center" }}>
                No tags yet
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Add new tag row */}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addTag();
                }
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Value"
              value={newTagValue}
              onChange={(e) => setNewTagValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addTag();
                }
              }}
              sx={{ flex: 1 }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={!newTagName.trim()}
              onClick={addTag}
              sx={{ flexShrink: 0 }}
            >
              Add
            </Button>
          </Stack>
          <Typography variant="caption" color="text.disabled">
            Press Enter or click Add — then Save tags to apply.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save tags"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

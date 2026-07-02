"use client";
import { Chip } from "@mui/material";

export { ConfirmDelete } from "../../app/components/ConfirmDelete";

export const StatusChip = ({ status }: { status: number }) => (
  <Chip
    label={status === 0 ? "Enabled" : "Disabled"}
    size="small"
    color={status === 0 ? "success" : "default"}
    variant="outlined"
    sx={{ height: 18, fontSize: "0.62rem" }}
  />
);

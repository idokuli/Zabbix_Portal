"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export const ConfirmDelete = ({
  open,
  name,
  description,
  onConfirm,
  onClose,
}: {
  open: boolean;
  name: string;
  description?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{t("confirmDelete.title", { name })}</DialogTitle>
      <DialogContent>
        <Typography>
          {description ?? (
            <>
              {t("confirmDelete.description")} <strong>{name}</strong>
            </>
          )}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("confirmDelete.cancel")}</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          {t("confirmDelete.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

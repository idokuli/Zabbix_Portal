"use client";
import { Button } from "@mui/material";
import Link from "next/link";

export const ActionButton = ({
  icon,
  label,
  href,
  external,
  variant = "outlined",
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  external?: boolean;
  variant?: "contained" | "outlined";
}) => (
  <Button
    component={external ? "a" : Link}
    href={href}
    variant={variant}
    size="small"
    startIcon={icon}
    sx={{ fontSize: "0.78rem", justifyContent: "flex-start", px: 1.5, py: 0.75 }}
    fullWidth
  >
    {label}
  </Button>
);

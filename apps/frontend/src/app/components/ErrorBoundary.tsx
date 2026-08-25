"use client";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { ErrorInfo, PropsWithChildren } from "react";
import { Component } from "react";

type State = { error: Error | null; componentStack: string | null; copied: boolean };

// Shows the full stack trace inline (not just behind DevTools) — this portal is
// internal-only, and being able to read/copy the trace straight off the error page
// (rather than asking whoever hit it to dig through browser console filters) has
// repeatedly been the fastest way to diagnose a crash reported from the field.
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null, componentStack: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  copyDetails = () => {
    const { error, componentStack } = this.state;
    if (!error) {
      return;
    }
    const text = [
      error.message,
      error.stack ?? "",
      componentStack ? `Component stack:${componentStack}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard
      .writeText(text)
      .then(() => this.setState({ copied: true }))
      .catch(() => {});
  };

  render() {
    const { error, componentStack, copied } = this.state;
    if (error) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: 2,
            p: 4,
          }}
        >
          <Typography variant="h5">Something went wrong</Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 480, textAlign: "center" }}
          >
            {error.message}
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button variant="outlined" onClick={this.copyDetails}>
              {copied ? "Copied!" : "Copy details"}
            </Button>
          </Stack>
          {(error.stack || componentStack) && (
            <Box
              component="pre"
              sx={{
                mt: 1,
                p: 2,
                maxWidth: 760,
                maxHeight: 320,
                overflow: "auto",
                fontSize: "0.72rem",
                lineHeight: 1.5,
                bgcolor: "action.hover",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                userSelect: "text",
              }}
            >
              {error.stack}
              {componentStack ? `\n\nComponent stack:${componentStack}` : ""}
            </Box>
          )}
        </Box>
      );
    }
    return this.props.children;
  }
}

// Client component: it passes `component={Link}` to MUI's Button, and React 19 refuses
// to serialise a function prop across the server→client boundary. Matches the rest of
// the app, where every page component is a client component.
"use client";
import { Box, Button, Typography } from "@mui/material";
import Link from "next/link";

const NotFound = () => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      gap: 2,
    }}
  >
    <Typography variant="h1" component="h1">
      404
    </Typography>
    <Typography variant="h5">Page not found</Typography>
    <Button component={Link} href="/" variant="contained">
      Go home
    </Button>
  </Box>
);

export default NotFound;

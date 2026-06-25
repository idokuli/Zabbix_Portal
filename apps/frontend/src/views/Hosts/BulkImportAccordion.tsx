"use client";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

export const BulkImportAccordion = ({
  uploadFile,
  uploading,
  dragActive,
  setDragActive,
  pickUploadFile,
  onBulkUpload,
}: {
  uploadFile: File | null;
  uploading: boolean;
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  pickUploadFile: (file: File | null) => void;
  onBulkUpload: () => void;
}) => (
  <Accordion
    disableGutters
    elevation={0}
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: "12px !important",
      "&:before": { display: "none" },
    }}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 52 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CloudUploadOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Bulk import
        </Typography>
        <Typography variant="caption" color="text.disabled">
          — upload .csv or .xlsx
        </Typography>
      </Box>
    </AccordionSummary>
    <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Upload a file with columns: <code>hostname</code> (or <code>host</code>), <code>ip</code>{" "}
          (or <code>ip_address</code>), optional <code>template</code>.
        </Typography>
        <Box
          component="label"
          htmlFor="bulk-upload-input"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            pickUploadFile(e.dataTransfer.files?.[0] ?? null);
          }}
          sx={{
            border: "2px dashed",
            borderColor: dragActive ? "primary.main" : "divider",
            borderRadius: 2,
            p: 3,
            textAlign: "center",
            bgcolor: dragActive ? "rgba(59,130,246,0.06)" : "action.hover",
            transition: "all 0.2s",
            cursor: "pointer",
          }}
        >
          <CloudUploadOutlinedIcon sx={{ fontSize: 28, color: "text.disabled", mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            {uploadFile ? uploadFile.name : "Drag & drop or click to choose a file"}
          </Typography>
          <input
            id="bulk-upload-input"
            hidden
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => pickUploadFile(e.target.files?.[0] ?? null)}
          />
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="outlined" size="small" component="label" htmlFor="bulk-upload-input">
            Choose file
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={onBulkUpload}
            disabled={!uploadFile || uploading}
            startIcon={<CloudUploadOutlinedIcon />}
          >
            {uploading ? "Importing…" : "Import hosts"}
          </Button>
        </Stack>
      </Stack>
    </AccordionDetails>
  </Accordion>
);

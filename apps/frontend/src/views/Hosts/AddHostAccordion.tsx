"use client";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { SearchableSelect } from "../../components/SearchableSelect";

export const AddHostAccordion = ({
  hostname,
  setHostname,
  ip,
  setIp,
  template,
  setTemplate,
  templates,
  proxyid,
  setProxyid,
  proxies,
  groupIds,
  setGroupIds,
  hostGroups,
  applyTeamTag,
  setApplyTeamTag,
  onCreate,
}: {
  hostname: string;
  setHostname: (v: string) => void;
  ip: string;
  setIp: (v: string) => void;
  template: string;
  setTemplate: (v: string) => void;
  templates: Array<{ templateid: string; name: string }>;
  proxyid: string;
  setProxyid: (v: string) => void;
  proxies: Array<{ proxyid: string; name: string }>;
  groupIds: string[];
  setGroupIds: (v: string[]) => void;
  hostGroups: Array<{ groupid: string; name: string }>;
  applyTeamTag: boolean;
  setApplyTeamTag: (v: boolean) => void;
  onCreate: () => void;
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
        <AddIcon sx={{ fontSize: 18, color: "primary.main" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Add host
        </Typography>
        <Typography variant="caption" color="text.disabled">
          — create a single host in Zabbix
        </Typography>
      </Box>
    </AccordionSummary>
    <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
      <Divider sx={{ mb: 2 }} />
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            size="small"
            label="Hostname"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            label="IP address"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            fullWidth
          />
        </Stack>
        <Autocomplete
          freeSolo
          size="small"
          options={templates.map((t) => t.name)}
          value={template}
          onChange={(_, v) => {
            if (v !== null) {
              setTemplate(v);
            }
          }}
          onInputChange={(_, v, reason) => {
            if (reason === "input" || reason === "clear") {
              setTemplate(v);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Template"
              placeholder="Linux by Zabbix agent"
              helperText={
                templates.length === 0
                  ? "Type a template name"
                  : `${templates.length} templates available`
              }
            />
          )}
          fullWidth
        />
        {proxies.length > 0 && (
          <FormControl size="small" fullWidth>
            <InputLabel>Proxy (optional)</InputLabel>
            <SearchableSelect
              value={proxyid}
              label="Proxy (optional)"
              onChange={(e) => setProxyid(e.target.value)}
            >
              <MenuItem value="">No proxy — direct monitoring</MenuItem>
              {proxies.map((p) => (
                <MenuItem key={p.proxyid} value={p.proxyid}>
                  {p.name}
                </MenuItem>
              ))}
            </SearchableSelect>
          </FormControl>
        )}
        {hostGroups.length > 0 && (
          <FormControl size="small" fullWidth>
            <InputLabel>Host groups (optional)</InputLabel>
            <Select
              multiple
              label="Host groups (optional)"
              value={groupIds}
              onChange={(e) => setGroupIds(e.target.value as string[])}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as string[]).map((id) => {
                    const g = hostGroups.find((g) => g.groupid === id);
                    return <Chip key={id} label={g?.name ?? id} size="small" sx={{ height: 20 }} />;
                  })}
                </Box>
              )}
            >
              {hostGroups.map((g) => (
                <MenuItem key={g.groupid} value={g.groupid}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControlLabel
          control={
            <Switch checked={applyTeamTag} onChange={(_, v) => setApplyTeamTag(v)} size="small" />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Tag with my team
            </Typography>
          }
        />
        <Box>
          <Button
            variant="contained"
            size="small"
            onClick={onCreate}
            disabled={!(hostname && ip)}
            startIcon={<AddIcon />}
          >
            Create host
          </Button>
        </Box>
      </Stack>
    </AccordionDetails>
  </Accordion>
);

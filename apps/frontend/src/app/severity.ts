// Canonical Zabbix severity scale — colors match the Zabbix frontend defaults
// so operators see the same semantics here as in Zabbix itself.
// Index = Zabbix severity value (0–5).

export type SeverityToken = {
  value: number;
  label: string;
  color: string;
  bg: string;
};

export const SEVERITIES: SeverityToken[] = [
  { value: 0, label: "Not classified", color: "#97AAB3", bg: "rgba(151,170,179,0.14)" },
  { value: 1, label: "Information", color: "#7499FF", bg: "rgba(116,153,255,0.14)" },
  { value: 2, label: "Warning", color: "#DBA243", bg: "rgba(219,162,67,0.14)" },
  { value: 3, label: "Average", color: "#F58E45", bg: "rgba(245,142,69,0.14)" },
  { value: 4, label: "High", color: "#E9695C", bg: "rgba(233,105,92,0.14)" },
  { value: 5, label: "Disaster", color: "#E45959", bg: "rgba(228,89,89,0.14)" },
];

export const severityOf = (value: number): SeverityToken =>
  SEVERITIES[Math.min(Math.max(value, 0), 5)] ?? SEVERITIES[0];

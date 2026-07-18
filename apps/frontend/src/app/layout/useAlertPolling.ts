import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { isCustomId, playSoundById } from "../../lib/soundLibrary";
import { type AlertEvent, type Problem, type StoredNotif, api } from "../api";
import { playAlertSound } from "./alertSounds";

const updateSeenProblemIds = (
  problems: Problem[],
  seenIds: Set<string>,
  polledSince: MutableRefObject<number>,
  firstPoll: MutableRefObject<boolean>,
): Problem[] => {
  const currentIds = new Set(problems.map((p) => p.eventid));

  if (firstPoll.current) {
    polledSince.current = Math.floor(Date.now() / 1000);
    for (const id of currentIds) {
      seenIds.add(id);
    }
    firstPoll.current = false;
    return [];
  }

  for (const id of seenIds) {
    if (!currentIds.has(id)) {
      seenIds.delete(id);
    }
  }

  const unseenProblems = problems.filter((p) => !seenIds.has(p.eventid));
  for (const p of unseenProblems) {
    seenIds.add(p.eventid);
  }

  return unseenProblems.filter((p) => !p.acknowledged && p.clock > polledSince.current);
};

const toProblemHistoryEntries = (newProblems: Problem[]): StoredNotif[] =>
  newProblems.map((p) => ({
    id: p.eventid,
    source: "zabbix" as const,
    hostname: p.hostname,
    severity: p.severity,
    name: p.name,
    clock: p.clock,
    acknowledged: p.acknowledged,
  }));

const playProblemSound = (
  newProblems: Problem[],
  soundRef: MutableRefObject<boolean>,
  soundPresetRef: MutableRefObject<string>,
) => {
  if (!soundRef.current) {
    return;
  }
  const maxSev = Math.max(...newProblems.map((p) => p.severity));
  const preset = soundPresetRef.current;
  if (isCustomId(preset)) {
    void playSoundById(preset);
  } else {
    playAlertSound(maxSev, preset);
  }
};

const notifyNewProblems = (
  newProblems: Problem[],
  showDesktopNotification: (title: string, body: string) => void,
) => {
  const top = newProblems.reduce((best, p) => (p.severity > best.severity ? p : best));
  showDesktopNotification(
    newProblems.length > 1 ? `${newProblems.length} new problems` : top.name,
    newProblems.length > 1
      ? `Highest: ${top.name} (${top.hostname})`
      : `${top.hostname} · ${top.severity_name}`,
  );
};

const eventsToProblems = (newEvents: AlertEvent[]): Problem[] =>
  newEvents.map((e) => ({
    eventid: `rule-${e.id}`,
    hostname: e.hostname,
    groups: [],
    severity: e.severity,
    severity_name: "",
    name: `${e.item_name} ${e.operator} ${e.threshold} (actual: ${e.actual_value})`,
    clock: e.fired_at,
    age_seconds: Math.floor(Date.now() / 1000) - e.fired_at,
    acknowledged: false,
  }));

const eventsToHistoryEntries = (newEvents: AlertEvent[]): StoredNotif[] =>
  newEvents.map((e) => ({
    id: `rule-${e.id}`,
    source: "rule" as const,
    hostname: e.hostname,
    severity: e.severity,
    name: `${e.item_name} ${e.operator} ${e.threshold} (actual: ${e.actual_value})`,
    clock: e.fired_at,
    acknowledged: false,
  }));

const readRuleSoundsMap = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem("alertRuleSounds") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

const topSeverityEvent = (events: AlertEvent[]): AlertEvent =>
  events.reduce((best, e) => (e.severity > best.severity ? e : best), events[0] as AlertEvent);

const playEventSound = (
  newEvents: AlertEvent[],
  soundRef: MutableRefObject<boolean>,
  soundPresetRef: MutableRefObject<string>,
) => {
  if (!soundRef.current) {
    return;
  }
  const ruleSoundsMap = readRuleSoundsMap();
  const topEvent = topSeverityEvent(newEvents);
  const ruleSound = ruleSoundsMap[topEvent.rule_id] ?? "default";
  if (ruleSound === "none") {
    return;
  }
  const preset = ruleSound === "default" ? soundPresetRef.current : ruleSound;
  if (isCustomId(preset)) {
    void playSoundById(preset);
  } else {
    playAlertSound(topEvent.severity, preset);
  }
};

const notifyNewEvents = (
  newEvents: AlertEvent[],
  showDesktopNotification: (title: string, body: string) => void,
) => {
  const top = topSeverityEvent(newEvents);
  showDesktopNotification(
    newEvents.length > 1
      ? `${newEvents.length} new alerts`
      : `${top.item_name} ${top.operator} ${top.threshold}`,
    `${top.hostname} · actual: ${top.actual_value}`,
  );
};

export const useAlertPolling = ({
  saveToHistory,
  showDesktopNotification,
  soundRef,
  soundPresetRef,
}: {
  saveToHistory: (entries: StoredNotif[]) => void;
  showDesktopNotification: (title: string, body: string) => void;
  soundRef: MutableRefObject<boolean>;
  soundPresetRef: MutableRefObject<string>;
}) => {
  const [health, setHealth] = useState<{ ok: boolean; zabbix: boolean } | null>(null);
  const [activeProblems, setActiveProblems] = useState<Problem[]>([]);
  const [notifications, setNotifications] = useState<Problem[]>([]);

  const seenIds = useRef<Set<string>>(new Set());
  const seenEventIds = useRef<Set<number>>(new Set());
  const firstPoll = useRef(true);
  const firstEventPoll = useRef(true);
  const polledSince = useRef(0);

  const dismissNotif = useCallback((eventid: string) => {
    setNotifications((prev) => prev.filter((p) => p.eventid !== eventid));
  }, []);

  // Health poll
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const h = await api.health();
        if (!cancelled) {
          setHealth({ ok: h.status === "online", zabbix: !!h.zabbix_connected });
        }
      } catch {
        if (!cancelled) {
          setHealth({ ok: false, zabbix: false });
        }
      }
    };
    void load();
    const t = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  // Problem poll
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.getProblems();
        if (cancelled) {
          return;
        }
        const problems = res.problems;
        setActiveProblems(problems);

        const newProblems = updateSeenProblemIds(problems, seenIds.current, polledSince, firstPoll);

        if (newProblems.length > 0) {
          setNotifications((prev) => [...newProblems, ...prev].slice(0, 8));
          saveToHistory(toProblemHistoryEntries(newProblems));
          playProblemSound(newProblems, soundRef, soundPresetRef);
          notifyNewProblems(newProblems, showDesktopNotification);
        }
      } catch {
        // silently fail
      }
    };

    const delay = window.setTimeout(() => {
      void poll();
    }, 5_000);
    const t = window.setInterval(poll, 10_000);
    window.addEventListener("problemAcknowledged", poll);
    return () => {
      cancelled = true;
      window.clearTimeout(delay);
      window.clearInterval(t);
      window.removeEventListener("problemAcknowledged", poll);
    };
  }, [saveToHistory, showDesktopNotification, soundRef, soundPresetRef]);

  // Custom alert events poll
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.getAlertEvents();
        if (cancelled) {
          return;
        }

        if (firstEventPoll.current) {
          seenEventIds.current = new Set(res.events.map((e) => e.id));
          firstEventPoll.current = false;
          return;
        }

        const newEvents = res.events.filter((e) => !seenEventIds.current.has(e.id));
        seenEventIds.current = new Set(res.events.map((e) => e.id));

        if (newEvents.length > 0) {
          setNotifications((prev) => [...eventsToProblems(newEvents), ...prev].slice(0, 8));
          saveToHistory(eventsToHistoryEntries(newEvents));
          playEventSound(newEvents, soundRef, soundPresetRef);
          notifyNewEvents(newEvents, showDesktopNotification);
        }
      } catch {
        // silently fail
      }
    };
    const delay = window.setTimeout(() => {
      void poll();
    }, 10_000);
    const t = window.setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      window.clearTimeout(delay);
      window.clearInterval(t);
    };
  }, [saveToHistory, showDesktopNotification, soundRef, soundPresetRef]);

  // Auto-dismiss low-severity notifications after 8 s
  useEffect(() => {
    if (notifications.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((p) => p.severity >= 3));
    }, 8_000);
    return () => clearTimeout(timer);
  }, [notifications]);

  return {
    health,
    activeProblems,
    setActiveProblems,
    notifications,
    setNotifications,
    dismissNotif,
  };
};

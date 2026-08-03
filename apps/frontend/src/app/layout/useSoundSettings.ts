import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  addSound,
  type CustomSound,
  deleteSound,
  isCustomId,
  listSounds,
  playSoundById,
} from "../../lib/soundLibrary";
import { DEFAULT_SOUND_PRESET, playAlertSound, SOUND_PRESETS } from "./alertSounds";

const FILE_EXTENSION_RE = /\.[^.]+$/;

export const useSoundSettings = () => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return localStorage.getItem("alertSound") !== "false";
  });
  const [desktopNotifEnabled, setDesktopNotifEnabled] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    return localStorage.getItem("desktopNotif") === "true" && Notification.permission === "granted";
  });
  // Users reported alerts vanishing before they could read/act on them (Chrome/Windows
  // auto-dismiss desktop notifications after a few seconds by default). requireInteraction
  // keeps the OS toast pinned until someone manually dismisses it. Defaults on since that's
  // the actual fix being requested; still toggleable off for anyone who prefers the old
  // auto-dismiss behavior.
  const [desktopNotifPersistentEnabled, setDesktopNotifPersistentEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return localStorage.getItem("desktopNotifPersistent") !== "false";
  });
  const [soundPreset, setSoundPreset] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SOUND_PRESET;
    }
    return localStorage.getItem("alertSoundPreset") ?? DEFAULT_SOUND_PRESET;
  });
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [soundMenuAnchor, setSoundMenuAnchor] = useState<null | HTMLElement>(null);
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);

  const customFileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);

  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  const soundPresetRef = useRef(soundPreset);
  soundPresetRef.current = soundPreset;
  const desktopNotifRef = useRef(desktopNotifEnabled);
  desktopNotifRef.current = desktopNotifEnabled;
  const desktopNotifPersistentRef = useRef(desktopNotifPersistentEnabled);
  desktopNotifPersistentRef.current = desktopNotifPersistentEnabled;

  const showDesktopNotification = useCallback((title: string, body: string) => {
    if (!desktopNotifRef.current) {
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }
    try {
      const n = new Notification(title, {
        body,
        icon: "/favicon.svg",
        tag: title,
        requireInteraction: desktopNotifPersistentRef.current,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // ignore
    }
  }, []);

  const toggleDesktopNotif = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (desktopNotifEnabled) {
      setDesktopNotifEnabled(false);
      localStorage.setItem("desktopNotif", "false");
      return;
    }
    if (Notification.permission === "granted") {
      setDesktopNotifEnabled(true);
      localStorage.setItem("desktopNotif", "true");
      return;
    }
    if (Notification.permission === "denied") {
      return;
    }
    void Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        setDesktopNotifEnabled(true);
        localStorage.setItem("desktopNotif", "true");
      }
    });
  }, [desktopNotifEnabled]);

  const toggleDesktopNotifPersistent = useCallback(() => {
    setDesktopNotifPersistentEnabled((v) => {
      localStorage.setItem("desktopNotifPersistent", String(!v));
      return !v;
    });
  }, []);

  const reloadCustomSounds = useCallback(() => {
    listSounds()
      .then(setCustomSounds)
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadCustomSounds();
  }, [reloadCustomSounds]);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    if (previewCtxRef.current) {
      void previewCtxRef.current.close();
      previewCtxRef.current = null;
    }
    setPreviewingKey(null);
  };

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (previewCtxRef.current) {
        void previewCtxRef.current.close();
        previewCtxRef.current = null;
      }
    };
  }, []);

  const handlePreview = (key: string) => {
    if (previewingKey === key) {
      stopPreview();
      return;
    }
    stopPreview();
    setPreviewingKey(key);
    if (isCustomId(key)) {
      playSoundById(key)
        .then((audio) => {
          if (!audio) {
            setPreviewingKey(null);
            return;
          }
          previewAudioRef.current = audio;
          audio.onended = () => {
            previewAudioRef.current = null;
            setPreviewingKey(null);
          };
        })
        .catch(() => setPreviewingKey(null));
    } else {
      try {
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) {
          setPreviewingKey(null);
          return;
        }
        const ctx = new AudioCtx();
        previewCtxRef.current = ctx;
        (SOUND_PRESETS[key] ?? SOUND_PRESETS[DEFAULT_SOUND_PRESET]).play(ctx, 3);
        setTimeout(() => {
          if (previewCtxRef.current === ctx) {
            void ctx.close();
            previewCtxRef.current = null;
            setPreviewingKey(null);
          }
        }, 2000);
      } catch {
        setPreviewingKey(null);
      }
    }
  };

  const selectSoundPreset = (key: string) => {
    localStorage.setItem("alertSoundPreset", key);
    setSoundPreset(key);
    setSoundMenuAnchor(null);
    window.dispatchEvent(new Event("alertSoundPresetChanged"));
    if (isCustomId(key)) {
      void playSoundById(key);
    } else {
      playAlertSound(3, key);
    }
  };

  const handleDeleteCustomSound = (id: string) => {
    deleteSound(id)
      .then(() => {
        if (soundPreset === id) {
          localStorage.setItem("alertSoundPreset", DEFAULT_SOUND_PRESET);
          setSoundPreset(DEFAULT_SOUND_PRESET);
          window.dispatchEvent(new Event("alertSoundPresetChanged"));
        }
        reloadCustomSounds();
      })
      .catch(() => {});
  };

  const handleCustomFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const name = file.name.replace(FILE_EXTENSION_RE, "");
    addSound(name, file)
      .then((id) => {
        reloadCustomSounds();
        selectSoundPreset(id);
      })
      .catch(() => {});
    e.target.value = "";
  };

  const toggleSound = () => {
    setSoundEnabled((v) => {
      localStorage.setItem("alertSound", String(!v));
      return !v;
    });
  };

  return {
    soundEnabled,
    soundPreset,
    desktopNotifEnabled,
    desktopNotifPersistentEnabled,
    customSounds,
    soundMenuAnchor,
    setSoundMenuAnchor,
    customFileInputRef,
    previewingKey,
    showDesktopNotification,
    toggleDesktopNotif,
    toggleDesktopNotifPersistent,
    toggleSound,
    selectSoundPreset,
    handlePreview,
    handleDeleteCustomSound,
    handleCustomFileChange,
    soundRef,
    soundPresetRef,
  };
};

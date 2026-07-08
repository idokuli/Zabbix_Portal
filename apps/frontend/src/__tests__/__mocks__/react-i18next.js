const useMock = [(k) => k, {}];
useMock.t = (k) => k;
useMock.i18n = { changeLanguage: () => Promise.resolve() };

module.exports = {
  useTranslation: () => ({
    t: (k, opts) => (opts?.name ? `${k}:${opts.name}` : k),
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }) => children,
  initReactI18next: { type: "3rdParty", init: () => {} },
};

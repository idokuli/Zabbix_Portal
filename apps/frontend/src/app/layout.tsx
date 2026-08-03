import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { Metadata } from "next";
import { Providers } from "./providers";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overwatch",
  icons: { icon: "/Overwatch_sign.png" },
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body>
      <AppRouterCacheProvider>
        <Providers>{children}</Providers>
      </AppRouterCacheProvider>
    </body>
  </html>
);

export default RootLayout;

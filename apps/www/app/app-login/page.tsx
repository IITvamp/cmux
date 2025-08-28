import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login Redirect • cmux",
  robots: {
    index: false,
    follow: false,
  },
};

import AppLoginClient from "./AppLoginClient";

export default function Page() {
  return <AppLoginClient />;
}

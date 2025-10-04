import { isElectron } from "@/lib/electron";
import { Providers } from "./providers";
import { RouterProviderWithAuth } from "./router";
import { useEffect } from "react";

export function App() {
  useEffect(() => {
    if (isElectron) {
      document.body.classList.add("electron");
    }
  }, []);

  return (
    <Providers>
      <RouterProviderWithAuth />
    </Providers>
  );
}

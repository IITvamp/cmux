import { Providers } from "./providers";
import { RouterProviderWithAuth } from "./router";

import "./antd-overrides.css";
import "./index.css";

export function App() {
  return (
    <Providers>
      <RouterProviderWithAuth />
    </Providers>
  );
}

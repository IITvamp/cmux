import { env } from "@/lib/utils/www-env";
import { MorphCloudClient } from "morphcloud";

export const __TEST_INTERNAL_ONLY_MORPH_CLIENT = new MorphCloudClient({
  apiKey: env.MORPH_API_KEY,
});


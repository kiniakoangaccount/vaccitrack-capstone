import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      // Registration submits an ID photo (up to 5MB, see MAX_ID_IMAGE_BYTES in
      // register-account.ts) directly through a server action's FormData.
      // Next's default 1MB body limit silently rejects any real phone photo.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;

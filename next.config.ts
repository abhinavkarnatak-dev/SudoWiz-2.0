import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // There is a stray lockfile further up the Projects tree, so pin the root
    // here rather than letting Turbopack infer the wrong one.
    root: import.meta.dirname,
  },
  // Dev only. Next blocks cross-origin requests to /_next dev assets, so a
  // phone hitting the LAN address gets server HTML that never hydrates: the
  // page looks right but nothing responds to taps. Allow the local subnet.
  allowedDevOrigins: ["192.168.29.84", "192.168.29.84:3000", "192.168.*.*"],
};

export default nextConfig;

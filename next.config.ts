import type { NextConfig } from "next";
import { withQRCode } from "next-plugin-qrcode";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withQRCode(nextConfig);

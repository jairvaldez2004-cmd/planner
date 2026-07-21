/** @type {import('next').NextConfig} */
const nextConfig = {
  // Alpha local. NO cloud/proveedor/deploy. Sin telemetría.
  experimental: {
    serverActions: {
      // Las server actions aceptan 1 MB por defecto: las subidas de renders (5 MB) y
      // modelos 3D escaneados (hasta 25 MB, ~33 MB en base64) fallarían por HTTP.
      bodySizeLimit: '40mb',
    },
  },
};

module.exports = nextConfig;

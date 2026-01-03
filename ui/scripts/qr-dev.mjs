#!/usr/bin/env node
import os from "os";
import { execSync } from "child_process";

function getLANIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === "IPv4" && !config.internal) {
        return config.address;
      }
    }
  }
  return "localhost";
}

const ip = getLANIP();
const port = 3000;
const url = `http://${ip}:${port}`;

console.log(`\n🚀  Local dev server URL:\n   ${url}\n`);
console.log("📱  Scan this QR on your phone to open:\n");

execSync(`qrip "${url}"`, { stdio: "inherit" });

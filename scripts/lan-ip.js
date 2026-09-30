#!/usr/bin/env node
/**
 * Prints the address(es) your phone should use to reach the backend that
 * docker-compose publishes on port 8000.
 *
 *   node scripts/lan-ip.js            (or: cd mobile && npm run lan-ip)
 *
 * Works on Windows, macOS and Linux (Node is already required for Expo).
 */
const os = require('os');

const PORT = 8000;
const found = [];

for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
  for (const a of addrs || []) {
    if (a.family !== 'IPv4' || a.internal) continue;
    // Skip link-local (169.254.x.x) and typical virtual adapters (Docker/WSL/VPN/VM).
    if (a.address.startsWith('169.254.')) continue;
    const virtual = /docker|veth|br-|vEthernet|wsl|vmnet|vbox|virtualbox|tailscale|zt|utun|tun|tap/i.test(name);
    found.push({ name, ip: a.address, virtual });
  }
}

if (found.length === 0) {
  console.log('No LAN IPv4 address found. Are you connected to Wi-Fi / Ethernet?');
  process.exit(1);
}

found.sort((a, b) => Number(a.virtual) - Number(b.virtual));
console.log('Use one of these in AttendX > Settings > API Base URL:\n');
for (const f of found) {
  const tag = f.virtual ? '  (virtual adapter - probably NOT what your phone can reach)' : '';
  console.log(`  http://${f.ip}:${PORT}   [${f.name}]${tag}`);
}
console.log('\nTip: open that URL + "/health" in your phone\'s browser first. You should see {"status":"ok"}.');

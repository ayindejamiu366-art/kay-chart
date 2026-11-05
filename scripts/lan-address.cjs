/**
 * Prints the address a phone on the same Wi-Fi should use to reach this machine.
 *
 * The Android app is served from its own origin and cannot use the relative
 * "/api", so it needs an absolute address. This prints the one to type into the
 * app's "Connect to your server" screen, along with the fully-formed API base.
 */
const os = require('os');

const PORT = process.env.PORT || 3001;

function lanAddresses() {
  const out = [];
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      const family = addr.family === 'IPv4' || addr.family === 4;
      if (!family || addr.internal) continue;
      if (!/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr.address)) continue;
      out.push({ name, address: addr.address });
    }
  }
  return out;
}

const addresses = lanAddresses();

console.log('\nNocturne server addresses for a device on this network:\n');
if (!addresses.length) {
  console.log('  No private network interface found.');
  console.log('  Connect to Wi-Fi, or use your public https API URL instead.\n');
} else {
  for (const { name, address } of addresses) {
    console.log(`  ${name}`);
    console.log(`    server address : ${address}:${PORT}`);
    console.log(`    API base       : http://${address}:${PORT}/api`);
  }
  console.log('\n  Enter the "server address" line in the app. It adds /api for you.\n');
  console.log('  If the device cannot connect, allow Node.js through Windows Firewall');
  console.log('  on private networks.\n');
}

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeHttpRange, resolveDailyBuild } from './lib/daily-source.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key ?? '<end>'}`);
    args[key.slice(2)] = value;
  }
  return args;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const days = args.days === undefined ? 7 : Number(args.days);
    const now = args.now ? new Date(args.now) : new Date();
    const result = await resolveDailyBuild({ now, days, probe: probeHttpRange });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(`Daily build resolution failed: ${error.message}`);
    process.exitCode = 1;
  }
}

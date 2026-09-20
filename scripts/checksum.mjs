import { basename } from 'node:path';
import { sha256File } from './lib/sha256.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/checksum.mjs <file> [file...]');
  process.exitCode = 1;
} else {
  for (const file of files) {
    try {
      const digest = await sha256File(file);
      console.log(`${digest}  ${basename(file)}`);
    } catch (error) {
      console.error(`Checksum failed for ${file}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
}

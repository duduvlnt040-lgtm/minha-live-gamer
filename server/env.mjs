import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const ENV_PATH = join(ROOT_DIR, '.env');

export function loadEnvFile() {
  if (!existsSync(ENV_PATH)) return false;

  try {
    const content = readFileSync(ENV_PATH, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;

      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();

      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
    return true;
  } catch (err) {
    console.warn('[ENV] Falha ao ler .env:', err.message);
    return false;
  }
}

loadEnvFile();

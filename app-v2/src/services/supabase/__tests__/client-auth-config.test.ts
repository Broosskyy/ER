import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('supabase client auth config', () => {
  it('enables detectSessionInUrl only on web runtimes', () => {
    const source = readFileSync(join(process.cwd(), 'src/services/supabase/client.ts'), 'utf8');
    expect(source).toContain('detectSessionInUrl: isWebRuntime()');
  });
});

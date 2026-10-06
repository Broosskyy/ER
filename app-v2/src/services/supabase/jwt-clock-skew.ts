export interface JwtPayloadClaims {
  iat?: number;
  exp?: number;
  role?: string;
  iss?: string;
}

export function decodeJwtPayloadUnsafe(token: string): JwtPayloadClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const payloadPart = parts[1];
    if (!payloadPart) {
      return null;
    }
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as JwtPayloadClaims;
  } catch {
    return null;
  }
}

export interface ClockSkewReport {
  localUtcIso: string;
  serverUtcIso?: string;
  skewMs?: number;
  skewDirection?: 'local_ahead' | 'local_behind' | 'in_sync';
  jwtIatIso?: string;
  jwtExpIso?: string;
  jwtRole?: string;
  likelyCause?: string;
}

export async function measureClockSkewAgainstHttpDate(
  fetchImpl: typeof fetch,
  url: string,
  jwtToken?: string,
): Promise<ClockSkewReport> {
  const localNow = new Date();
  const report: ClockSkewReport = {
    localUtcIso: localNow.toISOString(),
  };

  if (jwtToken) {
    const claims = decodeJwtPayloadUnsafe(jwtToken);
    if (claims?.iat) {
      report.jwtIatIso = new Date(claims.iat * 1000).toISOString();
    }
    if (claims?.exp) {
      report.jwtExpIso = new Date(claims.exp * 1000).toISOString();
    }
    report.jwtRole = claims?.role;
  }

  try {
    const response = await fetchImpl(url, { method: 'HEAD' });
    const dateHeader = response.headers.get('date');
    if (dateHeader) {
      const serverNow = new Date(dateHeader);
      report.serverUtcIso = serverNow.toISOString();
      report.skewMs = localNow.getTime() - serverNow.getTime();
      if (Math.abs(report.skewMs) <= 60_000) {
        report.skewDirection = 'in_sync';
      } else if (report.skewMs > 0) {
        report.skewDirection = 'local_ahead';
        report.likelyCause =
          'Local system clock is ahead of the remote server. Supabase may reject JWTs with "issued at future".';
      } else {
        report.skewDirection = 'local_behind';
        report.likelyCause =
          'Local system clock is behind the remote server. Token expiry checks may fail early.';
      }
    }
  } catch {
    report.likelyCause = 'Could not fetch remote Date header for skew measurement.';
  }

  return report;
}

export function isJwtIssuedAtFutureError(message: string): boolean {
  return /jwt issued at future|pgrst303/i.test(message);
}

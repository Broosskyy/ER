export interface MonthCalendarUrlOptions {
  /** Program list base URL, e.g. https://www.example.com/programm */
  baseListUrl: string;
  /** Path segment with `{year}` and `{month}` placeholders, e.g. year:{year}/month:{month} */
  monthPathTemplate: string;
  startYear: number;
  /** 1-based month index */
  startMonth: number;
  monthCount: number;
}

export function buildMonthCalendarUrls(options: MonthCalendarUrlOptions): string[] {
  const base = options.baseListUrl.replace(/\/$/, '');
  const urls: string[] = [];
  let year = options.startYear;
  let month = options.startMonth;

  for (let index = 0; index < options.monthCount; index += 1) {
    const monthPadded = String(month).padStart(2, '0');
    const path = options.monthPathTemplate
      .replace('{year}', String(year))
      .replace('{month}', monthPadded);
    urls.push(`${base}/${path}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return urls;
}

export const WEBSITE_TITLE_TRANSFORM_TYPES = [
  'remove_suffix',
  'remove_prefix',
  'regex_replace',
  'trim',
] as const;

export type WebsiteTitleTransformType = (typeof WEBSITE_TITLE_TRANSFORM_TYPES)[number];

export interface WebsiteTitleTransform {
  type: WebsiteTitleTransformType;
  /** Literal suffix/prefix or regex pattern depending on type. */
  value?: string;
  /** Replacement for regex_replace. */
  replacement?: string;
  /** Regex flags for regex_replace (default: no flags). */
  flags?: string;
}

export interface WebsiteTitleTransformValidationIssue {
  index: number;
  field: string;
  message: string;
}

export function validateWebsiteTitleTransforms(
  transforms: WebsiteTitleTransform[] | undefined,
): WebsiteTitleTransformValidationIssue[] {
  if (!transforms || transforms.length === 0) {
    return [];
  }

  const issues: WebsiteTitleTransformValidationIssue[] = [];

  transforms.forEach((transform, index) => {
    if (!WEBSITE_TITLE_TRANSFORM_TYPES.includes(transform.type)) {
      issues.push({
        index,
        field: 'type',
        message: `Unsupported transform type "${String(transform.type)}".`,
      });
      return;
    }

    if (transform.type === 'remove_suffix' || transform.type === 'remove_prefix') {
      if (!transform.value?.trim()) {
        issues.push({
          index,
          field: 'value',
          message: `${transform.type} requires a non-empty value.`,
        });
      }
    }

    if (transform.type === 'regex_replace') {
      if (!transform.value?.trim()) {
        issues.push({
          index,
          field: 'value',
          message: 'regex_replace requires a pattern value.',
        });
      } else {
        try {
          // eslint-disable-next-line no-new
          new RegExp(transform.value, transform.flags);
        } catch {
          issues.push({
            index,
            field: 'value',
            message: 'regex_replace pattern is not a valid regular expression.',
          });
        }
      }
    }
  });

  return issues;
}

export function applyWebsiteTitleTransforms(
  title: string | undefined,
  transforms: WebsiteTitleTransform[] | undefined,
): string | undefined {
  if (!title) {
    return title;
  }

  const issues = validateWebsiteTitleTransforms(transforms);
  if (issues.length > 0) {
    return title;
  }

  let result = title;

  for (const transform of transforms ?? []) {
    switch (transform.type) {
      case 'trim':
        result = result.trim();
        break;
      case 'remove_suffix': {
        const suffix = transform.value ?? '';
        if (suffix && result.endsWith(suffix)) {
          result = result.slice(0, -suffix.length);
        }
        break;
      }
      case 'remove_prefix': {
        const prefix = transform.value ?? '';
        if (prefix && result.startsWith(prefix)) {
          result = result.slice(prefix.length);
        }
        break;
      }
      case 'regex_replace': {
        if (!transform.value) {
          break;
        }
        try {
          const pattern = new RegExp(transform.value, transform.flags);
          result = result.replace(pattern, transform.replacement ?? '');
        } catch {
          // Invalid patterns are skipped at runtime after validation warnings.
        }
        break;
      }
      default:
        break;
    }
  }

  return result.trim();
}

export function buildConsumerGalleryImageUrls(input: {
  flyerUrl?: string;
  imageUrl?: string;
}): string[] {
  const urls: string[] = [];
  const push = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed && !urls.includes(trimmed)) {
      urls.push(trimmed);
    }
  };
  push(input.flyerUrl);
  push(input.imageUrl);
  return urls;
}

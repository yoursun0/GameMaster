import Image from 'next/image';
import { portraitById } from '@/lib/portraits';
import type { Locale } from '@/shared/schemas';

export function Portrait({
  id,
  locale,
  className,
  decorative = false,
}: {
  id: string;
  locale: Locale;
  className?: string;
  decorative?: boolean;
}) {
  const portrait = portraitById(id);
  return (
    <Image
      className={className}
      src={portrait.src}
      alt={decorative ? '' : portrait.alt[locale]}
      width={320}
      height={320}
      sizes="320px"
    />
  );
}

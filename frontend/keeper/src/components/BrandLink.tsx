import { getPublicBranding } from '@/integration/branding';
import styles from './BrandLink.module.scss';

type BrandLinkProps = {
  className?: string;
};

export function BrandLink({ className = '' }: BrandLinkProps) {
  const linkClassName = `${styles.brandLink} ${className}`.trim();
  const brand = getPublicBranding();

  return (
    <a className={linkClassName} href="/admin/usage-center" target="_top">
      {brand.logo && <img className={styles.brandMark} src={brand.logo} alt="" aria-hidden="true" />}
      <span className={styles.brandWord}>{brand.name}</span>
    </a>
  );
}

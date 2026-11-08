import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandLink } from '../BrandLink';
import { applyPublicBranding } from '@/integration/branding';

describe('BrandLink', () => {
  it('renders configured site branding and links to the host admin', () => {
    applyPublicBranding({ site_name: 'TokenLiberty', site_logo: '/site-logo.png' });
    const html = renderToStaticMarkup(<BrandLink />);

    expect(html).toContain('<img');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('>TokenLiberty</span>');
    expect(html).toContain('href="/admin/usage-center"');
    expect(html).toContain('target="_top"');
    expect(html).not.toMatch(/keeper|github/i);
  });
  it('omits unsafe configured logo URLs', () => {
    applyPublicBranding({ site_name: 'My Site', site_logo: 'javascript:alert(1)' });
    expect(renderToStaticMarkup(<BrandLink />)).not.toContain('<img');
  });
});

'use client';
import { createContext, useContext } from 'react';

export const defaultSettings = {
  siteName: 'Management',
  // Where the two public apps live. Empty until an operator fills them in on
  // Settings -> Branding; the page builder says so rather than guessing.
  storefrontUrl: '',
  adminUrl: '',
  logo: null,
  favicon: null,
  logoType: 'default',
  fontFamily: 'play',
  primaryColor: '#c8a96e',
  secondaryColor: '#1a1a2e',
  accentColor: '#e8c99a',
  phone: '',
  email: '',
  address: '',
  facebookUrl: '',
  instagramUrl: '',
  whatsappNumber: '',
  youtubeUrl: '',
  metaTitle: '',
  metaDescription: '',
  productNotes: [],
  carouselDesktop: 5,
  carouselTablet: 3,
  carouselMobile: 2,
  branchColumns: 2,
  footerTagline: '',
  footerCopyright: '',
  navItems: [],
  invoicePrintMode: 'full',
  showBreadcrumbs: true,
  breadcrumbDevices: 'all',
  aboutUs: '',
  privacyPolicy: '',
  refundPolicy: '',
  termsConditions: '',
};

const SiteSettingsContext = createContext(defaultSettings);

export function SiteSettingsProvider({ value, children }) {
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

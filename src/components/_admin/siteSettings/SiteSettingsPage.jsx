'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  IoSettingsOutline,
  IoHomeOutline,
  IoShirtOutline,
  IoLocationOutline,
  IoDocumentTextOutline,
  IoConstructOutline,
  IoCloudOutline
} from 'react-icons/io5';
import { FiFileText, FiExternalLink } from 'react-icons/fi';
import { getSiteSettingsByAdmin, updateSiteSettings, uploadSiteLogo, uploadSiteFavicon } from 'src/services';
import { useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import SectionsManager from 'src/components/_admin/homepage/SectionsManager';
import BannerList from 'src/components/_admin/banners/bannerList';
import Image from 'next/image';
import RichTextEditor from 'src/components/richTextEditor';
import { fDateTime } from 'src/utils/formatTime';

// ── Shared sub-components ────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Input({ name, value, onChange, placeholder, type = 'text', min, max }) {
  return (
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      max={max}
      className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-gray-400"
    />
  );
}

function Card({ title, subtitle, children, cols = 1, show = true }) {
  if (!show) return null;
  return (
    <section className="w-full rounded-md border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-base text-gray-800">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className={cols > 1 ? `grid grid-cols-${cols} gap-4` : 'space-y-4'}>{children}</div>
    </section>
  );
}

// ── Static page content editor (rich text by default, raw HTML on demand) ────
function PageContentEditor({ value, onChange }) {
  const [showHtml, setShowHtml] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowHtml((v) => !v)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition ${
            showHtml ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          {showHtml ? 'Back to editor' : 'Edit HTML'}
        </button>
      </div>
      {showHtml ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={14}
          spellCheck={false}
          placeholder="<h1>Heading</h1><p>Paragraph...</p>"
          className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-gray-400 resize-y leading-relaxed bg-gray-50"
        />
      ) : (
        <RichTextEditor value={value} onChange={onChange} minHeight={280} placeholder="Page content…" />
      )}
    </div>
  );
}

// ── Number stepper for carousel/column counts ────────────────────────────────
function CountStepper({ label, name, value, onChange, min = 1, max = 10, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ target: { name, value: Math.max(min, Number(value) - 1) } })}
          className="w-9 h-9 rounded-md border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center"
        >
          −
        </button>
        <span className="w-10 text-center font-bold text-gray-800 text-lg">{value}</span>
        <button
          type="button"
          onClick={() => onChange({ target: { name, value: Math.min(max, Number(value) + 1) } })}
          className="w-9 h-9 rounded-md border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center"
        >
          +
        </button>
        <div className="flex gap-1 ml-2">
          {Array.from({ length: max }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-5 rounded-md transition-colors ${i < value ? 'bg-yellow-400' : 'bg-gray-100'}`}
            />
          ))}
        </div>
      </div>
    </Field>
  );
}

// Reverse the HTML-entity encoding that xss-clean applies to request bodies.
// This is needed when loading page content back from the DB so the textarea
// shows raw HTML rather than &lt;h1&gt; etc.
function decodeHtml(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

// Default page HTML (pre-loads into editor if DB field is empty; admin saves to persist)
const DEFAULT_ABOUT_HTML = `<h1>Discover Us</h1><p>Where creativity meets elegance in every thread.</p><h2>Our Specialty</h2><p>Our specialty lies in our unique designs, exceptional service, and uncompromising quality. For those who prefer understated glamour and tasteful style, our creations are a cherished find.</p><h2>Meet Our Team</h2><p>Behind every masterpiece is a team of dedicated experts whose passion and craftsmanship breathe life into our designs.</p><h2>Our Journey</h2><p>Since our inception in 2018, we have grown from a dream to a thriving creative hub. Our products are lovingly crafted in our own factory using premium imported fabrics, with our headquarters proudly located in Demra, Dhaka.</p><h2>Showrooms &amp; Exhibitions</h2><p>We have established showrooms in several prime locations to serve you better:</p><ul><li>Bashundhara City Shopping Complex, Dhaka</li><li>Uttara - Jamjam Tower, Dhaka</li><li>Elephant Road, Dhaka</li><li>Theme Omar Plaza, Rajshahi</li><li>Sanmar Ocean City, Chittagong</li><li>Bali Arcade - Chokbazar, Chittagong</li></ul><p>We also host exclusive exhibitions across the country, offering you the chance to experience our designs in person.</p>`;
const DEFAULT_PRIVACY_HTML = `<h1>Privacy Policy</h1><p>We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our website.</p><h2>Information Collection</h2><p>We collect information that you provide directly, such as when you create an account, make a purchase, or contact us. This may include your name, email address, phone number, and payment details.</p><p>We also automatically collect certain information when you visit our site, such as your IP address, browser type, and browsing activity, to help us improve your experience.</p><h2>Use of Information</h2><p>We use collected information to operate and maintain our website, process transactions, communicate with you, improve our services, and for marketing purposes such as promotional emails.</p><h2>Data Security</h2><p>We implement security measures to protect your information from unauthorized access. However, no method of transmission over the internet is completely secure.</p><h2>Cookies</h2><p>We use cookies to enhance your browsing experience, remember your preferences, and analyze site traffic. You may disable cookies through your browser settings, although some features may not function properly.</p><h2>Third-Party Services</h2><p>We may share your information with trusted third-party service providers who assist us in operating our website, provided those parties agree to keep this information confidential.</p><h2>Changes to This Policy</h2><p>We may update this Privacy Policy from time to time and will notify you by posting the new policy on our website. Please review it periodically.</p>`;
const DEFAULT_REFUND_HTML = `<h1>Refund and Return Policy</h1><p>If you are not entirely satisfied with your purchase, we are here to help.</p><h2>Returns / Exchange</h2><p>You have <strong>5 calendar days</strong> to return or exchange an item from the date you received it. To be eligible, your item must be unused, in the same condition as received, and in original packaging with proof of purchase.</p><blockquote><strong>Note:</strong> Customized orders are not refundable or exchangeable unless the item is defective.</blockquote><h2>Refunds</h2><p>Once we receive your item, we will inspect it and notify you of the status of your refund. If approved, we will initiate a refund to your original method of payment within a certain number of days depending on your card issuer policies.</p><h2>Shipping</h2><p>You are responsible for paying your own shipping costs when returning an item. Shipping costs are non-refundable. If a refund is issued, return shipping costs will be deducted.</p><h2>Damaged or Defective Items</h2><p>If you received a damaged or defective item, please contact us immediately with photos of the item and packaging. We will arrange a replacement or full refund at no extra cost to you.</p>`;
const DEFAULT_TERMS_HTML = `<h1>Terms and Conditions</h1><p>Welcome! These terms and conditions outline the rules and regulations for the use of our website. By accessing this website, we assume you accept these terms and conditions in full.</p><h2>License</h2><p>Unless otherwise stated, we and/or our licensors own the intellectual property rights for all material on this website. All intellectual property rights are reserved.</p><p>You must not:</p><ul><li>Republish material from this website</li><li>Sell, rent, or sub-license material from this website</li><li>Reproduce, duplicate, or copy material from this website</li><li>Redistribute content from this website</li></ul><h2>User Comments</h2><p>Certain parts of this website offer the opportunity for users to post and exchange opinions and information. We do not filter, edit, publish, or review comments prior to their appearance. Comments reflect the views of the person who posts them.</p><h2>iFrames</h2><p>Without prior approval and written permission, you may not create frames around our webpages that alter the visual presentation or appearance of our website.</p><h2>Content Liability</h2><p>We shall not be held responsible for any content that appears on your website. No links should appear on any website that could be interpreted as defamatory, obscene, or criminal.</p><h2>Your Privacy</h2><p>Please read our <a href="/privacy-policy">Privacy Policy</a>.</p><h2>Reservation of Rights</h2><p>We reserve the right to request the removal of all links or any specific link to our website at any time and to amend these terms and conditions. By continuing to browse and use this website, you agree to be bound by the then-current version of these terms.</p><h2>Disclaimer</h2><p>To the maximum extent permitted by applicable law, we exclude all representations, warranties, and conditions relating to our website and the use of this website.</p>`;

// ── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'global', label: 'Global', icon: <IoSettingsOutline size={15} /> },
  { key: 'homepage', label: 'Homepage', icon: <IoHomeOutline size={15} /> },
  { key: 'product', label: 'Product Page', icon: <IoShirtOutline size={15} /> },
  { key: 'branch', label: 'Branch Page', icon: <IoLocationOutline size={15} /> },
  { key: 'invoice', label: 'Invoice', icon: <FiFileText size={15} /> },
  { key: 'pages', label: 'Pages', icon: <IoDocumentTextOutline size={15} /> },
  { key: 'maintenance', label: 'Maintenance', icon: <IoConstructOutline size={15} /> },
  { key: 'images', label: 'Image Server', icon: <IoCloudOutline size={15} /> }
];

// Static pages editable under Settings → Additional Pages
const PAGE_CARDS = [
  { key: 'aboutUs', label: 'About Us', hint: 'Shown on /about' },
  { key: 'privacyPolicy', label: 'Privacy Policy', hint: 'Shown on /privacy-policy' },
  { key: 'refundPolicy', label: 'Refund & Return Policy', hint: 'Shown on /refund-return-policy' },
  { key: 'termsConditions', label: 'Terms & Conditions', hint: 'Shown on /terms-and-conditions' }
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SiteSettingsPage({ section = 'global', page = null }) {
  const qc = useQueryClient();
  const tab = section;
  const savedFormRef = useRef(null);
  const DEFAULT_NAV = [
    { title: 'Categories', path: '', isDropdown: true },
    { title: 'Home', path: '/', isDropdown: false },
    { title: 'Products', path: '/products', isDropdown: false },
    { title: 'Branches', path: '/branches', isDropdown: false },
    { title: 'Contact', path: '/contact', isDropdown: false },
    { title: 'About', path: '/about', isDropdown: false }
  ];

  const [form, setForm] = useState({
    siteName: '',
    fontFamily: 'play',
    imageServerUrl: '',
    imageServerApiKey: '',
    primaryColor: '#2563eb',
    secondaryColor: '#000000',
    accentColor: '#60a5fa',
    phone: '',
    email: '',
    address: '',
    facebookUrl: '',
    instagramUrl: '',
    whatsappNumber: '',
    metaTitle: '',
    metaDescription: '',
    productNotes: [],
    carouselDesktop: 5,
    carouselTablet: 3,
    carouselMobile: 2,
    branchColumns: 2,
    footerTagline: '',
    footerCopyright: '',
    logoType: 'default',
    navItems: DEFAULT_NAV,
    youtubeUrl: '',
    showBreadcrumbs: true,
    breadcrumbDevices: 'all',
    productListDesktop: 'pagination',
    productListMobile: 'infinite',
    invoicePrintMode: 'full',
    aboutUs: DEFAULT_ABOUT_HTML,
    privacyPolicy: DEFAULT_PRIVACY_HTML,
    refundPolicy: DEFAULT_REFUND_HTML,
    termsConditions: DEFAULT_TERMS_HTML,
    maintenanceMode: false,
    maintenanceHeading: "We'll be back soon!",
    maintenanceSubheading: 'Our site is currently undergoing scheduled maintenance.',
    maintenanceMessage: '',
    maintenanceEndTime: ''
  });
  const [logo, setLogo] = useState(null);
  const [favicon, setFavicon] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [imageKeyConfigured, setImageKeyConfigured] = useState(false);
  const logoRef = useRef();
  const faviconRef = useRef();

  useEffect(() => {
    getSiteSettingsByAdmin()
      .then((res) => {
        const d = res.data || {};
        setForm({
          siteName: d.siteName || '',
          fontFamily: d.fontFamily || 'play',
          imageServerUrl: d.imageServerUrl || '',
          imageServerApiKey: '',
          primaryColor: d.primaryColor || '#2563eb',
          secondaryColor: d.secondaryColor || '#000000',
          accentColor: d.accentColor || '#60a5fa',
          phone: d.phone || '',
          email: d.email || '',
          address: d.address || '',
          facebookUrl: d.facebookUrl || '',
          instagramUrl: d.instagramUrl || '',
          whatsappNumber: d.whatsappNumber || '',
          metaTitle: d.metaTitle || '',
          metaDescription: d.metaDescription || '',
          productNotes: d.productNotes || [],
          footerTagline: d.footerTagline || '',
          footerCopyright: d.footerCopyright || '',
          carouselDesktop: d.carouselDesktop ?? 5,
          carouselTablet: d.carouselTablet ?? 3,
          carouselMobile: d.carouselMobile ?? 2,
          branchColumns: d.branchColumns ?? 2,
          logoType: d.logoType || 'default',
          navItems: d.navItems?.length ? d.navItems : DEFAULT_NAV,
          youtubeUrl: d.youtubeUrl || '',
          showBreadcrumbs: d.showBreadcrumbs ?? true,
          breadcrumbDevices: d.breadcrumbDevices || 'all',
          productListDesktop: d.productListDesktop || 'pagination',
          productListMobile: d.productListMobile || 'infinite',
          invoicePrintMode: d.invoicePrintMode || 'full',
          aboutUs: decodeHtml(d.aboutUs) || DEFAULT_ABOUT_HTML,
          privacyPolicy: decodeHtml(d.privacyPolicy) || DEFAULT_PRIVACY_HTML,
          refundPolicy: decodeHtml(d.refundPolicy) || DEFAULT_REFUND_HTML,
          termsConditions: decodeHtml(d.termsConditions) || DEFAULT_TERMS_HTML,
          maintenanceMode: d.maintenanceMode ?? false,
          maintenanceHeading: d.maintenanceHeading || "We'll be back soon!",
          maintenanceSubheading: d.maintenanceSubheading || 'Our site is currently undergoing scheduled maintenance.',
          maintenanceMessage: d.maintenanceMessage || '',
          maintenanceEndTime: d.maintenanceEndTime ? new Date(d.maintenanceEndTime).toISOString().slice(0, 16) : ''
        });
        if (d.logo) setLogo(d.logo);
        if (d.favicon) setFavicon(d.favicon);
        setImageKeyConfigured(Boolean(d.imageServerApiKeyConfigured));
      })
      .catch((e) => Swal.fire('Error', e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: typeof value === 'number' ? value : value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await updateSiteSettings(form);
      if (form.imageServerApiKey) {
        const savedForm = { ...form, imageServerApiKey: '' };
        setImageKeyConfigured(true);
        setForm(savedForm);
        savedFormRef.current = JSON.stringify(savedForm);
      } else {
        savedFormRef.current = JSON.stringify(form);
      }
      qc.invalidateQueries('site-settings');
      setMsg('Saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!loading && savedFormRef.current === null) savedFormRef.current = JSON.stringify(form);
  }, [loading, form]);

  const hasUnsavedChanges = !loading && savedFormRef.current !== null && savedFormRef.current !== JSON.stringify(form);

  useEffect(() => {
    const warnBeforeLeave = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [hasUnsavedChanges]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await uploadSiteLogo(fd);
      setLogo(res.data.path);
      qc.invalidateQueries('site-settings');
      setMsg('Logo uploaded!');
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    }
  };

  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await uploadSiteFavicon(fd);
      setFavicon(res.data.path);
      qc.invalidateQueries('site-settings');
      setMsg('Favicon uploaded!');
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    }
  };

  if (loading) return <div className="p-8 text-gray-500 animate-pulse">Loading…</div>;

  const isBrand = tab === 'brand';
  const isContact = tab === 'contact';
  const isSeo = tab === 'seo';
  const isFooter = tab === 'footer';
  const isNavigation = tab === 'navigation';
  const isBreadcrumbs = tab === 'breadcrumbs';
  const isGlobal = ['brand', 'contact', 'seo', 'footer', 'navigation', 'breadcrumbs', 'product'].includes(tab);
  const isHomepage = tab === 'homepage';
  const isProduct = tab === 'product';
  const isBranch = tab === 'branch';
  const isInvoice = tab === 'invoice';
  const isPages = tab === 'pages';
  const isMaintenance = tab === 'maintenance';
  const isImages = tab === 'images';

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {{
              brand: 'Brand Settings',
              contact: 'Contact',
              seo: 'SEO',
              footer: 'Footer',
              navigation: 'Navigation',
              breadcrumbs: 'Breadcrumb Settings',
              product: 'Product Showcase',
              branch: 'Branch Page',
              invoice: 'Invoice',
              maintenance: 'Maintenance',
              images: 'Image Server'
            }[tab] || (isPages ? PAGE_CARDS.find((c) => c.key === page)?.label || 'Additional Pages' : 'Site Settings')}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Changes apply within 60 s on the storefront</p>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && <span className="text-sm font-semibold text-amber-600">Unsaved changes</span>}
          {!hasUnsavedChanges && msg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
          {/* Save only applies to Global / Product / Branch tabs */}
          {!isHomepage && (
            <button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2.5 rounded-md font-semibold text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : hasUnsavedChanges ? 'Save Settings' : 'Saved'}
            </button>
          )}
        </div>
      </div>

      {/* ── GLOBAL TAB ──────────────────────────────────────────────────────── */}
      {isGlobal && (
        <>
          <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Branding */}
            <Card show={isBrand} title="Branding" subtitle="Logo, favicon and site name across the storefront">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col items-center gap-3 p-4 border border-dashed border-gray-200 rounded-md">
                  {logo ? (
                    <Image src={logo} alt="Logo" width={180} height={64} className="h-16 w-auto object-contain" />
                  ) : (
                    <div className="h-16 w-full bg-gray-50 rounded-md flex items-center justify-center text-xs text-gray-400">
                      No logo
                    </div>
                  )}
                  <input type="file" accept="image/*" ref={logoRef} className="hidden" onChange={handleLogoUpload} />
                  <button
                    onClick={() => logoRef.current?.click()}
                    className="border px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 w-full text-center"
                  >
                    {logo ? 'Change Logo' : 'Upload Logo'}
                  </button>
                </div>
                <div className="flex flex-col items-center gap-3 p-4 border border-dashed border-gray-200 rounded-md">
                  {favicon ? (
                    <Image src={favicon} alt="Favicon" width={40} height={40} className="h-10 w-10 object-contain" />
                  ) : (
                    <div className="h-10 w-full bg-gray-50 rounded-md flex items-center justify-center text-xs text-gray-400">
                      No favicon
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={faviconRef}
                    className="hidden"
                    onChange={handleFaviconUpload}
                  />
                  <button
                    onClick={() => faviconRef.current?.click()}
                    className="border px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 w-full text-center"
                  >
                    {favicon ? 'Change Favicon' : 'Upload Favicon'}
                  </button>
                </div>
              </div>
              <Field label="Site Name">
                <Input name="siteName" value={form.siteName} onChange={handleChange} placeholder="Your Store Name" />
              </Field>
              <Field
                label="Storefront Font"
                hint="Loaded from Google Fonts on the storefront; visitors fall back to sans-serif if unavailable"
              >
                <select
                  name="fontFamily"
                  value={form.fontFamily}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-yellow-400"
                >
                  <option value="play">Play</option>
                  <option value="roboto">Roboto</option>
                  <option value="inter">Inter</option>
                  <option value="poppins">Poppins</option>
                  <option value="montserrat">Montserrat</option>
                  <option value="lato">Lato</option>
                  <option value="nunito">Nunito</option>
                  <option value="open-sans">Open Sans</option>
                  <option value="hind-siliguri">Hind Siliguri</option>
                </select>
              </Field>
              <Field label="Logo Shape" hint="Round clips the logo into a circle — best for square/portrait images">
                <div className="flex gap-3">
                  {['default', 'round'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, logoType: type }))}
                      className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-md border-2 transition-all ${
                        form.logoType === type
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 bg-gray-200 flex items-center justify-center text-xs text-gray-500 ${
                          type === 'round' ? 'rounded-md' : 'rounded-md'
                        }`}
                      >
                        {logo ? (
                          <Image
                            src={logo}
                            alt=""
                            width={40}
                            height={40}
                            className={`w-10 h-10 object-cover ${type === 'round' ? 'rounded-md' : 'rounded-md'}`}
                          />
                        ) : (
                          'Logo'
                        )}
                      </div>
                      <span className="text-xs font-medium capitalize text-gray-700">{type}</span>
                    </button>
                  ))}
                </div>
              </Field>
            </Card>

            {/* Brand Colors */}
            <Card
              show={isBrand}
              title="Brand Colors"
              subtitle="Injected as CSS variables — affects buttons, links, and accents"
            >
              {[
                { key: 'primaryColor', label: 'Primary Color' },
                { key: 'secondaryColor', label: 'Secondary Color' },
                { key: 'accentColor', label: 'Accent Color' }
              ].map(({ key, label }) => (
                <Field key={key} label={label}>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-10 h-10 rounded-md border cursor-pointer p-0.5"
                    />
                    <Input name={key} value={form[key]} onChange={handleChange} placeholder="#000000" />
                    <span className="w-10 h-10 rounded-md border shrink-0" style={{ backgroundColor: form[key] }} />
                  </div>
                </Field>
              ))}
              <div className="flex gap-2 pt-2">
                <span
                  className="px-4 py-2 rounded-md text-white text-xs font-medium"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Primary
                </span>
                <span
                  className="px-4 py-2 rounded-md text-white text-xs font-medium"
                  style={{ backgroundColor: form.secondaryColor }}
                >
                  Secondary
                </span>
                <span
                  className="px-4 py-2 rounded-md text-xs font-medium border"
                  style={{ backgroundColor: form.accentColor }}
                >
                  Accent
                </span>
              </div>
            </Card>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Contact Info */}
            <Card show={isContact} title="Contact Info" subtitle="Shown in the footer, contact page, and order emails">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone">
                  <Input name="phone" value={form.phone} onChange={handleChange} placeholder="+880 1700-000000" />
                </Field>
                <Field label="Email">
                  <Input name="email" value={form.email} onChange={handleChange} placeholder="info@site.com" />
                </Field>
                <Field label="WhatsApp">
                  <Input
                    name="whatsappNumber"
                    value={form.whatsappNumber}
                    onChange={handleChange}
                    placeholder="8801700000000"
                  />
                </Field>
                <Field label="Facebook URL">
                  <Input
                    name="facebookUrl"
                    value={form.facebookUrl}
                    onChange={handleChange}
                    placeholder="https://facebook.com/page"
                  />
                </Field>
                <Field label="Instagram URL">
                  <Input
                    name="instagramUrl"
                    value={form.instagramUrl}
                    onChange={handleChange}
                    placeholder="https://instagram.com/page"
                  />
                </Field>
                <Field label="YouTube URL">
                  <Input
                    name="youtubeUrl"
                    value={form.youtubeUrl}
                    onChange={handleChange}
                    placeholder="https://youtube.com/@channel"
                  />
                </Field>
                <Field label="Address">
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows={2}
                    placeholder="123 Street, City"
                    className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-gray-400 resize-none"
                  />
                </Field>
              </div>
            </Card>

            {/* SEO */}
            <Card show={isSeo} title="SEO Defaults" subtitle="Meta title and description for search engines">
              <Field label="Meta Title">
                <Input
                  name="metaTitle"
                  value={form.metaTitle}
                  onChange={handleChange}
                  placeholder="Your Store — Shop Online"
                />
                <p className="text-xs text-gray-400 mt-1">Falls back to Site Name.</p>
              </Field>
              <Field label="Meta Description">
                <textarea
                  name="metaDescription"
                  value={form.metaDescription}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Brief description for search engines…"
                  className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-gray-400 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{form.metaDescription.length} / 160 characters</p>
              </Field>
            </Card>
          </div>

          {/* Footer Texts */}
          <Card show={isFooter} title="Footer Texts" subtitle="Customise the text shown in the footer">
            <Field label="Brand Tagline" hint="Shown below the logo. Leave empty to use the default.">
              <Input
                name="footerTagline"
                value={form.footerTagline}
                onChange={handleChange}
                placeholder={`${form.siteName || 'Sidrat'} — premium fashion crafted for the modern woman.`}
              />
            </Field>
            <Field
              label="Copyright Right Text"
              hint='Shown at the bottom-right of the footer. Leave empty for "Crafted with care".'
            >
              <Input
                name="footerCopyright"
                value={form.footerCopyright}
                onChange={handleChange}
                placeholder="Crafted with care"
              />
            </Field>
          </Card>

          {/* Navigation Items */}
          <Card
            show={isNavigation}
            title="Navigation Menu"
            subtitle="Links shown in the top menu bar on desktop. The Categories dropdown is auto-populated."
          >
            <div className="space-y-2">
              {form.navItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={item.title}
                    onChange={(e) => {
                      const updated = form.navItems.map((n, j) => (j === i ? { ...n, title: e.target.value } : n));
                      setForm((p) => ({ ...p, navItems: updated }));
                    }}
                    placeholder="Label"
                    className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-400 w-32"
                  />
                  {item.isDropdown ? (
                    <span className="flex-1 px-3 py-2 text-sm text-gray-400 bg-gray-50 rounded-md border border-dashed border-gray-200">
                      Auto — categories from database
                    </span>
                  ) : (
                    <input
                      value={item.path}
                      onChange={(e) => {
                        const updated = form.navItems.map((n, j) => (j === i ? { ...n, path: e.target.value } : n));
                        setForm((p) => ({ ...p, navItems: updated }));
                      }}
                      placeholder="/path"
                      className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                    />
                  )}
                  <span
                    className={`text-xs px-2 py-1 rounded-md font-medium ${item.isDropdown ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {item.isDropdown ? 'Dropdown' : 'Link'}
                  </span>
                  <button
                    onClick={() => setForm((p) => ({ ...p, navItems: p.navItems.filter((_, j) => j !== i) }))}
                    className="text-red-400 hover:text-red-600 text-xl font-bold px-1 shrink-0"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() =>
                  setForm((p) => ({ ...p, navItems: [...p.navItems, { title: '', path: '/', isDropdown: false }] }))
                }
                className="border border-dashed border-gray-300 text-gray-500 hover:border-gray-500 px-4 py-2 rounded-md text-sm"
              >
                + Add Link
              </button>
              {!form.navItems.some((n) => n.isDropdown) && (
                <button
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      navItems: [{ title: 'Categories', path: '', isDropdown: true }, ...p.navItems]
                    }))
                  }
                  className="border border-dashed border-yellow-300 text-yellow-600 hover:border-yellow-500 px-4 py-2 rounded-md text-sm"
                >
                  + Add Categories Dropdown
                </button>
              )}
            </div>
          </Card>

          {/* Page UI Options */}
          <Card show={isBreadcrumbs} title="Page Options" subtitle="UI features that appear across the storefront">
            <div className="space-y-4">
              {/* Show breadcrumbs toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Show Breadcrumbs</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Display navigation path (Home / Products / …) on all pages
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, showBreadcrumbs: !p.showBreadcrumbs }))}
                  className={`relative w-11 h-6 rounded-md transition-colors focus:outline-none ${form.showBreadcrumbs ? 'bg-yellow-400' : 'bg-gray-300'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-md shadow transition-transform ${form.showBreadcrumbs ? 'translate-x-5' : ''}`}
                  />
                </button>
              </div>

              {/* Device visibility — only when breadcrumbs are on */}
              {form.showBreadcrumbs && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Visible on</p>
                  <div className="flex gap-2">
                    {[
                      { value: 'all', label: 'All devices' },
                      { value: 'md-up', label: 'Tablet & Desktop' },
                      { value: 'lg-up', label: 'Desktop only' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, breadcrumbDevices: opt.value }))}
                        className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                          form.breadcrumbDevices === opt.value
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Product Listing Mode */}
          <Card
            show={isProduct}
            title="Product Listing"
            subtitle="Choose between infinite scroll and pagination per device"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { key: 'productListDesktop', label: 'Desktop', hint: 'Screen width ≥ 768 px' },
                { key: 'productListMobile', label: 'Mobile', hint: 'Screen width < 768 px' }
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <p className="text-sm font-medium text-gray-700 mb-0.5">{label}</p>
                  <p className="text-xs text-gray-400 mb-3">{hint}</p>
                  <div className="flex gap-2">
                    {[
                      { value: 'pagination', label: 'Pagination', desc: 'Page buttons at the bottom' },
                      { value: 'infinite', label: 'Infinite Scroll', desc: 'Auto-loads as user scrolls' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, [key]: opt.value }))}
                        className={`flex-1 px-3 py-3 rounded-md border text-left transition-colors ${
                          form[key] === opt.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold ${form[key] === opt.value ? 'text-blue-700' : 'text-gray-700'}`}
                        >
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Carousel Settings */}
          <Card
            show={isProduct}
            title="Product Carousel"
            subtitle="How many product cards are visible per row at each screen size"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <CountStepper
                label="Desktop (≥1024 px)"
                name="carouselDesktop"
                value={form.carouselDesktop}
                onChange={handleChange}
                min={1}
                max={8}
                hint="Large screens — typically 4–6"
              />
              <CountStepper
                label="Tablet (768–1023 px)"
                name="carouselTablet"
                value={form.carouselTablet}
                onChange={handleChange}
                min={1}
                max={5}
                hint="iPad-size screens — typically 2–4"
              />
              <CountStepper
                label="Mobile (< 768 px)"
                name="carouselMobile"
                value={form.carouselMobile}
                onChange={handleChange}
                min={1}
                max={4}
                hint="Phones — typically 1–2"
              />
            </div>
          </Card>
        </>
      )}

      {/* ── HOMEPAGE TAB ─────────────────────────────────────────────────── */}
      {isHomepage && (
        <div className="space-y-8">
          <Card title="Page Sections" subtitle="Drag to reorder, toggle visibility, add or remove sections">
            <SectionsManager />
          </Card>
          <Card title="Hero Banners" subtitle="Images shown in the top carousel (Hero/Slider section)">
            <BannerList />
          </Card>
        </div>
      )}

      {/* ── PRODUCT PAGE TAB ─────────────────────────────────────────────── */}
      {isProduct && (
        <Card
          title="Product Page Notes"
          subtitle="Shown below Add-to-Cart on every product — delivery info, return policy, etc. Write in Bangla."
        >
          <div className="space-y-2">
            {form.productNotes.map((note, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={note}
                  onChange={(e) => {
                    const updated = [...form.productNotes];
                    updated[i] = e.target.value;
                    setForm((p) => ({ ...p, productNotes: updated }));
                  }}
                  className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-gray-400"
                  placeholder="Note in Bangla…"
                />
                <button
                  onClick={() => setForm((p) => ({ ...p, productNotes: p.productNotes.filter((_, j) => j !== i) }))}
                  className="text-red-400 hover:text-red-600 text-xl font-bold px-2 shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setForm((p) => ({ ...p, productNotes: [...p.productNotes, ''] }))}
            className="border border-dashed border-gray-300 text-gray-500 hover:border-gray-500 px-4 py-2.5 rounded-md text-sm w-full mt-2"
          >
            + Add Note
          </button>
        </Card>
      )}

      {/* ── BRANCH PAGE TAB ──────────────────────────────────────────────── */}
      {isBranch && (
        <Card title="Branch Listing Layout" subtitle="Controls how branch cards are arranged on the Branches page">
          <div className="max-w-sm">
            <CountStepper
              label="Columns per row"
              name="branchColumns"
              value={form.branchColumns}
              onChange={handleChange}
              min={1}
              max={4}
              hint="How many branch cards appear side-by-side on desktop"
            />
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Preview</p>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${form.branchColumns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: form.branchColumns * 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400"
                >
                  Branch {i + 1}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── INVOICE TAB ──────────────────────────────────────────────────── */}
      {isInvoice && (
        <div className="space-y-6">
          <Card title="Print Mode" subtitle="Controls how invoices look when printed from the order detail page">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  key: 'full',
                  title: 'Full Page',
                  desc: 'The professional header and QR branch footer are printed on every page with the invoice content. Use with blank paper.',
                  icon: '📄'
                },
                {
                  key: 'letterhead',
                  title: 'Letterhead',
                  desc: 'Prints only the invoice content. Header and footer are hidden. Use this when you already have pre-printed letterhead paper.',
                  icon: '📋'
                }
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, invoicePrintMode: opt.key }))}
                  className={`p-5 rounded-md border-2 text-left transition-all ${
                    form.invoicePrintMode === opt.key
                      ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{opt.icon}</span>
                    <p
                      className={`font-semibold text-sm ${form.invoicePrintMode === opt.key ? 'text-yellow-800' : 'text-gray-800'}`}
                    >
                      {opt.title}
                    </p>
                    {form.invoicePrintMode === opt.key && (
                      <span className="ml-auto text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-md">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Letterhead Preview" subtitle="Preview and print a blank letterhead to create pre-printed paper">
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Open the letterhead preview to see how your header and footer will look. Print it on blank paper to
                create your letterhead stock, then set Print Mode to <strong>Letterhead</strong> above.
              </p>
              <div className="p-4 bg-gray-50 rounded-md border border-gray-100">
                <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
                  The letterhead includes:
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>✦ Your logo and company name</li>
                  <li>✦ Address, phone and email</li>
                  <li>✦ QR code for live branch locations and directions</li>
                  <li>✦ Your brand colour accent lines</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => window.open('/invoice/letterhead', '_blank')}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition w-fit"
              >
                <FiExternalLink size={14} />
                Open Letterhead Preview
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ── PAGES TAB ────────────────────────────────────────────────────── */}
      {isPages && (
        <div className="space-y-6">
          {PAGE_CARDS.filter((card) => !page || card.key === page).map(({ key, label, hint }) => (
            <Card key={key} title={label} subtitle={hint}>
              <PageContentEditor value={form[key]} onChange={(html) => setForm((p) => ({ ...p, [key]: html }))} />
            </Card>
          ))}
        </div>
      )}
      {/* ── MAINTENANCE TAB ──────────────────────────────────────────────── */}
      {isMaintenance && (
        <div className="space-y-6">
          {/* Toggle card */}
          <section className="bg-white border border-gray-100 rounded-md p-6 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="font-semibold text-base text-gray-800 flex items-center gap-2">
                  <IoConstructOutline size={17} className="text-yellow-500" />
                  Maintenance Mode
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  When enabled, the storefront is replaced with the maintenance page for all non-admin visitors.
                  Logged-in admin accounts can still browse normally.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, maintenanceMode: !p.maintenanceMode }))}
                className={`relative shrink-0 w-14 h-7 rounded-md transition-colors focus:outline-none ${
                  form.maintenanceMode ? 'bg-red-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-md shadow transition-transform ${
                    form.maintenanceMode ? 'translate-x-7' : ''
                  }`}
                />
              </button>
            </div>
            {form.maintenanceMode && (
              <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-4 py-3">
                <span className="text-red-500 text-lg">⚠</span>
                <p className="text-sm text-red-700 font-medium">
                  Maintenance mode is <strong>ON</strong> — the storefront is hidden from regular visitors.
                </p>
              </div>
            )}
          </section>

          {/* Page content */}
          <Card title="Page Content" subtitle="What visitors see on the maintenance page">
            <Field label="Heading">
              <Input
                name="maintenanceHeading"
                value={form.maintenanceHeading}
                onChange={handleChange}
                placeholder="We'll be back soon!"
              />
            </Field>
            <Field label="Subheading">
              <Input
                name="maintenanceSubheading"
                value={form.maintenanceSubheading}
                onChange={handleChange}
                placeholder="Our site is currently undergoing scheduled maintenance."
              />
            </Field>
            <Field
              label="Additional Message"
              hint="Optional — shown in a box below the subheading. Use this for extra details."
            >
              <textarea
                name="maintenanceMessage"
                value={form.maintenanceMessage}
                onChange={handleChange}
                rows={3}
                placeholder="e.g. We'll be back in a few hours. Thank you for your patience!"
                className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-gray-400 resize-none"
              />
            </Field>
          </Card>

          {/* Countdown timer */}
          <Card
            title="Countdown Timer"
            subtitle="Optional — shows a live countdown on the maintenance page until the site comes back online"
          >
            <Field
              label="Expected Back Online Time"
              hint="Leave blank to hide the timer. Visitors see a live countdown to this time."
            >
              <Input
                name="maintenanceEndTime"
                value={form.maintenanceEndTime}
                onChange={handleChange}
                type="datetime-local"
              />
            </Field>
            {form.maintenanceEndTime && (
              <p className="text-xs text-gray-400">
                Timer will show until:{' '}
                <strong className="text-gray-600">{fDateTime(form.maintenanceEndTime)}</strong>
              </p>
            )}
          </Card>

          {/* Live preview */}
          <Card title="Preview" subtitle="How the maintenance page will look to visitors">
            <div className="rounded-md border border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-12 px-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-md bg-yellow-100 flex items-center justify-center text-3xl">🔧</div>
              <h3 className="text-xl font-bold text-gray-900">{form.maintenanceHeading || "We'll be back soon!"}</h3>
              <p className="text-sm text-gray-500">
                {form.maintenanceSubheading || 'Our site is currently undergoing scheduled maintenance.'}
              </p>
              {form.maintenanceMessage && (
                <div className="bg-white border border-gray-200 rounded-md px-4 py-3 text-xs text-gray-600 max-w-xs text-left shadow-sm">
                  {form.maintenanceMessage}
                </div>
              )}
              {form.maintenanceEndTime && (
                <div className="flex gap-3 mt-2">
                  {['00', '00', '00', '00'].map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-md bg-yellow-500 flex items-center justify-center text-white font-bold text-lg">
                        {v}
                      </div>
                      <span className="text-xs text-gray-400">{['Days', 'Hrs', 'Min', 'Sec'][i]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {isImages && (
        <div className="space-y-6">
          <Card
            title="Image Server Connection"
            subtitle="All uploaded product, category, campaign, banner, logo, and favicon images are stored here"
          >
            <Field label="Image server URL" hint="For example https://img.example.com or http://localhost:3000">
              <Input
                name="imageServerUrl"
                value={form.imageServerUrl}
                onChange={handleChange}
                placeholder="https://img.example.com"
                type="url"
              />
            </Field>
            <Field
              label="API key"
              hint={
                imageKeyConfigured
                  ? 'A key is configured. Leave empty to keep it, or enter a new key to replace it.'
                  : 'Create a key in the image-server dashboard. It stays on the app server and is never exposed publicly.'
              }
            >
              <Input
                name="imageServerApiKey"
                value={form.imageServerApiKey}
                onChange={handleChange}
                placeholder={imageKeyConfigured ? 'Configured — enter only to replace' : 'imgkey_...'}
                type="password"
              />
            </Field>
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                form.imageServerUrl && imageKeyConfigured
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {form.imageServerUrl && imageKeyConfigured
                ? 'Configured. New uploads use the image server exclusively.'
                : 'Save both values before uploading images.'}
            </div>
          </Card>
          <Card
            title="Image processing"
            subtitle="Compression, conversion, dimensions, and limits are managed by the image server"
          >
            {form.imageServerUrl ? (
              <a
                href={`${form.imageServerUrl.replace(/\/+$/, '')}/dashboard`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Open image-server dashboard <FiExternalLink size={14} />
              </a>
            ) : (
              <p className="text-sm text-gray-500">Add the image-server URL to open its dashboard.</p>
            )}
          </Card>
        </div>
      )}

      {/* Bottom save bar (not on homepage tab — homepage uses its own mutations) */}
    </div>
  );
}

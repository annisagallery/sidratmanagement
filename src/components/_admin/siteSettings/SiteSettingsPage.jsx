'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from 'react-query';
import Image from 'next/image';
import {
  MdAdd,
  MdBuild,
  MdCheck,
  MdCheckCircle,
  MdDelete,
  MdImage,
  MdOpenInNew,
  MdOutlineFileUpload,
  MdRemove
} from 'react-icons/md';
import { getSiteSettingsByAdmin, updateSiteSettings, uploadSiteLogo, uploadSiteFavicon } from 'src/services';
import { alertError, toastSuccess } from 'src/utils/swal';
import RichTextEditor from 'src/components/richTextEditor';
import { fDateTime } from 'src/utils/formatTime';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Segmented from 'src/components/_admin/ui/Segmented';
import Callout from 'src/components/_admin/ui/Callout';
import Badge from 'src/components/_admin/ui/Badge';
import { Field, LengthCounter, SettingsCard, Toggle } from 'src/components/_admin/ui/fields';
import { ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

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


// Static pages editable under Settings → Additional pages
const PAGE_CARDS = [
  { key: 'aboutUs', label: 'About us', path: '/about' },
  { key: 'privacyPolicy', label: 'Privacy policy', path: '/privacy-policy' },
  { key: 'refundPolicy', label: 'Refund & return policy', path: '/refund-return-policy' },
  { key: 'termsConditions', label: 'Terms & conditions', path: '/terms-and-conditions' }
];

const DEFAULT_NAV = [
  { title: 'Categories', path: '', isDropdown: true },
  { title: 'Home', path: '/', isDropdown: false },
  { title: 'Products', path: '/products', isDropdown: false },
  { title: 'Branches', path: '/branches', isDropdown: false },
  { title: 'Contact', path: '/contact', isDropdown: false },
  { title: 'About', path: '/about', isDropdown: false }
];

const DEFAULT_FORM = {
  siteName: '',
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
};

/** The server's record, shaped into the form. */
function toForm(d = {}) {
  return {
    siteName: d.siteName || '',
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
  };
}

// ── Small building blocks ────────────────────────────────────────────────────

/** One of a few mutually exclusive choices, each with a sentence of explanation. */
function ChoiceCards({ label, options, value, onChange, columns = 2 }) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-3 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border p-4 text-left transition ${
              active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
              {active && <MdCheckCircle size={17} className="shrink-0 text-slate-900" aria-hidden />}
            </span>
            {opt.help && <span className="mt-1 block text-[13px] leading-relaxed text-slate-500">{opt.help}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A whole number within a range, with − and + either side. */
function CountStepper({ label, value, onChange, min = 1, max = 10, help }) {
  const n = Number(value) || min;
  return (
    <Field label={label} help={help}>
      <div className="flex items-center gap-2" role="group" aria-label={label}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, n - 1))}
          disabled={n <= min}
          className="btn-icon border border-slate-200"
          aria-label={`Fewer — ${label}`}
        >
          <MdRemove size={18} aria-hidden />
        </button>
        <output className="w-10 text-center text-lg font-semibold tabular-nums text-slate-900" aria-live="polite">
          {n}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, n + 1))}
          disabled={n >= max}
          className="btn-icon border border-slate-200"
          aria-label={`More — ${label}`}
        >
          <MdAdd size={18} aria-hidden />
        </button>
        <span className="ml-2 flex gap-1" aria-hidden>
          {Array.from({ length: max }).map((_, i) => (
            <span key={i} className={`h-1.5 w-4 rounded-full ${i < n ? 'bg-slate-900' : 'bg-slate-200'}`} />
          ))}
        </span>
      </div>
    </Field>
  );
}

/** Static page content: rich text by default, raw HTML on demand. */
function PageContentEditor({ value, onChange }) {
  const [mode, setMode] = useState('visual');
  return (
    <div className="space-y-3">
      <Segmented
        label="Editor"
        size="sm"
        options={[
          { id: 'visual', label: 'Visual' },
          { id: 'html', label: 'HTML' }
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'html' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={16}
          spellCheck={false}
          aria-label="Page HTML"
          placeholder="<h1>Heading</h1><p>Paragraph…</p>"
          className="input-ui ops-code min-h-[320px] w-full resize-y py-2 text-[13px]"
        />
      ) : (
        <RichTextEditor value={value} onChange={onChange} minHeight={320} placeholder="Page content…" />
      )}
    </div>
  );
}

/** Logo or favicon: preview, then upload/replace. */
function ImageSlot({ label, help, src, uploading, onPick, previewClass }) {
  const ref = useRef();
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-[13px] font-medium text-slate-800">{label}</p>
      {help && <p className="mt-0.5 text-xs text-slate-500">{help}</p>}
      <div className="mt-3 flex h-20 items-center justify-center rounded-md bg-slate-50">
        {src ? (
          <Image src={src} alt={`Current ${label.toLowerCase()}`} width={180} height={64} className={previewClass} />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-slate-500">
            <MdImage size={22} className="text-slate-400" aria-hidden />
            None yet
          </span>
        )}
      </div>
      <input type="file" accept="image/*" ref={ref} className="hidden" onChange={onPick} tabIndex={-1} aria-hidden />
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading} className="btn-ghost btn-sm mt-3 w-full">
        <MdOutlineFileUpload size={16} aria-hidden /> {uploading ? 'Uploading…' : src ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SiteSettingsPage({ section = 'global', page = null }) {
  const qc = useQueryClient();
  const tab = section;
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saved, setSaved] = useState(null); // JSON of the last saved form
  const [logo, setLogo] = useState(null);
  const [favicon, setFavicon] = useState(null);
  const [uploading, setUploading] = useState(null); // 'logo' | 'favicon' | null
  const [saving, setSaving] = useState(false);
  const [loadState, setLoadState] = useState({ loading: true, error: null });
  const [imageKeyConfigured, setImageKeyConfigured] = useState(false);

  const load = useCallback(() => {
    setLoadState({ loading: true, error: null });
    getSiteSettingsByAdmin()
      .then((res) => {
        const d = res.data || {};
        const next = toForm(d);
        setForm(next);
        setSaved(JSON.stringify(next));
        if (d.logo) setLogo(d.logo);
        if (d.favicon) setFavicon(d.favicon);
        setImageKeyConfigured(Boolean(d.imageServerApiKeyConfigured));
        setLoadState({ loading: false, error: null });
      })
      // A failed load must not fall through to the form: saving the defaults
      // it would show would overwrite every setting on the storefront.
      .catch((e) => setLoadState({ loading: false, error: e }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const put = (name, value) => setForm((p) => ({ ...p, [name]: value }));
  const handleChange = (e) => put(e.target.name, e.target.value);

  const hasUnsavedChanges = saved !== null && saved !== JSON.stringify(form);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSiteSettings(form);
      const next = form.imageServerApiKey ? { ...form, imageServerApiKey: '' } : form;
      if (form.imageServerApiKey) {
        setImageKeyConfigured(true);
        setForm(next);
      }
      setSaved(JSON.stringify(next));
      qc.invalidateQueries('site-settings');
      toastSuccess('Settings saved', 'The storefront picks them up within a minute.');
    } catch (e) {
      alertError(e, { title: 'The settings were not saved' });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => saved && setForm(JSON.parse(saved));

  useEffect(() => {
    const warnBeforeLeave = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [hasUnsavedChanges]);

  const upload = (kind, request, setter) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(kind);
    try {
      const res = await request(fd);
      setter(res.data.path);
      qc.invalidateQueries('site-settings');
      toastSuccess(kind === 'logo' ? 'Logo updated' : 'Favicon updated');
    } catch (err) {
      alertError(err, { title: `The ${kind} was not uploaded` });
    } finally {
      setUploading(null);
    }
  };

  const saveButton = (
    <button type="button" onClick={handleSave} disabled={saving || !hasUnsavedChanges || loadState.loading || Boolean(loadState.error)} className="btn-brand">
      {saving ? 'Saving…' : hasUnsavedChanges ? 'Save changes' : 'Saved'}
    </button>
  );

  const pageCard = PAGE_CARDS.find((c) => c.key === page);
  const title =
    {
      brand: 'Brand',
      contact: 'Contact',
      seo: 'Search engines',
      footer: 'Footer',
      navigation: 'Navigation',
      breadcrumbs: 'Breadcrumbs',
      product: 'Product showcase',
      branch: 'Branch page',
      invoice: 'Invoice',
      maintenance: 'Maintenance',
      images: 'Image server'
    }[tab] || pageCard?.label || 'Site settings';

  if (loadState.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={title}>{saveButton}</PageHeader>
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (loadState.error) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} />
        <ErrorState error={loadState.error} title="Settings could not be loaded" onRetry={load} />
      </div>
    );
  }

  const setNav = (i, patch) => put('navItems', form.navItems.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const setNote = (i, value) => put('productNotes', form.productNotes.map((n, j) => (j === i ? value : n)));

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title={title} subtitle="Changes reach the storefront within a minute of saving.">
        {saveButton}
      </PageHeader>

      {/* ── Brand ───────────────────────────────────────────────────────── */}
      {tab === 'brand' && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <SettingsCard title="Identity" description="The name, logo and browser icon used across the storefront.">
            <Field label="Site name">
              <input name="siteName" value={form.siteName} onChange={handleChange} placeholder="Your store name" className="input-ui" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageSlot
                label="Logo"
                help="PNG or SVG with a transparent background."
                src={logo}
                uploading={uploading === 'logo'}
                onPick={upload('logo', uploadSiteLogo, setLogo)}
                previewClass="h-14 w-auto object-contain"
              />
              <ImageSlot
                label="Favicon"
                help="Square, at least 64 × 64 px."
                src={favicon}
                uploading={uploading === 'favicon'}
                onPick={upload('favicon', uploadSiteFavicon, setFavicon)}
                previewClass="h-10 w-10 object-contain"
              />
            </div>
            {/* The storefront font picker was removed on purpose. Offering
                nine families meant every app had to instantiate all nine, and
                next/font preloads every family it can see — the storefront was
                shipping 17 woff2 files (~311 KiB) per page load to render text
                in one of them. The apps now hard-code Play via next/font. */}
            <Field label="Logo shape">
              <ChoiceCards
                label="Logo shape"
                value={form.logoType}
                onChange={(v) => put('logoType', v)}
                options={[
                  { value: 'default', label: 'As uploaded', help: 'Shown at its own shape.' },
                  { value: 'round', label: 'Round', help: 'Clipped to a circle — best for square or portrait logos.' }
                ]}
              />
            </Field>
          </SettingsCard>

          <SettingsCard title="Brand colours" description="Used for buttons, links and accents on the storefront.">
            {[
              { key: 'primaryColor', label: 'Primary' },
              { key: 'secondaryColor', label: 'Secondary' },
              { key: 'accentColor', label: 'Accent' }
            ].map(({ key, label }) => (
              <Field key={key} label={label}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form[key]}
                    onChange={(e) => put(key, e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-slate-200 p-0.5"
                    aria-label={`${label} colour picker`}
                  />
                  <input name={key} value={form[key]} onChange={handleChange} placeholder="#000000" className="input-ui ops-code" spellCheck={false} />
                </div>
              </Field>
            ))}
            <div>
              <p className="mb-2 text-[13px] font-medium text-slate-800">Preview</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md px-4 py-2 text-xs font-medium text-white" style={{ backgroundColor: form.primaryColor }}>
                  Primary
                </span>
                <span className="rounded-md px-4 py-2 text-xs font-medium text-white" style={{ backgroundColor: form.secondaryColor }}>
                  Secondary
                </span>
                <span className="rounded-md border border-slate-200 px-4 py-2 text-xs font-medium text-slate-900" style={{ backgroundColor: form.accentColor }}>
                  Accent
                </span>
              </div>
            </div>
          </SettingsCard>
        </div>
      )}

      {/* ── Contact ─────────────────────────────────────────────────────── */}
      {tab === 'contact' && (
        <SettingsCard title="Contact details" description="Shown in the footer, on the contact page and in order emails.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Phone">
              <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+880 1700-000000" className="input-ui" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="info@site.com" className="input-ui" />
            </Field>
            <Field label="WhatsApp number" help="Country code first, digits only.">
              <input name="whatsappNumber" inputMode="tel" value={form.whatsappNumber} onChange={handleChange} placeholder="8801700000000" className="input-ui" />
            </Field>
            <Field label="Address" className="sm:col-span-2 xl:col-span-3">
              <textarea name="address" value={form.address} onChange={handleChange} rows={2} placeholder="123 Street, City" className="input-ui min-h-[64px] resize-y py-2" />
            </Field>
          </div>
          <div className="border-t border-slate-200 pt-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Social links</h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Facebook">
                <input name="facebookUrl" type="url" value={form.facebookUrl} onChange={handleChange} placeholder="https://facebook.com/page" className="input-ui" />
              </Field>
              <Field label="Instagram">
                <input name="instagramUrl" type="url" value={form.instagramUrl} onChange={handleChange} placeholder="https://instagram.com/page" className="input-ui" />
              </Field>
              <Field label="YouTube">
                <input name="youtubeUrl" type="url" value={form.youtubeUrl} onChange={handleChange} placeholder="https://youtube.com/@channel" className="input-ui" />
              </Field>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ── SEO ─────────────────────────────────────────────────────────── */}
      {tab === 'seo' && (
        <SettingsCard title="Search engine defaults" description="Used on any page that does not set its own title and description.">
          <Field label="Page title" help="Falls back to the site name." counter={<LengthCounter value={form.metaTitle} max={60} />}>
            <input name="metaTitle" value={form.metaTitle} onChange={handleChange} placeholder="Your Store — Shop Online" className="input-ui" />
          </Field>
          <Field label="Description" counter={<LengthCounter value={form.metaDescription} max={160} />}>
            <textarea
              name="metaDescription"
              value={form.metaDescription}
              onChange={handleChange}
              rows={4}
              placeholder="A sentence or two about the store, for search results"
              className="input-ui min-h-[96px] resize-y py-2"
            />
          </Field>
        </SettingsCard>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {tab === 'footer' && (
        <SettingsCard title="Footer text" description="Leave a field empty to use the default wording.">
          <Field label="Tagline" help="Shown under the logo.">
            <input
              name="footerTagline"
              value={form.footerTagline}
              onChange={handleChange}
              placeholder={`${form.siteName || 'Sidrat'} — premium fashion crafted for the modern woman.`}
              className="input-ui"
            />
          </Field>
          <Field label="Bottom-right text" help="Defaults to “Crafted with care”.">
            <input name="footerCopyright" value={form.footerCopyright} onChange={handleChange} placeholder="Crafted with care" className="input-ui" />
          </Field>
        </SettingsCard>
      )}

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      {tab === 'navigation' && (
        <SettingsCard
          title="Top menu"
          description="Links in the storefront's desktop menu bar, left to right. The categories dropdown fills itself from the catalogue."
        >
          <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {form.navItems.map((item, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
                <span className="w-5 shrink-0 text-center text-[13px] tabular-nums text-slate-500">{i + 1}</span>
                <input
                  value={item.title}
                  onChange={(e) => setNav(i, { title: e.target.value })}
                  placeholder="Label"
                  aria-label={`Menu item ${i + 1} label`}
                  className="input-ui w-full sm:w-40"
                />
                {item.isDropdown ? (
                  <span className="flex min-h-[40px] flex-1 items-center rounded-md bg-slate-50 px-3 text-[13px] text-slate-500">
                    Filled from categories
                  </span>
                ) : (
                  <input
                    value={item.path}
                    onChange={(e) => setNav(i, { path: e.target.value })}
                    placeholder="/path"
                    aria-label={`Menu item ${i + 1} link`}
                    className="input-ui ops-code min-w-0 flex-1"
                    spellCheck={false}
                  />
                )}
                <Badge tone={item.isDropdown ? 'violet' : 'neutral'}>{item.isDropdown ? 'Dropdown' : 'Link'}</Badge>
                <button
                  type="button"
                  onClick={() => put('navItems', form.navItems.filter((_, j) => j !== i))}
                  className="btn-icon btn-icon-sm btn-icon-danger shrink-0"
                  aria-label={`Remove ${item.title || `menu item ${i + 1}`}`}
                  title="Remove"
                >
                  <MdDelete size={17} aria-hidden />
                </button>
              </li>
            ))}
            {!form.navItems.length && <li className="px-4 py-6 text-center text-[13px] text-slate-500">The menu is empty.</li>}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => put('navItems', [...form.navItems, { title: '', path: '/', isDropdown: false }])} className="btn-ghost">
              <MdAdd size={17} aria-hidden /> Add link
            </button>
            {!form.navItems.some((n) => n.isDropdown) && (
              <button
                type="button"
                onClick={() => put('navItems', [{ title: 'Categories', path: '', isDropdown: true }, ...form.navItems])}
                className="btn-ghost"
              >
                <MdAdd size={17} aria-hidden /> Add categories dropdown
              </button>
            )}
          </div>
        </SettingsCard>
      )}

      {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
      {tab === 'breadcrumbs' && (
        <SettingsCard title="Breadcrumbs" description="The Home / Products / … trail at the top of storefront pages.">
          <Toggle
            label="Show breadcrumbs"
            help="Display the navigation path on every page."
            checked={form.showBreadcrumbs}
            onChange={(on) => put('showBreadcrumbs', on)}
          />
          {form.showBreadcrumbs && (
            <Field label="Show on">
              <Segmented
                label="Show on"
                options={[
                  { id: 'all', label: 'All devices' },
                  { id: 'md-up', label: 'Tablet and desktop' },
                  { id: 'lg-up', label: 'Desktop only' }
                ]}
                value={form.breadcrumbDevices}
                onChange={(v) => put('breadcrumbDevices', v)}
              />
            </Field>
          )}
        </SettingsCard>
      )}

      {/* ── Product showcase ───────────────────────────────────────────── */}
      {tab === 'product' && (
        <div className="space-y-6">
          <SettingsCard title="Product listing" description="How shoppers move through long product lists.">
            {[
              { key: 'productListDesktop', label: 'On desktop', help: 'Screens 768 px and wider.' },
              { key: 'productListMobile', label: 'On mobile', help: 'Screens narrower than 768 px.' }
            ].map(({ key, label, help }) => (
              <Field key={key} label={label} help={help}>
                <ChoiceCards
                  label={label}
                  value={form[key]}
                  onChange={(v) => put(key, v)}
                  options={[
                    { value: 'pagination', label: 'Pages', help: 'Numbered page buttons at the bottom.' },
                    { value: 'infinite', label: 'Infinite scroll', help: 'More products load as the shopper scrolls.' }
                  ]}
                />
              </Field>
            ))}
          </SettingsCard>

          <SettingsCard title="Product carousel" description="How many product cards fit in a row at each screen size.">
            <div className="grid gap-6 md:grid-cols-3">
              <CountStepper label="Desktop" help="1024 px and wider — usually 4 to 6." value={form.carouselDesktop} onChange={(v) => put('carouselDesktop', v)} max={8} />
              <CountStepper label="Tablet" help="768 to 1023 px — usually 2 to 4." value={form.carouselTablet} onChange={(v) => put('carouselTablet', v)} max={5} />
              <CountStepper label="Mobile" help="Under 768 px — usually 1 or 2." value={form.carouselMobile} onChange={(v) => put('carouselMobile', v)} max={4} />
            </div>
          </SettingsCard>

          <SettingsCard title="Product page notes" description="Shown under Add to cart on every product — delivery, returns and so on. Write them in Bangla.">
            {form.productNotes.length ? (
              <ol className="space-y-2">
                {form.productNotes.map((note, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-[13px] tabular-nums text-slate-500">{i + 1}</span>
                    <input value={note} onChange={(e) => setNote(i, e.target.value)} placeholder="Note in Bangla…" aria-label={`Note ${i + 1}`} className="input-ui" />
                    <button
                      type="button"
                      onClick={() => put('productNotes', form.productNotes.filter((_, j) => j !== i))}
                      className="btn-icon btn-icon-sm btn-icon-danger shrink-0"
                      aria-label={`Remove note ${i + 1}`}
                      title="Remove"
                    >
                      <MdDelete size={17} aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-slate-500">No notes — nothing is shown under Add to cart.</p>
            )}
            <button type="button" onClick={() => put('productNotes', [...form.productNotes, ''])} className="btn-ghost">
              <MdAdd size={17} aria-hidden /> Add note
            </button>
          </SettingsCard>
        </div>
      )}

      {/* ── Branch page ─────────────────────────────────────────────────── */}
      {tab === 'branch' && (
        <SettingsCard title="Branch listing" description="How branch cards are laid out on the storefront's Branches page.">
          <CountStepper label="Cards per row" help="On desktop." value={form.branchColumns} onChange={(v) => put('branchColumns', v)} max={4} />
          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-800">Preview</p>
            <div className="grid gap-2 rounded-lg bg-slate-50 p-3" style={{ gridTemplateColumns: `repeat(${form.branchColumns}, minmax(0, 1fr))` }} aria-hidden>
              {Array.from({ length: form.branchColumns * 2 }).map((_, i) => (
                <div key={i} className="flex h-14 items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-500">
                  Branch {i + 1}
                </div>
              ))}
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ── Invoice ─────────────────────────────────────────────────────── */}
      {tab === 'invoice' && (
        <div className="space-y-6">
          <SettingsCard title="Print mode" description="How invoices print from an order page.">
            <ChoiceCards
              label="Print mode"
              value={form.invoicePrintMode}
              onChange={(v) => put('invoicePrintMode', v)}
              options={[
                {
                  value: 'full',
                  label: 'Full page',
                  help: 'The header and the QR branch footer print on every page with the invoice. Use blank paper.'
                },
                {
                  value: 'letterhead',
                  label: 'Letterhead',
                  help: 'Prints only the invoice content, for paper that already has the header and footer printed on it.'
                }
              ]}
            />
          </SettingsCard>

          <SettingsCard
            title="Letterhead"
            description="Print a blank letterhead to make pre-printed paper, then choose Letterhead above."
            action={
              <button type="button" onClick={() => window.open('/invoice/letterhead', '_blank')} className="btn-ghost btn-sm">
                <MdOpenInNew size={16} aria-hidden /> Open preview
              </button>
            }
          >
            <ul className="grid gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
              {['Logo and company name', 'Address, phone and email', 'QR code to branch locations and directions', 'Brand colour accent lines'].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <MdCheck size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </SettingsCard>
        </div>
      )}

      {/* ── Additional pages ────────────────────────────────────────────── */}
      {tab === 'pages' &&
        PAGE_CARDS.filter((card) => !page || card.key === page).map(({ key, label, path }) => (
          <SettingsCard
            key={key}
            title={label}
            description={`Shown on ${path}`}
            action={
              <a href={path} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" aria-label={`Open ${label} on the storefront (new tab)`}>
                <MdOpenInNew size={16} aria-hidden /> View page
              </a>
            }
          >
            <PageContentEditor value={form[key]} onChange={(html) => put(key, html)} />
          </SettingsCard>
        ))}

      {/* ── Maintenance ─────────────────────────────────────────────────── */}
      {tab === 'maintenance' && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-6">
            <SettingsCard title="Maintenance mode">
              <Toggle
                label="Take the storefront offline"
                help="Visitors see the maintenance page instead. Signed-in admin accounts can still browse normally."
                checked={form.maintenanceMode}
                onChange={(on) => put('maintenanceMode', on)}
              />
              {form.maintenanceMode && (
                <Callout tone="danger" title="The storefront is hidden from shoppers">
                  {hasUnsavedChanges ? 'Once you save, only admin accounts can browse the site.' : 'Only admin accounts can browse the site until this is turned off.'}
                </Callout>
              )}
            </SettingsCard>

            <SettingsCard title="Maintenance page" description="What visitors see while the site is offline.">
              <Field label="Heading">
                <input name="maintenanceHeading" value={form.maintenanceHeading} onChange={handleChange} placeholder="We'll be back soon!" className="input-ui" />
              </Field>
              <Field label="Subheading">
                <input
                  name="maintenanceSubheading"
                  value={form.maintenanceSubheading}
                  onChange={handleChange}
                  placeholder="Our site is currently undergoing scheduled maintenance."
                  className="input-ui"
                />
              </Field>
              <Field label="Extra message" optional help="Shown in a box under the subheading.">
                <textarea
                  name="maintenanceMessage"
                  value={form.maintenanceMessage}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. We'll be back in a few hours. Thank you for your patience!"
                  className="input-ui min-h-[80px] resize-y py-2"
                />
              </Field>
              <Field
                label="Back online at"
                optional
                help={form.maintenanceEndTime ? `A countdown to ${fDateTime(form.maintenanceEndTime)} is shown.` : 'Leave empty to hide the countdown.'}
              >
                <input name="maintenanceEndTime" value={form.maintenanceEndTime} onChange={handleChange} type="datetime-local" className="input-ui" />
              </Field>
            </SettingsCard>
          </div>

          <Panel title="Preview" description="The maintenance page, as visitors see it." className="xl:sticky xl:top-0">
            <div className="flex flex-col items-center justify-center space-y-4 rounded-lg bg-slate-50 px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
                <MdBuild size={26} aria-hidden />
              </span>
              <h3 className="text-xl font-semibold text-slate-900">{form.maintenanceHeading || "We'll be back soon!"}</h3>
              <p className="text-sm text-slate-500">{form.maintenanceSubheading || 'Our site is currently undergoing scheduled maintenance.'}</p>
              {form.maintenanceMessage && (
                <div className="max-w-xs rounded-md border border-slate-200 bg-white px-4 py-3 text-left text-xs text-slate-600">{form.maintenanceMessage}</div>
              )}
              {form.maintenanceEndTime && (
                <div className="mt-2 flex gap-3" aria-hidden>
                  {['Days', 'Hrs', 'Min', 'Sec'].map((unit) => (
                    <div key={unit} className="flex flex-col items-center gap-1">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-lg font-semibold text-white">00</div>
                      <span className="text-xs text-slate-500">{unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ── Image server ────────────────────────────────────────────────── */}
      {tab === 'images' && (
        <div className="space-y-6">
          <SettingsCard
            title="Connection"
            description="Every uploaded image — products, categories, campaigns, banners, logo and favicon — is stored on the image server."
            action={
              form.imageServerUrl && imageKeyConfigured ? (
                <Badge tone="success" dot>
                  Connected
                </Badge>
              ) : (
                <Badge tone="warning" dot>
                  Not set up
                </Badge>
              )
            }
          >
            <Field label="Server address" help="For example https://img.example.com or http://localhost:3000">
              <input name="imageServerUrl" value={form.imageServerUrl} onChange={handleChange} placeholder="https://img.example.com" type="url" className="input-ui ops-code" spellCheck={false} />
            </Field>
            <Field
              label="API key"
              help={
                imageKeyConfigured
                  ? 'A key is saved. Leave this empty to keep it, or enter a new one to replace it.'
                  : 'Create a key in the image-server dashboard. It stays on the app server and is never shown publicly.'
              }
            >
              <input
                name="imageServerApiKey"
                value={form.imageServerApiKey}
                onChange={handleChange}
                placeholder={imageKeyConfigured ? 'Saved — enter only to replace' : 'imgkey_…'}
                type="password"
                autoComplete="new-password"
                className="input-ui ops-code"
              />
            </Field>
            {!(form.imageServerUrl && imageKeyConfigured) && (
              <Callout tone="warning">Save both the address and the key before uploading any images.</Callout>
            )}
          </SettingsCard>
          <SettingsCard
            title="Image processing"
            description="Compression, conversion, sizes and limits are managed on the image server itself."
            action={
              form.imageServerUrl ? (
                <a href={`${form.imageServerUrl.replace(/\/+$/, '')}/dashboard`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                  <MdOpenInNew size={16} aria-hidden /> Open dashboard
                </a>
              ) : null
            }
          >
            {!form.imageServerUrl && <p className="text-[13px] text-slate-500">Add the server address to open its dashboard.</p>}
          </SettingsCard>
        </div>
      )}

      {/* Unsaved changes stay in view however far down the page you are. */}
      {hasUnsavedChanges && (
        <div className="sticky bottom-3 z-20" role="region" aria-label="Unsaved changes">
          <div className="card-ui flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-lg">
            <p className="text-[13px] font-medium text-slate-900">You have unsaved changes</p>
            <div className="flex gap-2">
              <button type="button" onClick={discard} disabled={saving} className="btn-ghost">
                Discard
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-brand">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

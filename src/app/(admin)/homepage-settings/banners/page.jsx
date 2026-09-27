import HeroLayoutPicker from 'src/components/_admin/banners/heroLayout';
import BannerList from 'src/components/_admin/banners/bannerList';

export default function HomepageBannersPage() {
  return (
    <div className="space-y-6">
      <HeroLayoutPicker />
      <BannerList />
    </div>
  );
}

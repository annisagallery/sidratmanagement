import HeroLayoutPicker from 'src/components/_admin/banners/heroLayout';
import BannerList from 'src/components/_admin/banners/bannerList';

export default function HomepageBannersPage() {
  return (
    <div className="space-y-8">
      <HeroLayoutPicker />
      <BannerList />
    </div>
  );
}

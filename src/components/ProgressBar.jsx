import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

// mui

const Providers = () => {
  return <ProgressBar height="3px" color="black" options={{ showSpinner: false }} shallowRouting />;
};

export default Providers;

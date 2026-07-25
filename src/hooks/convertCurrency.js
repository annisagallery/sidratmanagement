import useSettingsStore from 'src/stores/settingsStore';

export const useCurrencyConvert = () => {
  const rate = useSettingsStore((s) => s.rate);
  return (number) => Number((number * rate).toFixed(1));
};

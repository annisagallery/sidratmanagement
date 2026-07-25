import { useState, useEffect } from 'react';
import useSettingsStore from 'src/stores/settingsStore';

export const useCurrencyFormatter = (curr) => {
  const currency = useSettingsStore((s) => s.currency);
  const [formatter, setFormatter] = useState(null);

  useEffect(() => {
    if (currency) {
      setFormatter(new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }));
    }
  }, [currency, curr]);

  return (number) => (formatter ? formatter.format(Number(number) || 0) : number);
};

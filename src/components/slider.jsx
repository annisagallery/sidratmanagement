import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Range } from 'react-range'; // Importing Range component from react-range
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';

// custom hooks
import { useCurrencyFormatter } from 'src/hooks/formatCurrency';
import { useCurrencyConvert } from 'src/hooks/convertCurrency';

CustomizedSlider.propTypes = {
  prices: PropTypes.array.isRequired,
  path: PropTypes.string.isRequired
};

export default function CustomizedSlider({ ...props }) {
  const { prices: filterPrices, path } = props;
  const cCurrency = useCurrencyConvert();
  const fCurrency = useCurrencyFormatter();
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const prices = searchParams.get('prices');
  const [state, setState] = React.useState([0, filterPrices[1]]);

  const createQueryString = useCallback(
    (name, value) => {
      const params = new URLSearchParams(searchParams);
      params.set(name, value);
      return params.toString();
    },
    [searchParams]
  );

  const deleteQueryString = useCallback(
    (name) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(name);
      return params.toString();
    },
    [searchParams]
  );

  React.useEffect(() => {
    if (Boolean(prices)) {
      setState([cCurrency(Number(prices.split('_')[0])), cCurrency(Number(prices.split('_')[1]))]);
    } else {
      setState([0, filterPrices[1]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-semibold text-gray-800">Price Range</div>
        {Boolean(prices) && (
          <button
            onClick={() => {
              setState([0, filterPrices[1]]);
              push(`${path}?${deleteQueryString('prices')}`);
            }}
            className="bg-primary text-white px-2 rounded-md text-sm"
          >
            Reset
          </button>
        )}
      </div>

      <div className="px-2 mt-2">
        <Range
          step={1}
          min={0}
          max={cCurrency(filterPrices[1])}
          values={state}
          onChange={(values) => setState(values)}
          onFinalChange={(values) => {
            const prices = values.join('_');
            push(`${path}?` + createQueryString('prices', prices));
          }}
          renderTrack={({ props, children }) => (
            <div
              {...props}
              className="w-full h-2 bg-gray-200 rounded-md relative"
              style={{
                background: `linear-gradient(to right, #e5e5e5 ${100 * (state[0] / cCurrency(filterPrices[1]))}%, #000000 ${100 * (state[0] / cCurrency(filterPrices[1]))}%, #000000 ${100 * (state[1] / cCurrency(filterPrices[1]))}%, #e5e5e5 ${100 * (state[1] / cCurrency(filterPrices[1]))}%)`
              }}
            >
              {children}
            </div>
          )}
          renderThumb={({ props, isDragged }) => (
            <div
              {...props}
              className={`w-5 h-5 bg-white border-2 border-primary rounded-md focus:outline-none ${isDragged ? 'shadow-lg' : ''}`}
            />
          )}
        />
        <div className="flex justify-between mt-4">
          <span className="text-gray-600">Min {state[0]}৳</span>
          <span className="text-gray-600">Max {state[1]}৳</span>
        </div>
      </div>
    </>
  );
}

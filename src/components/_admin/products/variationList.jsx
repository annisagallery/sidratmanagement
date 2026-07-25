import GlobalTable from 'src/components/_admin/ui/GlobalTable';
// components/VariationsList.js

import React from 'react';
import { AiOutlineDelete } from 'react-icons/ai';

const VariationsList = ({ sizes, colors, variations, setVariations, price, salePrice }) => {
  // Generate all combinations
  const combinations = [];

  sizes.forEach((size) => {
    colors.forEach((color) => {
      const existingVariation = variations.find((v) => v.size === size.value && v.color === color.value);
      combinations.push({
        size,
        color,
      ...existingVariation
      });
    });
  });

  const handlePriceChange = (index, value) => {
    const updated = [...variations];
    updated[index].priceAddition = value;
    setVariations(updated);
  };

  const handleRemoveVariation = (index) => {
    const updated = [...variations];
    updated.splice(index, 1);
    setVariations(updated);
  };

  return (
    <div className="mt-4">
      <h3 className="text-md font-semibold mb-2">Variation Combinations</h3>
      <GlobalTable className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="py-2 px-4 border">Size</th>
            <th className="py-2 px-4 border">Color</th>
            <th className="py-2 px-4 border">Price</th>
            <th className="py-2 px-4 border">Sale Price</th>
            <th className="py-2 px-4 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {combinations.map((combo, idx) => {
            const totalPrice = salePrice
              ? Number(salePrice) + Number(combo.priceAddition || 0)
              : Number(price) + Number(combo.priceAddition || 0);
            return (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-2 px-4 border">{combo.size.label}</td>
                <td className="py-2 px-4 border">{combo.color.label}</td>
                <td className="py-2 px-4 border">
                  <input
                    type="number"
                    value={combo.priceAddition || 0}
                    onChange={(e) => handlePriceChange(idx, e.target.value)}
                    className="border rounded-md p-1 w-20"
                    min="0"
                  />
                </td>
                <td className="py-2 px-4 border">{totalPrice.toFixed(2)}</td>
                <td className="py-2 px-4 border text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveVariation(idx)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <AiOutlineDelete />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </GlobalTable>
    </div>
  );
};

export default VariationsList;

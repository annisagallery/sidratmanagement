import React from 'react';
import PropTypes from 'prop-types';
import ShippingChargeForm from '../../forms/shippingcharge';
// components

EditShippingCharge.propTypes = {
  data: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired
};

export default function EditShippingCharge({ data, isLoading }) {
  return (
    <div>
      <ShippingChargeForm data={data} isLoading={isLoading} />
    </div>
  );
}

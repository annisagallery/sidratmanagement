'use client';
import React from 'react';
import PropTypes from 'prop-types';
import { ClipLoader } from 'react-spinners';

const DashboardCard = ({ color = 'bg-primary', title, value, icon, isAmount = false, isLoading = false }) => {
  // Function to format the value as currency if isAmount is true
  const formatValue = (val) => {
    if (isAmount && typeof val === 'number') {
      return val.toLocaleString('en-US', {
        style: 'currency',
        currency: 'BDT'
      });
    }
    return val;
  };

  return (
    <div className="flex items-center p-4 bg-white  rounded-md border border-yellow-500">
      {/* Icon Section */}
      <div className={`p-3 rounded-md ${color} bg-opacity-20`}>{icon}</div>

      {/* Content Section */}
      <div className="ml-4 flex-1">
        <p className="text-sm text-gray-500">{title}</p>
        {isLoading ? (
          <div className="flex items-center mt-2">
            <ClipLoader size={20} color="#4A90E2" />
            <span className="ml-2 text-lg font-semibold text-gray-700">Loading...</span>
          </div>
        ) : (
          <p className="mt-2 text-xl font-semibold text-gray-900">{formatValue(value)}</p>
        )}
      </div>
    </div>
  );
};

// PropTypes for type checking
DashboardCard.propTypes = {
  color: PropTypes.string,
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  icon: PropTypes.element.isRequired,
  isAmount: PropTypes.bool,
  isLoading: PropTypes.bool
};

export default DashboardCard;

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import moment from 'moment';

// ----------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const isNumeric = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

const getAlignmentClass = (align) => {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'left':
    default:
      return 'text-left';
  }
};

const getFlexJustifyClass = (align) => {
  switch (align) {
    case 'center':
      return 'justify-center';
    case 'right':
      return 'justify-end';
    case 'left':
    default:
      return 'justify-start';
  }
};

const formatDateDDMMYYYY = (dateValue) => {
  const m = moment(dateValue);
  if (!m.isValid()) return dateValue;
  return m.format('DD/MM/YYYY hh:mm A');
};

// NEW: Helper to transform text based on casing prop
const applyTextCasing = (text, casing) => {
  if (!text) return '';
  const str = String(text);
  switch (casing) {
    case 'uppercase':
      return str.toUpperCase();
    case 'lowercase':
      return str.toLowerCase();
    case 'capitalize':
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    default:
      return str;
  }
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const DataTable = ({
  columns,
  data,
  isLoading,
  totalItems,
  filters = [],
  buttons = [],
  isSearch = false,
  limitOptions = [10, 20, 50],
  pdfReport = false,
  excelReport = false,
  reportColumns = []
}) => {
  const searchParams = useSearchParams();
  const [sortField, setSortField] = useState(searchParams.get('sortField') || '');
  const [sortDirection, setSortDirection] = useState(searchParams.get('sortDirection') || 'asc');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || 1, 10));

  // --- Logic for updates and sums remains same ---
  const updateSearchParams = (field, value) => {
    const params = new URLSearchParams(window.location.search);
    params.set(field, value);
    if (field !== 'page') params.set('page', 1);
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  const handleFieldChange = (field, value) => updateSearchParams(field, value);

  const calculateSums = () => {
    const sums = {};
    data?.forEach((row) => {
      columns.forEach((column) => {
        if (column.total) {
          const value = getNestedValue(row, column.id);
          if (isNumeric(value)) {
            sums[column.id] = (sums[column.id] || 0) + parseFloat(value);
          }
        }
      });
    });
    return sums;
  };
  const sums = calculateSums();

  const handleSort = (column) => {
    const newDirection = sortField === column.id && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(column.id);
    setSortDirection(newDirection);
    updateSearchParams('sortField', column.id);
    updateSearchParams('sortDirection', newDirection);
  };

  const totalPages = Math.ceil(totalItems / parseInt(searchParams.get('limit') || '10', 10));

  // Export placeholders
  const handlePdfExport = () => alert('PDF Export triggered!');
  const handleExcelExport = () => alert('Excel Export triggered!');

  return (
    <div className="bg-white p-3 border rounded-md shadow-sm">
      {/* Top Bar (Search, Filters, Buttons) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {isSearch && (
            <input
              type="text"
              placeholder="Search..."
              onChange={(e) => handleFieldChange('search', e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {filters.map((filter, index) => (
            <select
              key={index}
              onChange={(e) => handleFieldChange(filter.label.toLowerCase(), e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All {filter.label}</option>
              {filter?.options?.map((option, idx) => (
                <option key={idx} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
          {buttons?.map((button, index) => (
            <button
              key={index}
              onClick={button.onClick}
              className="border border-green-500 bg-green-500 text-white text-sm px-3 py-1 rounded-md hover:bg-green-600 transition"
            >
              {button.label}
            </button>
          ))}
          {pdfReport && (
            <button
              onClick={handlePdfExport}
              className="border border-blue-500 bg-blue-500 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-600 transition"
            >
              Export PDF
            </button>
          )}
          {excelReport && (
            <button
              onClick={handleExcelExport}
              className="border border-blue-500 bg-blue-500 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-600 transition"
            >
              Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              {columns?.map((column) => (
                <th
                  key={column.id}
                  className={`px-3 py-2 border-b cursor-pointer select-none ${getAlignmentClass(column.align)}`}
                  style={{ width: column.width ? `${column.width}%` : 'auto' }}
                  onClick={() => column.sortable && handleSort(column)}
                >
                  <div className={`flex items-center space-x-1 ${getFlexJustifyClass(column.align)}`}>
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="text-xs">
                        {sortField === column.id ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns?.length} className="text-center py-3">
                  Loading...
                </td>
              </tr>
            ) : data.length < 1 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-3">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {columns.map((column) => {
                    const rawValue = getNestedValue(row, column.id);

                    // 1. Handle Date
                    let displayValue = rawValue;
                    if (column.isDate && rawValue) {
                      displayValue = formatDateDDMMYYYY(rawValue);
                    } else if (column.casing && typeof rawValue === 'string') {
                      // 2. Handle Text Casing for normal text
                      displayValue = applyTextCasing(rawValue, column.casing);
                    }

                    return (
                      <td
                        key={column.id}
                        className={`${column.className || ''} px-3 py-2 border-b relative ${getAlignmentClass(column.align)}`}
                      >
                        {/* A. IMAGE */}
                        {column.image ? (
                          <div className="w-12 h-12 relative">
                            <Image
                              src={rawValue || '/placeholder.svg'}
                              alt={rawValue || 'Image'}
                              fill
                              className="rounded-md object-cover"
                            />
                          </div>
                        ) : // B. ACTIONS
                        column.actions?.length ? (
                          <div className="flex space-x-1 items-center justify-center">
                            {column.actions.map((action, actionIndex) => (
                              <button
                                key={actionIndex}
                                onClick={() => action.onClick(row)}
                                className="bg-blue-500 text-white text-xs px-2 py-1 rounded-md hover:bg-blue-600 transition"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : // C. STATUS (With Custom Config)
                        column.statusConfig ? (
                          (() => {
                            // Find config for this specific value, or fallback to 'default'
                            const config = column.statusConfig[rawValue] || column.statusConfig['default'];
                            // Apply Casing to the status text
                            const statusText = applyTextCasing(rawValue, column.casing);

                            if (config) {
                              return (
                                <span
                                  className="px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap"
                                  style={{
                                    backgroundColor: config.bg,
                                    color: config.color,
                                    border: `1px solid ${config.color}30` // Optional: adding transparency for border
                                  }}
                                >
                                  {statusText}
                                </span>
                              );
                            }
                            // Fallback if no config found but statusConfig prop exists
                            return <span>{statusText}</span>;
                          })()
                        ) : // D. BOOLEAN
                        typeof rawValue === 'boolean' ? (
                          rawValue ? (
                            <span className="text-green-600 font-semibold">Yes</span>
                          ) : (
                            <span className="text-red-600 font-semibold">No</span>
                          )
                        ) : (
                          // E. DEFAULT
                          displayValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {/* Footer Sums */}
          {Object.keys(sums).length > 0 && (
            <tfoot>
              <tr className="bg-gray-100">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-3 py-2 border-t font-semibold text-sm ${getAlignmentClass(column.align)}`}
                  >
                    {column.total && isNumeric(sums?.[column.id]) ? sums[column.id].toFixed(2) : null}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination (Same as before) */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-3 border-t pt-3">
        <div className="flex items-center space-x-2">
          <label htmlFor="limit" className="text-sm">
            Rows:
          </label>
          <select
            id="limit"
            onChange={(e) => handleFieldChange('limit', e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            {limitOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
          <button
            onClick={() => {
              const newPage = Math.max(currentPage - 1, 1);
              setCurrentPage(newPage);
              handleFieldChange('page', newPage);
            }}
            disabled={currentPage <= 1}
            className="border px-2 py-1 rounded-md text-sm disabled:bg-gray-200"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => {
              const newPage = Math.min(currentPage + 1, totalPages);
              setCurrentPage(newPage);
              handleFieldChange('page', newPage);
            }}
            disabled={currentPage >= totalPages}
            className="border px-2 py-1 rounded-md text-sm disabled:bg-gray-200"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;

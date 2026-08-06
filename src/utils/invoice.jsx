import React from 'react';
import { format } from 'date-fns';
import Image from 'next/image';

import logo from '@/public/logofull.png';

export default function Invoice({ order }) {
  const {
    orderNo = '',
    createdAt = new Date(),
    status = '',
    shippingAddress = {},
    items = [],
    subTotal = 0,
    shipping = 0,
    discount = 0,
    total = 0
  } = order || {};

  // Status color mapping
  const getStatusColor = () => {
    switch (status) {
      case 'Delivered':
        return { background: '#dcfce7', color: '#166534' };
      case 'Pending':
        return { background: '#fef9c3', color: '#854d0e' };
      default:
        return { background: '#dbeafe', color: '#1e40af' };
    }
  };

  const statusStyle = getStatusColor();

  return (
    <div
      style={{
        width: '21cm',
        minHeight: '29.7cm',
        margin: '0 auto',
        padding: '25px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        backgroundColor: 'white',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header Section */}
      <header style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ width: '300px' }}>
            <Image src={logo} alt="Logo" className="h-auto w-full" />
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1
              style={{
                margin: '0',
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#374151',
                fontStyle: 'italic'
              }}
            >
              INVOICE
            </h1>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #d1d5db'
          }}
        >
          <div>
            <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Invoice No:</p>
            <p style={{ margin: '0', color: '#4b5563' }}>{orderNo}</p>
          </div>
          <div>
            <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Order Date:</p>
            <p style={{ margin: '0', color: '#4b5563' }}>{format(new Date(createdAt), 'dd/MM/yyyy')}</p>
          </div>
          <div>
            <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Invoice Date:</p>
            <p style={{ margin: '0', color: '#4b5563' }}>{format(new Date(), 'dd/MM/yyyy')}</p>
          </div>
        </div>
      </header>

      {/* Shipping Address */}
      <section style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontWeight: 'bold',
            fontSize: '14px',
            margin: '0 0 8px 0',
            paddingBottom: '4px',
            borderBottom: '1px solid #d1d5db'
          }}
        >
          SHIPPING ADDRESS
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '8px'
          }}
        >
          <div>
            <p style={{ margin: '0 0 4px 0' }}>
              <span style={{ fontWeight: '600' }}>Name:</span> {shippingAddress.name}
            </p>
            <p style={{ margin: '0' }}>
              <span style={{ fontWeight: '600' }}>Phone:</span> {shippingAddress.phone}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0' }}>
              <span style={{ fontWeight: '600' }}>City:</span>{' '}
              {shippingAddress.district || shippingAddress.city?.city_name || shippingAddress.city}
            </p>
            <p style={{ margin: '0' }}>
              <span style={{ fontWeight: '600' }}>Zone:</span>{' '}
              {shippingAddress.upazila || shippingAddress.zone?.zone_name || shippingAddress.zone}
            </p>
          </div>
        </div>
        <p style={{ margin: '0' }}>
          <span style={{ fontWeight: '600' }}>Address:</span> {shippingAddress.address}
        </p>
      </section>

      {/* Items Table */}
      <section style={{ flexGrow: 1, marginBottom: '24px' }}>
        <h2
          style={{
            fontWeight: 'bold',
            fontSize: '14px',
            margin: '0 0 8px 0',
            paddingBottom: '4px',
            borderBottom: '1px solid #d1d5db'
          }}
        >
          ORDER ITEMS
        </h2>
        <table
          style={{
            width: '100%',
            fontSize: '12px',
            borderCollapse: 'collapse',
            border: '1px solid #e5e7eb'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th
                style={{
                  padding: '4px',
                  border: '1px solid #e5e7eb',
                  textAlign: 'center',
                  width: '40px'
                }}
              >
                #
              </th>
              <th
                style={{
                  padding: '4px',
                  border: '1px solid #e5e7eb',
                  textAlign: 'left'
                }}
              >
                Item Description
              </th>
              <th
                style={{
                  padding: '4px',
                  border: '1px solid #e5e7eb',
                  textAlign: 'right',
                  width: '70px'
                }}
              >
                Price (৳)
              </th>
              <th
                style={{
                  padding: '4px',
                  border: '1px solid #e5e7eb',
                  textAlign: 'right',
                  width: '120px'
                }}
              >
                Customization (৳)
              </th>
              <th
                style={{
                  padding: '4px',
                  border: '1px solid #e5e7eb',
                  textAlign: 'right',
                  width: '80px'
                }}
              >
                Total (৳)
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const price = item.discountPrice || item.regularPrice;
              const customizePrice = item.customizePrice || 0;
              const itemTotal = price + customizePrice;

              return (
                <tr key={index}>
                  <td
                    style={{
                      padding: '4px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center'
                    }}
                  >
                    {index + 1}
                  </td>
                  <td
                    style={{
                      padding: '4px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    {item.pid?.name}
                    <p style={{ fontSize: '10px', marginTop: 2 }}>
                      {(item.attributes || []).map((a, i) => (
                        <span key={i} style={{ marginRight: 6 }}>
                          {a.attributeName}: {a.valueName}
                          {i < (item.attributes.length - 1) ? ' |' : ''}
                        </span>
                      ))}
                      {(!item.attributes || item.attributes.length === 0) && 'N/A'}
                    </p>
                    {item.note && (
                      <p
                        style={{
                          fontSize: '10px'
                        }}
                      >
                        Note: {item.note}
                      </p>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '4px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'right'
                    }}
                  >
                    {price.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '4px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'right'
                    }}
                  >
                    {customizePrice.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '4px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'right',
                      fontWeight: '500'
                    }}
                  >
                    {itemTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Summary Section */}
      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '250px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0'
              }}
            >
              <span style={{ fontWeight: '600' }}>Subtotal:</span>
              <span>৳ {subTotal.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0'
              }}
            >
              <span style={{ fontWeight: '600' }}>Shipping:</span>
              <span>৳ {shipping.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0'
              }}
            >
              <span style={{ fontWeight: '600' }}>Discount:</span>
              <span style={{ color: '#dc2626' }}>-৳ {discount.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                marginTop: '4px',
                borderTop: '1px solid #d1d5db'
              }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Total:</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>৳ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Terms & Conditions */}
      <section style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontWeight: 'bold',
            fontSize: '14px',
            margin: '0 0 8px 0',
            paddingBottom: '4px',
            borderBottom: '1px solid #d1d5db'
          }}
        >
          TERMS AND CONDITIONS
        </h2>
        <ul
          style={{
            listStyleType: 'disc',
            paddingLeft: '20px',
            fontSize: '13px',
            margin: '0'
          }}
        >
          <li style={{ marginBottom: '4px' }}>
            Items cannot be returned after purchase. Exchanges allowed within five (5) days
          </li>
          <li style={{ marginBottom: '4px' }}>Original receipt must be presented for exchanges</li>
          <li style={{ marginBottom: '4px' }}>Exchange must be same or higher value</li>
          <li>Check products at time of purchase - not responsible after leaving store</li>
        </ul>
      </section>

      {/* Footer - Fixed at bottom */}
      <footer style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #d1d5db' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '32px',
            marginBottom: '24px'
          }}
        >
          <div>
            <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>OUR BRANCHES</h3>
            <p style={{ margin: '0 0 2px 0', fontSize: '13px' }}>Branch 1: 123 Main Street, City</p>
            <p style={{ margin: '0', fontSize: '13px' }}>Branch 2: 456 Another Road, City</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '4px', height: '20px' }}>_____________________</div>
              <p style={{ margin: '0', fontSize: '13px' }}>Customer Signature</p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '4px', height: '20px' }}>_____________________</div>
              <p style={{ margin: '0', fontSize: '13px' }}>Branch Manager Signature</p>
            </div>
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '13px'
          }}
        >
          <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>
            www.sidratbd.com | facebook.com/sidratbd | instagram.com/sidratbd
          </p>
          <p style={{ margin: '0' }}>Hotline: 01306-535650, 01849992094</p>
        </div>
      </footer>
    </div>
  );
}

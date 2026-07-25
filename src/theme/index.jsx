'use client';
import PropTypes from 'prop-types';

ThemeRegistry.propTypes = { children: PropTypes.node.isRequired };

export default function ThemeRegistry({ children }) {
  return children;
}

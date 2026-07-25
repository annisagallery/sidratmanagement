// icons
import { IoIosRemove } from 'react-icons/io';
import { IoIosAdd } from 'react-icons/io';
import PropTypes from 'prop-types';

function Incrementer({ ...props }) {
  const { available, quantity, onIncrease, onDecrease } = props;

  return (
    <div className="w-24 mb-0">
      <div className="flex items-center justify-between p-1">
        <button
          onClick={onDecrease}
          disabled={quantity <= 1}
          className="w-6 h-6 bg-blue-500 text-white flex items-center justify-center rounded-md disabled:bg-gray-300"
        >
          <IoIosRemove size={16} />
        </button>
        <span>{quantity}</span>
        <button
          onClick={onIncrease}
          disabled={quantity >= available}
          className="w-6 h-6 bg-blue-500 text-white flex items-center justify-center rounded-md disabled:bg-gray-300"
        >
          <IoIosAdd size={16} />
        </button>
      </div>
      <p className="text-xs text-gray-500">Available: {available}</p>
    </div>
  );
}

export default Incrementer;

Incrementer.propTypes = {
  available: PropTypes.number.isRequired,
  quantity: PropTypes.number.isRequired,
  onIncrease: PropTypes.func.isRequired,
  onDecrease: PropTypes.func.isRequired
};

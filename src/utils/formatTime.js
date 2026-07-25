import moment from 'moment';

// ----------------------------------------------------------------------

export function fDate(date) {
  return moment(date).format('DD/MM/YYYY');
}

export function fDateShortMonth(date) {
  return moment(date).format('DD/MM/YYYY');
}

export function fDateShort(date) {
  return moment(date).format('DD/MM/YYYY');
}

export function fDateTime(date) {
  return moment(date).format('DD/MM/YYYY HH:mm');
}

export function fTimestamp(date) {
  return moment(date).valueOf(); // Returns timestamp in milliseconds
}

export function fDateTimeSuffix(date) {
  return moment(date).format('DD/MM/YYYY hh:mm A');
}

export function fToNow(date) {
  return moment(date).fromNow();
}

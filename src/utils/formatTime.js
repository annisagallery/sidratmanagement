import moment from 'moment';
import { BDDate } from './bdTime';

// ----------------------------------------------------------------------

export function fDate(date) {
  return moment(new BDDate(date)).utcOffset(360).format('DD/MM/YYYY');
}

export function fDateShortMonth(date) {
  return moment(new BDDate(date)).utcOffset(360).format('DD/MM/YYYY');
}

export function fDateShort(date) {
  return moment(new BDDate(date)).utcOffset(360).format('DD/MM/YYYY');
}

export function fDateTime(date) {
  return moment(new BDDate(date)).utcOffset(360).format('DD/MM/YYYY HH:mm');
}

export function fTimestamp(date) {
  return new BDDate(date).getTime();
}

export function fDateTimeSuffix(date) {
  return moment(new BDDate(date)).utcOffset(360).format('DD/MM/YYYY hh:mm A');
}

export function fToNow(date) {
  return moment(new BDDate(date)).fromNow();
}

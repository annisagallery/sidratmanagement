import { allDistricts, upazilaNamesOf, thanaNamesOf } from '@bangladeshi/bangladesh-address/build/src';

export const districts = allDistricts();

export function upazilasForDistrict(district) {
  if (!district || district === 'ALL') return [];
  const upazilas = upazilaNamesOf(district) || [];
  const thanas = thanaNamesOf(district) || [];
  return Array.from(new Set([...upazilas, ...thanas])).sort((a, b) => a.localeCompare(b));
}

export function addressDistrict(address = {}) {
  return address.district || address.city || address.city_name || '';
}

export function addressUpazila(address = {}) {
  return address.upazila || address.zone || address.zone_name || '';
}

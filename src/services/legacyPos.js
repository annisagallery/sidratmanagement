/**
 * Old POS bridge — TEMPORARY, deleted with the migration page.
 *
 * Kept out of services/index.js on purpose: when the old POS is switched off,
 * this whole file goes, and nothing that stays behind has to be edited.
 * The API side lives in postgressserver/src/legacy-pos/.
 */

import http from './http';

const BASE = '/admin/legacy-pos';

const scopedParams = (params = {}) => {
  const { warehouseIds, ...rest } = params;
  return warehouseIds?.length ? { ...rest, warehouseIds: warehouseIds.join(',') } : rest;
};

export const getLegacyPosStatus = async (params = {}) =>
  (await http.get(`${BASE}/status`, { params: scopedParams(params) })).data;

export const getLegacyPosBranches = async () => (await http.get(`${BASE}/branches`)).data;

export const getLegacyPosProducts = async (params = {}) =>
  (await http.get(`${BASE}/products`, { params: scopedParams(params) })).data;

export const getLegacyPosStock = async (params = {}) =>
  (await http.get(`${BASE}/stock`, { params: scopedParams(params) })).data;

/**
 * Starts a job and returns straight away; poll the run for the report.
 * `warehouseIds` is the page-level showroom scope for either job.
 * `scopeLabel` is only so the run reads properly before its report lands.
 */
export const startLegacyPosRun = async ({ job, mode, warehouseIds, scopeLabel }) =>
  (await http.post(`${BASE}/runs`, { job, mode, warehouseIds, scopeLabel })).data;

export const getLegacyPosRuns = async () => (await http.get(`${BASE}/runs`)).data;

export const getLegacyPosRun = async (id) => (await http.get(`${BASE}/runs/${id}`)).data;

/**
 * Old POS bridge — TEMPORARY, deleted with the migration page.
 *
 * Kept out of services/index.js on purpose: when the old POS is switched off,
 * this whole file goes, and nothing that stays behind has to be edited.
 * The API side lives in postgressserver/src/legacy-pos/.
 */

import http from './http';

const BASE = '/admin/legacy-pos';

export const getLegacyPosStatus = async () => (await http.get(`${BASE}/status`)).data;

export const getLegacyPosBranches = async () => (await http.get(`${BASE}/branches`)).data;

export const getLegacyPosProducts = async (params = {}) => (await http.get(`${BASE}/products`, { params })).data;

export const getLegacyPosStock = async (params = {}) => (await http.get(`${BASE}/stock`, { params })).data;

/**
 * Starts a job and returns straight away; poll the run for the report.
 * `warehouseId` scopes a stock sync to one showroom; omit it for all of them.
 * `warehouseName` is only so the run reads properly before its report lands.
 */
export const startLegacyPosRun = async ({ job, mode, warehouseId = null, warehouseName = null }) =>
  (await http.post(`${BASE}/runs`, { job, mode, warehouseId, warehouseName })).data;

export const getLegacyPosRuns = async () => (await http.get(`${BASE}/runs`)).data;

export const getLegacyPosRun = async (id) => (await http.get(`${BASE}/runs/${id}`)).data;

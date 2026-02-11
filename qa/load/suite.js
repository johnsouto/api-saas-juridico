import { getTargetBaseUrl, getProfileOptions, getCreds, login, listClients, listProcesses, exportOverviewXlsx, pace } from "./lib.js";

const baseUrl = getTargetBaseUrl();
const creds = getCreds(baseUrl);

export const options = getProfileOptions();

export default function () {
  login(baseUrl, creds.email, creds.password);
  pace();
  listClients(baseUrl);
  pace();
  listProcesses(baseUrl);
  pace();
  exportOverviewXlsx(baseUrl);
  pace();
}


import { getTargetBaseUrl, getProfileOptions, getCreds, login, uploadSmallDocument, pace } from "./lib.js";

const baseUrl = getTargetBaseUrl();
const creds = getCreds(baseUrl);

export const options = getProfileOptions();

export default function () {
  login(baseUrl, creds.email, creds.password);
  pace();
  uploadSmallDocument(baseUrl);
  pace();
}

